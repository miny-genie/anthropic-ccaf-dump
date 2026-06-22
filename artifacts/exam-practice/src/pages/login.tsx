import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [username, setUsername] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    loginMutation.mutate(
      { data: { username: username.trim() } },
      {
        onSuccess: (user) => {
          queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
          setLocation("/");
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-card-border shadow-sm p-4 md:p-8">
        <CardHeader className="space-y-4 text-center px-0 pt-0">
          <CardTitle className="font-serif text-3xl tracking-tight text-foreground">
            Exam Practice
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            A quiet space to focus and prepare.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                className="h-12 bg-background"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium transition-transform active:scale-[0.98]"
              disabled={!username.trim() || loginMutation.isPending}
            >
              {loginMutation.isPending ? "Entering..." : "Enter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
