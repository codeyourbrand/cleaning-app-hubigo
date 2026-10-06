"use client";

import { formatDateTime } from "@/lib/datetime";
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

type IntegrationStatus = {
  configured: boolean;
  webhookConfigured: boolean;
  environment: "sandbox" | "production";
  lastSync: string | null;
  events: SyncEvent[];
};

type SyncResult = {
  properties: number;
  reservations: number;
  tasksCreated: number;
  tasksUpdated: number;
  tasksCancelled: number;
  skipped: number;
  errors: { message: string; leadUid?: string }[];
};

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/coordinator/integrations/hostfully");
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function syncNow() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/hostfully/sync", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setSyncResult(body);
        toast.success("Sync finished");
      } else {
        toast.error(body.error || "Sync failed");
      }
    } finally {
      setSyncing(false);
      await load();
    }
  }

  async function registerWebhooks() {
    setRegistering(true);
    try {
      const res = await fetch(
        "/api/coordinator/integrations/hostfully/webhooks",
        { method: "POST" },
      );
      const body = await res.json();
      if (res.ok) {
        toast.success(
          `Webhooks registered: ${body.created.length} created, ${body.existing.length} already present`,
        );
      } else {
        toast.error(body.error || "Registration failed");
      }
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Integrations</h1>

      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hostfully</h2>
          <div className="flex items-center gap-2">
            {data && (
              <Badge variant="outline">
                {data.environment === "sandbox" ? "Sandbox" : "Production"}
              </Badge>
            )}
            {loading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <Badge variant={data?.configured ? "default" : "destructive"}>
                {data?.configured ? "Connected" : "Not configured"}
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Last sync:{" "}
          {data?.lastSync ? formatDateTime(data.lastSync) : "Never"}
        </p>
        <div className="flex gap-2">
          <Button onClick={syncNow} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync now"}
          </Button>
        </div>
        {syncResult && (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {syncResult.properties} properties, {syncResult.reservations}{" "}
              reservations — {syncResult.tasksCreated} created,{" "}
              {syncResult.tasksUpdated} updated, {syncResult.tasksCancelled}{" "}
              cancelled, {syncResult.skipped} skipped
            </p>
            {syncResult.errors.length > 0 && (
              <p className="text-destructive">
                {syncResult.errors.length} error(s):{" "}
                {syncResult.errors[0].message}
                {syncResult.errors.length > 1 ? " …" : ""}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Webhooks</h2>
          {data && (
            <Badge variant={data.webhookConfigured ? "default" : "destructive"}>
              {data.webhookConfigured ? "Secret set" : "Secret missing"}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Hostfully webhooks are registered automatically for all booking and
          property events. The callback URL embeds the shared secret from
          HOSTFULLY_WEBHOOK_SECRET — keep it private.
        </p>
        <Button
          variant="outline"
          onClick={registerWebhooks}
          disabled={registering || !data?.configured}
        >
          {registering ? "Registering..." : "Register webhooks"}
        </Button>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent sync events</h2>
        <div className="space-y-2">
          {!data?.events.length && (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          )}
          {data?.events.map((e) => (
            <div key={e.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{e.eventType}</p>
                <Badge
                  variant={e.status === "PROCESSED" ? "outline" : "destructive"}
                >
                  {e.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.createdAt)}
              </p>
              {e.error && (
                <p className="text-sm text-destructive mt-1">{e.error}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
