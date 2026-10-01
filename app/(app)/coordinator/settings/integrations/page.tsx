"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type SyncEvent = {
  id: string;
  createdAt: string;
  eventType: string;
  status: string;
  error: string | null;
};

export default function IntegrationsPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    setStatus("loading");
    try {
      const res = await fetch("/api/coordinator/integrations/hostfully");
      const data = await res.json();
      setStatus(data.configured ? "ok" : "error");
      setLastSync(data.lastSync);
      setEvents(data.events || []);
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/hostfully/sync", { method: "POST" });
      if (res.ok) {
        toast.success("Sync started");
      } else {
        const data = await res.json();
        toast.error(data.error || "Sync failed");
      }
    } finally {
      setSyncing(false);
      await load();
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Integrations</h1>

      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hostfully</h2>
          {status === "loading" ? <Skeleton className="h-6 w-20" /> : <Badge variant={status === "ok" ? "default" : "destructive"}>{status === "ok" ? "Connected" : "Not configured"}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">Last sync: {lastSync ? new Date(lastSync).toLocaleString() : "Never"}</p>
        <div className="flex gap-2">
          <Button onClick={syncNow} disabled={syncing}>{syncing ? "Syncing..." : "Sync now"}</Button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent sync events</h2>
        <div className="space-y-2">
          {events.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
          {events.map((e) => (
            <div key={e.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{e.eventType}</p>
                <Badge variant={e.status === "PROCESSED" ? "outline" : "destructive"}>{e.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</p>
              {e.error && <p className="text-sm text-destructive mt-1">{e.error}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-semibold mb-2">Webhook setup</h2>
        <p className="text-sm text-muted-foreground">
          Point Hostfully webhook URL to:
        </p>
        <code className="block mt-2 p-2 bg-muted rounded text-xs break-all">
          {typeof window !== "undefined" ? `${window.location.origin}/api/hostfully/webhook` : ""}
        </code>
        <p className="text-sm text-muted-foreground mt-2">Event types: NEW_BOOKING, BOOKING_UPDATED, BOOKING_CANCELLED, NEW_PROPERTY, UPDATED_PROPERTY</p>
      </section>
    </div>
  );
}
