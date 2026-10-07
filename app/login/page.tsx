"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HubigoMark } from "@/components/logo";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const body = tab === "email" ? { email, password } : { phone, password };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not sign in");
      } else {
        toast.success("Signed in");
        router.push(
          data.user.role === "COORDINATOR" ? "/coordinator" : "/cleaner/tasks",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <HubigoMark className="size-16 rounded-2xl mb-4 mx-auto" />
          <h1 className="text-3xl font-bold tracking-tight">hubigo</h1>
          <p className="text-muted-foreground mt-1">
            Cleaning & maintenance operations
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "email" | "phone")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="phone">Phone</TabsTrigger>
          </TabsList>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <TabsContent value="email" className="mt-0">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hubigo.local"
                  required
                />
              </div>
            </TabsContent>
            <TabsContent value="phone" className="mt-0">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971 50 000 0000"
                  required
                />
              </div>
            </TabsContent>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Tabs>
      </div>
    </main>
  );
}
