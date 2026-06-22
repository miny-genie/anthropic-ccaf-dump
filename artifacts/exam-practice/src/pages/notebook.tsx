import { useListWrongAnswers, useListWrongAnswerScenarios, useUpdateWrongAnswer, getListWrongAnswersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

export default function Notebook() {
  const [scenarioFilter, setScenarioFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const updateMutation = useUpdateWrongAnswer();

  const { data: scenarios } = useListWrongAnswerScenarios();
  const { data: wrongAnswers, isLoading } = useListWrongAnswers({ 
    scenario: scenarioFilter !== "all" ? scenarioFilter : undefined,
    isRealTest: typeFilter === "real" ? true : typeFilter === "mock" ? false : undefined
  });

  const handleMarkResolved = (id: number, resolved: boolean) => {
    updateMutation.mutate(
      { id, data: { resolved } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListWrongAnswersQueryKey() });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="space-y-4 animate-pulse">
      <Skeleton className="h-10 w-1/3 mb-8" />
      <Skeleton className="h-10 w-full mb-4" />
      <Skeleton className="h-48 w-full" />
    </div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Notebook</h1>
          <p className="text-lg text-muted-foreground mt-2 font-serif italic">
            Questions you missed. Review and learn.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="real">Real Tests</SelectItem>
            <SelectItem value="mock">Practice Mode</SelectItem>
          </SelectContent>
        </Select>

        <Select value={scenarioFilter} onValueChange={setScenarioFilter}>
          <SelectTrigger className="w-[240px] bg-card">
            <SelectValue placeholder="All Scenarios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scenarios</SelectItem>
            {scenarios?.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {!wrongAnswers?.length ? (
           <Card className="bg-card border-card-border shadow-sm p-12 text-center">
             <FileText className="w-12 h-12 text-muted mx-auto mb-4" />
             <h3 className="font-serif text-xl mb-2 text-foreground">No questions found</h3>
             <p className="text-muted-foreground">
               Looks like you haven't gotten anything wrong that matches these filters!
             </p>
           </Card>
        ) : (
          wrongAnswers.map(wa => (
            <Card key={wa.id} className="bg-card border-card-border shadow-sm opacity-100 transition-opacity">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-wrap gap-2">
                    {wa.scenario && (
                      <span className="text-[10px] bg-secondary text-foreground px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                        {wa.scenario}
                      </span>
                    )}
                    {wa.isRealTest && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                        Real Test
                      </span>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleMarkResolved(wa.id, !wa.resolvedAt)}
                    className={wa.resolvedAt ? "text-success" : "text-muted-foreground hover:text-foreground"}
                  >
                    {wa.resolvedAt ? (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Resolved</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2 opacity-50" /> Mark Resolved</>
                    )}
                  </Button>
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none font-serif text-lg mb-6 leading-relaxed">
                  {wa.questionText}
                </div>

                <div className="space-y-3 mb-6">
                  {wa.options.map(opt => {
                    const isSelected = wa.selectedOption === opt.label;
                    const isCorrect = wa.correctOption === opt.label;
                    
                    let bgClass = "bg-secondary/50";
                    let borderClass = "border-transparent";
                    let icon = null;

                    if (isCorrect) {
                      bgClass = "bg-success/10";
                      borderClass = "border-success/30";
                      icon = <CheckCircle className="w-5 h-5 text-success shrink-0" />;
                    } else if (isSelected) {
                      bgClass = "bg-destructive/10";
                      borderClass = "border-destructive/30";
                      icon = <XCircle className="w-5 h-5 text-destructive shrink-0" />;
                    }

                    return (
                      <div key={opt.label} className={`flex items-start gap-3 p-4 rounded-lg border ${bgClass} ${borderClass}`}>
                        <div className="font-semibold text-foreground mt-0.5">{opt.label}.</div>
                        <div className="flex-1 text-foreground">{opt.text}</div>
                        {icon}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
