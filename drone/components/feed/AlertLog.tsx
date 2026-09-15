"use client";

import { useLocale } from "@/components/console/LocaleContext";
import { ageColor } from "@/components/console/TargetList";
import type { Alert } from "@/hooks/useAlerts";
import { rangeBearing } from "@/lib/geo";
import { formatAgeShort, formatBearing, formatRange, formatTimeUTC } from "@/lib/format";
import { KIND, KIND_COLOR, SPECIES } from "@/lib/species";
import type { SimState } from "@/lib/types";

interface Props {
  log: Alert[];
  unacked: number;
  state: SimState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAck: (id: string) => void;
  onAckAll: () => void;
  compact?: boolean;
}

/** Persistent alert history — fills the spare cell of the feed grid. */
export function AlertLog({ log, unacked, state, selectedId, onSelect, onAck, onAckAll, compact = false }: Props) {
  const { t, pick, locale } = useLocale();
  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-line bg-panel-2" aria-label={t("alertLog")}>
      <header className={`flex shrink-0 items-center justify-between border-b border-line ${compact ? "h-7 px-2" : "h-8 px-2.5"}`}>
        <h2 className="panel-title flex items-center gap-1.5">
          {unacked > 0 && <span className="blink inline-block h-2 w-2 rounded-full bg-warn" />}
          {t("alertLog")}
          <span className="readout text-text">{log.length}</span>
          {unacked > 0 && (
            <span className="readout normal-case tracking-normal text-warn">
              · {unacked} {t("unacked")}
            </span>
          )}
        </h2>
        {unacked > 0 && (
          <button type="button" className="btn !py-0.5 !text-[10.5px]" onClick={onAckAll}>
            {t("ackAll")}
          </button>
        )}
      </header>

      {log.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-[11.5px] text-muted">{t("noAlerts")}</div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {log.map((a) => {
            const det = state.detections.find((d) => d.id === a.id);
            const drone = state.drones.find((d) => d.id === a.droneId);
            const color = KIND_COLOR[a.kind];
            const selected = a.id === selectedId;
            const ageMs = state.now - a.capturedAt;
            const name = det ? (det.kind === "school" ? pick(SPECIES[det.species]) : pick(KIND[det.kind])) : t(`kind_${a.kind}`);
            const rb = det ? rangeBearing(state.vessel.position, det.position) : null;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!det}
                  onClick={() => {
                    if (!det) return;
                    onSelect(det.id);
                    onAck(det.id);
                  }}
                  className={`grid w-full grid-cols-[8px_1fr_auto] items-center gap-x-2 border-b border-line/70 text-left transition-colors ${
                    compact ? "px-2 py-1" : "px-2.5 py-1.5"
                  } ${selected ? "bg-panel-3" : "hover:bg-panel-3/60"} ${a.acked ? "opacity-60" : ""} disabled:cursor-default`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${a.acked ? "" : "blink"}`} style={{ background: a.acked ? "var(--color-dim)" : color }} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[11.5px]">
                      <span className="readout text-drone">{drone?.callsign ?? a.droneId.toUpperCase()}</span>
                      <span className={`truncate font-semibold ${a.acked ? "text-muted" : "text-text"}`}>{t(`alert_${a.kind}`)}</span>
                      <span className="truncate text-muted">{name}</span>
                      {det?.status === "confirmed" && <span className="tag border border-ok/50 bg-ok/10 text-ok">{t("confirmedTag")}</span>}
                      {det?.status === "dismissed" && <span className="tag border border-line-2 bg-panel-3 text-dim">{t("dismissedTag")}</span>}
                    </span>
                    {!compact && det && (
                      <span className="readout mt-0.5 block text-[10.5px] text-muted">
                        {det.kind === "school" ? `r ${det.radiusM} m · ~${det.estTonnes} t · ` : det.kind === "birds" ? `${det.birdCount} · ` : ""}
                        {Math.round(det.confidence * 100)}%
                        {rb && (
                          <>
                            {" · "}
                            <span className="text-text">{formatBearing(rb.bearingDeg)}</span> · {formatRange(rb.rangeNm)}
                          </>
                        )}
                        <span className="ml-1.5 text-dim">{a.id}</span>
                      </span>
                    )}
                  </span>
                  <span className="readout text-right text-[10.5px] leading-tight">
                    <span className="block text-muted">{formatTimeUTC(a.capturedAt)}</span>
                    <span className="block" style={{ color: ageColor(ageMs) }}>
                      {formatAgeShort(ageMs, locale)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
