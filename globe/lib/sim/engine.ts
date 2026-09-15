/**
 * Deterministic simulation of one purse-seiner + a flight of Allswell VTOL delta wings.
 *
 * `advance(state, dt)` is a pure function of (state, dt): the PRNG state lives inside
 * `SimState`, so React StrictMode's double-invoked updaters produce identical results,
 * and a fixed seed replays the same scenario on every load.
 *
 * Until the real drone data-link is wired in, this stands in for the telemetry +
 * detection feed. The shapes it produces are the same ones the live feed will emit.
 */
import { angleDelta, moveAlong, normDeg, offsetNm, rangeBearing } from "../geo";
import type {
  Detection,
  DetectionKind,
  Drone,
  GeoPoint,
  SimState,
  Snapshot,
  Species,
  SurfaceActivity,
  Vessel,
  Waypoint,
} from "../types";
import { Rng } from "./rng";

export const SIM = {
  /** 2 m delta wing: cruise + spotting altitude */
  droneCruiseKts: 48,
  droneAltM: 400,
  climbRateMps: 3.5,
  /** Effective detection swath (oblique EO camera scanning both sides), nm */
  swathNm: 1.2,
  enduranceMin: 210,
  rtbBatteryPct: 22,
  turnaroundMin: 14,
  maxAirborne: 2,
  turnRateDegPerSec: 22,
  trackIntervalSec: 20,
  trackMaxAgeMs: 110 * 60_000,
  detectionPruneMs: 6 * 3600_000,
  /** Poisson event rates per airborne drone, events / second */
  rateSchool: 1 / (15 * 60),
  rateBirds: 1 / (34 * 60),
  rateFloating: 1 / (50 * 60),
  /** Camera model used for the snapshot bounding boxes */
  frameW: 1920,
  frameH: 1080,
  hfovDeg: 68,
  /** History replayed on load so the screen opens populated */
  historyMs: 3 * 3600_000,
  historyStepSec: 20,
} as const;

const SPECIES_WEIGHTS: readonly (readonly [Species, number])[] = [
  ["skipjack", 0.5],
  ["yellowfin", 0.2],
  ["mixed", 0.14],
  ["unknown", 0.1],
  ["bigeye", 0.06],
];

const ACTIVITY_WEIGHTS: readonly (readonly [SurfaceActivity, number])[] = [
  ["breezer", 0.32],
  ["boiler", 0.22],
  ["shadow", 0.2],
  ["foamer", 0.14],
  ["jumper", 0.12],
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Offset from `origin` by (along, cross) nm in a frame aligned to `headingDeg`. +cross = starboard. */
function bodyOffset(origin: GeoPoint, headingDeg: number, along: number, cross: number): GeoPoint {
  const h = (headingDeg * Math.PI) / 180;
  const east = along * Math.sin(h) + cross * Math.cos(h);
  const north = along * Math.cos(h) - cross * Math.sin(h);
  return offsetNm(origin, east, north);
}

/**
 * Creeping-line ("lawnmower") search box ahead of the vessel on one side of her track.
 * ~100 nm of legs — sized to a single battery.
 */
function planSearch(vessel: Vessel, sector: -1 | 1, rng: Rng): Waypoint[] {
  const along0 = 5 + rng.range(-1, 1);
  const along1 = 21;
  const cross0 = 1.5;
  const cross1 = 13 + rng.range(-1.5, 1.5);
  const spacing = 2.6;
  const wps: Waypoint[] = [];
  let flip = rng.chance(0.5);
  for (let a = along0; a <= along1; a += spacing) {
    const c0 = flip ? cross1 : cross0;
    const c1 = flip ? cross0 : cross1;
    wps.push(bodyOffset(vessel.position, vessel.headingDeg, a, sector * c0));
    wps.push(bodyOffset(vessel.position, vessel.headingDeg, a, sector * c1));
    flip = !flip;
  }
  return wps;
}

function makeSnapshot(rng: Rng, kind: DetectionKind, radiusM: number, drone: Drone): Snapshot {
  const W = SIM.frameW;
  const H = SIM.frameH;
  const alt = Math.max(120, drone.altitudeM);
  const gsdM = (2 * alt * Math.tan((SIM.hfovDeg * Math.PI) / 360)) / W;
  const diamPx =
    kind === "school" ? (2 * radiusM) / gsdM : kind === "birds" ? rng.range(320, 720) : rng.range(110, 260);
  const w = clamp(diamPx / W, 0.06, 0.62);
  const elong = kind === "school" ? rng.range(0.5, 1) : rng.range(0.8, 1.1);
  const h = clamp(w * (W / H) * elong, 0.06, 0.72);
  const x = clamp(0.5 + rng.gauss(0, 0.09) - w / 2, 0.03, 0.97 - w);
  const y = clamp(0.5 + rng.gauss(0, 0.07) - h / 2, 0.05, 0.95 - h);
  return {
    width: W,
    height: H,
    bbox: { x, y, w, h },
    altitudeM: Math.round(alt),
    cameraHeadingDeg: Math.round(drone.headingDeg),
    gsdM,
  };
}

interface SpawnOpts {
  position?: GeoPoint;
  species?: Species;
  radiusM?: number;
  rescanOf?: string;
  capturedAt?: number;
}

function spawnDetection(
  state: SimState,
  rng: Rng,
  drone: Drone,
  kind: DetectionKind,
  opts: SpawnOpts = {},
): Detection {
  const id = `D${state.seq.toString().padStart(4, "0")}`;
  const position =
    opts.position ??
    bodyOffset(drone.position, drone.headingDeg, rng.range(0.1, 0.7), rng.gauss(0, drone.swathNm / 4));

  let species: Species = "unknown";
  let radiusM = 0;
  let estTonnes = 0;
  let confidence: number;
  let birdCount = 0;
  const activity = rng.weighted(ACTIVITY_WEIGHTS);

  if (kind === "school") {
    species = opts.species ?? rng.weighted(SPECIES_WEIGHTS);
    radiusM = Math.round(opts.radiusM ?? clamp(rng.logNormal(55, 0.5), 18, 240));
    // crude biomass: surface area × density factor, ±30%
    estTonnes = Math.max(5, Math.round((Math.PI * radiusM * radiusM * 0.0025 * rng.range(0.7, 1.3)) / 5) * 5);
    confidence =
      species === "unknown" ? rng.range(0.42, 0.64) : clamp(rng.gauss(0.8, 0.1), 0.5, 0.98);
    if (opts.rescanOf) confidence = clamp(confidence + 0.06, 0.5, 0.99);
    birdCount = rng.chance(0.55) ? rng.int(4, 90) : 0;
  } else if (kind === "birds") {
    confidence = rng.range(0.7, 0.96);
    birdCount = rng.int(25, 260);
  } else {
    confidence = rng.range(0.78, 0.97);
  }

  return {
    id,
    kind,
    position,
    capturedAt: opts.capturedAt ?? state.now,
    droneId: drone.id,
    radiusM,
    estTonnes,
    species,
    confidence,
    activity,
    birdCount,
    status: "new",
    snapshot: makeSnapshot(rng, kind, radiusM, drone),
    rescanOf: opts.rescanOf,
  };
}

function linkQuality(rangeNm: number, rng: Rng): number {
  const base = rangeNm < 8 ? 1 : 1 - (rangeNm - 8) / 60;
  return clamp(base + rng.gauss(0, 0.03), 0.3, 1);
}

interface StepCtx {
  state: SimState;
  rng: Rng;
  dt: number;
  airborneCount: number;
  occupiedSectors: Set<number>;
  spawned: Detection[];
  rescanned: Set<string>;
}

function flyToward(d: Drone, target: GeoPoint, dt: number): { drone: Drone; arrived: boolean } {
  const { rangeNm, bearingDeg } = rangeBearing(d.position, target);
  const maxTurn = SIM.turnRateDegPerSec * dt;
  const heading = normDeg(d.headingDeg + clamp(angleDelta(d.headingDeg, bearingDeg), -maxTurn, maxTurn));
  const stepNm = (d.speedKts * dt) / 3600;
  const arriveNm = Math.max(0.35, stepNm * 1.15);
  const position = moveAlong(d.position, heading, Math.min(stepNm, rangeNm));
  return { drone: { ...d, headingDeg: heading, position }, arrived: rangeNm <= arriveNm };
}

function appendTrack(d: Drone, now: number): Drone {
  const last = d.track[d.track.length - 1];
  if (last && now - last.t < SIM.trackIntervalSec * 1000) return d;
  const cutoff = now - SIM.trackMaxAgeMs;
  const track = d.track.filter((p) => p.t >= cutoff);
  track.push({ lat: d.position.lat, lon: d.position.lon, t: now });
  return { ...d, track };
}

function stepDrone(d0: Drone, ctx: StepCtx): Drone {
  const { state, rng, dt } = ctx;
  const { vessel, now } = state;
  let d: Drone = { ...d0 };

  switch (d.status) {
    case "deck": {
      d.position = vessel.position;
      d.headingDeg = vessel.headingDeg;
      d.speedKts = vessel.speedKts;
      d.altitudeM = 0;
      // charge toward 100% across the turnaround window
      d.batteryPct = clamp(d.batteryPct + (100 / SIM.turnaroundMin) * (dt / 60) * 1.2, 0, 100);
      d.link = 1;
      if (now >= d.readyAt && ctx.airborneCount < SIM.maxAirborne) {
        const sector: -1 | 1 = ctx.occupiedSectors.has(-1) ? 1 : ctx.occupiedSectors.has(1) ? -1 : d.sector;
        ctx.occupiedSectors.add(sector);
        ctx.airborneCount += 1;
        d = {
          ...d,
          status: "launching",
          sector,
          waypoints: planSearch(vessel, sector, rng),
          waypointIndex: 0,
          launchedAt: now,
          // launches with whatever charge she has (the opening scene staggers sorties this way)
          batteryPct: d.batteryPct,
          sortieDetections: 0,
          track: [],
        };
      }
      return d;
    }

    case "launching": {
      d.altitudeM = Math.min(SIM.droneAltM, d.altitudeM + SIM.climbRateMps * dt);
      d.speedKts = clamp(d.speedKts + 8 * dt, 0, SIM.droneCruiseKts);
      const r = flyToward(d, d.waypoints[0], dt);
      d = r.drone;
      d.batteryPct = clamp(d.batteryPct - (100 / SIM.enduranceMin) * (dt / 60) * 1.6, 0, 100);
      if (d.altitudeM >= SIM.droneAltM - 1) d.status = "airborne";
      return appendTrack(d, now);
    }

    case "airborne": {
      d.speedKts = SIM.droneCruiseKts + rng.gauss(0, 0.6);
      d.altitudeM = SIM.droneAltM + rng.gauss(0, 2);
      d.batteryPct = clamp(d.batteryPct - (100 / SIM.enduranceMin) * (dt / 60), 0, 100);
      d.link = linkQuality(rangeBearing(vessel.position, d.position).rangeNm, rng);

      if (d.batteryPct <= SIM.rtbBatteryPct) {
        d.status = "returning";
        return appendTrack(d, now);
      }

      const target = d.waypoints[d.waypointIndex];
      const r = flyToward(d, target, dt);
      d = r.drone;
      if (r.arrived) {
        if (target.rescanOf) ctx.rescanned.add(target.rescanOf);
        d.waypointIndex += 1;
        if (d.waypointIndex >= d.waypoints.length) {
          d.waypoints = planSearch(vessel, d.sector, rng);
          d.waypointIndex = 0;
        }
      }

      // Poisson detection events along the swath
      for (const [kind, rate] of [
        ["school", SIM.rateSchool],
        ["birds", SIM.rateBirds],
        ["floating", SIM.rateFloating],
      ] as const) {
        if (rng.chance(1 - Math.exp(-rate * dt))) {
          const det = spawnDetection(state, rng, d, kind);
          state.seq += 1;
          ctx.spawned.push(det);
          d.sortieDetections += 1;
        }
      }
      return appendTrack(d, now);
    }

    case "returning": {
      d.speedKts = SIM.droneCruiseKts + 4;
      d.batteryPct = clamp(d.batteryPct - (100 / SIM.enduranceMin) * (dt / 60), 0, 100);
      d.link = linkQuality(rangeBearing(vessel.position, d.position).rangeNm, rng);
      const r = flyToward(d, vessel.position, dt);
      d = r.drone;
      const dist = rangeBearing(d.position, vessel.position).rangeNm;
      if (dist < 1.5) d.altitudeM = Math.max(30, SIM.droneAltM * (dist / 1.5));
      if (r.arrived || dist < 0.2) {
        d = {
          ...d,
          status: "deck",
          altitudeM: 0,
          speedKts: vessel.speedKts,
          position: vessel.position,
          readyAt: now + SIM.turnaroundMin * 60_000,
          waypoints: [],
          waypointIndex: 0,
        };
      }
      return appendTrack(d, now);
    }
  }
}

function stepVessel(v: Vessel, dt: number, now: number, meta: ScenarioMeta): Vessel {
  // gentle 25-minute yaw wander so the plot visibly re-projects; anchored to scenario
  // start so the whole run is a pure function of the seed (same scene on every load)
  const wander = 3 * Math.sin((2 * Math.PI * (now - meta.startedAt)) / (25 * 60_000));
  const headingDeg = normDeg(meta.baseHeading + wander);
  return {
    ...v,
    headingDeg,
    position: moveAlong(v.position, headingDeg, (v.speedKts * dt) / 3600),
  };
}

export interface ScenarioMeta {
  baseHeading: number;
  /** Epoch ms of the start of the replayed history */
  startedAt: number;
}

export function advance(prev: SimState, dtSec: number, meta: ScenarioMeta): SimState {
  const rng = new Rng(prev.rng);
  const now = prev.now + dtSec * 1000;
  // Work on a shallow copy; nested objects are replaced, never mutated.
  const state: SimState = { ...prev, now, detections: prev.detections.slice() };
  state.vessel = stepVessel(prev.vessel, dtSec, now, meta);

  const ctx: StepCtx = {
    state,
    rng,
    dt: dtSec,
    airborneCount: prev.drones.filter((d) => d.status !== "deck").length,
    occupiedSectors: new Set(prev.drones.filter((d) => d.status !== "deck").map((d) => d.sector)),
    spawned: [],
    rescanned: new Set(),
  };

  state.drones = prev.drones.map((d) => stepDrone(d, ctx));

  // Re-sight photos for detections whose re-scan waypoint was reached this tick
  if (ctx.rescanned.size) {
    for (const id of ctx.rescanned) {
      const idx = state.detections.findIndex((x) => x.id === id);
      if (idx < 0) continue;
      const parent = state.detections[idx];
      const drone = state.drones.find((d) => d.id === parent.rescan?.droneId) ?? state.drones[0];
      // the school has moved since the first photo
      const drifted = moveAlong(parent.position, rng.range(0, 360), rng.range(0.15, 0.9));
      const child = spawnDetection(state, rng, drone, "school", {
        position: drifted,
        species: parent.species === "unknown" ? rng.weighted(SPECIES_WEIGHTS) : parent.species,
        radiusM: clamp(parent.radiusM * rng.range(0.8, 1.2), 15, 260),
        rescanOf: parent.id,
      });
      state.seq += 1;
      ctx.spawned.push(child);
      state.detections[idx] = { ...parent, rescan: undefined };
    }
  }

  if (ctx.spawned.length) state.detections.push(...ctx.spawned);

  const cutoff = now - SIM.detectionPruneMs;
  if (state.detections.length && state.detections[0].capturedAt < cutoff) {
    state.detections = state.detections.filter((d) => d.capturedAt >= cutoff);
  }

  // slow SST drift
  state.env = { ...prev.env, sstC: prev.env.sstC + rng.gauss(0, 0.002) };
  state.rng = rng.state;
  return state;
}

/** Task the nearest airborne drone to fly over `detectionId` and photograph it again. */
export function requestRescan(prev: SimState, detectionId: string): SimState {
  const det = prev.detections.find((d) => d.id === detectionId);
  if (!det || det.rescan) return prev;
  const candidates = prev.drones.filter((d) => d.status === "airborne");
  if (!candidates.length) return prev;
  const nearest = candidates.reduce((best, d) =>
    rangeBearing(d.position, det.position).rangeNm < rangeBearing(best.position, det.position).rangeNm ? d : best,
  );
  const wp: Waypoint = { lat: det.position.lat, lon: det.position.lon, rescanOf: det.id };
  const drones = prev.drones.map((d) =>
    d.id === nearest.id
      ? {
          ...d,
          waypoints: [...d.waypoints.slice(0, d.waypointIndex), wp, ...d.waypoints.slice(d.waypointIndex)],
        }
      : d,
  );
  const detections = prev.detections.map((d) =>
    d.id === detectionId ? { ...d, rescan: { droneId: nearest.id, requestedAt: prev.now } } : d,
  );
  return { ...prev, drones, detections };
}

export function updateDetection(prev: SimState, id: string, patch: Partial<Detection>): SimState {
  return { ...prev, detections: prev.detections.map((d) => (d.id === id ? { ...d, ...patch } : d)) };
}

function makeDrone(
  id: string,
  callsign: string,
  sector: -1 | 1,
  readyAt: number,
  vessel: Vessel,
  batteryPct = 100,
): Drone {
  return {
    id,
    callsign,
    status: "deck",
    position: vessel.position,
    headingDeg: vessel.headingDeg,
    altitudeM: 0,
    speedKts: 0,
    batteryPct,
    link: 1,
    track: [],
    swathNm: SIM.swathNm,
    sortieDetections: 0,
    launchedAt: 0,
    sector,
    waypoints: [],
    waypointIndex: 0,
    readyAt,
  };
}

/**
 * Build the opening scene: a Win Far purse seiner working skipjack grounds in the
 * Solomon Sea, with the last three hours of flight + detections already replayed.
 */
export function createScenario(seed: number, now: number): { state: SimState; meta: ScenarioMeta } {
  const baseHeading = 248;
  const start = now - SIM.historyMs;
  const speedKts = 9.6;
  // Place the vessel so that she arrives at the target grounds at `now`.
  const target: GeoPoint = { lat: -3.215, lon: 156.68 };
  const vessel: Vessel = {
    nameZh: "穩發626號",
    nameEn: "Win Far 626",
    callsign: "BJ5626",
    position: moveAlong(target, baseHeading + 180, (speedKts * SIM.historyMs) / 3600_000),
    headingDeg: baseHeading,
    speedKts,
  };

  let state: SimState = {
    now: start,
    vessel,
    // ALW-01 is already half-way through a battery at history start, so the two
    // airborne sorties interleave instead of landing together.
    drones: [
      makeDrone("alw-01", "ALW-01", -1, start, vessel, 62),
      makeDrone("alw-02", "ALW-02", 1, start, vessel, 100),
      makeDrone("alw-03", "ALW-03", -1, start + 10 * 60_000, vessel, 100),
    ],
    detections: [],
    env: { sstC: 29.1, windKts: 12, windDirDeg: 112, waveHeightM: 1.1, cloud: 0.3 },
    seq: 1,
    rng: seed,
  };

  const meta: ScenarioMeta = { baseHeading, startedAt: start };
  const steps = Math.ceil(SIM.historyMs / 1000 / SIM.historyStepSec);
  for (let i = 0; i < steps; i++) state = advance(state, SIM.historyStepSec, meta);
  // land exactly on `now`
  state = { ...state, now };

  // Make sure the opening screen has a fresh school to look at.
  const freshest = state.detections.filter((d) => d.kind === "school").reduce((m, d) => Math.max(m, d.capturedAt), 0);
  if (now - freshest > 4 * 60_000) {
    const drone = state.drones.find((d) => d.status === "airborne") ?? state.drones[0];
    const rng = new Rng(state.rng);
    const det = spawnDetection(state, rng, drone, "school", {
      capturedAt: now - 95_000,
      species: "skipjack",
      radiusM: 85,
    });
    state = {
      ...state,
      seq: state.seq + 1,
      rng: rng.state,
      detections: [...state.detections, det],
      drones: state.drones.map((d) => (d.id === drone.id ? { ...d, sortieDetections: d.sortieDetections + 1 } : d)),
    };
  }

  return { state, meta };
}
