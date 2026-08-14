import { useParams, Link } from "wouter";
import {
  useGetAttemptResult,
  getGetAttemptResultQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, ChevronLeft, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale, useT } from "@/lib/locale";

export default function Result() {
  const { id } = useParams<{ id: string }>();
  const attemptId = parseInt(id || "0", 10);
  const [locale] = useLocale();
  const t = useT();

  const { data: result, isLoading } = useGetAttemptResult(
    attemptId,
    {
      locale,
    },
    {
      query: {
        enabled: !!attemptId,
        queryKey: getGetAttemptResultQueryKey(attemptId, { locale }),
      },
    },
  );

  if (isLoading || !result) {
    return (
      <div className="min-h-screen bg-background flex flex-col p-8 items-center justify-center font-serif text-muted-foreground animate-pulse">
        {t("result.loading")}
      </div>
    );
  }

  const {
    isRealTest,
    passed,
    scoreScaled,
    percent,
    correctCount,
    totalCount,
    scenarioBreakdown,
    wrongAnswers,
  } = result;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="text-muted-foreground">
              <ChevronLeft className="w-4 h-4 mr-2" />
              {t("result.backToDashboard")}
            </Button>
          </Link>
          <h1 className="font-serif text-lg font-medium text-foreground">
            {t("result.title")}
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Hero Score Card */}
        <Card
          className={`border-none shadow-sm text-center py-12 ${isRealTest && passed ? "bg-success/10" : isRealTest && passed === false ? "bg-destructive/10" : "bg-[#181715] text-[#faf9f5]"}`}
        >
          <CardContent className="space-y-4">
            <h2
              className={`font-serif text-2xl ${isRealTest && passed ? "text-success" : isRealTest && passed === false ? "text-destructive" : "text-[#cc785c]"}`}
            >
              {isRealTest
                ? passed
                  ? t("result.certificationPassed")
                  : t("result.didNotPass")
                : t("result.practiceCompleted")}
            </h2>

            <div
              className={`font-serif text-7xl md:text-8xl font-bold tracking-tight ${isRealTest && passed ? "text-success-foreground" : isRealTest && passed === false ? "text-destructive-foreground" : "text-white"}`}
            >
              {isRealTest ? scoreScaled : `${percent}%`}
            </div>

            <p
              className={`text-lg opacity-80 font-medium ${isRealTest && passed ? "text-success-foreground" : isRealTest && passed === false ? "text-destructive-foreground" : "text-gray-300"}`}
            >
              {t("result.correctSummary", {
                correct: correctCount,
                total: totalCount,
              })}
            </p>
          </CardContent>
        </Card>

        {/* Breakdown */}
        {scenarioBreakdown && scenarioBreakdown.length > 0 && (
          <div>
            <h3 className="font-serif text-2xl text-foreground mb-6">
              {t("result.domainBreakdown")}
            </h3>
            <div className="space-y-4">
              {scenarioBreakdown.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 bg-card p-4 rounded-xl border border-card-border shadow-sm"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-2">
                      <span className="font-medium text-foreground">
                        {s.scenario}
                      </span>
                      <span className="text-sm font-semibold">
                        {s.percent}%
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.percent >= 72 ? "bg-success" : s.percent >= 50 ? "bg-warning" : "bg-destructive"}`}
                        style={{ width: `${s.percent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 text-right">
                      {s.correct} / {s.total}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wrong Answers Overview */}
        {wrongAnswers && wrongAnswers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-2xl text-foreground">
                {t("result.areasToReview")}
              </h3>
              <Link href="/notebook">
                <Button variant="outline">
                  {t("result.goToNotebook")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            <div className="space-y-6">
              {wrongAnswers.slice(0, 5).map((wa) => (
                <Card
                  key={wa.questionId}
                  className="bg-card border-card-border shadow-sm"
                >
                  <CardContent className="p-6">
                    <div className="mb-4">
                      {wa.scenario && (
                        <span className="text-[10px] bg-secondary text-foreground px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold mb-2 inline-block">
                          {wa.scenario}
                        </span>
                      )}
                      <p className="font-serif text-lg text-foreground line-clamp-2">
                        {wa.questionText}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {wa.selectedOption && (
                        <div className="flex items-start gap-2 text-sm text-destructive">
                          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>
                            {t("result.youSelected")}{" "}
                            <span className="font-semibold">
                              {wa.selectedOption}
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-sm text-success">
                        <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                          {t("result.correctAnswer")}{" "}
                          <span className="font-semibold">
                            {wa.correctOption}
                          </span>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {wrongAnswers.length > 5 && (
                <div className="text-center pt-4">
                  <p className="text-muted-foreground mb-4">
                    {t("result.moreWrongAnswers", {
                      count: wrongAnswers.length - 5,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
