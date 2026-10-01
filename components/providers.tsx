"use client";

import NextTopLoader from "nextjs-toploader";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "./service-worker";
import { SyncManager } from "./sync-manager";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NextTopLoader
        color="#d4b56e"
        height={3}
        shadow="0 0 12px #d4b56e, 0 0 6px #d4b56e"
        showSpinner={false}
      />
      <ServiceWorkerRegistration />
      <SyncManager />
      {children}
      <SonnerToaster />
    </>
  );
}
