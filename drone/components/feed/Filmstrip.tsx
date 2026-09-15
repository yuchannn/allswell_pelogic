"use client";

import { SnapshotCanvas } from "@/components/snapshot/SnapshotCanvas";
import { ageColor } from "@/components/console/TargetList";
import { useLocale } from "@/components/console/LocaleContext";
import { formatAgeShort } from "@/lib/format";
import { KIND, KIND_COLOR, SPECIES } from "@/lib/species";
import type { Detection, Environment } from "@/lib/types";

interface Props {
  /** Newest first */
  captures: Detection[];
  callsign: string;
  env: Environment;
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  max?: number;
}

/** Row of this sortie's recent captures — the drone's own contact sheet. */
export function Filmstrip({ captures, callsign, env, now, selectedId, onSelect, max = 8 }: Props) {
  const { t, pick, locale } = useLocale();
  const shown = captures.slice(0, max);
  return (
    <div className="flex items-center gap-2 border-t border-line px-2.5 py-1.5">
      <span className="panel-title w-12 shrink-0 leading-tight">{t("recentCaptures")}</span>
      <ul className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {shown.map((det) => {
          const selected = det.id === selectedId;
          const ageMs = now - det.capturedAt;
          const name = det.kind === "school" ? pick(SPECIES[det.species]) : pick(KIND[det.kind]);
          return (
            <li key={det.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(det.id)}
                aria-pressed={selected}
                title={`${det.id} · ${name}`}
                className={`block w-[104px] rounded-md border p-[2px] text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                  selected ? "border-text" : "border-line hover:border-line-2"
                } ${det.status === "dismissed" ? "opacity-50" : ""}`}
              >
                <SnapshotCanvas det={det} droneCallsign={callsign} env={env} hud="box" className="rounded-[3px]" />
                <span className="mt-0.5 flex items-center justify-between px-0.5 text-[9.5px] leading-tight">
                  <span className="flex items-center gap-1 truncate">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[det.kind] }} />
                    <span className="readout truncate text-muted">{det.kind === "school" ? SPECIES[det.species].code : det.id}</span>
                  </span>
                  <span className="readout" style={{ color: ageColor(ageMs) }}>
                    {formatAgeShort(ageMs, locale)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
