"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, subDays, addDays } from "date-fns";
import { Search, Luggage, Car, Baby, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { taskStatusStyle } from "@/lib/task-status";

type TaskWithApartment = {
  id: string;
  title: string | null;
  date: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  type: "CHECK_OUT" | "REFRESH" | "CLEANING" | "REPAIR" | "OTHER";
  customTypeName: string | null;
  checkoutTime: string | null;
  checkinWindow: string | null;
  guestsCount: number | null;
  nightsCount: number | null;
  requests: string | null;
  instructions: string | null;
  apartment: { id: string; number: string; building: string | null };
  assignedTo: { id: string; name: string }[];
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

// Use date strings to avoid timezone comparison issues
function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export default function CleanerTasksPage() {
  const [dateStr, setDateStr] = useState<string>(toDateStr(new Date()));
  const [tasks, setTasks] = useState<TaskWithApartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"my" | "all" | "status">("my");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const online = useOnlineStatus();

  useEffect(() => {
    fetchTasks();
  }, [dateStr, filter, statusFilter]);

  async function fetchTasks() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("date", dateStr);
    if (filter === "my") params.set("myTasks", "true");
    if (filter === "status" && statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = tasks.filter(
    (t) =>
      t.apartment.number.toLowerCase().includes(search.toLowerCase()) ||
      (t.apartment.building || "").toLowerCase().includes(search.toLowerCase()),
  );

  const currentDate = new Date(dateStr + "T12:00:00");
  const todayStr = toDateStr(new Date());

  function navigateDate(offset: number) {
    const current = new Date(dateStr + "T12:00:00");
    const next = addDays(current, offset);
    setDateStr(toDateStr(next));
  }

  function getDateLabel(ds: string): string {
    const today = toDateStr(new Date());
    const yesterday = toDateStr(subDays(new Date(), 1));
    const tomorrow = toDateStr(addDays(new Date(), 1));
    if (ds === today) return "Today";
    if (ds === yesterday) return "Yesterday";
    if (ds === tomorrow) return "Tomorrow";
    return format(new Date(ds + "T12:00:00"), "dd/MM");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        {!online && <Badge variant="secondary">OFFLINE</Badge>}
      </div>

      {/* Date navigation */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => navigateDate(-1)}
        >
          {getDateLabel(toDateStr(subDays(currentDate, 1)))}
        </Button>
        <Button
          variant="default"
          size="sm"
          className="flex-[2]"
          onClick={() => setDateStr(todayStr)}
        >
          {dateStr === todayStr ? "Today" : getDateLabel(dateStr)}
          <span className="ml-1 text-xs opacity-70">
            {format(currentDate, "dd/MM")}
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => navigateDate(1)}
        >
          {getDateLabel(toDateStr(addDays(currentDate, 1)))}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search apartment"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === "my" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("my")}
        >
          My tasks
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "status" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("status")}
        >
          Status
        </Button>
        {filter === "status" && (
          <select
            className="text-sm border rounded-md px-2 py-1 bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="TODO">To do</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="DONE">Done</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No tasks for this day.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: TaskWithApartment }) {
  const statusColor = taskStatusStyle(task.status).badge;

  const typeLabel = getTaskTypeLabel(task.type, task.customTypeName);

  return (
    <Link href={`/tasks/${task.id}`}>
      <div className="rounded-2xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold">{task.title || typeLabel}</h2>
            <p className="text-2xl font-bold text-muted-foreground">
              {task.apartment.number}
            </p>
          </div>
          <Badge className={statusColor} variant="outline">
            {task.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          {task.checkoutTime && <p>Checkout {task.checkoutTime}</p>}
          {task.checkinWindow && <p>Check-in {task.checkinWindow}</p>}
          {task.assignedTo.length > 0 && (
            <p>Assigned: {task.assignedTo.map((a) => a.name).join(", ")}</p>
          )}
          {(task.guestsCount || task.nightsCount) && (
            <p>
              {task.guestsCount ? `${task.guestsCount} guests` : ""}
              {task.guestsCount && task.nightsCount ? " · " : ""}
              {task.nightsCount ? `${task.nightsCount} nights` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {task.requests?.toLowerCase().includes("luggage") && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Luggage className="size-3" /> Luggage
            </span>
          )}
          {task.requests?.toLowerCase().includes("parking") && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Car className="size-3" /> Parking
            </span>
          )}
          {task.requests?.toLowerCase().includes("baby") && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Baby className="size-3" /> Baby
            </span>
          )}
          {task.type === "REPAIR" && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Wrench className="size-3" /> Repair
            </span>
          )}
        </div>

        {task.instructions && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {task.instructions}
          </p>
        )}
      </div>
    </Link>
  );
}
