"use client";

import { formatTimeUTC } from "@/lib/format";
import { useLocale } from "./LocaleContext";

interface Props {
  now: number;
  schools: number;
  fresh: number;
  linkQuality: number;
  /** Unacknowledged alerts */
  alerts: number;
  speed: number;
  onSpeed: (s: number) => void;
}

export function StatusBar({ now, schools, fresh, linkQuality, alerts, speed, onSpeed }: Props) {
  const { t } = useLocale();
  const bars = Math.round(linkQuality * 5);
  return (
    <footer className="flex h-8 items-center justify-between border-t border-line bg-panel px-3 text-[11px]">
      <div className="flex items-center gap-4">
        <span className="tag border border-warn/40 bg-warn/10 text-warn">{t("simulated")}</span>
        <span className="flex items-center gap-1.5 text-muted">
          {t("dataLink")}
          <span className="inline-flex items-end gap-[2px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`inline-block w-[3px] ${i <= bars ? "bg-ok" : "bg-line-2"}`} style={{ height: 3 + i * 1.4 }} />
            ))}
          </span>
        </span>
        <span className="text-muted">
          {t("lastUpdate")} <span className="readout text-text">{formatTimeUTC(now)}</span>
        </span>
        <span className="text-muted">
          <span className="readout text-text">{schools}</span> {t("schoolsInRange")} ·{" "}
          <span className="readout text-ok">{fresh}</span> {t("freshCount")}
        </span>
        <span className={alerts > 0 ? "text-warn" : "text-muted"}>
          <span className={`readout ${alerts > 0 ? "font-semibold text-warn" : "text-text"}`}>{alerts}</span> {t("alerts")}{" "}
          <span className={alerts > 0 ? "text-warn/80" : "text-dim"}>{t("unacked")}</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-2 text-muted">
          {t("demoSpeed")}
          <span className="seg" role="group">
            {[1, 10, 60].map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => onSpeed(s)} className="readout">
                {s}×
              </button>
            ))}
          </span>
        </span>
        <span className="text-dim">{t("fishingMaster")}</span>
      </div>
    </footer>
  );
}
