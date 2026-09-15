"use client";

import { useLocale } from "@/components/console/LocaleContext";
import { ageColor } from "@/components/console/TargetList";
import type { Alert } from "@/hooks/useAlerts";
import { rangeBearing } from "@/lib/geo";
import { formatAgeShort, formatBearing, formatRange } from "@/lib/format";
import { KIND, KIND_COLOR, SPECIES } from "@/lib/species";
import type { SimState } from "@/lib/types";

interface Props {
  toasts: Alert[];
  state: SimState;
  onView: (id: string) => void;
  onAck: (id: string) => void;
  onAckAll: () => void;
  /** Total unacknowledged, so the stack can say "+N more" */
  unacked: number;
}

/** Floating alerts over the feed wall: one card per new detection, newest on top. */
export function AlertStack({ toasts, state, onView, onAck, onAckAll, unacked }: Props) {
  const { t, pick, locale } = useLocale();
  if (!toasts.length) return null;
  const hidden = unacked - toasts.length;
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-20 flex w-[400px] max-w-[calc(100%-24px)] -translate-x-1/2 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((a) => {
        const det = state.detections.find((d) => d.id === a.id);
        if (!det) return null;
        const drone = state.drones.find((d) => d.id === a.droneId);
        const rb = rangeBearing(state.vessel.position, det.position);
        const ageMs = state.now - det.capturedAt;
        const color = KIND_COLOR[det.kind];
        const isSchool = det.kind === "school";
        const name = isSchool ? pick(SPECIES[det.species]) : pick(KIND[det.kind]);
        const summary = isSchool
          ? `r ${det.radiusM} m · ~${det.estTonnes} t`
          : det.kind === "birds"
            ? `${t("birds")} ${det.birdCount}`
            : det.id;
        return (
          <div
            key={a.id}
            className="toast-in pointer-events-auto flex overflow-hidden rounded-md border border-line-2 bg-panel/95 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur"
            style={{ borderColor: `color-mix(in srgb, ${color} 55%, var(--color-line-2))` }}
          >
            <div className="w-1.5 shrink-0" style={{ background: color }} />
            <div className="min-w-0 flex-1 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="blink inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="readout text-[11px] font-semibold text-drone">{drone?.callsign ?? a.droneId.toUpperCase()}</span>
                  <span className="truncate text-[12.5px] font-bold text-text">{t(`alert_${det.kind}`)}</span>
                </div>
                <span className="readout shrink-0 text-[11px]" style={{ color: ageColor(ageMs) }}>
                  {formatAgeShort(ageMs, locale)}
                </span>
              </div>
              <div className="readout mt-1 flex items-center gap-2 text-[11.5px] text-muted">
                <span className="font-semibold" style={{ color }}>
                  {name}
                  {isSchool && <span className="ml-1 text-muted">{SPECIES[det.species].code}</span>}
                </span>
                <span>·</span>
                <span className="truncate">{summary}</span>
                <span>·</span>
                <span className="text-text">{Math.round(det.confidence * 100)}%</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="readout text-[12px]">
                  <span className="text-dim">{t("targetBearingLine")}</span>{" "}
                  <span className="font-bold text-accent">{formatBearing(rb.bearingDeg)}</span>
                  <span className="text-dim"> · </span>
                  <span className="text-text">{formatRange(rb.rangeNm)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <button type="button" className="btn btn-primary !py-1 !text-[11px]" onClick={() => onView(det.id)}>
                    {t("view")}
                  </button>
                  <button type="button" className="btn !py-1 !text-[11px]" onClick={() => onAck(det.id)}>
                    {t("ack")}
                  </button>
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {hidden > 0 && (
        <div className="pointer-events-auto flex items-center justify-between rounded-md border border-line bg-panel/90 px-3 py-1.5 text-[11px] text-muted">
          <span>
            +<span className="readout text-text">{hidden}</span> {t("alerts")} · {t("unacked")}
          </span>
          <button type="button" className="btn !py-0.5 !text-[10.5px]" onClick={onAckAll}>
            {t("ackAll")}
          </button>
        </div>
      )}
    </div>
  );
}
