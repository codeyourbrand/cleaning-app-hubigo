"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Setting = {
  id: string;
  eventType: string;
  enabled: boolean;
  destination: "GROUP" | "USER" | "BOTH";
};

type SettingsResponse = {
  settings: Setting[];
  configured: boolean;
  labels: Record<string, string>;
  destinationLabels: Record<string, string>;
};

export default function WhatsAppNotificationsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/settings");
      if (!res.ok) throw new Error("Failed to load");
      setData(await res.json());
    } catch {
      toast.error("Failed to load WhatsApp settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function updateSetting(
    eventType: string,
    patch: Partial<Pick<Setting, "enabled" | "destination">>,
  ) {
    if (!data) return;

    // Optimistic update
    setData({
      ...data,
      settings: data.settings.map((s) =>
        s.eventType === eventType ? { ...s, ...patch } : s,
      ),
    });

    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ eventType, ...patch }] }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      setData({ ...data, settings: updated.settings });
    } catch {
      toast.error("Failed to save setting");
      fetchSettings();
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/whatsapp/test", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      toast.success("Test message sent to WhatsApp group!");
    } catch (err) {
      toast.error((err as Error).message || "Failed to send test message");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <MessageSquare className="size-6 text-green-600" />
          <h1 className="text-2xl font-bold tracking-tight">
            WhatsApp Notifications
          </h1>
        </div>
        <Badge
          variant={data.configured ? "default" : "secondary"}
          className={
            data.configured
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : ""
          }
        >
          {data.configured ? "Connected" : "Not configured"}
        </Badge>
      </div>

      {!data.configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 items-start dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium mb-1">Configuration required</p>
            <p>
              Set{" "}
              <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">
                WHAPI_TOKEN
              </code>{" "}
              and{" "}
              <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">
                WHAPI_GROUP_ID
              </code>{" "}
              in your environment variables to enable WhatsApp notifications.
            </p>
            <p className="mt-1">
              Get your token from{" "}
              <a
                href="https://whapi.cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                whapi.cloud
              </a>
              . The group ID can be found using the Whapi API{" "}
              <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">
                GET /groups
              </code>{" "}
              endpoint.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Notification events</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose which events send a message and where: to the group, to the
            person directly (their WhatsApp number), or both.
          </p>
        </div>
        <div className="divide-y">
          {data.settings.map((setting) => (
            <div
              key={setting.eventType}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <EventIcon eventType={setting.eventType} />
                <div>
                  <div className="font-medium text-sm">
                    {data.labels[setting.eventType] || setting.eventType}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {eventDescription(setting.eventType)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {setting.enabled && (
                  <select
                    value={setting.destination}
                    onChange={(e) =>
                      updateSetting(setting.eventType, {
                        destination: e.target.value as Setting["destination"],
                      })
                    }
                    disabled={saving || !data.configured}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {Object.entries(data.destinationLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                )}
                <label className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={setting.enabled}
                    onChange={(e) =>
                      updateSetting(setting.eventType, {
                        enabled: e.target.checked,
                      })
                    }
                    disabled={saving || !data.configured}
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer-checked:bg-green-600 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-sm">Test connection</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send a test message to your WhatsApp group to verify the
              integration works.
            </p>
          </div>
          <Button
            onClick={sendTest}
            disabled={testing || !data.configured}
            size="sm"
            className="gap-2"
          >
            <Send className="size-4" />
            {testing ? "Sending..." : "Send test"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EventIcon({ eventType }: { eventType: string }) {
  const base =
    "size-9 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm";
  switch (eventType) {
    case "TASK_CREATED":
      return (
        <div className={`${base} bg-blue-500`}>
          <Plus className="size-5" strokeWidth={2.25} />
        </div>
      );
    case "TASK_ASSIGNED":
      return (
        <div className={`${base} bg-purple-500`}>
          <UserRound className="size-5" strokeWidth={2.25} />
        </div>
      );
    case "TASK_TIMING_CHANGED":
      return (
        <div className={`${base} bg-orange-500`}>
          <Clock className="size-5" strokeWidth={2.25} />
        </div>
      );
    case "TASK_STARTED":
      return (
        <div className={`${base} bg-amber-500`}>
          <Play className="size-5 fill-current" strokeWidth={2.25} />
        </div>
      );
    case "TASK_COMPLETED":
      return (
        <div className={`${base} bg-green-500`}>
          <CheckCircle2 className="size-5" strokeWidth={2.25} />
        </div>
      );
    case "REFRESH_CREATED":
      return (
        <div className={`${base} bg-cyan-500`}>
          <RefreshCw className="size-5" strokeWidth={2.25} />
        </div>
      );
    case "TASK_COMMENTED":
      return (
        <div className={`${base} bg-pink-500`}>
          <MessageSquare className="size-5" strokeWidth={2.25} />
        </div>
      );
    default:
      return (
        <div className={`${base} bg-gray-500`}>
          <MessageSquare className="size-5" strokeWidth={2.25} />
        </div>
      );
  }
}

function eventDescription(eventType: string): string {
  switch (eventType) {
    case "TASK_CREATED":
      return "When a new task is created (manual or Hostfully checkout)";
    case "TASK_ASSIGNED":
      return "Sent to the cleaner when the coordinator clicks the WhatsApp button in the schedule";
    case "TASK_TIMING_CHANGED":
      return "Sent to the cleaner (marked TIMING CHANGED) when the time is edited after the assignment was sent";
    case "TASK_COMMENTED":
      return "When a comment is added to a task (coordinator comments go to the assigned cleaner)";
    case "TASK_STARTED":
      return "When a cleaner starts working on a task";
    case "TASK_COMPLETED":
      return "When a task is marked as completed";
    case "REFRESH_CREATED":
      return "When a mid-stay refresh task is automatically generated";
    default:
      return "";
  }
}
