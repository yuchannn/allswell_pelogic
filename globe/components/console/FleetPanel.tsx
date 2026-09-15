"use client";

import { rangeBearing } from "@/lib/geo";
import { formatBearing, formatDurationHM, formatRange } from "@/lib/format";
import type { Drone, SimState } from "@/lib/types";
import { useLocale } from "./LocaleContext";

const STATUS_STYLE: Record<Drone["status"], string> = {
  airborne: "border-drone/50 bg-drone/10 text-drone",
  returning: "border-warn/50 bg-warn/10 text-warn",
  launching: "border-accent/50 bg-accent/10 text-accent",
  deck: "border-line-2 bg-panel-3 text-muted",
};

export function FleetPanel({ state }: { state: SimState }) {
  const { t } = useLocale();
  return (
    <section className="border-b border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-title">{t("fleet")}</h2>
        <span className="readout text-[10px] text-dim">
          {state.drones.filter((d) => d.status !== "deck").length}/{state.drones.length} ▲
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {state.drones.map((d) => (
          <DroneCard key={d.id} drone={d} state={state} />
        ))}
      </div>
    </section>
  );
}

function DroneCard({ drone: d, state }: { drone: Drone; state: SimState }) {
  const { t } = useLocale();
  const flying = d.status !== "deck";
  const rb = rangeBearing(state.vessel.position, d.position);
  const batteryColor = d.batteryPct > 40 ? "bg-drone" : d.batteryPct > 25 ? "bg-warn" : "bg-danger";
  const readyMs = d.readyAt - state.now;

  return (
    <div className="rounded-md border border-line bg-panel-2 p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="-7 -8 14 16" aria-hidden="true">
            <path d="M0 -8 L7 7 L0 3.5 L-7 7 Z" fill={flying ? "var(--color-drone)" : "var(--color-dim)"} />
          </svg>
          <span className="readout text-[12.5px] font-semibold text-text">{d.callsign}</span>
        </div>
        <span className={`tag border ${STATUS_STYLE[d.status]}`}>{t(`droneStatus_${d.status}`)}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="w-8 text-[10px] text-dim">{t("battery")}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-panel-3">
          <div className={`h-full ${batteryColor}`} style={{ width: `${d.batteryPct}%` }} />
        </div>
        <span className="readout w-9 text-right text-[11px] text-text">{Math.round(d.batteryPct)}%</span>
      </div>

      {flying ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
          <Row k={t("bearing")} v={`${formatBearing(rb.bearingDeg)} · ${formatRange(rb.rangeNm)}`} wide />
          <Row k={t("altitude")} v={`${Math.round(d.altitudeM)} m`} />
          <Row k={t("link")} v={<LinkBars q={d.link} />} />
          <Row k={t("sortie")} v={formatDurationHM(state.now - d.launchedAt)} />
          <Row k={t("sortieDetections")} v={String(d.sortieDetections)} />
          <Row
            k={t("legProgress")}
            v={d.status === "airborne" ? `${Math.min(d.waypointIndex + 1, d.waypoints.length)}/${d.waypoints.length}` : "—"}
          />
        </dl>
      ) : (
        <div className="mt-2 text-[11px] text-muted">
          {readyMs > 0 ? (
            <>
              {t("readyIn")} <span className="readout text-text">{Math.ceil(readyMs / 60000)} {t("minutesShort")}</span>
            </>
          ) : (
            <span className="text-drone">{t("readyNow")} · {t("waitingSlot")}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, wide = false }: { k: string; v: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${wide ? "col-span-2" : ""}`}>
      <dt className="whitespace-nowrap text-dim">{k}</dt>
      <dd className="readout truncate text-text">{v}</dd>
    </div>
  );
}

function LinkBars({ q }: { q: number }) {
  const bars = Math.round(q * 5);
  return (
    <span className="inline-flex items-end gap-[2px]" aria-label={`${Math.round(q * 100)}%`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block w-[3px] ${i <= bars ? (q > 0.6 ? "bg-drone" : "bg-warn") : "bg-line-2"}`}
          style={{ height: 3 + i * 1.6 }}
        />
      ))}
    </span>
  );
}
