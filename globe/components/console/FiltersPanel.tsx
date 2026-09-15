"use client";

import type { Orientation } from "@/components/radar/RadarDisplay";
import { KIND_COLOR } from "@/components/radar/markers";
import { KIND_ORDER } from "@/lib/species";
import type { DetectionKind } from "@/lib/types";
import { useLocale } from "./LocaleContext";

export const RANGE_OPTIONS = [6, 12, 24, 48] as const;
export const MAX_AGE_OPTIONS = [30, 60, 120, 360] as const;

export interface ViewSettings {
  rangeNm: (typeof RANGE_OPTIONS)[number];
  orientation: Orientation;
  showCoverage: boolean;
  kinds: Record<DetectionKind, boolean>;
  maxAgeMin: (typeof MAX_AGE_OPTIONS)[number];
  minConfidence: number;
  showDismissed: boolean;
}

export const DEFAULT_VIEW: ViewSettings = {
  rangeNm: 24,
  orientation: "north",
  showCoverage: true,
  kinds: { school: true, birds: true, floating: true },
  maxAgeMin: 120,
  minConfidence: 0.5,
  showDismissed: false,
};

interface Props {
  view: ViewSettings;
  onChange: (patch: Partial<ViewSettings>) => void;
}

export function FiltersPanel({ view, onChange }: Props) {
  const { t, locale } = useLocale();
  const ageLabel = (m: number) =>
    locale === "zh-TW" ? (m < 60 ? `${m}分` : `${m / 60}時`) : m < 60 ? `${m}m` : `${m / 60}h`;

  return (
    <section className="p-3">
      <h2 className="panel-title mb-2">{t("display")}</h2>
      <div className="flex flex-col gap-2 text-[11.5px]">
        <Field label={t("range")}>
          <div className="seg" role="group">
            {RANGE_OPTIONS.map((r) => (
              <button key={r} type="button" aria-pressed={view.rangeNm === r} onClick={() => onChange({ rangeNm: r })}>
                {r}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("orientation")}>
          <div className="seg" role="group">
            <button type="button" aria-pressed={view.orientation === "north"} onClick={() => onChange({ orientation: "north" })}>
              {t("northUp")}
            </button>
            <button type="button" aria-pressed={view.orientation === "head"} onClick={() => onChange({ orientation: "head" })}>
              {t("headUp")}
            </button>
          </div>
        </Field>
        <Check checked={view.showCoverage} onChange={(v) => onChange({ showCoverage: v })} label={t("coverage")} />
      </div>

      <h2 className="panel-title mt-4 mb-2">{t("filters")}</h2>
      <div className="flex flex-col gap-2 text-[11.5px]">
        <Field label={t("show")}>
          <div className="flex flex-wrap gap-1.5">
            {KIND_ORDER.map((k) => {
              const on = view.kinds[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ kinds: { ...view.kinds, [k]: !on } })}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                    on ? "border-line-2 bg-panel-3 text-text" : "border-line text-dim hover:text-muted"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: on ? KIND_COLOR[k] : "var(--color-dim)" }}
                  />
                  {t(`kind_${k}`)}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={t("maxAge")}>
          <div className="seg" role="group">
            {MAX_AGE_OPTIONS.map((m) => (
              <button key={m} type="button" aria-pressed={view.maxAgeMin === m} onClick={() => onChange({ maxAgeMin: m })}>
                {ageLabel(m)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("minConfidence")}>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={view.minConfidence}
              onChange={(e) => onChange({ minConfidence: Number(e.target.value) })}
              className="h-1 flex-1 accent-accent"
              aria-label={t("minConfidence")}
            />
            <span className="readout w-9 text-right text-text">{Math.round(view.minConfidence * 100)}%</span>
          </div>
        </Field>
        <Check checked={view.showDismissed} onChange={(v) => onChange({ showDismissed: v })} label={t("showDismissed")} />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] text-dim">{label}</span>
      {children}
    </div>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-muted hover:text-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {label}
    </label>
  );
}
