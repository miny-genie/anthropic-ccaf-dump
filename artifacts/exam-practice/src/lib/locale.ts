import { useEffect, useState } from "react";

export type Locale = "en" | "ko";

const STORAGE_KEY = "exam_locale";

const messages = {
  en: {
    "app.loading": "Loading...",
    "app.name": "Exam Practice",
    "app.subtitle": "Claude Certified Architect",
    "nav.dashboard": "Dashboard",
    "nav.practice": "Practice",
    "nav.notebook": "Notebook",
    "nav.history": "History",
    "nav.signOut": "Sign out",
    "login.description": "A quiet space to focus and prepare.",
    "login.username": "Username",
    "login.usernamePlaceholder": "Enter your name",
    "login.entering": "Entering...",
    "login.enter": "Enter",
    "dashboard.welcome": "Welcome back, {username}.",
    "dashboard.subtitle": "Ready to continue your preparation?",
    "dashboard.realTestPasses": "Real Test Passes",
    "dashboard.attempts": "/ {count} attempts",
    "dashboard.bestScore": "Best score: {score}",
    "dashboard.practiceProgress": "Practice Progress",
    "dashboard.answered": "{answered} of {total} answered",
    "dashboard.toReview": "To Review",
    "dashboard.wrong": "Wrong",
    "dashboard.bookmarks": "Bookmarks",
    "dashboard.practiceDescription":
      "Untimed, open-ended study with instant feedback. Picks up right where you left off.",
    "dashboard.realTestDescription":
      "Strict 60-question timed exam. 120 minutes. No immediate feedback.",
    "dashboard.recentActivity": "Recent Activity",
    "modes.title": "Practice Modes",
    "modes.subtitle": "Choose how you want to prepare today.",
    "modes.practiceDescription":
      "Untimed, open-ended study with instant feedback on each question. Your progress is always saved.",
    "modes.realTestDescription":
      "Strict 60-question timed exam. 120 minutes. No immediate feedback. Pass mark: 720/1000.",
    "modes.review": "Review",
    "modes.notebookDescription": "Review and annotate questions you missed.",
    "common.practiceMode": "Practice Mode",
    "common.realTest": "Real Test",
    "common.realTests": "Real Tests",
    "common.opening": "Opening...",
    "common.startPractice": "Start Practice",
    "common.starting": "Starting...",
    "common.startSimulation": "Start Simulation",
    "common.wrongAnswerNotebook": "Wrong Answer Notebook",
    "common.openNotebook": "Open Notebook",
    "common.passed": "PASSED",
    "common.failed": "FAILED",
    "common.inProgress": "IN PROGRESS",
    "common.correct": "correct",
    "common.remove": "Remove",
    "common.saveNote": "Save note",
    "common.yourNote": "Your note",
    "common.notePlaceholder": "Add a personal note for this question...",
    "history.title": "History",
    "history.emptyTitle": "No attempts yet",
    "history.emptyDescription":
      "Your completed practice sessions and real tests will appear here.",
    "history.startPracticing": "Start practicing",
    "history.subtitle": "Past attempts and simulations.",
    "history.started": "Started: {date}",
    "history.completed": "Completed: {date}",
    "history.correctCount": "{correct} / {total} correct",
    "notebook.title": "Notebook",
    "notebook.subtitle": "Questions you missed. Review and learn.",
    "notebook.allTypes": "All Types",
    "notebook.allScenarios": "All Scenarios",
    "notebook.noQuestions": "No questions found",
    "notebook.noQuestionsDescription":
      "Looks like you haven't gotten anything wrong that matches these filters!",
    "notebook.resolved": "Resolved",
    "notebook.markResolved": "Mark Resolved",
    "result.loading": "Loading results...",
    "result.backToDashboard": "Back to Dashboard",
    "result.title": "Results",
    "result.certificationPassed": "Certification Passed",
    "result.didNotPass": "Did Not Pass",
    "result.practiceCompleted": "Practice Completed",
    "result.correctSummary": "{correct} out of {total} correct",
    "result.domainBreakdown": "Domain Breakdown",
    "result.areasToReview": "Areas to Review",
    "result.goToNotebook": "Go to Notebook",
    "result.youSelected": "You selected:",
    "result.correctAnswer": "Correct answer:",
    "result.moreWrongAnswers": "+{count} more wrong answers",
    "exam.loading": "Loading exam...",
    "exam.submit": "Submit Exam",
    "exam.exit": "Exit",
    "exam.resetPractice": "Reset Practice",
    "exam.startOver": "Start over?",
    "exam.resetDescription":
      "This clears all your practice answers, feedback, and saved position, then reshuffles the questions for a fresh run. Your bookmarks and personal notes are kept.",
    "exam.cancel": "Cancel",
    "exam.questionOf": "Question {current} of {total}",
    "exam.bookmarked": "Bookmarked",
    "exam.bookmark": "Bookmark",
    "exam.flagged": "Flagged",
    "exam.flagForReview": "Flag for review",
    "exam.scenario": "Scenario: {scenario}",
    "exam.previous": "Previous",
    "exam.next": "Next",
    "exam.questions": "Questions",
    "notFound.title": "404 Page Not Found",
    "notFound.description": "Did you forget to add the page to the router?",
  },
  ko: {
    "app.loading": "불러오는 중...",
    "app.name": "시험 연습",
    "app.subtitle": "Claude Certified Architect",
    "nav.dashboard": "대시보드",
    "nav.practice": "연습",
    "nav.notebook": "오답 노트",
    "nav.history": "기록",
    "nav.signOut": "로그아웃",
    "login.description": "집중해서 시험을 준비하는 공간입니다.",
    "login.username": "사용자 이름",
    "login.usernamePlaceholder": "이름을 입력하세요",
    "login.entering": "입장 중...",
    "login.enter": "입장",
    "dashboard.welcome": "{username}님, 다시 오셨네요.",
    "dashboard.subtitle": "이어서 준비해볼까요?",
    "dashboard.realTestPasses": "실전 시험 합격",
    "dashboard.attempts": "/ 총 {count}회 응시",
    "dashboard.bestScore": "최고 점수: {score}",
    "dashboard.practiceProgress": "연습 진행률",
    "dashboard.answered": "{total}문제 중 {answered}문제 풀이",
    "dashboard.toReview": "복습 대상",
    "dashboard.wrong": "오답",
    "dashboard.bookmarks": "북마크",
    "dashboard.practiceDescription":
      "시간 제한 없이 즉시 피드백을 보며 학습합니다. 마지막 위치부터 이어서 진행합니다.",
    "dashboard.realTestDescription":
      "60문항 실전 시험입니다. 제한 시간은 120분이며 즉시 피드백은 없습니다.",
    "dashboard.recentActivity": "최근 활동",
    "modes.title": "연습 모드",
    "modes.subtitle": "오늘 어떤 방식으로 준비할지 선택하세요.",
    "modes.practiceDescription":
      "시간 제한 없이 각 문제의 즉시 피드백을 보며 학습합니다. 진행 상황은 항상 저장됩니다.",
    "modes.realTestDescription":
      "60문항 실전 시험입니다. 제한 시간은 120분이며 즉시 피드백은 없습니다. 합격 기준: 720/1000.",
    "modes.review": "복습",
    "modes.notebookDescription": "틀린 문제를 다시 보고 메모를 남깁니다.",
    "common.practiceMode": "연습 모드",
    "common.realTest": "실전 시험",
    "common.realTests": "실전 시험",
    "common.opening": "여는 중...",
    "common.startPractice": "연습 시작",
    "common.starting": "시작 중...",
    "common.startSimulation": "시뮬레이션 시작",
    "common.wrongAnswerNotebook": "오답 노트",
    "common.openNotebook": "노트 열기",
    "common.passed": "합격",
    "common.failed": "불합격",
    "common.inProgress": "진행 중",
    "common.correct": "정답",
    "common.remove": "삭제",
    "common.saveNote": "메모 저장",
    "common.yourNote": "내 메모",
    "common.notePlaceholder": "이 문제에 대한 개인 메모를 추가하세요...",
    "history.title": "기록",
    "history.emptyTitle": "아직 응시 기록이 없습니다",
    "history.emptyDescription":
      "완료한 연습 세션과 실전 시험 기록이 여기에 표시됩니다.",
    "history.startPracticing": "연습 시작하기",
    "history.subtitle": "지난 응시와 시뮬레이션 기록입니다.",
    "history.started": "시작: {date}",
    "history.completed": "완료: {date}",
    "history.correctCount": "{total}문제 중 {correct}문제 정답",
    "notebook.title": "오답 노트",
    "notebook.subtitle": "틀린 문제를 복습하고 학습합니다.",
    "notebook.allTypes": "전체 유형",
    "notebook.allScenarios": "전체 시나리오",
    "notebook.noQuestions": "문제를 찾을 수 없습니다",
    "notebook.noQuestionsDescription": "현재 필터에 맞는 오답이 없습니다.",
    "notebook.resolved": "해결됨",
    "notebook.markResolved": "해결 표시",
    "result.loading": "결과를 불러오는 중...",
    "result.backToDashboard": "대시보드로 돌아가기",
    "result.title": "결과",
    "result.certificationPassed": "인증 시험 합격",
    "result.didNotPass": "불합격",
    "result.practiceCompleted": "연습 완료",
    "result.correctSummary": "{total}문제 중 {correct}문제 정답",
    "result.domainBreakdown": "영역별 결과",
    "result.areasToReview": "복습할 영역",
    "result.goToNotebook": "오답 노트로 이동",
    "result.youSelected": "선택한 답:",
    "result.correctAnswer": "정답:",
    "result.moreWrongAnswers": "추가 오답 {count}개",
    "exam.loading": "시험을 불러오는 중...",
    "exam.submit": "시험 제출",
    "exam.exit": "나가기",
    "exam.resetPractice": "연습 초기화",
    "exam.startOver": "처음부터 다시 시작할까요?",
    "exam.resetDescription":
      "연습 답안, 피드백, 저장된 위치를 모두 지우고 문제를 다시 섞어 새로 시작합니다. 북마크와 개인 메모는 유지됩니다.",
    "exam.cancel": "취소",
    "exam.questionOf": "{total}문제 중 {current}번",
    "exam.bookmarked": "북마크됨",
    "exam.bookmark": "북마크",
    "exam.flagged": "표시됨",
    "exam.flagForReview": "복습 표시",
    "exam.scenario": "시나리오: {scenario}",
    "exam.previous": "이전",
    "exam.next": "다음",
    "exam.questions": "문항",
    "notFound.title": "404 페이지를 찾을 수 없습니다",
    "notFound.description": "라우터에 페이지를 추가했는지 확인하세요.",
  },
} as const;

export type MessageKey = keyof typeof messages.en;

type MessageValues = Record<string, string | number>;

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

export function translate(
  locale: Locale,
  key: MessageKey,
  values: MessageValues = {},
): string {
  return messages[locale][key].replace(/\{(\w+)\}/g, (_, name: string) =>
    values[name] == null ? "" : String(values[name]),
  );
}

export function useT(): (key: MessageKey, values?: MessageValues) => string {
  const [locale] = useLocale();
  return (key, values) => translate(locale, key, values);
}
