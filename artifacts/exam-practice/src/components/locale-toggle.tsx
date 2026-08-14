import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale";

export function LocaleToggle() {
  const [locale, setLocale] = useLocale();

  return (
    <div className="inline-flex h-9 items-center rounded-md border border-border bg-background p-0.5">
      <Button
        type="button"
        variant={locale === "en" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-3 text-xs"
        onClick={() => setLocale("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        variant={locale === "ko" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-3 text-xs"
        onClick={() => setLocale("ko")}
      >
        KR
      </Button>
    </div>
  );
}
