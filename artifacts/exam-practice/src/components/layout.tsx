import { Link, useLocation } from "wouter";
import {
  useLogout,
  useGetCurrentUser,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  History,
  LayoutDashboard,
  LogOut,
  FileText,
} from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const { data: user } = useGetCurrentUser({
    query: { retry: false, queryKey: getGetCurrentUserQueryKey() },
  });

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
        window.location.href = "/login";
      },
    });
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/modes", label: "Practice", icon: BookOpen },
    { href: "/notebook", label: "Notebook", icon: FileText },
    { href: "/history", label: "History", icon: History },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card p-6 flex flex-col">
        <div className="mb-10">
          <h1 className="font-serif text-2xl text-foreground">Exam Practice</h1>
          <p className="text-sm text-muted-foreground mt-1 tracking-tight">
            Claude Certified Architect
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (location.startsWith(item.href) && item.href !== "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-border">
          <div className="px-4 pb-3">
            <LocaleToggle />
          </div>
          <div className="px-4 py-3 mb-2 text-sm font-medium text-foreground">
            {user?.username}
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-4 text-muted-foreground hover:text-foreground hover:bg-secondary"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-12 overflow-auto">
        <div className="max-w-4xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
