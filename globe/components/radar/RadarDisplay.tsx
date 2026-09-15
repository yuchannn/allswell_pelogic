"use client";

import { useMemo } from "react";
import { useElementSize } from "@/hooks/useElementSize";
import { useLocale } from "@/components/console/LocaleContext";
import { ageBucket } from "@/lib/age";
import { normDeg, projectToScreen } from "@/lib/geo";
import { formatAgeLong, formatBearing, formatPct, formatRange } from "@/lib/format";
import { ACTIVITY, KIND, SPECIES } from "@/lib/species";
import type { Detection, Drone, SimState } from "@/lib/types";
import { Graticule } from "./Graticule";
import { DetectionMarker, DroneMarker, KIND_COLOR, ShipMarker } from "./markers";

export type Orientation = "north" | "head";

interface Props {
  state: SimState;
  detections: Detection[];
  rangeNm: number;
  orientation: Orientation;
  showCoverage: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}

const MARGIN = 36;

/**
 * Where to print "bearing · range" along the steer line: mid-line normally, but pushed
 * past the target when the target is so close the label would sit on the ship icon.
 */
function steerLabelPos(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < 110) {
    const k = (len + 34) / Math.max(len, 1);
    return { x: x * k, y: y * k + 4 };
  }
  return { x: x * 0.55, y: y * 0.55 - 6 };
}

/** Split a track into a few chunks so older flight fades out. */
function chunked<T>(arr: T[], n: number): T[][] {
  if (arr.length < 2) return [];
  const size = Math.max(2, Math.ceil(arr.length / n));
  const out: T[][] = [];
  for (let i = 0; i < arr.length - 1; i += size - 1) out.push(arr.slice(i, i + size));
  return out;
}

export function RadarDisplay({
  state,
  detections,
  rangeNm,
  orientation,
  showCoverage,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: Props) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const { t, pick, locale } = useLocale();
  const { vessel, drones, now } = state;

  const R = Math.max(0, Math.min(width, height) / 2 - MARGIN);
  const cx = width / 2;
  const cy = height / 2;
  const pxPerNm = R / rangeNm;
  const rotation = orientation === "head" ? vessel.headingDeg : 0;
  const origin = vessel.position;

  const projected = useMemo(
    () =>
      detections
        .map((det) => ({ det, p: projectToScreen(origin, det.position, pxPerNm, rotation) }))
        .filter(({ p }) => p.rangeNm <= rangeNm * 1.03)
        // draw fresh (important) targets last so they sit on top
        .sort((a, b) => b.det.capturedAt - a.det.capturedAt)
        .reverse(),
    [detections, origin, pxPerNm, rotation, rangeNm],
  );

  const hovered = hoveredId ? projected.find((x) => x.det.id === hoveredId) : undefined;
  const selected = selectedId ? projected.find((x) => x.det.id === selectedId) : undefined;

  const droneLabel = (d: Drone) => `${d.callsign} ${Math.round(d.altitudeM)}m`;

  const describe = (det: Detection, ageMs: number, brg: number, rng: number) => {
    const kind = pick(KIND[det.kind]);
    const sp = det.kind === "school" ? pick(SPECIES[det.species]) : "";
    return `${kind} ${sp} ${formatBearing(brg)} ${formatRange(rng)} ${formatAgeLong(ageMs, locale)}`;
  };

  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      {R > 40 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block select-none"
          onClick={() => onSelect(null)}
        >
          <g transform={`translate(${cx} ${cy})`}>
            <Graticule R={R} rangeNm={rangeNm} rotationDeg={rotation} />

            {/* clip everything dynamic to the plot circle */}
            <defs>
              <clipPath id="plot-clip">
                <circle r={R} />
              </clipPath>
            </defs>
            <g clipPath="url(#plot-clip)">
              {/* Drone coverage + tracks + planned route */}
              {showCoverage &&
                drones
                  .filter((d) => d.status !== "deck")
                  .map((d) => {
                    const pts = d.track.map((tp) => projectToScreen(origin, tp, pxPerNm, rotation));
                    const chunks = chunked(pts, 8);
                    const color = d.status === "returning" ? "var(--color-warn)" : "var(--color-drone)";
                    const swathPx = Math.max(6, d.swathNm * pxPerNm);
                    const here = projectToScreen(origin, d.position, pxPerNm, rotation);
                    const remaining = d.waypoints.slice(d.waypointIndex, d.waypointIndex + 6);
                    const route = [here, ...remaining.map((w) => projectToScreen(origin, w, pxPerNm, rotation))];
                    return (
                      <g key={d.id}>
                        {/* camera swath — where the drone has actually looked */}
                        {chunks.map((c, i) => (
                          <polyline
                            key={`s${i}`}
                            points={c.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                            fill="none"
                            stroke={color}
                            strokeOpacity={0.035 + 0.05 * ((i + 1) / chunks.length)}
                            strokeWidth={swathPx}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                        {chunks.map((c, i) => (
                          <polyline
                            key={`t${i}`}
                            points={c.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                            fill="none"
                            stroke={color}
                            strokeOpacity={0.18 + 0.5 * ((i + 1) / chunks.length)}
                            strokeWidth={1.2}
                            strokeLinejoin="round"
                          />
                        ))}
                        {d.status === "airborne" && route.length > 1 && (
                          <polyline
                            points={route.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                            fill="none"
                            stroke={color}
                            strokeOpacity={0.35}
                            strokeWidth={1}
                            strokeDasharray="3 5"
                          />
                        )}
                        {remaining
                          .filter((w) => w.rescanOf)
                          .map((w) => {
                            const p = projectToScreen(origin, w, pxPerNm, rotation);
                            return (
                              <path
                                key={w.rescanOf}
                                d="M0 -7 L7 0 L0 7 L-7 0 Z"
                                transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
                                fill="none"
                                stroke={color}
                                strokeWidth={1.2}
                                strokeOpacity={0.9}
                              />
                            );
                          })}
                      </g>
                    );
                  })}

              {/* Heading line */}
              <line
                x1={0}
                y1={0}
                x2={Math.sin(((vessel.headingDeg - rotation) * Math.PI) / 180) * R}
                y2={-Math.cos(((vessel.headingDeg - rotation) * Math.PI) / 180) * R}
                stroke="var(--color-accent)"
                strokeOpacity={0.55}
                strokeWidth={1}
              />

              {/* Steer line to the selected target */}
              {selected && (
                <g style={{ pointerEvents: "none" }}>
                  <line
                    x1={0}
                    y1={0}
                    x2={selected.p.x}
                    y2={selected.p.y}
                    stroke="var(--color-text)"
                    strokeOpacity={0.55}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                  <text
                    {...steerLabelPos(selected.p.x, selected.p.y)}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={700}
                    className="readout"
                    fill="var(--color-text)"
                    stroke="#04070d"
                    strokeWidth={3.5}
                    style={{ paintOrder: "stroke" }}
                  >
                    {formatBearing(selected.p.bearingDeg)} · {formatRange(selected.p.rangeNm)}
                  </text>
                </g>
              )}

              {/* Detections */}
              {projected.map(({ det, p }) => {
                const ageMs = now - det.capturedAt;
                return (
                  <DetectionMarker
                    key={det.id}
                    det={det}
                    x={p.x}
                    y={p.y}
                    ageMs={ageMs}
                    selected={det.id === selectedId}
                    hovered={det.id === hoveredId}
                    onSelect={(id) => onSelect(id)}
                    onHover={onHover}
                    ariaLabel={describe(det, ageMs, p.bearingDeg, p.rangeNm)}
                  />
                );
              })}

              {/* Airframes */}
              {drones
                .filter((d) => d.status !== "deck")
                .map((d) => {
                  const p = projectToScreen(origin, d.position, pxPerNm, rotation);
                  if (p.rangeNm > rangeNm * 1.03) return null;
                  return (
                    <DroneMarker
                      key={d.id}
                      drone={d}
                      x={p.x}
                      y={p.y}
                      headingDeg={normDeg(d.headingDeg - rotation)}
                      label={droneLabel(d)}
                    />
                  );
                })}
            </g>

            <ShipMarker headingDeg={normDeg(vessel.headingDeg - rotation)} />
          </g>
        </svg>
      )}

      {/* Off-plot drones indicator */}
      {R > 40 &&
        drones
          .filter((d) => d.status !== "deck")
          .map((d) => {
            const p = projectToScreen(origin, d.position, pxPerNm, rotation);
            if (p.rangeNm <= rangeNm * 1.03) return null;
            const a = Math.atan2(p.x, -p.y);
            const ex = cx + Math.sin(a) * (R + 4);
            const ey = cy - Math.cos(a) * (R + 4);
            return (
              <div
                key={d.id}
                className="readout pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded bg-panel/90 px-1.5 py-0.5 text-[10px] font-semibold text-drone hairline"
                style={{ left: ex, top: ey }}
              >
                {d.callsign} ▸ {formatRange(p.rangeNm)}
              </div>
            );
          })}

      {/* Hover tooltip */}
      {hovered && hovered.det.id !== selectedId && (
        <Tooltip det={hovered.det} x={cx + hovered.p.x} y={cy + hovered.p.y} width={width} height={height} now={now} brg={hovered.p.bearingDeg} rng={hovered.p.rangeNm} />
      )}

      {/* Corner readouts */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1">
        <div className="readout text-[11px] text-muted">
          {t("range")} <span className="text-text">{rangeNm} nm</span> · {t("orientation")}{" "}
          <span className="text-text">{orientation === "north" ? t("northUp") : t("headUp")}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute top-3 right-3 text-right">
        <div className="readout text-[11px] text-muted">
          {t("heading")} <span className="text-accent font-semibold">{formatBearing(vessel.headingDeg)}</span>
          {" · "}
          {t("speed")} <span className="text-text">{vessel.speedKts.toFixed(1)} kn</span>
        </div>
      </div>
      <Legend />
    </div>
  );
}

function Legend() {
  const { t } = useLocale();
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 text-[10.5px] text-muted">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: KIND_COLOR.school }} />
        {t("kind_school")}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rotate-45" style={{ background: KIND_COLOR.birds }} />
        {t("kind_birds")}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 border" style={{ borderColor: KIND_COLOR.floating }} />
        {t("kind_floating")}
      </div>
      <div className="flex items-center gap-1.5">
        <svg width="11" height="11" viewBox="-7 -8 14 16">
          <path d="M0 -8 L7 7 L0 3.5 L-7 7 Z" fill="var(--color-drone)" />
        </svg>
        Allswell VTOL
      </div>
      <div className="mt-1 text-dim">{t("legendSize")}</div>
      <div className="text-dim">{t("legendAge")}</div>
    </div>
  );
}

function Tooltip({
  det,
  x,
  y,
  width,
  height,
  now,
  brg,
  rng,
}: {
  det: Detection;
  x: number;
  y: number;
  width: number;
  height: number;
  now: number;
  brg: number;
  rng: number;
}) {
  const { t, pick, locale } = useLocale();
  const ageMs = now - det.capturedAt;
  const bucket = ageBucket(ageMs);
  const flipX = x > width - 220;
  const flipY = y > height - 130;
  const isSchool = det.kind === "school";
  return (
    <div
      className="pointer-events-none absolute z-10 w-[200px] rounded-md border border-line-2 bg-panel/95 p-2.5 text-[11px] shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur fade-in"
      style={{ left: flipX ? x - 214 : x + 14, top: flipY ? y - 118 : y + 12 }}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold" style={{ color: KIND_COLOR[det.kind] }}>
          {isSchool ? pick(SPECIES[det.species]) : pick(KIND[det.kind])}
        </span>
        <span className="readout text-muted">{det.id}</span>
      </div>
      {isSchool && (
        <div className="mt-1 text-muted">
          r ≈ <span className="readout text-text">{det.radiusM} m</span> · ~
          <span className="readout text-text">{det.estTonnes} t</span> · {pick(ACTIVITY[det.activity])}
        </div>
      )}
      <div className="mt-0.5 text-muted">
        {t("confidence")} <span className="readout text-text">{formatPct(det.confidence)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="readout text-text">
          {formatBearing(brg)} · {formatRange(rng)}
        </span>
        <span
          className="readout"
          style={{
            color:
              bucket === "fresh"
                ? "var(--color-ok)"
                : bucket === "stale"
                  ? "var(--color-dim)"
                  : "var(--color-warn)",
          }}
        >
          {formatAgeLong(ageMs, locale)}
        </span>
      </div>
    </div>
  );
}
