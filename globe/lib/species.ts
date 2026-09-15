import type { DetectionKind, Species, SurfaceActivity } from "./types";

export interface SpeciesInfo {
  id: Species;
  /** Short code used on the plan display (FAO 3-alpha where one exists) */
  code: string;
  zh: string;
  en: string;
  latin?: string;
}

export const SPECIES: Record<Species, SpeciesInfo> = {
  skipjack: { id: "skipjack", code: "SKJ", zh: "正鰹", en: "Skipjack", latin: "Katsuwonus pelamis" },
  yellowfin: { id: "yellowfin", code: "YFT", zh: "黃鰭鮪", en: "Yellowfin", latin: "Thunnus albacares" },
  bigeye: { id: "bigeye", code: "BET", zh: "大目鮪", en: "Bigeye", latin: "Thunnus obesus" },
  mixed: { id: "mixed", code: "MIX", zh: "混群", en: "Mixed school" },
  unknown: { id: "unknown", code: "UNK", zh: "未識別", en: "Unidentified" },
};

export const SPECIES_ORDER: Species[] = ["skipjack", "yellowfin", "bigeye", "mixed", "unknown"];

export const ACTIVITY: Record<SurfaceActivity, { zh: string; en: string; hint: { zh: string; en: string } }> = {
  breezer: {
    zh: "漣漪群",
    en: "Breezer",
    hint: { zh: "表層下魚群造成水面漣漪", en: "Ripple from a school just below the surface" },
  },
  boiler: {
    zh: "翻騰群",
    en: "Boiler",
    hint: { zh: "魚群於水面攝食，水面翻騰", en: "Feeding at the surface, water boiling" },
  },
  foamer: {
    zh: "白泡群",
    en: "Foamer",
    hint: { zh: "劇烈攝食，大量白泡", en: "Heavy feeding with white water" },
  },
  jumper: {
    zh: "跳躍群",
    en: "Jumper",
    hint: { zh: "魚體躍出水面", en: "Fish clearing the surface" },
  },
  shadow: {
    zh: "暗影群",
    en: "Shadow",
    hint: { zh: "水下暗色魚群，無水面擾動", en: "Dark sub-surface mass, no surface disturbance" },
  },
};

export const KIND: Record<DetectionKind, { zh: string; en: string; color: string }> = {
  school: { zh: "魚群", en: "School", color: "var(--color-target)" },
  birds: { zh: "鳥群", en: "Birds", color: "var(--color-birds)" },
  floating: { zh: "漂流物", en: "Floating object", color: "var(--color-floating)" },
};

export const KIND_ORDER: DetectionKind[] = ["school", "birds", "floating"];
