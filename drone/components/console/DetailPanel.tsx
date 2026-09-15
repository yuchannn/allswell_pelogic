"use client";

import { SnapshotCanvas } from "@/components/snapshot/SnapshotCanvas";
import { AGE, ageBucket } from "@/lib/age";
import { rangeBearing } from "@/lib/geo";
import { formatAgeLong, formatBearing, formatLat, formatLon, formatRange, formatTimeUTC } from "@/lib/format";
import { ACTIVITY, KIND, KIND_COLOR, SPECIES } from "@/lib/species";
import type { Detection, SimState } from "@/lib/types";
import { useLocale } from "./LocaleContext";
import { ageColor } from "./TargetList";

interface Props {
  det: Detection;
  state: SimState;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onReset: (id: string) => void;
  onRescan: (id: string) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExpand: () => void;
}

export function DetailPanel({ det, state, onConfirm, onDismiss, onReset, onRescan, onClose, onPrev, onNext, onExpand }: Props) {
  const { t, pick, locale } = useLocale();
  const drone = state.drones.find((d) => d.id === det.droneId);
  const rb = rangeBearing(state.vessel.position, det.position);
  const ageMs = state.now - det.capturedAt;
  const bucket = ageBucket(ageMs);
  const isSchool = det.kind === "school";
  const color = KIND_COLOR[det.kind];
  const areaHa = (Math.PI * det.radiusM * det.radiusM) / 10_000;
  const airborne = state.drones.some((d) => d.status === "airborne");

  const rescanDrone = det.rescan ? state.drones.find((d) => d.id === det.rescan?.droneId) : undefined;
  const rescanEtaMin = rescanDrone
    ? Math.max(1, Math.round((rangeBearing(rescanDrone.position, det.position).rangeNm / Math.max(rescanDrone.speedKts, 1)) * 60))
    : null;

  return (
    <section className="fade-in flex flex-col border-b border-line" aria-label={t("snapshot")}>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <h2 className="panel-title">{t("snapshot")}</h2>
          <span className="readout text-[11px] text-dim">{det.id}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label={t("prevTarget")} onClick={onPrev}>
            ▲
          </IconBtn>
          <IconBtn label={t("nextTarget")} onClick={onNext}>
            ▼
          </IconBtn>
          <IconBtn label={t("viewFullscreen")} onClick={onExpand}>
            ⛶
          </IconBtn>
          <IconBtn label={t("close")} onClick={onClose}>
            ✕
          </IconBtn>
        </div>
      </div>

      <div className="group relative px-3">
        <div
          role="button"
          tabIndex={0}
          onClick={onExpand}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onExpand();
            }
          }}
          aria-label={t("viewFullscreen")}
          title={t("viewFullscreen")}
          className="block w-full cursor-zoom-in rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <SnapshotCanvas det={det} droneCallsign={drone?.callsign ?? det.droneId.toUpperCase()} env={state.env} />
        </div>
        <span className="pointer-events-none absolute top-2 right-5 flex items-center gap-1 rounded border border-line-2 bg-panel/85 px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          ⛶ {t("viewFullscreen")} <span className="readout text-dim">F</span>
        </span>
      </div>

      <div className="px-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-bold leading-none text-text">
                {isSchool ? pick(SPECIES[det.species]) : pick(KIND[det.kind])}
              </span>
              {isSchool && <span className="readout text-[11px] text-muted">{SPECIES[det.species].code}</span>}
            </div>
            {isSchool && SPECIES[det.species].latin && (
              <div className="mt-0.5 text-[10.5px] italic text-dim">{SPECIES[det.species].latin}</div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {ageMs < AGE.newTagMs && det.status !== "dismissed" && (
                <span className="tag border border-target/50 bg-target/15 text-target-2 blink">{t("newTag")}</span>
              )}
              {det.rescanOf && (
                <span className="tag border border-line-2 bg-panel-3 text-text">
                  {t("resightTag")} · {t("resightOf")} {det.rescanOf}
                </span>
              )}
              {det.status === "confirmed" && <span className="tag border border-ok/50 bg-ok/10 text-ok">{t("confirmedTag")}</span>}
              {det.status === "dismissed" && <span className="tag border border-line-2 bg-panel-3 text-dim">{t("dismissedTag")}</span>}
              {bucket === "stale" && <span className="tag border border-line-2 bg-panel-3 text-dim">{t("staleTag")}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-dim">{t("targetBearingLine")}</div>
            <div className="readout text-[22px] font-bold leading-none text-accent">{formatBearing(rb.bearingDeg)}</div>
            <div className="readout mt-0.5 text-[12px] text-text">{formatRange(rb.rangeNm)}</div>
          </div>
        </div>

        {/* confidence */}
        <div className="mt-3 flex items-center gap-2">
          <span className="w-16 text-[10.5px] text-dim">{t("confidence")}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-panel-3">
            <div className="h-full" style={{ width: `${det.confidence * 100}%`, background: color }} />
          </div>
          <span className="readout w-10 text-right text-[12px] font-semibold text-text">{Math.round(det.confidence * 100)}%</span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px]">
          {isSchool && (
            <>
              <Item k={t("schoolRadius")} v={`${det.radiusM} m`} sub={`${areaHa.toFixed(1)} ${t("hectare")}`} />
              <Item k={t("estTonnage")} v={`~${det.estTonnes} ${t("tonnes")}`} />
              <Item k={t("activity")} v={pick(ACTIVITY[det.activity])} sub={pick(ACTIVITY[det.activity].hint)} />
              <Item k={t("birds")} v={det.birdCount > 0 ? String(det.birdCount) : "—"} />
            </>
          )}
          {det.kind === "birds" && <Item k={t("birds")} v={String(det.birdCount)} />}
          <Item k={t("captured")} v={formatTimeUTC(det.capturedAt)} />
          <Item
            k={t("photoAge")}
            v={<span style={{ color: ageColor(ageMs) }}>{formatAgeLong(ageMs, locale)}</span>}
            sub={t(`ageBucket_${bucket}`)}
          />
          <Item
            k={t("capturedBy")}
            v={drone?.callsign ?? det.droneId}
            sub={`${t("camAlt")} ${det.snapshot.altitudeM} m · ${det.snapshot.gsdM.toFixed(2)} m/px`}
          />
          <Item k={t("position")} v={<>{formatLat(det.position.lat)}<br />{formatLon(det.position.lon)}</>} />
        </dl>

        {det.rescan && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-drone/40 bg-drone/10 px-2.5 py-1.5 text-[11.5px] text-drone">
            <span className="blink inline-block h-1.5 w-1.5 rounded-full bg-drone" />
            {t("rescanTag")} · {rescanDrone?.callsign} · {t("rescanEta")}{" "}
            <span className="readout font-semibold">{rescanEtaMin} {t("minutesShort")}</span>
          </div>
        )}

        <div className="mt-3 mb-3 flex flex-wrap gap-2">
          {det.status !== "confirmed" ? (
            <button type="button" className="btn btn-primary" onClick={() => onConfirm(det.id)}>
              ✓ {t("confirm")}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => onReset(det.id)}>
              {t("undo")}
            </button>
          )}
          {det.status !== "dismissed" ? (
            <button type="button" className="btn btn-danger" onClick={() => onDismiss(det.id)}>
              {t("dismiss")}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => onReset(det.id)}>
              {t("undo")}
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={!!det.rescan || !airborne}
            onClick={() => onRescan(det.id)}
            title={!airborne ? t("noDroneForRescan") : undefined}
          >
            ⟳ {det.rescan ? t("rescanBusy") : t("rescan")}
          </button>
        </div>
      </div>
    </section>
  );
}

function Item({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] text-dim">{k}</dt>
      <dd className="readout text-[12.5px] text-text">{v}</dd>
      {sub && <dd className="truncate text-[10.5px] text-muted">{sub}</dd>}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded border border-line text-[10px] text-muted transition-colors hover:bg-panel-3 hover:text-text"
    >
      {children}
    </button>
  );
}
