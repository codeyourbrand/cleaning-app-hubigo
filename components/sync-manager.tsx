"use client";

import { useEffect } from "react";
import { useMutationQueue } from "@/hooks/use-mutation-queue";
import { toast } from "sonner";

export function SyncManager() {
  const { syncOutbox, outbox } = useMutationQueue();

  useEffect(() => {
    function handleOnline() {
      syncOutbox().then(() => {
        toast.success("Synced");
      });
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOutbox]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine && outbox.length > 0) {
        syncOutbox();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [syncOutbox, outbox]);

  return null;
}
