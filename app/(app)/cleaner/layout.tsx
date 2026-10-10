"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Building2, LogOut } from "lucide-react";
import { HubigoLogo } from "@/components/logo";
import { cn } from "@/lib/utils";

export default function CleanerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: "/cleaner/tasks", label: "Tasks", icon: ClipboardList },
    { href: "/cleaner/apartments", label: "Apartments", icon: Building2 },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-sidebar text-sidebar-foreground px-4 py-3">
        <Link href="/cleaner/tasks" className="inline-block">
          <HubigoLogo markClassName="size-8" />
        </Link>
        <button
          onClick={logout}
          className="inline-flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors"
          aria-label="Logout"
        >
          <LogOut className="size-5" />
        </button>
      </header>
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-pb-4 z-50">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-3 text-sm font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                aria-label={tab.label}
              >
                <Icon className="size-6" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
