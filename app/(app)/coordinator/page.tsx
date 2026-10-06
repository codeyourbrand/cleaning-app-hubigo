"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type TaskSummary = {
  id: string;
  title: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  type: string;
  customTypeName: string | null;
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

function getTaskTypeLabel(type: string, customTypeName?: string | null) {
  switch (type) {
    case "CHECK_OUT":
      return "Check-out";
    case "REFRESH":
      return "Refresh";
    case "CLEANING":
      return "Cleaning";
    case "REPAIR":
      return "Repair";
    case "OTHER":
      return customTypeName || "Other";
    default:
      return type;
  }
}

export default function CoordinatorDashboard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    cleaner: "",
    building: "",
    status: "",
  });

  async function loadBoard() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const res = await fetch(
        `/api/coordinator/dashboard?${params.toString()}`,
      );
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

  // Drag and drop handlers
  const dragItem = useRef<{ taskId: string; fromColumn: string } | null>(null);

  function handleDragStart(taskId: string, fromColumn: string) {
    dragItem.current = { taskId, fromColumn };
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(toColumn: string) {
    if (!dragItem.current || !board) return;
    const { taskId, fromColumn } = dragItem.current;
    if (fromColumn === toColumn) {
      dragItem.current = null;
      return;
    }

    // Optimistic: move the task between columns
    const columnKeys: Record<
      string,
      keyof Pick<Board, "today" | "tomorrow" | "dayAfter">
    > = {
      today: "today",
      tomorrow: "tomorrow",
      dayAfter: "dayAfter",
    };

    const fromKey = columnKeys[fromColumn];
    const toKey = columnKeys[toColumn];
    if (!fromKey || !toKey) return;

    const task = board[fromKey].find((t) => t.id === taskId);
    if (!task) return;

    // Calculate the new date
    const dateOffsets: Record<string, number> = {
      today: 0,
      tomorrow: 1,
      dayAfter: 2,
    };
    const newDate = addDays(new Date(), dateOffsets[toColumn]);
    const dateStr = format(newDate, "yyyy-MM-dd");

    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [fromKey]: prev[fromKey].filter((t) => t.id !== taskId),
        [toKey]: [...prev[toKey], task],
      };
    });

    dragItem.current = null;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date(dateStr) }),
      });
      if (!res.ok) {
        toast.error("Could not move task");
        loadBoard(); // revert
      }
    } catch {
      toast.error("Could not move task");
      loadBoard(); // revert
    }
  }

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
            onChange={(e) =>
              setFilters({ ...filters, cleaner: e.target.value })
            }
            aria-label="Filter by cleaner"
          >
            <option value="">All cleaners</option>
            <option value="me">My tasks</option>
          </select>
          <select
            className="text-sm border rounded-md px-2 py-1 bg-background"
            value={filters.building}
            onChange={(e) =>
              setFilters({ ...filters, building: e.target.value })
            }
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
        <StatCard
          label="To do"
          value={board.counts.todo}
          color="bg-red-100 text-red-700"
        />
        <StatCard
          label="In progress"
          value={board.counts.inProgress}
          color="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Done"
          value={board.counts.done}
          color="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Column
          title="Today"
          date={new Date()}
          tasks={board.today}
          columnId="today"
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
        <Column
          title="Tomorrow"
          date={addDays(new Date(), 1)}
          tasks={board.tomorrow}
          columnId="tomorrow"
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
        <Column
          title="Day after"
          date={addDays(new Date(), 2)}
          tasks={board.dayAfter}
          columnId="dayAfter"
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

function Column({
  title,
  date,
  tasks,
  columnId,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  title: string;
  date: Date;
  tasks: TaskSummary[];
  columnId: string;
  onDragStart: (taskId: string, fromColumn: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (toColumn: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`rounded-2xl border bg-card p-4 min-w-[280px] transition-colors ${
        dragOver ? "ring-2 ring-primary/50 bg-primary/5" : ""
      }`}
      onDragOver={(e) => {
        onDragOver(e);
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop(columnId);
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {format(date, "MMM d")}
        </span>
      </div>
      <div className="space-y-3">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">No tasks.</p>
        )}
        {tasks.map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart(t.id, columnId);
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <Link href={`/tasks/${t.id}`}>
              <div
                className={`rounded-xl border p-3 mb-0 hover:shadow-md transition-shadow ${statusBg(t.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-base truncate">
                      {t.title || getTaskTypeLabel(t.type, t.customTypeName)}
                    </p>
                    <p className="text-lg font-bold text-muted-foreground">
                      {t.apartment.number}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.apartment.building || "—"}
                </p>
                {t.assignedTo && <p className="text-sm">{t.assignedTo.name}</p>}
                {t.checkoutTime && (
                  <p className="text-xs text-muted-foreground">
                    Checkout {t.checkoutTime}
                  </p>
                )}
              </div>
            </Link>
          </div>
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
  return (
    <Badge className={cls} variant="outline">
      {status.replace("_", " ")}
    </Badge>
  );
}
