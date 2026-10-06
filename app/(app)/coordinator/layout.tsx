"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Building2,
  Users,
  Upload,
  History,
  Plug,
  Settings,
  LogOut,
  Menu,
  Package,
  ScrollText,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { HubigoLogo } from "@/components/logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/coordinator", label: "Dashboard", icon: LayoutDashboard },
  { href: "/coordinator/tasks/new", label: "Create task", icon: ListTodo },
  { href: "/coordinator/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/coordinator/apartments", label: "Apartments", icon: Building2 },
  { href: "/coordinator/inventory", label: "Inventory", icon: Package },
  { href: "/coordinator/users", label: "Users", icon: Users },
  { href: "/coordinator/import", label: "Import", icon: Upload },
  { href: "/coordinator/history", label: "Logs", icon: ScrollText },
  {
    href: "/coordinator/notifications",
    label: "WhatsApp",
    icon: MessageSquare,
  },
  {
    href: "/coordinator/settings/integrations",
    label: "Hostfully",
    icon: Plug,
  },
];

export default function CoordinatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const Nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {links.map((link) => {
        const Icon = link.icon;
        const active =
          link.href === "/coordinator"
            ? pathname === "/coordinator"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-5" />
            {link.label}
          </Link>
        );
      })}
      <button
        onClick={logout}
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut className="size-5" />
        Logout
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground p-4 sticky top-0 h-screen overflow-y-auto">
        <div className="mb-8 px-2 pt-2">
          <HubigoLogo />
        </div>
        {Nav}
      </aside>

      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-sidebar text-sidebar-foreground px-4 py-3">
        <HubigoLogo markClassName="size-8" />
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-64 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border p-4"
          >
            <div className="mb-6 px-2">
              <HubigoLogo />
            </div>
            {Nav}
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
