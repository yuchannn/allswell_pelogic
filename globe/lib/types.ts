/**
 * Domain model for the Allswell × 穩發 aerial fish-spotting console.
 *
 * Everything that comes off the drone data link is geo-fixed (lat/lon).
 * The vessel moves, so the plan display re-projects every object relative
 * to the ship on each frame — exactly like a relative-motion radar.
 */

export interface GeoPoint {
  /** Decimal degrees, +N */
  lat: number;
  /** Decimal degrees, +E */
  lon: number;
}

/** Fish species the onboard classifier can propose (WCPO purse-seine targets). */
export type Species =
  | "skipjack" // 正鰹 Katsuwonus pelamis
  | "yellowfin" // 黃鰭鮪 Thunnus albacares
  | "bigeye" // 大目鮪 Thunnus obesus
  | "mixed" // 混群 mixed tuna school
  | "unknown"; // 未識別

/** What the drone actually photographed. Schools are the primary target. */
export type DetectionKind =
  | "school" // fish school (red)
  | "birds" // working birds — indicates fish beneath (amber)
  | "floating"; // log / FAD / debris — tuna aggregate under floating objects (white)

/** Surface signature the spotter uses to judge a school (purse-seine vocabulary). */
export type SurfaceActivity =
  | "breezer" // ripple from a school just below the surface
  | "boiler" // fish feeding at the surface, water "boiling"
  | "foamer" // heavy feeding, white water
  | "jumper" // fish clearing the surface
  | "shadow"; // dark sub-surface mass, no surface disturbance

export type DetectionStatus = "new" | "confirmed" | "dismissed";

export interface Snapshot {
  /** Real EO camera frame when available; otherwise the console renders a procedural preview. */
  imageUrl?: string;
  /** Pixel size of the frame, used for aspect ratio + bbox mapping */
  width: number;
  height: number;
  /** Detector bounding box, normalised 0..1 in frame coordinates */
  bbox: { x: number; y: number; w: number; h: number };
  /** Camera state at capture */
  altitudeM: number;
  cameraHeadingDeg: number;
  /** Ground sample distance — metres per pixel at the frame centre */
  gsdM: number;
}

export interface Detection {
  id: string;
  kind: DetectionKind;
  /** Geo position of the *centre of the school* at capture time. */
  position: GeoPoint;
  /** ISO-8601 / epoch ms of the photo. Age is derived from this — never stored. */
  capturedAt: number;
  droneId: string;
  /** Estimated school radius in metres (schools only; 0 otherwise) */
  radiusM: number;
  /** Rough biomass estimate in tonnes (schools only) */
  estTonnes: number;
  species: Species;
  /** Classifier confidence 0..1 */
  confidence: number;
  activity: SurfaceActivity;
  /** Working-bird count seen over the target (0 when none) */
  birdCount: number;
  status: DetectionStatus;
  snapshot: Snapshot;
  /** Set when this photo is a re-sight of an earlier detection (requested by the fishing master). */
  rescanOf?: string;
  /** Set on the *original* detection when a re-scan has been tasked to a drone. */
  rescan?: { droneId: string; requestedAt: number };
}

export interface Waypoint extends GeoPoint {
  /** When set, arriving here triggers a re-sight photo of that detection. */
  rescanOf?: string;
}

export type DroneStatus = "airborne" | "returning" | "deck" | "launching";

export interface TrackPoint extends GeoPoint {
  t: number;
}

export interface Drone {
  id: string;
  callsign: string;
  status: DroneStatus;
  position: GeoPoint;
  headingDeg: number;
  altitudeM: number;
  speedKts: number;
  batteryPct: number;
  /** 0..1 data-link quality */
  link: number;
  /** Recent flight path, oldest first. Thinned + capped by the engine. */
  track: TrackPoint[];
  /** Camera ground swath width in nautical miles (drawn as the coverage band) */
  swathNm: number;
  /** Detections attributed to this sortie */
  sortieDetections: number;
  /** Sortie start (epoch ms) */
  launchedAt: number;
  /** Which side of the vessel's track this drone is assigned to search (-1 port, +1 starboard) */
  sector: -1 | 1;
  /** Search pattern waypoints + progress */
  waypoints: Waypoint[];
  waypointIndex: number;
  /** Deck turnaround: epoch ms when the drone is ready to launch again */
  readyAt: number;
}

export interface Vessel {
  nameZh: string;
  nameEn: string;
  callsign: string;
  position: GeoPoint;
  headingDeg: number;
  speedKts: number;
}

export interface Environment {
  sstC: number;
  windKts: number;
  windDirDeg: number;
  waveHeightM: number;
  /** Cloud cover 0..1 — affects optical detection */
  cloud: number;
}

export interface SimState {
  /** Simulation clock, epoch ms */
  now: number;
  vessel: Vessel;
  drones: Drone[];
  detections: Detection[];
  env: Environment;
  /** Monotonic counter for ids */
  seq: number;
  /** PRNG state — kept in the snapshot so `advance` is a pure function */
  rng: number;
}
