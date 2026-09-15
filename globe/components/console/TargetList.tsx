"use client";

import { useEffect, useRef } from "react";
import { KIND_COLOR } from "@/components/radar/markers";
import { AGE, ageBucket } from "@/lib/age";
import { formatAgeShort, formatBearing, formatRange } from "@/lib/format";
import { KIND, SPECIES } from "@/lib/species";
import type { Detection } from "@/lib/types";
import { useLocale } from "./LocaleContext";

export type SortKey = "newest" | "nearest" | "largest" | "confidence";

export interface ListRow {
  det: Detection;
  rangeNm: number;
  bearingDeg: number;
  ageMs: number;
  inRange: boolean;
}

interface Props {
  rows: ListRow[];
  sort: SortKey;
  onSort: (s: SortKey) => void;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  inRangeCount: number;
}

export function ageColor(ageMs: number): string {
  const b = ageBucket(ageMs);
  return b === "fresh"
    ? "var(--color-ok)"
    : b === "recent"
      ? "var(--color-text)"
      : b === "aging"
        ? "var(--color-warn)"
        : "var(--color-dim)";
}

export function TargetList({ rows, sort, onSort, selectedId, hoveredId, onSelect, onHover, inRangeCount }: Props) {
  const { t, pick, locale } = useLocale();
  const listRef = useRef<HTMLUListElement | null>(null);

  // keep the selected row in view when selection comes from the plot
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-id="${selectedId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="panel-title">
          {t("targets")} <span className="readout ml-1 text-text">{rows.length}</span>
          <span className="ml-1.5 text-dim normal-case tracking-normal">
            ({inRangeCount} {t("inRange")})
          </span>
        </h2>
        <div className="seg" role="group" aria-label={t("sort")}>
          {(["newest", "nearest", "largest", "confidence"] as SortKey[]).map((k) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => onSort(k)}>
              {t(`sort_${k}`)}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-4 text-[12px] text-muted">{t("noTargets")}</div>
      ) : (
        <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {rows.map(({ det, rangeNm, bearingDeg, ageMs, inRange }) => {
            const selected = det.id === selectedId;
            const hovered = det.id === hoveredId;
            const isSchool = det.kind === "school";
            const dismissed = det.status === "dismissed";
            return (
              <li key={det.id} data-id={det.id}>
                <button
                  type="button"
                  onClick={() => onSelect(det.id)}
                  onMouseEnter={() => onHover(det.id)}
                  onMouseLeave={() => onHover(null)}
                  className={`grid w-full grid-cols-[14px_1fr_auto] items-center gap-x-2.5 border-b border-line/70 px-3 py-2 text-left transition-colors ${
                    selected ? "bg-panel-3" : hovered ? "bg-panel-2" : "hover:bg-panel-2"
                  } ${dismissed || !inRange ? "opacity-55" : ""}`}
                >
                  <span
                    className={`inline-block rounded-full ${isSchool ? "h-3 w-3" : det.kind === "birds" ? "h-2.5 w-2.5 rotate-45 rounded-none" : "h-2.5 w-2.5 rounded-none border"}`}
                    style={{
                      background: det.kind === "floating" ? "transparent" : dismissed ? "var(--color-dim)" : KIND_COLOR[det.kind],
                      borderColor: KIND_COLOR.floating,
                      opacity: isSchool ? Math.max(0.35, 1 - ageMs / (2 * AGE.staleMs)) : 1,
                    }}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className={`truncate text-[12.5px] font-semibold ${dismissed ? "text-dim line-through" : "text-text"}`}>
                        {isSchool ? pick(SPECIES[det.species]) : pick(KIND[det.kind])}
                      </span>
                      {ageMs < AGE.newTagMs && !dismissed && (
                        <span className="tag border border-target/50 bg-target/15 text-target-2">{t("newTag")}</span>
                      )}
                      {det.rescanOf && <span className="tag border border-line-2 bg-panel-3 text-text">{t("resightTag")}</span>}
                      {det.status === "confirmed" && <span className="tag border border-ok/50 bg-ok/10 text-ok">{t("confirmedTag")}</span>}
                      {det.rescan && <span className="tag border border-drone/50 bg-drone/10 text-drone">{t("rescanTag")}</span>}
                    </span>
                    <span className="readout mt-0.5 block text-[11px] text-muted">
                      {isSchool ? (
                        <>
                          r {det.radiusM} m · ~{det.estTonnes} t · {Math.round(det.confidence * 100)}%
                        </>
                      ) : det.kind === "birds" ? (
                        <>
                          {det.birdCount} · {Math.round(det.confidence * 100)}%
                        </>
                      ) : (
                        <>{Math.round(det.confidence * 100)}%</>
                      )}
                      <span className="ml-1.5 text-dim">{det.id}</span>
                    </span>
                  </span>
                  <span className="readout text-right text-[11.5px] leading-tight">
                    <span className="block text-text">
                      {formatBearing(bearingDeg)} <span className="text-dim">·</span> {formatRange(rangeNm)}
                    </span>
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
