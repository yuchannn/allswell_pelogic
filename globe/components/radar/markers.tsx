"use client";

import { AGE, ageBucket, ageOpacity, markerRadius } from "@/lib/age";
import { formatAgeShort } from "@/lib/format";
import { SPECIES } from "@/lib/species";
import type { Detection, Drone } from "@/lib/types";
import { useLocale } from "@/components/console/LocaleContext";

export const KIND_COLOR = {
  school: "var(--color-target)",
  birds: "var(--color-birds)",
  floating: "var(--color-floating)",
} as const;

interface DetectionMarkerProps {
  det: Detection;
  x: number;
  y: number;
  ageMs: number;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  ariaLabel: string;
}

export function DetectionMarker({
  det,
  x,
  y,
  ageMs,
  selected,
  hovered,
  onSelect,
  onHover,
  ariaLabel,
}: DetectionMarkerProps) {
  const { locale } = useLocale();
  const bucket = ageBucket(ageMs);
  const dismissed = det.status === "dismissed";
  const opacity = dismissed ? 0.3 : ageOpacity(ageMs);
  const color = dismissed ? "var(--color-dim)" : KIND_COLOR[det.kind];
  const r = det.kind === "school" ? markerRadius(det.radiusM) : det.kind === "birds" ? 5.5 : 4.5;
  const fresh = bucket === "fresh" && !dismissed;
  const isNew = ageMs < AGE.newTagMs && !dismissed;
  const showLabel = det.kind === "school" ? fresh || hovered || selected : hovered || selected;
  const label =
    det.kind === "school"
      ? `${SPECIES[det.species].code} ${formatAgeShort(ageMs, locale)}`
      : formatAgeShort(ageMs, locale);

  return (
    <g
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className="cursor-pointer outline-none"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(det.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(det.id);
        }
      }}
      onMouseEnter={() => onHover(det.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(det.id)}
      onBlur={() => onHover(null)}
    >
      {/* generous hit area */}
      <circle r={Math.max(r + 8, 14)} fill="transparent" />

      {fresh && det.kind === "school" && (
        <>
          <circle r={r * 2.2} fill={color} fillOpacity={0.09} />
          <circle className="pulse-ring" r={r} fill="none" stroke={color} strokeWidth={1.5} />
        </>
      )}
      {isNew && det.kind !== "school" && (
        <circle className="pulse-ring" r={r} fill="none" stroke={color} strokeWidth={1.2} />
      )}

      {det.kind === "school" && (
        <circle
          r={r}
          fill={color}
          fillOpacity={opacity}
          stroke={bucket === "stale" ? color : "#04070d"}
          strokeOpacity={bucket === "stale" ? 0.6 : 0.8}
          strokeWidth={1}
          strokeDasharray={bucket === "stale" ? "2 2" : undefined}
          style={{ filter: fresh ? "drop-shadow(0 0 6px rgba(255,59,59,0.7))" : undefined }}
        />
      )}
      {det.kind === "birds" && (
        <path
          d={`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`}
          fill={color}
          fillOpacity={opacity}
          stroke="#04070d"
          strokeOpacity={0.8}
          strokeWidth={1}
        />
      )}
      {det.kind === "floating" && (
        <rect
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          fill="none"
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth={1.6}
        />
      )}

      {det.status === "confirmed" && (
        <circle r={r + 3} fill="none" stroke="var(--color-ok)" strokeWidth={1.4} strokeOpacity={0.95} />
      )}
      {det.rescan && (
        <circle
          r={r + 6}
          fill="none"
          stroke="var(--color-drone)"
          strokeWidth={1}
          strokeDasharray="3 3"
          strokeOpacity={0.8}
        />
      )}
      {det.rescanOf && !selected && (
        <circle r={r + 3} fill="none" stroke="var(--color-text)" strokeWidth={1} strokeOpacity={0.5} />
      )}

      {(selected || hovered) && (
        <circle
          className={selected ? "selection-ring" : undefined}
          r={r + 8}
          fill="none"
          stroke={selected ? "var(--color-text)" : color}
          strokeWidth={selected ? 1.5 : 1}
          strokeDasharray={selected ? "6 5" : undefined}
          strokeOpacity={selected ? 0.95 : 0.7}
        />
      )}

      {showLabel && (
        <text
          x={r + 9}
          y={-2}
          fontSize={10.5}
          fontWeight={600}
          className="readout"
          fill={dismissed ? "var(--color-dim)" : "var(--color-text)"}
          fillOpacity={Math.max(opacity, 0.7)}
          stroke="#04070d"
          strokeWidth={3}
          style={{ paintOrder: "stroke", pointerEvents: "none" }}
        >
          {label}
        </text>
      )}
      {isNew && (
        <text
          x={r + 9}
          y={10}
          fontSize={9}
          fontWeight={800}
          letterSpacing={1}
          className="readout blink"
          fill={color}
          stroke="#04070d"
          strokeWidth={3}
          style={{ paintOrder: "stroke", pointerEvents: "none" }}
        >
          NEW
        </text>
      )}
    </g>
  );
}

interface DroneMarkerProps {
  drone: Drone;
  x: number;
  y: number;
  /** Screen-relative heading (true heading minus display rotation) */
  headingDeg: number;
  label: string;
}

export function DroneMarker({ drone, x, y, headingDeg, label }: DroneMarkerProps) {
  const returning = drone.status === "returning";
  const color = returning ? "var(--color-warn)" : "var(--color-drone)";
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} style={{ pointerEvents: "none" }}>
      <circle r={12} fill={color} fillOpacity={0.08} />
      <path
        d="M0 -8 L7 7 L0 3.5 L-7 7 Z"
        transform={`rotate(${headingDeg})`}
        fill={color}
        stroke="#04070d"
        strokeWidth={1}
        style={{ filter: "drop-shadow(0 0 5px rgba(70,224,160,0.6))" }}
      />
      <text
        x={12}
        y={4}
        fontSize={10.5}
        fontWeight={700}
        className="readout"
        fill={color}
        stroke="#04070d"
        strokeWidth={3}
        style={{ paintOrder: "stroke" }}
      >
        {label}
      </text>
    </g>
  );
}

export function ShipMarker({ headingDeg }: { headingDeg: number }) {
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle r={16} fill="var(--color-accent)" fillOpacity={0.08} />
      <g transform={`rotate(${headingDeg})`}>
        <path
          d="M0 -11 L5.5 -3 L5.5 9 L-5.5 9 L-5.5 -3 Z"
          fill="var(--color-accent)"
          stroke="#04070d"
          strokeWidth={1.2}
          style={{ filter: "drop-shadow(0 0 6px rgba(63,211,255,0.7))" }}
        />
        <rect x={-2.5} y={-1} width={5} height={6} fill="#04070d" fillOpacity={0.55} />
      </g>
    </g>
  );
}
