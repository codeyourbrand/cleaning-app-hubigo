"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type TaskSummary = {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  apartment: { number: string; building: string | null };
  assignedTo: { name: string } | null;
  checkoutTime: string | null;
};

type Board = {
  today: TaskSummary[];
  tomorrow: TaskSummary[];
  dayAfter: TaskSummary[];
  counts: { todo: number; inProgress: number; done: number };
};

export default function CoordinatorDashboard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ cleaner: "", building: "", status: "" });

  async function loadBoard() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const res = await fetch(`/api/coordinator/dashboard?${params.toString()}`);
      const data = await res.json();
      setBoard(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoard();
    const interval = setInterval(loadBoard, 5000);
    return () => clearInterval(interval);
  }, [filters.cleaner, filters.building, filters.status]);

  if (loading || !board) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Team Board</h1>
        <div className="flex flex-wrap gap-2">
          <select
            className="text-sm border rounded-md px-2 py-1 bg-background"
            value={filters.cleaner}
            onChange={(e) => setFilters({ ...filters, cleaner: e.target.value })}
            aria-label="Filter by cleaner"
          >
            <option value="">All cleaners</option>
            <option value="me">My tasks</option>
          </select>
          <select
            className="text-sm border rounded-md px-2 py-1 bg-background"
            value={filters.building}
            onChange={(e) => setFilters({ ...filters, building: e.target.value })}
            aria-label="Filter by building"
          >
            <option value="">All buildings</option>
          </select>
          <select
            className="text-sm border rounded-md px-2 py-1 bg-background"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="To do" value={board.counts.todo} color="bg-red-100 text-red-700" />
        <StatCard label="In progress" value={board.counts.inProgress} color="bg-amber-100 text-amber-700" />
        <StatCard label="Done" value={board.counts.done} color="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Column title="Today" date={new Date()} tasks={board.today} />
        <Column title="Tomorrow" date={addDays(new Date(), 1)} tasks={board.tomorrow} />
        <Column title="Day after" date={addDays(new Date(), 2)} tasks={board.dayAfter} />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

function Column({ title, date, tasks }: { title: string; date: Date; tasks: TaskSummary[] }) {
  return (
    <div className="rounded-2xl border bg-card p-4 min-w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-xs text-muted-foreground">{format(date, "MMM d")}</span>
      </div>
      <div className="space-y-3">
        {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks.</p>}
        {tasks.map((t) => (
          <Link key={t.id} href={`/tasks/${t.id}`}>
            <div className={`rounded-xl border p-3 mb-3 hover:shadow-md transition-shadow ${statusBg(t.status)}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-lg">{t.apartment.number}</p>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-sm text-muted-foreground">{t.apartment.building || "—"}</p>
              {t.assignedTo && <p className="text-sm">{t.assignedTo.name}</p>}
              {t.checkoutTime && <p className="text-xs text-muted-foreground">Checkout {t.checkoutTime}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function statusBg(status: string) {
  if (status === "DONE") return "bg-emerald-50 border-emerald-200";
  if (status === "IN_PROGRESS") return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "DONE"
      ? "bg-emerald-100 text-emerald-700"
      : status === "IN_PROGRESS"
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return <Badge className={cls} variant="outline">{status.replace("_", " ")}</Badge>;
}
