import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useGetAttempt, useSaveAnswer, useSubmitAttempt, getGetAttemptQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Flag, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Exam() {
  const { id } = useParams<{ id: string }>();
  const attemptId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: attempt, isLoading } = useGetAttempt(attemptId, {
    query: { enabled: !!attemptId, queryKey: getGetAttemptQueryKey(attemptId) }
  });

  const saveAnswerMutation = useSaveAnswer();
  const submitMutation = useSubmitAttempt();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Sync timer
  useEffect(() => {
    if (attempt?.remainingSeconds !== undefined && timeLeft === null) {
      setTimeLeft(attempt.remainingSeconds);
    }
  }, [attempt, timeLeft]);

  // Tick timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || submitMutation.isPending) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitMutation.isPending]);

  if (isLoading || !attempt) {
    return <div className="min-h-screen bg-background flex items-center justify-center font-serif text-muted-foreground animate-pulse">Loading exam...</div>;
  }

  // Redirect if already submitted
  if (attempt.submittedAt) {
    setLocation(`/result/${attempt.id}`);
    return null;
  }

  const questions = attempt.questions;
  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (optionLabel: string) => {
    if (saveAnswerMutation.isPending) return;

    const isFlagged = currentQuestion.flagged;
    
    // Optimistic update
    queryClient.setQueryData(getGetAttemptQueryKey(attemptId), (old: any) => {
      if (!old) return old;
      const newQuestions = [...old.questions];
      newQuestions[currentIndex] = { ...newQuestions[currentIndex], selectedOption: optionLabel };
      return { ...old, questions: newQuestions };
    });

    saveAnswerMutation.mutate({
      id: attemptId,
      data: { questionId: currentQuestion.id, selectedOption: optionLabel, flagged: isFlagged }
    }, {
      onSuccess: (result) => {
        // Mockup mode immediate feedback logic could go here if we wanted to show it without reloading
        // But getAttempt provides the truth. If we need feedback, we rely on the refetch or update state
        queryClient.invalidateQueries({ queryKey: getGetAttemptQueryKey(attemptId) });
      }
    });
  };

  const handleToggleFlag = () => {
    const newFlagged = !currentQuestion.flagged;

    queryClient.setQueryData(getGetAttemptQueryKey(attemptId), (old: any) => {
      if (!old) return old;
      const newQuestions = [...old.questions];
      newQuestions[currentIndex] = { ...newQuestions[currentIndex], flagged: newFlagged };
      return { ...old, questions: newQuestions };
    });

    saveAnswerMutation.mutate({
      id: attemptId,
      data: { questionId: currentQuestion.id, selectedOption: currentQuestion.selectedOption, flagged: newFlagged }
    });
  };

  const handleSubmit = () => {
    if (submitMutation.isPending) return;
    submitMutation.mutate({ id: attemptId }, {
      onSuccess: (result) => {
        setLocation(`/result/${result.id}`);
      }
    });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Check if we have correctness info (mockup mode only)
  const isCorrect = (currentQuestion as any).isCorrect;
  const correctOption = (currentQuestion as any).correctOption;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-serif text-lg md:text-xl font-medium text-foreground truncate">{attempt.title}</h1>
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <div className={`flex items-center gap-2 font-mono text-lg font-medium px-3 py-1 rounded-md ${timeLeft < 300 ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-secondary text-foreground'}`}>
                <Clock className="w-4 h-4" />
                {formatTime(timeLeft)}
              </div>
            )}
            <Button 
              variant="default" 
              className="bg-[#181715] hover:bg-[#252320] text-white"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              Submit Exam
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8">
        
        {/* Main Question Area */}
        <div className="flex-1 space-y-8 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
              Question {currentQuestion.questionNo} of {questions.length}
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleToggleFlag}
              className={currentQuestion.flagged ? "text-warning hover:text-warning/80 bg-warning/10" : "text-muted-foreground"}
            >
              <Flag className={`w-4 h-4 mr-2 ${currentQuestion.flagged ? "fill-current" : ""}`} />
              {currentQuestion.flagged ? "Flagged" : "Flag for review"}
            </Button>
          </div>

          <div className="prose prose-lg dark:prose-invert max-w-none font-serif leading-relaxed text-foreground">
            {currentQuestion.scenario && (
              <div className="mb-6 p-6 bg-secondary/50 rounded-xl text-base font-sans whitespace-pre-wrap border border-border">
                {currentQuestion.scenario}
              </div>
            )}
            <div className="whitespace-pre-wrap">
              {currentQuestion.questionText}
            </div>
          </div>

          <div className="space-y-3 pt-4">
            {currentQuestion.options.map(opt => {
              const isSelected = currentQuestion.selectedOption === opt.label;
              const showCorrectness = !attempt.isRealTest && currentQuestion.selectedOption;
              const isActuallyCorrect = showCorrectness && correctOption === opt.label;
              const isWrongSelection = showCorrectness && isSelected && correctOption !== opt.label;

              let btnClass = "border-border hover:border-primary hover:bg-secondary/50";
              let icon = null;

              if (showCorrectness) {
                if (isActuallyCorrect) {
                  btnClass = "border-success bg-success/10";
                  icon = <CheckCircle className="w-5 h-5 text-success shrink-0" />;
                } else if (isWrongSelection) {
                  btnClass = "border-destructive bg-destructive/10";
                  icon = <XCircle className="w-5 h-5 text-destructive shrink-0" />;
                } else if (isSelected) {
                  // Fallback if no correctness data
                  btnClass = "border-primary bg-primary/5 text-primary";
                } else {
                  btnClass = "border-border opacity-50";
                }
              } else if (isSelected) {
                btnClass = "border-primary bg-primary/5 text-primary ring-1 ring-primary";
              }

              return (
                <button
                  key={opt.label}
                  onClick={() => handleSelectOption(opt.label)}
                  disabled={Boolean(showCorrectness && currentQuestion.selectedOption !== null)}
                  className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all duration-200 ${btnClass}`}
                >
                  <div className={`font-semibold mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                    {opt.label}.
                  </div>
                  <div className="flex-1 text-foreground leading-relaxed">
                    {opt.text}
                  </div>
                  {icon}
                </button>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-8 border-t border-border">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Sidebar Nav Grid */}
        <div className="w-full md:w-72 shrink-0">
          <Card className="bg-card border-card-border shadow-sm sticky top-24">
            <CardContent className="p-4">
              <h3 className="font-serif text-lg mb-4 text-foreground">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = !!q.selectedOption;
                  const isFlagged = q.flagged;
                  
                  let bg = "bg-secondary text-foreground hover:bg-border";
                  if (isCurrent) bg = "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background";
                  else if (isFlagged) bg = "bg-warning text-warning-foreground";
                  else if (isAnswered) bg = "bg-[#181715] text-[#faf9f5]";

                  // If in practice mode and answered, maybe show color
                  if (!attempt.isRealTest && isAnswered) {
                    const cCorrect = (q as any).isCorrect;
                    if (cCorrect === true) bg = isCurrent ? "bg-success text-success-foreground ring-2 ring-success ring-offset-2 ring-offset-background" : "bg-success text-success-foreground";
                    if (cCorrect === false) bg = isCurrent ? "bg-destructive text-destructive-foreground ring-2 ring-destructive ring-offset-2 ring-offset-background" : "bg-destructive text-destructive-foreground";
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-10 rounded-md text-sm font-medium transition-all ${bg}`}
                    >
                      {q.questionNo}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}
