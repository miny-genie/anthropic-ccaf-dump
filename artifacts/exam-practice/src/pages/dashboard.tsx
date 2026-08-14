import {
  useGetDashboard,
  useGetOrCreatePracticeAttempt,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  CheckCircle,
  Clock,
  XCircle,
  Bookmark,
  FileText,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale, useT } from "@/lib/locale";

export default function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();
  const practiceMutation = useGetOrCreatePracticeAttempt();
  const [, setLocation] = useLocation();
  const [locale] = useLocale();
  const t = useT();

  const handleStartPractice = () => {
    practiceMutation.mutate(
      { params: { locale } },
      {
        onSuccess: (attempt) => setLocation(`/exam/${attempt.id}`),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-serif text-4xl text-foreground">
          {t("dashboard.welcome", { username: dashboard.user.username })}
        </h1>
        <p className="text-lg text-muted-foreground mt-2 font-serif italic">
          {t("dashboard.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-card-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("dashboard.realTestPasses")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-serif text-foreground">
                {dashboard.realTestStat.passes}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("dashboard.attempts", {
                  count: dashboard.realTestStat.attempts,
                })}
              </span>
            </div>
            {dashboard.realTestStat.bestScaled > 0 && (
              <p className="text-xs text-success mt-1">
                {t("dashboard.bestScore", {
                  score: dashboard.realTestStat.bestScaled,
                })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("dashboard.practiceProgress")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-serif text-foreground">
                {dashboard.practiceProgress.percentComplete}%
              </span>
              <span className="text-sm text-muted-foreground">
                {t("dashboard.answered", {
                  answered: dashboard.practiceProgress.answered,
                  total: dashboard.practiceProgress.total,
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("dashboard.toReview")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <div className="flex items-baseline gap-1">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span className="text-2xl font-serif">
                    {dashboard.wrongAnswerCount}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.wrong")}
                </p>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <Bookmark className="w-4 h-4 text-warning" />
                  <span className="text-2xl font-serif">
                    {dashboard.bookmarkCount}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("dashboard.bookmarks")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-secondary border-none shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
          <CardContent className="p-8">
            <BookOpen className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-serif text-2xl mb-2 text-foreground">
              {t("common.practiceMode")}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t("dashboard.practiceDescription")}
            </p>
            <Button
              onClick={handleStartPractice}
              disabled={practiceMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {practiceMutation.isPending
                ? t("common.opening")
                : t("common.startPractice")}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#181715] text-[#faf9f5] border-none shadow-sm relative overflow-hidden">
          <CardContent className="p-8">
            <Clock className="w-8 h-8 text-[#cc785c] mb-4" />
            <h3 className="font-serif text-2xl mb-2">{t("common.realTest")}</h3>
            <p className="text-gray-400 mb-6">
              {t("dashboard.realTestDescription")}
            </p>
            <Link href="/modes">
              <Button className="bg-[#cc785c] text-white hover:bg-[#a9583e] border-none">
                {t("common.startSimulation")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {dashboard.recentAttempts.length > 0 && (
        <div>
          <h2 className="font-serif text-2xl text-foreground mb-6">
            {t("dashboard.recentActivity")}
          </h2>
          <div className="space-y-4">
            {dashboard.recentAttempts.slice(0, 3).map((attempt) => (
              <Link key={attempt.id} href={`/result/${attempt.id}`}>
                <Card className="hover:bg-secondary/50 transition-colors cursor-pointer border-card-border">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">
                          {attempt.isRealTest
                            ? t("common.realTest")
                            : t("common.practiceMode")}
                        </span>
                        {attempt.isRealTest && (
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                            {t("common.realTest")}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(attempt.startedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      {attempt.submittedAt ? (
                        <>
                          <div className="font-serif text-xl text-foreground">
                            {attempt.isRealTest
                              ? attempt.scoreScaled
                              : `${attempt.percent}%`}
                          </div>
                          {attempt.isRealTest && attempt.passed !== null && (
                            <div
                              className={`text-xs font-medium ${attempt.passed ? "text-success" : "text-destructive"}`}
                            >
                              {attempt.passed
                                ? t("common.passed")
                                : t("common.failed")}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm font-medium text-warning">
                          {t("common.inProgress")}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
