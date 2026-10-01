"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/cleaner/tasks", label: "Tasks", icon: ClipboardList },
    { href: "/cleaner/apartments", label: "Apartments", icon: Building2 },
  ];

  return (
    <div className="flex flex-col min-h-screen pb-20">
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
                  active ? "text-primary" : "text-muted-foreground"
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
