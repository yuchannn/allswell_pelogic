"use client";

import { useEffect, useRef, useState } from "react";
import { useElementSize } from "@/hooks/useElementSize";
import { useLocale } from "@/components/console/LocaleContext";
import { ageColor } from "@/components/console/TargetList";
import { AGE, ageBucket } from "@/lib/age";
import { rangeBearing } from "@/lib/geo";
import { formatAgeLong, formatBearing, formatRange, formatTimeUTC } from "@/lib/format";
import { ACTIVITY, KIND, KIND_COLOR, SPECIES } from "@/lib/species";
import type { Detection, SimState } from "@/lib/types";
import { SnapshotCanvas } from "./SnapshotCanvas";

interface Props {
  det: Detection;
  state: SimState;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onReset: (id: string) => void;
  onRescan: (id: string) => void;
}

/** Tracks the browser Fullscreen API so the toggle button reflects reality. */
function useNativeFullscreen() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const sync = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const supported = typeof document !== "undefined" && !!document.fullscreenEnabled;
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  return { active, supported, toggle };
}

/**
 * Full-screen review of one capture. The frame is fitted to the stage at 16:9 and the
 * decision-critical numbers (steer, size, age) stay on screen so the fishing master
 * can confirm or dismiss without leaving the photo.
 */
export function SnapshotViewer({ det, state, onClose, onPrev, onNext, onConfirm, onDismiss, onReset, onRescan }: Props) {
  const { t, pick, locale } = useLocale();
  const { ref: stageRef, width: stageW, height: stageH } = useElementSize<HTMLDivElement>();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const native = useNativeFullscreen();

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const drone = state.drones.find((d) => d.id === det.droneId);
  const rb = rangeBearing(state.vessel.position, det.position);
  const ageMs = state.now - det.capturedAt;
  const isSchool = det.kind === "school";
  const color = KIND_COLOR[det.kind];
  const airborne = state.drones.some((d) => d.status === "airborne");

  // fit a 16:9 frame inside the stage
  const frameW = Math.max(0, Math.floor(Math.min(stageW, (stageH * 16) / 9)));

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${t("snapshot")} ${det.id}`}
      tabIndex={-1}
      className="fade-in fixed inset-0 z-50 flex flex-col bg-bg/95 outline-none backdrop-blur-sm"
      onClick={onClose}
    >
      {/* top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel/80 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <h2 className="panel-title">{t("snapshot")}</h2>
          <span className="readout text-[12px] text-muted">{det.id}</span>
          <span className="text-[15px] font-bold text-text">{isSchool ? pick(SPECIES[det.species]) : pick(KIND[det.kind])}</span>
          {isSchool && <span className="readout text-[11px] text-muted">{SPECIES[det.species].code}</span>}
          <span className="readout text-[12px] text-text">{Math.round(det.confidence * 100)}%</span>
          {ageMs < AGE.newTagMs && det.status !== "dismissed" && (
            <span className="tag border border-target/50 bg-target/15 text-target-2 blink">{t("newTag")}</span>
          )}
          {det.rescanOf && <span className="tag border border-line-2 bg-panel-3 text-text">{t("resightTag")}</span>}
          {det.status === "confirmed" && <span className="tag border border-ok/50 bg-ok/10 text-ok">{t("confirmedTag")}</span>}
          {det.status === "dismissed" && <span className="tag border border-line-2 bg-panel-3 text-dim">{t("dismissedTag")}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[10.5px] text-dim md:inline">{t("fullscreenHint")}</span>
          {native.supported && (
            <button
              type="button"
              className="btn"
              onClick={native.toggle}
              aria-pressed={native.active}
              title={t("displayFullscreen")}
            >
              ⛶ {native.active ? t("exitFullscreen") : t("displayFullscreen")}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose} aria-label={t("close")}>
            ✕ {t("close")} <span className="readout text-[10px] text-dim">Esc</span>
          </button>
        </div>
      </div>

      {/* stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 py-4">
        <button
          type="button"
          className="absolute top-1/2 left-3 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-md border border-line bg-panel/80 text-[16px] text-muted transition-colors hover:bg-panel-3 hover:text-text"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label={t("prevTarget")}
        >
          ◀
        </button>
        <div ref={stageRef} className="flex h-full w-full items-center justify-center">
          {frameW > 40 && (
            <div className="shadow-[0_20px_80px_rgba(0,0,0,0.7)]" style={{ width: frameW }} onClick={(e) => e.stopPropagation()}>
              <SnapshotCanvas det={det} droneCallsign={drone?.callsign ?? det.droneId.toUpperCase()} env={state.env} />
            </div>
          )}
        </div>
        <button
          type="button"
          className="absolute top-1/2 right-3 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-md border border-line bg-panel/80 text-[16px] text-muted transition-colors hover:bg-panel-3 hover:text-text"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label={t("nextTarget")}
        >
          ▶
        </button>
      </div>

      {/* bottom strip: the numbers that drive the decision + the decision itself */}
      <div className="flex h-[76px] shrink-0 items-center justify-between gap-6 border-t border-line bg-panel/80 px-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-7">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-dim">{t("targetBearingLine")}</div>
            <div className="readout text-[26px] leading-none font-bold text-accent">{formatBearing(rb.bearingDeg)}</div>
          </div>
          <Stat label={t("distance")} value={formatRange(rb.rangeNm)} big />
          {isSchool && (
            <>
              <Stat label={t("schoolRadius")} value={`${det.radiusM} m`} sub={`~${det.estTonnes} ${t("tonnes")}`} />
              <Stat label={t("activity")} value={pick(ACTIVITY[det.activity])} sub={det.birdCount > 0 ? `${t("birds")} ${det.birdCount}` : undefined} />
            </>
          )}
          {det.kind === "birds" && <Stat label={t("birds")} value={String(det.birdCount)} />}
          <Stat
            label={t("photoAge")}
            value={<span style={{ color: ageColor(ageMs) }}>{formatAgeLong(ageMs, locale)}</span>}
            sub={`${formatTimeUTC(det.capturedAt)} · ${t(`ageBucket_${ageBucket(ageMs)}`)}`}
          />
          <Stat label={t("capturedBy")} value={drone?.callsign ?? det.droneId} sub={`${t("camAlt")} ${det.snapshot.altitudeM} m`} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
    </div>
  );
}

function Stat({ label, value, sub, big = false }: { label: string; value: React.ReactNode; sub?: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`readout leading-none text-text ${big ? "text-[22px] font-semibold" : "text-[15px] font-semibold"}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[10.5px] text-muted">{sub}</div>}
    </div>
  );
}
