import { useListAttempts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function History() {
  const { data: attempts, isLoading } = useListAttempts();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <Skeleton className="h-10 w-1/3 mb-8" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!attempts?.length) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="font-serif text-4xl text-foreground">History</h1>
        </div>
        <Card className="bg-card border-card-border shadow-sm p-12 text-center">
          <Clock className="w-12 h-12 text-muted mx-auto mb-4" />
          <h3 className="font-serif text-xl mb-2 text-foreground">No attempts yet</h3>
          <p className="text-muted-foreground mb-6">
            Your completed practice sessions and real tests will appear here.
          </p>
          <Link href="/modes">
            <span className="text-primary hover:underline font-medium cursor-pointer">Start practicing</span>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-serif text-4xl text-foreground">History</h1>
        <p className="text-lg text-muted-foreground mt-2 font-serif italic">
          Past attempts and simulations.
        </p>
      </div>

      <div className="space-y-4">
        {attempts.map(attempt => (
          <Link key={attempt.id} href={`/result/${attempt.id}`}>
            <Card className="hover:bg-secondary/50 transition-colors cursor-pointer border-card-border">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-lg text-foreground font-serif">{attempt.title}</span>
                    {attempt.isRealTest && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">Real Test</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-4">
                    <span>Started: {new Date(attempt.startedAt).toLocaleString()}</span>
                    {attempt.submittedAt && (
                      <span>Completed: {new Date(attempt.submittedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  {attempt.submittedAt ? (
                    <>
                      <div className="text-right">
                        <div className="font-serif text-2xl text-foreground">
                          {attempt.isRealTest ? attempt.scoreScaled : `${attempt.percent}%`}
                        </div>
                        {attempt.isRealTest && attempt.passed !== null && (
                          <div className={`text-xs font-medium uppercase tracking-wide mt-1 flex items-center justify-end gap-1 ${attempt.passed ? 'text-success' : 'text-destructive'}`}>
                            {attempt.passed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {attempt.passed ? 'PASSED' : 'FAILED'}
                          </div>
                        )}
                        {!attempt.isRealTest && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {attempt.correctCount} / {attempt.totalCount} correct
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-medium text-warning flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      IN PROGRESS
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
