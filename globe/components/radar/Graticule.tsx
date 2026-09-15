"use client";

import { memo } from "react";
import { useLocale } from "@/components/console/LocaleContext";

interface Props {
  R: number;
  rangeNm: number;
  /** Degrees to rotate the true-bearing scale (Head-up passes the ship heading) */
  rotationDeg: number;
}

const CARDINALS: Record<number, string> = { 0: "N", 90: "E", 180: "S", 270: "W" };

/** Range rings + true-bearing scale. Memoised — only re-renders when geometry changes. */
export const Graticule = memo(function Graticule({ R, rangeNm, rotationDeg }: Props) {
  const { locale } = useLocale();
  const rings = [0.25, 0.5, 0.75, 1];
  const ticks: React.ReactNode[] = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const major = deg % 30 === 0;
    const mid = deg % 10 === 0;
    const len = major ? 11 : mid ? 7 : 4;
    ticks.push(
      <line
        key={deg}
        x1={0}
        y1={-R}
        x2={0}
        y2={-R + len}
        transform={`rotate(${deg})`}
        stroke="var(--color-accent)"
        strokeOpacity={major ? 0.7 : mid ? 0.45 : 0.28}
        strokeWidth={major ? 1.2 : 1}
      />,
    );
    if (major) {
      const cardinal = CARDINALS[deg];
      const label = cardinal ?? deg.toString().padStart(3, "0");
      // Keep labels upright regardless of display rotation.
      ticks.push(
        <text
          key={`l${deg}`}
          transform={`rotate(${deg}) translate(0 ${-R - 17}) rotate(${-deg - rotationDeg})`}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={cardinal ? 12 : 10}
          fontWeight={cardinal ? 700 : 500}
          className="readout"
          fill={cardinal ? "var(--color-accent)" : "var(--color-muted)"}
          fillOpacity={cardinal ? 1 : 0.9}
        >
          {label}
        </text>,
      );
    }
  }

  const unit = locale === "zh-TW" ? "浬" : "nm";

  return (
    <g>
      <defs>
        <radialGradient id="plot-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#0a1526" />
          <stop offset="0.75" stopColor="#060c17" />
          <stop offset="1" stopColor="#04070d" />
        </radialGradient>
      </defs>
      <circle r={R} fill="url(#plot-bg)" />

      {/* Rotating part: rings' labels, ticks, cross-hairs, all in *true* bearings */}
      <g transform={`rotate(${-rotationDeg})`}>
        {/* cross-hairs */}
        <line x1={-R} y1={0} x2={R} y2={0} stroke="var(--color-accent)" strokeOpacity={0.1} />
        <line x1={0} y1={-R} x2={0} y2={R} stroke="var(--color-accent)" strokeOpacity={0.1} />
        {[45, 135].map((d) => (
          <line
            key={d}
            x1={0}
            y1={-R}
            x2={0}
            y2={R}
            transform={`rotate(${d})`}
            stroke="var(--color-accent)"
            strokeOpacity={0.06}
          />
        ))}
        {ticks}
      </g>

      {/* Rings are rotation-invariant */}
      {rings.map((f) => (
        <circle
          key={f}
          r={R * f}
          fill="none"
          stroke="var(--color-accent)"
          strokeOpacity={f === 1 ? 0.55 : 0.2}
          strokeWidth={f === 1 ? 1.2 : 1}
          strokeDasharray={f === 1 ? undefined : "2 4"}
        />
      ))}
      {rings.map((f) => {
        // range labels along the lower-right radial, clear of the heading line in H-UP
        const a = (135 * Math.PI) / 180;
        const x = Math.sin(a) * (R * f) + 4;
        const y = -Math.cos(a) * (R * f) - 4;
        const v = rangeNm * f;
        return (
          <text
            key={`r${f}`}
            x={x}
            y={y}
            fontSize={10}
            className="readout"
            fill="var(--color-muted)"
            fillOpacity={0.9}
            style={{ paintOrder: "stroke" }}
            stroke="var(--color-bg)"
            strokeWidth={3}
          >
            {Number.isInteger(v) ? v : v.toFixed(1)} {unit}
          </text>
        );
      })}
    </g>
  );
});
