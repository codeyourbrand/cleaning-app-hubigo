"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { taskStatusStyle } from "@/lib/task-status";
import { InlineTimeInput } from "@/components/inline-time-input";
import { CleanerMultiSelect } from "@/components/cleaner-multi-select";
import { toast } from "sonner";

type Cleaner = { id: string; name: string };

type TaskSummary = {
  id: string;
  title: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  type: string;
  customTypeName: string | null;
  apartment: { number: string; building: string | null };
  assignedTo: Cleaner[];
  checkoutTime: string | null;
};

type Board = {
  today: TaskSummary[];
  tomorrow: TaskSummary[];
  dayAfter: TaskSummary[];
  cleaners: Cleaner[];
  counts: { todo: number; inProgress: number; done: number };
};

const COLUMN_KEYS = ["today", "tomorrow", "dayAfter"] as const;

function typeDot(type: string) {
  if (type === "CHECK_OUT") return "bg-slate-800";
  if (type === "REFRESH") return "bg-orange-500";
  return "bg-purple-500";
}

/** Chronological by time; tasks without a time go last (sort is stable). */
function sortByTime(tasks: TaskSummary[]) {
  return [...tasks].sort((a, b) => {
    if (a.checkoutTime === b.checkoutTime) return 0;
    if (!a.checkoutTime) return 1;
    if (!b.checkoutTime) return -1;
    return a.checkoutTime.localeCompare(b.checkoutTime);
  });
}

function mapTasks(board: Board, fn: (task: TaskSummary) => TaskSummary): Board {
  return {
    ...board,
    ...Object.fromEntries(COLUMN_KEYS.map((k) => [k, board[k].map(fn)])),
  };
}

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
        loadBoard();
      }
    } catch {
      toast.error("Could not move task");
      loadBoard();
    }
  }

  async function assignTask(taskId: string, userIds: string[]) {
    if (!board) return;
    const selected = board.cleaners.filter((c) => userIds.includes(c.id));
    setBoard(
      mapTasks(board, (t) =>
        t.id === taskId ? { ...t, assignedTo: selected } : t,
      ),
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToUserIds: userIds }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        selected.length > 0
          ? `Assigned to ${selected.map((c) => c.name).join(", ")}`
          : "Unassigned",
        {
          description:
            selected.length > 0
              ? "WhatsApp is sent from the Schedule page"
              : undefined,
        },
      );
    } catch {
      toast.error("Could not assign cleaners");
      loadBoard();
    }
  }

  async function updateTime(taskId: string, time: string | null) {
    if (!board) return;
    setBoard(
      mapTasks(board, (t) =>
        t.id === taskId ? { ...t, checkoutTime: time } : t,
      ),
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutTime: time }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Could not update time");
      loadBoard();
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

  const visibleTasks = [...board.today, ...board.tomorrow, ...board.dayAfter];
  const typeCounts = {
    checkout: visibleTasks.filter((task) => task.type === "CHECK_OUT").length,
    refresh: visibleTasks.filter((task) => task.type === "REFRESH").length,
    other: visibleTasks.filter((task) =>
      ["CLEANING", "REPAIR", "OTHER"].includes(task.type),
    ).length,
  };

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
            {board.cleaners.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Check-out"
          value={typeCounts.checkout}
          color="bg-slate-200 text-slate-800"
        />
        <StatCard
          label="Refresh"
          value={typeCounts.refresh}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          label="Other"
          value={typeCounts.other}
          color="bg-fuchsia-100 text-fuchsia-700"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Column
          title="Today"
          date={new Date()}
          tasks={board.today}
          columnId="today"
          cleaners={board.cleaners}
          onAssign={assignTask}
          onUpdateTime={updateTime}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
        <Column
          title="Tomorrow"
          date={addDays(new Date(), 1)}
          tasks={board.tomorrow}
          columnId="tomorrow"
          cleaners={board.cleaners}
          onAssign={assignTask}
          onUpdateTime={updateTime}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
        <Column
          title="Day after"
          date={addDays(new Date(), 2)}
          tasks={board.dayAfter}
          columnId="dayAfter"
          cleaners={board.cleaners}
          onAssign={assignTask}
          onUpdateTime={updateTime}
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
  cleaners,
  onAssign,
  onUpdateTime,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  title: string;
  date: Date;
  tasks: TaskSummary[];
  columnId: string;
  cleaners: Cleaner[];
  onAssign: (taskId: string, userIds: string[]) => void;
  onUpdateTime: (taskId: string, time: string | null) => void;
  onDragStart: (taskId: string, fromColumn: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (toColumn: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`rounded-3xl border bg-muted/30 p-3 min-w-[280px] transition-colors ${
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
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground shadow-sm">
            {tasks.length}
          </span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {format(date, "dd/MM")}
        </span>
      </div>
      {tasks.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">No tasks.</p>
      )}
      <div className="space-y-3">
        {sortByTime(tasks).map((t) => (
          <TaskTile
            key={t.id}
            task={t}
            columnId={columnId}
            cleaners={cleaners}
            onAssign={onAssign}
            onUpdateTime={onUpdateTime}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}

function TaskTile({
  task,
  columnId,
  cleaners,
  onAssign,
  onUpdateTime,
  onDragStart,
}: {
  task: TaskSummary;
  columnId: string;
  cleaners: Cleaner[];
  onAssign: (taskId: string, userIds: string[]) => void;
  onUpdateTime: (taskId: string, time: string | null) => void;
  onDragStart: (taskId: string, fromColumn: string) => void;
}) {
  const status = taskStatusStyle(task.status);
  const assignedNames = task.assignedTo.map((c) => c.name).join(", ");

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id, columnId);
      }}
      className={`group relative cursor-grab overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:cursor-grabbing ${status.tile}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${status.accent}`} />
      <Link href={`/tasks/${task.id}`} className="block py-3 pl-5 pr-3">
        <div className="flex items-center justify-between gap-2">
          <InlineTimeInput
            value={task.checkoutTime}
            onSave={(v) => onUpdateTime(task.id, v)}
          />
          <Badge className={status.badge} variant="outline">
            {status.label}
          </Badge>
        </div>
        <p className="mt-2 text-2xl font-bold leading-none tracking-tight">
          {task.apartment.number}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span
            className={`size-2 shrink-0 rounded-full ${typeDot(task.type)}`}
          />
          <span className="truncate">
            {task.title || getTaskTypeLabel(task.type, task.customTypeName)}
          </span>
        </p>
      </Link>
      <div className="border-t border-inherit bg-white/60 py-2 pl-5 pr-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <UserRound
              className={`size-3.5 ${task.assignedTo.length > 0 ? "text-foreground" : "text-muted-foreground"}`}
            />
          </span>
          <span
            className={`text-sm truncate ${
              task.assignedTo.length > 0
                ? "font-medium"
                : "italic text-muted-foreground"
            }`}
          >
            {assignedNames || "Unassigned"}
          </span>
        </div>
        <CleanerMultiSelect
          cleaners={cleaners}
          selected={task.assignedTo.map((c) => c.id)}
          onChange={(ids) => onAssign(task.id, ids)}
          placeholder="Assign cleaners"
        />
      </div>
    </div>
  );
}
