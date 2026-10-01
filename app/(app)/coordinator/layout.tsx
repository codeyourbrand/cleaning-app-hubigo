"use client";

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/coordinator", label: "Dashboard", icon: LayoutDashboard },
  { href: "/coordinator/tasks/new", label: "Tasks", icon: ListTodo },
  { href: "/coordinator/apartments", label: "Apartments", icon: Building2 },
  { href: "/coordinator/users", label: "Users", icon: Users },
  { href: "/coordinator/import", label: "Import", icon: Upload },
  { href: "/coordinator/history", label: "History", icon: History },
  { href: "/coordinator/settings/integrations", label: "Hostfully", icon: Plug },
];

export default function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const Nav = (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <Icon className="size-5" />
            {link.label}
          </Link>
        );
      })}
      <button
        onClick={logout}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors mt-auto"
      >
        <LogOut className="size-5" />
        Logout
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden md:flex w-64 flex-col border-r bg-card p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">H</div>
          <span className="text-xl font-bold">Hubigo</span>
        </div>
        {Nav}
      </aside>

      <header className="md:hidden flex items-center justify-between border-b p-4 bg-card">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">H</div>
          <span className="text-xl font-bold">Hubigo</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 p-4">
            {Nav}
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
