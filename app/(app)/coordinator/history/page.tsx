"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type HistoryRecord = {
  id: string;
  createdAt: string;
  action: string;
  taskId: string | null;
  user: { name: string };
};

export default function HistoryPage() {
  const [logs, setLogs] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History</h1>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{log.action}</p>
              <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</p>
            </div>
            <p className="text-sm text-muted-foreground">{log.user.name}</p>
            {log.taskId && <p className="text-xs text-muted-foreground">Task {log.taskId}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
