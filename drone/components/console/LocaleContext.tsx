"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/lib/format";
import { translate, type I18nKey } from "@/lib/i18n";

export interface LocaleCtx {
  locale: Locale;
  t: (key: I18nKey) => string;
  /** Pick the right label from a {zh,en} pair */
  pick: (pair: { zh: string; en: string }) => string;
}

export const LocaleContext = createContext<LocaleCtx>({
  locale: "zh-TW",
  t: (k) => translate("zh-TW", k),
  pick: (p) => p.zh,
});

export function useLocale(): LocaleCtx {
  return useContext(LocaleContext);
}

export function makeLocaleCtx(locale: Locale): LocaleCtx {
  return {
    locale,
    t: (k) => translate(locale, k),
    pick: (p) => (locale === "zh-TW" ? p.zh : p.en),
  };
}
