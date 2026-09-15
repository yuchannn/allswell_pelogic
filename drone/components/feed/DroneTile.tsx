"use client";

import type { CSSProperties } from "react";
import { useElementSize } from "@/hooks/useElementSize";
import { LinkBars, STATUS_STYLE } from "@/components/console/FleetPanel";
import { useLocale } from "@/components/console/LocaleContext";
import { ageColor } from "@/components/console/TargetList";
import { SnapshotCanvas } from "@/components/snapshot/SnapshotCanvas";
import { AGE } from "@/lib/age";
import { rangeBearing } from "@/lib/geo";
import { formatAgeShort, formatBearing, formatDurationHM, formatRange } from "@/lib/format";
import { KIND, KIND_COLOR, SPECIES } from "@/lib/species";
import type { Detection, Drone, SimState } from "@/lib/types";
import { Filmstrip } from "./Filmstrip";
import { LiveFrame } from "./LiveFrame";

export type TileSize = "large" | "medium" | "small";

interface Props {
  drone: Drone;
  /** 1-based hot-key shown next to the callsign */
  index: number;
  state: SimState;
  /** This drone's captures that pass the operator's filters, newest first */
  captures: Detection[];
  selectedId: string | null;
  focused: boolean;
  /** An unacknowledged alert is attached to the frame being shown */
  alerting: boolean;
  size: TileSize;
  className?: string;
  onSelect: (id: string) => void;
  onFocus: () => void;
  onExpand: (id: string) => void;
}

/** HUD status line — kept in English like the rest of the camera overlay. */
const HUD_STATUS: Record<Drone["status"], string> = {
  airborne: "SEARCHING",
  launching: "CLIMBING",
  returning: "RETURNING",
  deck: "STANDBY",
};

/**
 * One drone = one tile: live telemetry strip, the aircraft's latest capture (or its
 * live EO view while searching / static when the camera is off on deck), and a
 * caption with the numbers the fishing master steers by.
 */
export function DroneTile({
  drone,
  index,
  state,
  captures,
  selectedId,
  focused,
  alerting,
  size,
  className = "",
  onSelect,
  onFocus,
  onExpand,
}: Props) {
  const { t, pick, locale } = useLocale();
  const { ref: stageRef, width: sw, height: sh } = useElementSize<HTMLDivElement>();
  const { now, vessel, env } = state;

  const latest = captures[0] ?? null;
  const flying = drone.status !== "deck";
  const small = size === "small";
  const large = size === "large";
  const ageMs = latest ? now - latest.capturedAt : 0;
  const isNew = !!latest && ageMs < AGE.newTagMs && latest.status !== "dismissed";
  const isSchool = latest?.kind === "school";
  const color = latest ? KIND_COLOR[latest.kind] : "var(--color-drone)";
  const shownSelected = !!latest && latest.id === selectedId;
  const rb = rangeBearing(vessel.position, drone.position);
  const tb = latest ? rangeBearing(vessel.position, latest.position) : null;
  const readyMs = drone.readyAt - now;
  const name = latest ? (isSchool ? pick(SPECIES[latest.species]) : pick(KIND[latest.kind])) : "";

  // fit a 16:9 frame in whatever the layout gave us
  const pad = small ? 4 : 8;
  const frameW = Math.max(0, Math.floor(Math.min(sw - pad * 2, ((sh - pad * 2) * 16) / 9)));

  const summary = latest
    ? isSchool
      ? `r ${latest.radiusM} m · ~${latest.estTonnes} t · ${Math.round(latest.confidence * 100)}%`
      : latest.kind === "birds"
        ? `${latest.birdCount} · ${Math.round(latest.confidence * 100)}%`
        : `${Math.round(latest.confidence * 100)}%`
    : "";

  const borderClass = alerting ? "alert-ring" : focused ? "border-accent-2/70" : shownSelected ? "border-line-2" : "border-line";
  const style = alerting ? ({ "--alert-color": color, borderColor: color } as CSSProperties) : undefined;

  return (
    <article
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border bg-panel-2 ${borderClass} ${className}`}
      style={style}
      aria-label={`${drone.callsign} ${t("feeds")}`}
    >
      {/* telemetry strip */}
      <header className={`flex shrink-0 items-center justify-between gap-2 border-b border-line ${small ? "h-7 px-2" : "h-8 px-2.5"}`}>
        <div className="flex min-w-0 items-center gap-2">
          <svg width="12" height="12" viewBox="-7 -8 14 16" aria-hidden="true" className="shrink-0">
            <path d="M0 -8 L7 7 L0 3.5 L-7 7 Z" fill={flying ? "var(--color-drone)" : "var(--color-dim)"} />
          </svg>
          <span className={`readout font-semibold text-text ${small ? "text-[11.5px]" : "text-[12.5px]"}`}>{drone.callsign}</span>
          <span className="readout text-[9.5px] text-dim">{index}</span>
          <span className={`tag border ${STATUS_STYLE[drone.status]}`}>{t(`droneStatus_${drone.status}`)}</span>
          {alerting && <span className="blink inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
        </div>

        <div className="readout flex shrink-0 items-center gap-3 text-[10.5px] text-muted">
          {!small && flying && (
            <>
              {large && (
                <span>
                  {t("heading")} <span className="font-semibold text-accent">{formatBearing(drone.headingDeg)}</span>
                </span>
              )}
              {large && (
                <span>
                  {formatBearing(rb.bearingDeg)} · {formatRange(rb.rangeNm)}
                </span>
              )}
              <span>
                {t("altitude")} <span className="text-text">{Math.round(drone.altitudeM)} m</span>
              </span>
              <span>
                {t("battery")}{" "}
                <span className={drone.batteryPct > 40 ? "text-text" : drone.batteryPct > 25 ? "text-warn" : "text-danger"}>
                  {Math.round(drone.batteryPct)}%
                </span>
              </span>
              <LinkBars q={drone.link} />
            </>
          )}
          {!small && !flying && (
            <span>
              {readyMs > 0 ? (
                <>
                  {t("readyIn")} <span className="text-text">{Math.ceil(readyMs / 60000)} {t("minutesShort")}</span>
                </>
              ) : (
                <span className="text-drone">{t("readyNow")}</span>
              )}
              <span className="ml-3">
                {t("battery")} <span className="text-text">{Math.round(drone.batteryPct)}%</span>
              </span>
            </span>
          )}
          {small && flying && <span className="text-text">{Math.round(drone.batteryPct)}%</span>}
          <div className="flex items-center gap-1">
            {!large && (
              <IconBtn label={t("focusDrone")} onClick={onFocus}>
                ⤢
              </IconBtn>
            )}
            {latest && !small && (
              <IconBtn label={t("viewFullscreen")} onClick={() => onExpand(latest.id)}>
                ⛶
              </IconBtn>
            )}
          </div>
        </div>
      </header>

      {/* frame */}
      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center bg-black" style={{ padding: pad }}>
        {frameW > 40 && (
          <div
            role="button"
            tabIndex={0}
            aria-label={latest ? `${drone.callsign} · ${t("latestCapture")} ${latest.id}` : `${drone.callsign} · ${t("focusDrone")}`}
            aria-pressed={shownSelected}
            onClick={() => (latest ? onSelect(latest.id) : onFocus())}
            onDoubleClick={() => latest && onExpand(latest.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (latest) onSelect(latest.id);
                else onFocus();
              }
            }}
            className={`group relative cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              shownSelected ? "ring-2 ring-text" : ""
            }`}
            style={{ width: frameW }}
          >
            {latest ? (
              <SnapshotCanvas
                det={latest}
                droneCallsign={drone.callsign}
                env={env}
                // the full camera HUD is unreadable at strip size — keep just the detector box
                hud={small ? "box" : "full"}
                className={flying ? "" : "saturate-[0.35]"}
              />
            ) : (
              <LiveFrame drone={drone} env={env} now={now} mode={flying ? "live" : "nosignal"} statusLine={HUD_STATUS[drone.status]} />
            )}

            {/* what am I looking at? — turns into the NEW banner while the capture is fresh */}
            <span
              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded border px-1.5 py-[1px] text-[10px] font-semibold tracking-wider ${
                small ? "top-1" : "top-2"
              } ${isNew ? "blink border-transparent text-bg" : "border-line-2 bg-panel/85"}`}
              style={isNew ? { background: color } : undefined}
            >
              {latest && isNew ? (
                <>
                  {t("newTag")} · {t(`alert_${latest.kind}`)}
                  {isSchool && ` · ${SPECIES[latest.species].code}`}
                  <span className="readout ml-1.5 opacity-80">{formatAgeShort(ageMs, locale)}</span>
                </>
              ) : latest ? (
                <>
                  <span className="text-muted">{flying ? t("latestCapture") : t("lastCapture")}</span>
                  <span className="readout ml-1.5" style={{ color: ageColor(ageMs) }}>
                    {formatAgeShort(ageMs, locale)}
                  </span>
                </>
              ) : flying ? (
                <>
                  <span className="blink mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-target align-middle" />
                  <span className="text-text">{t("live")}</span>
                  <span className="ml-1.5 text-muted">
                    {drone.status === "launching" ? t("climbing") : drone.status === "returning" ? t("rtb") : t("searching")}
                  </span>
                </>
              ) : (
                <span className="text-dim">{t("noSignal")}</span>
              )}
            </span>

            {/* camera off */}
            {!flying && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-md bg-bg/60">
                <span className="text-[12px] font-semibold tracking-wider text-muted">{t("onDeckFeed")}</span>
                {!small && (
                  <span className="readout text-[11px] text-dim">
                    {readyMs > 0 ? `${t("readyIn")} ${Math.ceil(readyMs / 60000)} ${t("minutesShort")}` : t("readyNow")}
                    {" · "}
                    {t("battery")} {Math.round(drone.batteryPct)}%
                  </span>
                )}
              </div>
            )}

            {/* strip tiles carry their caption inside the frame */}
            {small && latest && (
              <span className="pointer-events-none absolute bottom-1 left-1 flex max-w-[calc(100%-8px)] items-center gap-1 rounded bg-panel/85 px-1.5 py-[1px] text-[10px]">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className="truncate font-semibold text-text">{name}</span>
                <span className="readout truncate text-muted">{summary}</span>
              </span>
            )}

            {!small && latest && (
              <span className="pointer-events-none absolute top-2 right-2 rounded border border-line-2 bg-panel/85 px-1.5 py-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                ⛶ {t("viewFullscreen")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* caption */}
      {!small && (
        <footer className="flex h-9 shrink-0 items-center justify-between gap-3 border-t border-line px-2.5 text-[11px]">
          {latest ? (
            <>
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className={`truncate text-[12.5px] font-semibold ${latest.status === "dismissed" ? "text-dim line-through" : "text-text"}`}>
                  {name}
                </span>
                {isSchool && <span className="readout text-[10.5px] text-muted">{SPECIES[latest.species].code}</span>}
                {isNew && <span className="tag border border-target/50 bg-target/15 text-target-2">{t("newTag")}</span>}
                {latest.rescanOf && <span className="tag border border-line-2 bg-panel-3 text-text">{t("resightTag")}</span>}
                {latest.status === "confirmed" && <span className="tag border border-ok/50 bg-ok/10 text-ok">{t("confirmedTag")}</span>}
                {latest.rescan && <span className="tag border border-drone/50 bg-drone/10 text-drone">{t("rescanTag")}</span>}
                <span className="readout truncate text-muted">{summary}</span>
                <span className="readout text-dim">{latest.id}</span>
              </div>
              {tb && (
                <div className="readout shrink-0 text-right leading-tight">
                  <span className="text-[10px] uppercase tracking-wider text-dim">{t("targetBearingLine")}</span>{" "}
                  <span className="font-semibold text-accent">{formatBearing(tb.bearingDeg)}</span>
                  <span className="text-dim"> · </span>
                  <span className="text-text">{formatRange(tb.rangeNm)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <span className="text-muted">{flying ? t("noCapture") : t("onDeckFeed")}</span>
              {flying && (
                <span className="readout text-dim">
                  {t("sortie")} {formatDurationHM(now - drone.launchedAt)} · {t("sortieDetections")} {drone.sortieDetections}
                </span>
              )}
            </>
          )}
        </footer>
      )}

      {large && captures.length > 1 && (
        <Filmstrip captures={captures} callsign={drone.callsign} env={env} now={now} selectedId={selectedId} onSelect={onSelect} />
      )}
    </article>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 items-center justify-center rounded border border-line text-[10px] text-muted transition-colors hover:bg-panel-3 hover:text-text"
    >
      {children}
    </button>
  );
}
