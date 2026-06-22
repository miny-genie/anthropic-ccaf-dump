import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetAttempt,
  useSaveAnswer,
  useSubmitAttempt,
  useUpdateAttemptProgress,
  useToggleBookmark,
  useSetNote,
  getGetAttemptQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  Flag,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Exam() {
  const { id } = useParams<{ id: string }>();
  const attemptId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: attempt, isLoading } = useGetAttempt(attemptId, {
    query: { enabled: !!attemptId, queryKey: getGetAttemptQueryKey(attemptId) },
  });

  const saveAnswerMutation = useSaveAnswer();
  const submitMutation = useSubmitAttempt();
  const progressMutation = useUpdateAttemptProgress();
  const bookmarkMutation = useToggleBookmark();
  const noteMutation = useSetNote();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const initializedRef = useRef(false);

  const attemptKey = getGetAttemptQueryKey(attemptId);

  // Restore the saved cursor position once, when the attempt first loads.
  useEffect(() => {
    if (attempt && !initializedRef.current) {
      initializedRef.current = true;
      const total = attempt.questions.length;
      const pos = Math.min(
        Math.max(1, attempt.currentPosition || 1),
        Math.max(1, total),
      );
      setCurrentIndex(pos - 1);
    }
  }, [attempt]);

  // Only real tests are timed; practice mode has remainingSeconds === null.
  useEffect(() => {
    if (attempt && attempt.remainingSeconds != null && timeLeft === null) {
      setTimeLeft(attempt.remainingSeconds);
    }
  }, [attempt, timeLeft]);

  const currentQuestionId = attempt?.questions[currentIndex]?.id;
  const savedNote = attempt?.questions[currentIndex]?.note ?? "";

  // Reset the note editor when the visible question changes.
  useEffect(() => {
    setNoteDraft(savedNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionId]);

  const isPending = submitMutation.isPending;
  // Tick timer (real test only).
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isPending) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          submitMutation.mutate(
            { id: attemptId },
            { onSuccess: (result) => setLocation(`/result/${result.id}`) },
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isPending]);

  if (isLoading || !attempt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-serif text-muted-foreground animate-pulse">
        Loading exam...
      </div>
    );
  }

  if (attempt.submittedAt) {
    setLocation(`/result/${attempt.id}`);
    return null;
  }

  const questions = attempt.questions;
  const currentQuestion = questions[currentIndex];
  const isReal = attempt.isRealTest;

  const patchQuestion = (
    questionId: number,
    patch: Record<string, unknown>,
  ) => {
    queryClient.setQueryData(attemptKey, (old: any) => {
      if (!old) return old;
      const newQuestions = old.questions.map((q: any) =>
        q.id === questionId ? { ...q, ...patch } : q,
      );
      return { ...old, questions: newQuestions };
    });
  };

  const goTo = (idx: number) => {
    const clamped = Math.min(Math.max(0, idx), questions.length - 1);
    setCurrentIndex(clamped);
    progressMutation.mutate({
      id: attemptId,
      data: { currentPosition: clamped + 1 },
    });
  };

  const handleSelectOption = (optionLabel: string) => {
    if (saveAnswerMutation.isPending) return;
    // Lock practice answers once chosen (the correct answer is revealed).
    if (!isReal && currentQuestion.selectedOption) return;

    patchQuestion(currentQuestion.id, { selectedOption: optionLabel });

    saveAnswerMutation.mutate(
      {
        id: attemptId,
        data: { questionId: currentQuestion.id, selectedOption: optionLabel },
      },
      {
        onSuccess: (result) => {
          patchQuestion(currentQuestion.id, {
            selectedOption: optionLabel,
            isCorrect: result.isCorrect ?? null,
            correctOption: result.correctOption ?? null,
          });
        },
      },
    );
  };

  const handleToggleFlag = () => {
    const newFlagged = !currentQuestion.flagged;
    patchQuestion(currentQuestion.id, { flagged: newFlagged });
    saveAnswerMutation.mutate({
      id: attemptId,
      data: { questionId: currentQuestion.id, flagged: newFlagged },
    });
  };

  const handleToggleBookmark = () => {
    const newVal = !currentQuestion.bookmarked;
    patchQuestion(currentQuestion.id, { bookmarked: newVal });
    bookmarkMutation.mutate(
      { data: { questionId: currentQuestion.id } },
      {
        onSuccess: (res) =>
          patchQuestion(currentQuestion.id, { bookmarked: res.bookmarked }),
      },
    );
  };

  const saveNote = (value: string) => {
    noteMutation.mutate(
      { data: { questionId: currentQuestion.id, note: value } },
      {
        onSuccess: (res) =>
          patchQuestion(currentQuestion.id, { note: res.note ?? null }),
      },
    );
  };

  const handleSubmit = () => {
    if (submitMutation.isPending) return;
    submitMutation.mutate(
      { id: attemptId },
      { onSuccess: (result) => setLocation(`/result/${result.id}`) },
    );
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${h}:${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const correctOption = currentQuestion.correctOption;
  const noteDirty = noteDraft !== savedNote;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="font-serif text-lg md:text-xl font-medium text-foreground truncate">
            {attempt.title}
          </h1>
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <div
                className={`flex items-center gap-2 font-mono text-lg font-medium px-3 py-1 rounded-md ${
                  timeLeft < 300
                    ? "bg-destructive/10 text-destructive animate-pulse"
                    : "bg-secondary text-foreground"
                }`}
              >
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
              {isReal ? "Submit Exam" : "Finish Practice"}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-8">
        <div className="flex-1 space-y-8 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
              Question {currentQuestion.questionNo} of {questions.length}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleBookmark}
                className={
                  currentQuestion.bookmarked
                    ? "text-primary hover:text-primary/80 bg-primary/10"
                    : "text-muted-foreground"
                }
              >
                <Bookmark
                  className={`w-4 h-4 mr-2 ${
                    currentQuestion.bookmarked ? "fill-current" : ""
                  }`}
                />
                {currentQuestion.bookmarked ? "Bookmarked" : "Bookmark"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleFlag}
                className={
                  currentQuestion.flagged
                    ? "text-warning hover:text-warning/80 bg-warning/10"
                    : "text-muted-foreground"
                }
              >
                <Flag
                  className={`w-4 h-4 mr-2 ${
                    currentQuestion.flagged ? "fill-current" : ""
                  }`}
                />
                {currentQuestion.flagged ? "Flagged" : "Flag for review"}
              </Button>
            </div>
          </div>

          <div className="prose prose-lg dark:prose-invert max-w-none font-serif leading-relaxed text-foreground">
            {!isReal && currentQuestion.scenario && (
              <div className="mb-6 p-6 bg-secondary/50 rounded-xl text-base font-sans whitespace-pre-wrap border border-border">
                {currentQuestion.scenario}
              </div>
            )}
            <div className="whitespace-pre-wrap">
              {currentQuestion.questionText}
            </div>
            {isReal && currentQuestion.scenario && (
              <div className="mt-3 text-right text-xs text-muted-foreground not-prose font-sans italic">
                Scenario : {currentQuestion.scenario}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4">
            {currentQuestion.options.map((opt) => {
              const isSelected = currentQuestion.selectedOption === opt.label;
              const showCorrectness = !isReal && !!currentQuestion.selectedOption;
              const isActuallyCorrect =
                showCorrectness && correctOption === opt.label;
              const isWrongSelection =
                showCorrectness && isSelected && correctOption !== opt.label;

              let btnClass =
                "border-border hover:border-primary hover:bg-secondary/50";
              let icon = null;

              if (showCorrectness) {
                if (isActuallyCorrect) {
                  btnClass = "border-success bg-success/10";
                  icon = (
                    <CheckCircle className="w-5 h-5 text-success shrink-0" />
                  );
                } else if (isWrongSelection) {
                  btnClass = "border-destructive bg-destructive/10";
                  icon = (
                    <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  );
                } else if (isSelected) {
                  btnClass = "border-primary bg-primary/5 text-primary";
                } else {
                  btnClass = "border-border opacity-50";
                }
              } else if (isSelected) {
                btnClass =
                  "border-primary bg-primary/5 text-primary ring-1 ring-primary";
              }

              return (
                <button
                  key={opt.label}
                  onClick={() => handleSelectOption(opt.label)}
                  disabled={Boolean(
                    !isReal && currentQuestion.selectedOption !== null,
                  )}
                  className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all duration-200 ${btnClass}`}
                >
                  <div
                    className={`font-semibold mt-0.5 ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
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

          {!isReal && (
            <div className="pt-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Your note
              </label>
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a personal note for this question..."
                className="mt-2 min-h-24 bg-card"
              />
              <div className="mt-2 flex justify-end gap-2">
                {currentQuestion.note && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNoteDraft("");
                      saveNote("");
                    }}
                    disabled={noteMutation.isPending}
                  >
                    Remove
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveNote(noteDraft)}
                  disabled={noteMutation.isPending || !noteDirty}
                >
                  Save note
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-8 border-t border-border">
            <Button
              variant="outline"
              size="lg"
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === questions.length - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        <div className="w-full md:w-72 shrink-0">
          <Card className="bg-card border-card-border shadow-sm sticky top-24">
            <CardContent className="p-4">
              <h3 className="font-serif text-lg mb-4 text-foreground">
                Questions
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = !!q.selectedOption;
                  const isFlagged = q.flagged;

                  let bg = "bg-secondary text-foreground hover:bg-border";
                  if (isCurrent)
                    bg =
                      "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background";
                  else if (isFlagged) bg = "bg-warning text-warning-foreground";
                  else if (isAnswered) bg = "bg-[#181715] text-[#faf9f5]";

                  if (!isReal && isAnswered) {
                    if (q.isCorrect === true)
                      bg = isCurrent
                        ? "bg-success text-success-foreground ring-2 ring-success ring-offset-2 ring-offset-background"
                        : "bg-success text-success-foreground";
                    if (q.isCorrect === false)
                      bg = isCurrent
                        ? "bg-destructive text-destructive-foreground ring-2 ring-destructive ring-offset-2 ring-offset-background"
                        : "bg-destructive text-destructive-foreground";
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => goTo(idx)}
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
