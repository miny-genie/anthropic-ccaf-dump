import { useEffect, useState } from "react";

export type Locale = "en" | "ko";

const STORAGE_KEY = "exam_locale";

function normalizeLocale(value: string | null): Locale {
  return value === "ko" ? "ko" : "en";
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
}

export function setStoredLocale(locale: Locale): void {
  window.localStorage.setItem(STORAGE_KEY, locale);
  window.dispatchEvent(
    new CustomEvent("exam-locale-change", { detail: locale }),
  );
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const [locale, setLocale] = useState<Locale>(() => getStoredLocale());

  useEffect(() => {
    const sync = () => setLocale(getStoredLocale());
    window.addEventListener("storage", sync);
    window.addEventListener("exam-locale-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("exam-locale-change", sync);
    };
  }, []);

  return [locale, setStoredLocale];
}
