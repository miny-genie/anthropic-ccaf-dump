export type Locale = "en" | "ko";
export type TranslationLocale = Exclude<Locale, "en">;

export function normalizeLocale(value: unknown): Locale {
  return value === "ko" ? "ko" : "en";
}

export function translationLocale(value: unknown): TranslationLocale | null {
  const locale = normalizeLocale(value);
  return locale === "en" ? null : locale;
}
