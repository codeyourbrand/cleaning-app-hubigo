"use client";

import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistration } from "./service-worker";
import { SyncManager } from "./sync-manager";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ServiceWorkerRegistration />
      <SyncManager />
      {children}
      <SonnerToaster />
    </>
  );
}
