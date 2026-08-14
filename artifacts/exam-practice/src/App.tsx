import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";

// Components
import Login from "@/pages/login";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Modes from "@/pages/modes";
import History from "@/pages/history";
import Notebook from "@/pages/notebook";
import Exam from "@/pages/exam";
import Result from "@/pages/result";
import { useT } from "@/lib/locale";

// This app drives its caches through optimistic setQueryData with no mutation
// invalidation, so a window-focus background refetch would return pre-mutation
// server state and clobber optimistic writes — e.g. re-showing practice feedback
// right after it was cleared. Disabling focus refetch closes that race while
// leaving staleTime at 0 so pages still refetch fresh data on mount/navigation.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({
  component: Component,
  bare = false,
}: {
  component: React.ComponentType;
  bare?: boolean;
}) {
  const {
    data: user,
    isLoading,
    error,
  } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() },
  });
  const [, setLocation] = useLocation();
  const t = useT();

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      setLocation("/login");
    }
  }, [isLoading, error, user, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-serif text-muted-foreground animate-pulse">
        {t("app.loading")}
      </div>
    );
  }

  if (error || !user) {
    return null;
  }

  if (bare) {
    return <Component />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route
        path="/"
        component={() => <ProtectedRoute component={Dashboard} />}
      />
      <Route
        path="/dashboard"
        component={() => <ProtectedRoute component={Dashboard} />}
      />
      <Route
        path="/modes"
        component={() => <ProtectedRoute component={Modes} />}
      />
      <Route
        path="/history"
        component={() => <ProtectedRoute component={History} />}
      />
      <Route
        path="/notebook"
        component={() => <ProtectedRoute component={Notebook} />}
      />
      <Route
        path="/exam/:id"
        component={() => <ProtectedRoute component={Exam} bare />}
      />
      <Route
        path="/result/:id"
        component={() => <ProtectedRoute component={Result} />}
      />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
