import {
  useListSources,
  useStartAttempt,
  useGetOrCreatePracticeAttempt,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { BookOpen, Clock, FileText, ChevronRight } from "lucide-react";
import { useLocale, useT } from "@/lib/locale";

export default function Modes() {
  const { data: sources, isLoading } = useListSources();
  const startMutation = useStartAttempt();
  const practiceMutation = useGetOrCreatePracticeAttempt();
  const [, setLocation] = useLocation();
  const [locale] = useLocale();
  const t = useT();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-10 w-1/3 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-48 bg-muted rounded-xl"></div>
          <div className="h-48 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  const realTestSource = sources?.find((s) => s.isRealTest);

  const handleStartRealTest = () => {
    if (!realTestSource) return;
    startMutation.mutate(
      {
        params: { locale },
        data: { sourceId: realTestSource.id, timeLimitSeconds: 7200 },
      },
      {
        onSuccess: (attempt) => {
          setLocation(`/exam/${attempt.id}`);
        },
      },
    );
  };

  const handleStartPractice = () => {
    practiceMutation.mutate(
      { params: { locale } },
      {
        onSuccess: (attempt) => {
          setLocation(`/exam/${attempt.id}`);
        },
      },
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-serif text-4xl text-foreground">
          {t("modes.title")}
        </h1>
        <p className="text-lg text-muted-foreground mt-2 font-serif italic">
          {t("modes.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-secondary border-none shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110" />
          <CardContent className="p-8 flex flex-col h-full">
            <BookOpen className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-serif text-2xl mb-2 text-foreground">
              {t("common.practiceMode")}
            </h3>
            <p className="text-muted-foreground mb-6 flex-1">
              {t("modes.practiceDescription")}
            </p>
            <Button
              onClick={handleStartPractice}
              disabled={practiceMutation.isPending}
              className="w-full justify-between bg-background text-foreground hover:bg-background/90 border border-border"
            >
              {practiceMutation.isPending
                ? t("common.opening")
                : t("common.startPractice")}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#181715] text-[#faf9f5] border-none shadow-sm relative overflow-hidden group">
          <CardContent className="p-8 flex flex-col h-full">
            <Clock className="w-8 h-8 text-[#cc785c] mb-4" />
            <h3 className="font-serif text-2xl mb-2">{t("common.realTest")}</h3>
            <p className="text-gray-400 mb-6 flex-1">
              {t("modes.realTestDescription")}
            </p>
            <Button
              onClick={handleStartRealTest}
              disabled={startMutation.isPending || !realTestSource}
              className="w-full justify-between bg-[#cc785c] text-white hover:bg-[#a9583e] border-none"
            >
              {startMutation.isPending
                ? t("common.starting")
                : t("common.startSimulation")}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="font-serif text-2xl text-foreground mb-6 mt-12">
          {t("modes.review")}
        </h2>
        <Card className="bg-card border-card-border shadow-sm">
          <CardContent className="p-8 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-6 h-6 text-warning" />
                <h3 className="font-serif text-xl text-foreground">
                  {t("common.wrongAnswerNotebook")}
                </h3>
              </div>
              <p className="text-muted-foreground">
                {t("modes.notebookDescription")}
              </p>
            </div>
            <Link href="/notebook">
              <Button variant="outline">{t("common.openNotebook")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
