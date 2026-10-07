"use client";

import { formatDateTimeSeconds } from "@/lib/datetime";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Package,
  RefreshCw,
  MoreHorizontal,
  User,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type LogRecord = {
  id: string;
  createdAt: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  taskId: string | null;
  user: { id: string; name: string };
  task: {
    id: string;
    title: string | null;
    type: string;
    apartment: { number: string };
  } | null;
};

type Tab = "ALL" | "TASK" | "INVENTORY" | "SYNC" | "OTHER";

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "ALL", label: "All", icon: MoreHorizontal },
  { value: "TASK", label: "Tasks", icon: ListTodo },
  { value: "INVENTORY", label: "Inventory", icon: Package },
  { value: "SYNC", label: "Sync", icon: RefreshCw },
  { value: "OTHER", label: "Other", icon: MoreHorizontal },
];

const ACTION_LABELS: Record<string, string> = {
  TASK_CREATED: "Task created",
  TASK_ASSIGNED: "Task assigned",
  TASK_STARTED: "Task started",
  TASK_COMPLETED: "Task completed",
  TASK_STATUS_CHANGED: "Task status changed",
  TASK_EDITED: "Task edited",
  TASK_DELETED: "Task deleted",
  STEP_COMPLETED: "Step completed",
  STEP_UNCOMPLETED: "Step uncompleted",
  COMMENT_CREATED: "Comment added",
  PHOTO_ADDED: "Photo added",
  LOST_FOUND_CREATED: "Lost & found reported",
  DAMAGE_CREATED: "Damage reported",
  USER_CREATED: "User created",
  USER_UPDATED: "User updated",
  APARTMENT_CREATED: "Apartment created",
  APARTMENT_UPDATED: "Apartment updated",
  TASK_IMPORTED: "Tasks imported",
  HOSTFULLY_SYNC: "Hostfully sync",
  INVENTORY_CHECKLIST_CREATED: "Checklist created",
  INVENTORY_CHECKLIST_UPDATED: "Checklist updated",
  INVENTORY_CHECKLIST_DELETED: "Checklist deleted",
  INVENTORY_ITEM_ADDED: "Item added",
  INVENTORY_ITEM_UPDATED: "Item updated",
  INVENTORY_ITEM_DELETED: "Item deleted",
  INVENTORY_ITEM_CHECKED: "Item checked",
  INVENTORY_ITEM_UNCHECKED: "Item unchecked",
  WHATSAPP_SKIPPED: "WhatsApp notification skipped",
};

function getActionBadgeColor(action: string): string {
  if (
    action.startsWith("TASK_") ||
    action.startsWith("STEP_") ||
    action === "COMMENT_CREATED" ||
    action === "PHOTO_ADDED"
  )
    return "bg-blue-100 text-blue-700 border-blue-200";
  if (action.startsWith("INVENTORY_"))
    return "bg-purple-100 text-purple-700 border-purple-200";
  if (action === "HOSTFULLY_SYNC")
    return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>("ALL");
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab !== "ALL") params.set("category", tab);
    if (search) params.set("search", search);
    params.set("sortDir", sortDir);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    try {
      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [tab, sortDir, limit, offset]);

  useEffect(() => {
    setOffset(0);
  }, [tab, search, sortDir]);

  useEffect(() => {
    load();
  }, [load, offset]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const hasMore = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Logs</h1>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Button
              key={t.value}
              variant={tab === t.value ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.value)}
            >
              <Icon className="size-4 mr-1" />
              {t.label}
            </Button>
          );
        })}
      </div>

      {/* Search + sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
        >
          <ArrowUpDown className="size-4 mr-1" />
          {sortDir === "desc" ? "Newest first" : "Oldest first"}
        </Button>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {total} log{total !== 1 ? "s" : ""} found
        {offset > 0 &&
          ` · Showing ${offset + 1}–${Math.min(offset + limit, total)}`}
      </p>

      {/* Log entries */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No logs found.
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasMore) && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: LogRecord }) {
  const [expanded, setExpanded] = useState(false);
  const label = ACTION_LABELS[log.action] || log.action;
  const badgeColor = getActionBadgeColor(log.action);

  const parsedNew = safeParseJson(log.newValue);
  const parsedOld = safeParseJson(log.oldValue);
  const hasDetails = parsedNew || parsedOld;

  // Build a human-readable summary
  const summary = buildSummary(log.action, parsedNew, parsedOld, log.task);

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={badgeColor} variant="outline">
              {label}
            </Badge>
            {log.task && (
              <Link
                href={`/tasks/${log.task.id}`}
                className="text-xs text-primary hover:underline"
              >
                {log.task.title || log.task.type} · {log.task.apartment.number}
              </Link>
            )}
          </div>
          {summary && <p className="text-sm text-foreground mb-1">{summary}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {log.user.name}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatDateTimeSeconds(log.createdAt)}
            </span>
          </div>
        </div>
        {hasDetails && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="mt-3 pt-3 border-t space-y-2">
          {parsedOld && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                Before
              </p>
              <pre className="text-xs bg-muted rounded-lg p-2 overflow-x-auto max-h-48">
                {JSON.stringify(parsedOld, null, 2)}
              </pre>
            </div>
          )}
          {parsedNew && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                After
              </p>
              <pre className="text-xs bg-muted rounded-lg p-2 overflow-x-auto max-h-48">
                {JSON.stringify(parsedNew, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function safeParseJson(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildSummary(
  action: string,
  newVal: any,
  oldVal: any,
  task: LogRecord["task"],
): string | null {
  switch (action) {
    case "TASK_CREATED":
      return newVal?.assignedToUserId
        ? `Created and assigned task`
        : `Created task`;
    case "TASK_ASSIGNED":
      return newVal?.assignedToUserId ? `Assigned to user` : `Unassigned task`;
    case "TASK_STARTED":
      return `Started cleaning`;
    case "TASK_COMPLETED":
      return `Completed cleaning`;
    case "TASK_EDITED":
      return `Edited task details`;
    case "STEP_COMPLETED":
      return newVal?.stepId ? `Completed step` : null;
    case "STEP_UNCOMPLETED":
      return newVal?.stepId ? `Uncompleted step` : null;
    case "COMMENT_CREATED":
      return newVal?.body
        ? `"${(newVal.body as string).slice(0, 80)}${(newVal.body as string).length > 80 ? "..." : ""}"`
        : null;
    case "PHOTO_ADDED":
      return newVal?.type ? `Added ${newVal.type.toLowerCase()} photo` : null;
    case "TASK_IMPORTED":
      return newVal?.stats
        ? `Imported ${newVal.stats.created} task(s) from ${newVal.stats.total} rows`
        : null;
    case "HOSTFULLY_SYNC":
      if (newVal?.tasksCreated !== undefined) {
        return `Properties: ${newVal.properties ?? 0}, Reservations: ${newVal.reservations ?? 0}, Tasks created: ${newVal.tasksCreated ?? 0}, Updated: ${newVal.tasksUpdated ?? 0}${newVal.errors?.length ? `, Errors: ${newVal.errors.length}` : ""}`;
      }
      if (newVal?.reason) return newVal.reason;
      return null;
    case "INVENTORY_CHECKLIST_CREATED":
      return newVal?.name
        ? `Created "${newVal.name}" (${newVal.type?.toLowerCase() || "checklist"}) with ${newVal.itemCount ?? 0} items`
        : null;
    case "INVENTORY_CHECKLIST_UPDATED":
      return newVal?.name ? `Updated checklist "${newVal.name}"` : null;
    case "INVENTORY_CHECKLIST_DELETED":
      return oldVal?.name ? `Deleted checklist "${oldVal.name}"` : null;
    case "INVENTORY_ITEM_ADDED":
      if (newVal?.items) {
        return `Added ${newVal.items.length} item(s) to "${newVal.checklistName}"`;
      }
      return newVal?.name
        ? `Added "${newVal.name}" (qty: ${newVal.quantity ?? 1}) to "${newVal.checklistName}"`
        : null;
    case "INVENTORY_ITEM_UPDATED":
      return newVal?.name ? `Updated item "${newVal.name}"` : null;
    case "INVENTORY_ITEM_DELETED":
      return oldVal?.name
        ? `Removed "${oldVal.name}" from "${oldVal.checklistName}"`
        : null;
    case "INVENTORY_ITEM_CHECKED":
      return newVal?.itemName
        ? `Checked "${newVal.itemName}" in "${newVal.checklistName}"`
        : null;
    case "INVENTORY_ITEM_UNCHECKED":
      return newVal?.itemName
        ? `Unchecked "${newVal.itemName}" in "${newVal.checklistName}"`
        : null;
    case "USER_CREATED":
      return newVal?.name ? `Created user "${newVal.name}"` : null;
    case "USER_UPDATED":
      return newVal?.name ? `Updated user "${newVal.name}"` : null;
    case "APARTMENT_CREATED":
      return newVal?.number
        ? `Created apartment ${newVal.number}${newVal.building ? ` · ${newVal.building}` : ""}`
        : null;
    case "APARTMENT_UPDATED":
      return newVal?.number ? `Updated apartment ${newVal.number}` : null;
    default:
      return null;
  }
}
