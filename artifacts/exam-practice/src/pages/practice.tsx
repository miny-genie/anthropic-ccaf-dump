import { useState } from "react";
import { useListSources, useStartAttempt } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { BookOpen, HelpCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function Practice() {
  const { data: sources, isLoading } = useListSources();
  const startMutation = useStartAttempt();
  const [, setLocation] = useLocation();
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  if (isLoading) {
    return <div className="space-y-4 animate-pulse">
      <Skeleton className="h-10 w-1/3 mb-8" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>;
  }

  const practiceSources = sources?.filter(s => !s.isRealTest) || [];

  const handleStart = () => {
    if (!selectedSourceId) return;
    startMutation.mutate(
      { data: { sourceId: selectedSourceId } },
      {
        onSuccess: (attempt) => {
          setLocation(`/exam/${attempt.id}`);
        }
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-serif text-4xl text-foreground">Practice Modules</h1>
        <p className="text-lg text-muted-foreground mt-2 font-serif italic">
          Select a question bank to practice with.
        </p>
      </div>

      <Card className="bg-card border-card-border shadow-sm">
        <CardContent className="p-6">
          <RadioGroup 
            value={selectedSourceId?.toString()} 
            onValueChange={(val) => setSelectedSourceId(parseInt(val))}
            className="space-y-4"
          >
            {practiceSources.map((source) => (
              <div key={source.id} className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-secondary/50 transition-colors">
                <RadioGroupItem value={source.id.toString()} id={source.id.toString()} className="mt-1" />
                <div className="grid gap-1.5 flex-1 cursor-pointer">
                  <Label htmlFor={source.id.toString()} className="font-serif text-lg cursor-pointer">
                    {source.title}
                  </Label>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    {source.questionCount} questions
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>

          <div className="mt-8 flex justify-end">
            <Button 
              onClick={handleStart}
              disabled={!selectedSourceId || startMutation.isPending}
              className="bg-primary text-primary-foreground px-8"
              size="lg"
            >
              {startMutation.isPending ? "Starting..." : "Start Practice"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
