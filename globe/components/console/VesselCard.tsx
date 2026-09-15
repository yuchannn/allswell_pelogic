"use client";

import { formatBearing, formatLat, formatLon } from "@/lib/format";
import type { Environment, Vessel } from "@/lib/types";
import { useLocale } from "./LocaleContext";

export function VesselCard({ vessel, env }: { vessel: Vessel; env: Environment }) {
  const { t, locale } = useLocale();
  return (
    <section className="border-b border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="panel-title">{t("vessel")}</h2>
        <span className="readout text-[10px] text-dim">{vessel.callsign}</span>
      </div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[15px] font-semibold text-text">{locale === "zh-TW" ? vessel.nameZh : vessel.nameEn}</span>
        <span className="text-[11px] text-muted">{locale === "zh-TW" ? vessel.nameEn : vessel.nameZh}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11.5px]">
        <dt className="text-dim">{t("position")}</dt>
        <dd className="readout text-text">
          {formatLat(vessel.position.lat)}
          <br />
          {formatLon(vessel.position.lon)}
        </dd>
        <dt className="text-dim">{t("heading")}</dt>
        <dd className="readout">
          <span className="font-semibold text-accent">{formatBearing(vessel.headingDeg)}</span>
          <span className="ml-3 text-dim">{t("speed")}</span>{" "}
          <span className="text-text">{vessel.speedKts.toFixed(1)} kn</span>
        </dd>
        <dt className="text-dim">{t("sst")}</dt>
        <dd className="readout">
          <span className="text-text">{env.sstC.toFixed(1)} °C</span>
          <span className="ml-3 text-dim">{t("wind")}</span>{" "}
          <span className="text-text">
            {formatBearing(env.windDirDeg)}/{Math.round(env.windKts)}kn
          </span>
        </dd>
        <dt className="text-dim">{t("wave")}</dt>
        <dd className="readout">
          <span className="text-text">{env.waveHeightM.toFixed(1)} m</span>
          <span className="ml-3 text-dim">{t("cloud")}</span>{" "}
          <span className="text-text">{Math.round(env.cloud * 8)}/8</span>
        </dd>
      </dl>
    </section>
  );
}
