"use client";

import type { Locale } from "@/lib/format";
import { formatClock } from "@/lib/format";
import { Logo } from "./Logo";
import { useLocale } from "./LocaleContext";

interface Props {
  now: number;
  /** Ship local-time offset, hours from UTC */
  shipTzOffset: number;
  freshCount: number;
  onLocale: (l: Locale) => void;
}

export function Header({ now, shipTzOffset, freshCount, onLocale }: Props) {
  const { t, locale } = useLocale();
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-panel px-4">
      <div className="flex items-center gap-5">
        <Logo />
        <div className="h-7 w-px bg-line-2" />
        <div className="leading-tight">
          <div className="text-[14px] font-semibold text-text">
            {t("appTitle")}
            <span className="ml-2 text-[11px] font-normal text-muted">
              {locale === "zh-TW" ? "Aerial Fish Spotting" : "空中魚探"}
            </span>
          </div>
          <div className="text-[10.5px] text-dim">{t("appSubtitle")}</div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {freshCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-target/40 bg-target/10 px-2.5 py-1">
            <span className="blink inline-block h-2 w-2 rounded-full bg-target" />
            <span className="readout text-[12px] font-semibold text-target-2">
              {freshCount} {t("freshCount")}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 readout text-[12px]">
          <Clock label={t("utc")} value={formatClock(now, 0)} primary />
          <Clock label={t("shipTime")} value={formatClock(now, shipTzOffset).slice(0, 5)} />
          <Clock label={t("taipei")} value={formatClock(now, 8).slice(0, 5)} />
        </div>

        <div className="seg" role="group" aria-label={t("language")}>
          <button type="button" aria-pressed={locale === "zh-TW"} onClick={() => onLocale("zh-TW")}>
            繁中
          </button>
          <button type="button" aria-pressed={locale === "en"} onClick={() => onLocale("en")}>
            EN
          </button>
        </div>
      </div>
    </header>
  );
}

function Clock({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] tracking-wider text-dim">{label}</span>
      <span className={primary ? "text-[14px] font-semibold text-text" : "text-muted"}>{value}</span>
    </div>
  );
}
