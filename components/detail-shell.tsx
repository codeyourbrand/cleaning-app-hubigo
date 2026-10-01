import Link from "next/link";
import { HubigoLogo } from "@/components/logo";

export function DetailShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex w-full max-w-2xl items-center px-4 py-3">
          <Link href="/" aria-label="Home">
            <HubigoLogo markClassName="size-8" />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 pb-28 sm:p-6">{children}</main>
    </div>
  );
}
