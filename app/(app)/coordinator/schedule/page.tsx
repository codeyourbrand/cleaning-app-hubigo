"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { format, addDays, subDays, startOfWeek, parseISO } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskRow = {
  id: string;
  title: string | null;
  status: string;
  type: string;
  customTypeName: string | null;
  checkoutTime: string | null;
  checkinWindow: string | null;
  guestsCount: number | null;
  nightsCount: number | null;
  requests: string | null;
  instructions: string | null;
  apartment: { id: string; number: string; building: string | null };
  assignedTo: { id: string; name: string } | null;
};

type Shift = {
  id: string;
  userId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  dayOff: boolean;
  note: string | null;
  user: { id: string; name: string };
};

type ScheduleNote = {
  id: string;
  date: string;
  note: string;
  kind: "GENERAL" | "WEEKLY_NOTE" | "MAINTENANCE" | "IN_CHARGE";
  sortOrder: number;
};

type Cleaner = { id: string; name: string };

type DailyData = {
  tasks: TaskRow[];
  shifts: Shift[];
  notes: ScheduleNote[];
  cleaners: Cleaner[];
  date: string;
};

type WeekDay = {
  date: string;
  dayOfWeek: string;
  shifts: Shift[];
  tasks: TaskRow[];
  notes: ScheduleNote[];
};

type WeeklyData = {
  days: WeekDay[];
  cleaners: Cleaner[];
  weekStart: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeLabel(type: string, custom?: string | null) {
  switch (type) {
    case "CHECK_OUT":
      return "CHECK OUT";
    case "REFRESH":
      return "REFRESH";
    case "CLEANING":
      return "VACANT CLEAN";
    case "REPAIR":
      return "REPAIR";
    case "OTHER":
      return custom || "OTHER";
    default:
      return type;
  }
}

function typeColor(type: string) {
  switch (type) {
    case "CHECK_OUT":
      return "text-black font-bold";
    case "REFRESH":
      return "text-blue-600 font-bold";
    case "CLEANING":
      return "text-fuchsia-600 font-bold";
    case "REPAIR":
      return "text-red-600 font-bold";
    default:
      return "text-amber-700 font-bold";
  }
}

function statusIcon(status: string) {
  if (status === "DONE") return "✅";
  if (status === "IN_PROGRESS") return "🔄";
  return "☐";
}

function fmtDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

const cellClass =
  "w-full h-8 appearance-none rounded border border-transparent bg-transparent px-1.5 text-center text-sm hover:border-input focus:border-ring focus:bg-white focus:outline-none";

const TASK_TYPES = [
  { value: "CHECK_OUT", label: "CHECK OUT" },
  { value: "REFRESH", label: "REFRESH" },
  { value: "CLEANING", label: "VACANT CLEAN" },
  { value: "REPAIR", label: "REPAIR" },
  { value: "OTHER", label: "OTHER" },
];

function CellInput({
  value,
  onSave,
  type = "text",
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  className?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      type={type}
      className={`${cellClass} ${className}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      onKeyDown={(e) =>
        e.key === "Enter" && (e.target as HTMLInputElement).blur()
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SchedulePage() {
  const [tab, setTab] = useState<"daily" | "weekly">("daily");
  const [currentDate, setCurrentDate] = useState(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
        <div className="flex gap-1 rounded-lg border p-0.5 bg-muted">
          <button
            onClick={() => setTab("daily")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "daily"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="size-4" />
            Daily
          </button>
          <button
            onClick={() => setTab("weekly")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "weekly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarRange className="size-4" />
            Weekly
          </button>
        </div>
      </div>

      {tab === "daily" ? (
        <DailyView date={currentDate} onDateChange={setCurrentDate} />
      ) : (
        <WeeklyView date={currentDate} onDateChange={setCurrentDate} />
      )}
    </div>
  );
}

// ===========================================================================
// DAILY VIEW
// ===========================================================================

function DailyView({
  date,
  onDateChange,
}: {
  date: Date;
  onDateChange: (d: Date) => void;
}) {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingShifts, setEditingShifts] = useState(false);
  const [shiftInputs, setShiftInputs] = useState<
    Record<string, { start: string; end: string; dayOff: boolean }>
  >({});
  const [savingShifts, setSavingShifts] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [apartments, setApartments] = useState<
    { id: string; number: string; building: string | null }[]
  >([]);
  const [newTask, setNewTask] = useState({
    apartmentId: "",
    type: "CHECK_OUT",
    time: "",
    assignedToUserId: "",
  });
  const [creatingTask, setCreatingTask] = useState(false);

  const dateStr = fmtDate(date);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/schedule?date=${dateStr}`);
        if (!res.ok) throw new Error();
        const d: DailyData = await res.json();
        setData(d);
        if (silent) return;
        // Init shift inputs
        const inputs: typeof shiftInputs = {};
        for (const c of d.cleaners) {
          const existing = d.shifts.find((s) => s.userId === c.id);
          inputs[c.id] = {
            start: existing?.startTime ?? "",
            end: existing?.endTime ?? "",
            dayOff: existing?.dayOff ?? false,
          };
        }
        setShiftInputs(inputs);
      } catch {
        toast.error("Failed to load schedule");
      } finally {
        setLoading(false);
      }
    },
    [dateStr],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/apartments")
      .then((r) => r.json())
      .then((d) => setApartments(d.apartments ?? []))
      .catch(() => toast.error("Failed to load apartments"));
  }, []);

  async function patchTask(id: string, patch: Record<string, unknown>) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === id ? ({ ...t, ...patch } as TaskRow) : t,
            ),
          }
        : prev,
    );
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) toast.error("Failed to save");
    if ("assignedToUserId" in patch || "apartmentId" in patch || !res.ok)
      load(true);
  }

  async function removeTask(id: string) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete task");
    load(true);
  }

  async function createTask() {
    if (!newTask.apartmentId) return toast.error("Select an apartment");
    setCreatingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apartmentId: newTask.apartmentId,
          date: dateStr,
          type: newTask.type,
          checkoutTime: newTask.time || undefined,
          assignedToUserId: newTask.assignedToUserId || null,
        }),
      });
      if (!res.ok) throw new Error();
      setNewTask({ ...newTask, apartmentId: "", time: "" });
      load(true);
    } catch {
      toast.error("Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  }

  async function saveShifts() {
    setSavingShifts(true);
    try {
      const bulk = Object.entries(shiftInputs).map(([userId, v]) => ({
        userId,
        date: dateStr,
        startTime: v.start || null,
        endTime: v.end || null,
        dayOff: v.dayOff,
      }));
      const res = await fetch("/api/schedule/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk }),
      });
      if (!res.ok) throw new Error();
      toast.success("Shifts saved");
      setEditingShifts(false);
      load();
    } catch {
      toast.error("Failed to save shifts");
    } finally {
      setSavingShifts(false);
    }
  }

  async function addNote() {
    if (!noteInput.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch("/api/schedule/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, note: noteInput.trim() }),
      });
      if (!res.ok) throw new Error();
      setNoteInput("");
      load();
    } catch {
      toast.error("Failed to add note");
    } finally {
      setAddingNote(false);
    }
  }

  async function deleteNote(id: string) {
    try {
      await fetch("/api/schedule/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      load();
    } catch {
      toast.error("Failed to delete note");
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Group cleaners who have shifts today
  const activeShifts = data.shifts.filter((s) => !s.dayOff);
  const shiftSummary =
    activeShifts.length > 0
      ? activeShifts.map((s) => s.user.name).join(", ")
      : "No shifts set";
  const offNames = data.shifts
    .filter((x) => x.dayOff)
    .map((x) => x.user.name)
    .join(", ");
  const dayLabel =
    fmtDate(date) === fmtDate(new Date())
      ? "TODAY"
      : fmtDate(date) === fmtDate(addDays(new Date(), 1))
        ? "TOMORROW"
        : format(date, "EEEE").toUpperCase();

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDateChange(subDays(date, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <div className="text-lg font-bold">
            {format(date, "EEEE, dd/MM/yyyy")}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDateChange(addDays(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(new Date())}
          className="ml-2"
        >
          Today
        </Button>
      </div>

      {/* Shift header section */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-start justify-between gap-4 p-3">
          <table className="w-[420px] max-w-full border-collapse border border-black bg-white text-sm text-black">
            <tbody>
              <tr>
                <td
                  colSpan={3}
                  className="border border-black py-1 text-center font-bold text-blue-700"
                >
                  FOR {dayLabel}
                </td>
              </tr>
              <tr>
                <td className="border border-black" />
                <td
                  colSpan={2}
                  className="border border-black py-1 text-center font-bold"
                >
                  OFF{offNames && `: ${offNames}`}
                </td>
              </tr>
              <tr className="font-bold">
                <td className="border border-black" />
                <td className="border border-black py-1 text-center">
                  Shift start
                </td>
                <td className="border border-black py-1 text-center">
                  Shift end
                </td>
              </tr>
              <tr className="font-bold">
                <td className="border border-black px-2 py-3 text-center">
                  {shiftSummary}
                </td>
                <td className="border border-black text-center">
                  {activeShifts[0]?.startTime ?? "-"}
                </td>
                <td className="border border-black text-center">
                  {activeShifts[0]?.endTime ?? "-"}
                </td>
              </tr>
            </tbody>
          </table>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingShifts(!editingShifts)}
          >
            {editingShifts ? "Cancel" : "Edit shifts"}
          </Button>
        </div>

        {editingShifts && (
          <div className="p-4 space-y-3">
            {data.cleaners.map((c) => {
              const inp = shiftInputs[c.id] ?? {
                start: "",
                end: "",
                dayOff: false,
              };
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 text-sm flex-wrap"
                >
                  <span className="w-28 font-medium truncate">{c.name}</span>
                  <Input
                    type="time"
                    className="w-28 h-8"
                    value={inp.start}
                    onChange={(e) =>
                      setShiftInputs({
                        ...shiftInputs,
                        [c.id]: { ...inp, start: e.target.value },
                      })
                    }
                    disabled={inp.dayOff}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    className="w-28 h-8"
                    value={inp.end}
                    onChange={(e) =>
                      setShiftInputs({
                        ...shiftInputs,
                        [c.id]: { ...inp, end: e.target.value },
                      })
                    }
                    disabled={inp.dayOff}
                  />
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inp.dayOff}
                      onChange={(e) =>
                        setShiftInputs({
                          ...shiftInputs,
                          [c.id]: { ...inp, dayOff: e.target.checked },
                        })
                      }
                    />
                    <span className="text-red-600 font-medium">Day off</span>
                  </label>
                </div>
              );
            })}
            <div className="pt-2">
              <Button size="sm" onClick={saveShifts} disabled={savingShifts}>
                {savingShifts && (
                  <Loader2 className="size-4 mr-1 animate-spin" />
                )}
                Save shifts
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add note */}
      <div className="flex gap-2">
        <Input
          placeholder="Add note (e.g. BREAK 15:00 — 6607)"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNote()}
          className="h-9"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={addNote}
          disabled={addingNote || !noteInput.trim()}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Daily task table — editable, Excel-style */}
      <div className="overflow-x-auto">
        <table className="min-w-[1300px] w-full border-collapse border border-black bg-white text-sm text-black">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1 text-center font-bold w-24">
                Time
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold w-40">
                Assigned
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold w-32">
                Apartment
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold w-32">
                Type
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold w-14">
                Done?
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold w-24">
                Check in
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold w-16">
                Guests
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold w-16">
                Nights
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold">
                Request
              </th>
              <th className="border border-black px-2 py-1 text-center font-bold">
                Instructions
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {data.tasks.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="border border-black px-3 py-8 text-center text-muted-foreground"
                >
                  No tasks scheduled for this day.
                </td>
              </tr>
            )}
            {data.tasks.map((t) => (
              <tr
                key={t.id}
                className={`hover:bg-slate-50 ${
                  t.status === "DONE" ? "bg-emerald-50" : ""
                }`}
              >
                <td className="border border-black px-1 py-1">
                  <CellInput
                    type="time"
                    value={t.checkoutTime ?? ""}
                    onSave={(v) => patchTask(t.id, { checkoutTime: v || null })}
                  />
                </td>
                <td className="border border-black px-1 py-1">
                  <select
                    className={cellClass}
                    value={t.assignedTo?.id ?? ""}
                    onChange={(e) =>
                      patchTask(t.id, {
                        assignedToUserId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {data.cleaners.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border border-black px-1 py-1">
                  <select
                    className={`${cellClass} font-bold`}
                    value={t.apartment.id}
                    onChange={(e) =>
                      patchTask(t.id, { apartmentId: e.target.value })
                    }
                  >
                    {!apartments.some((a) => a.id === t.apartment.id) && (
                      <option value={t.apartment.id}>
                        {t.apartment.number}
                      </option>
                    )}
                    {apartments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.number}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border border-black px-1 py-1">
                  <select
                    className={`${cellClass} ${typeColor(t.type)}`}
                    value={t.type}
                    onChange={(e) => patchTask(t.id, { type: e.target.value })}
                  >
                    {TASK_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border border-black px-2 py-1 text-center">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer"
                    checked={t.status === "DONE"}
                    onChange={(e) =>
                      patchTask(t.id, {
                        status: e.target.checked ? "DONE" : "TODO",
                      })
                    }
                  />
                </td>
                <td className="border border-black px-1 py-1">
                  <CellInput
                    type="time"
                    value={t.checkinWindow ?? ""}
                    onSave={(v) =>
                      patchTask(t.id, { checkinWindow: v || null })
                    }
                  />
                </td>
                <td className="border border-black px-1 py-1">
                  <CellInput
                    type="number"
                    className="text-center"
                    value={t.guestsCount?.toString() ?? ""}
                    onSave={(v) =>
                      patchTask(t.id, {
                        guestsCount: v === "" ? null : Number(v),
                      })
                    }
                  />
                </td>
                <td className="border border-black px-1 py-1">
                  <CellInput
                    type="number"
                    className="text-center"
                    value={t.nightsCount?.toString() ?? ""}
                    onSave={(v) =>
                      patchTask(t.id, {
                        nightsCount: v === "" ? null : Number(v),
                      })
                    }
                  />
                </td>
                <td className="border border-black px-1 py-1">
                  <CellInput
                    value={t.requests ?? ""}
                    onSave={(v) => patchTask(t.id, { requests: v || null })}
                  />
                </td>
                <td className="border border-black px-1 py-1">
                  <CellInput
                    value={t.instructions ?? ""}
                    onSave={(v) => patchTask(t.id, { instructions: v || null })}
                  />
                </td>
                <td className="px-1 py-1 text-center">
                  <button
                    onClick={() => removeTask(t.id)}
                    className="text-muted-foreground hover:text-red-600"
                    aria-label="Delete task"
                  >
                    <X className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {data.notes
              .filter((note) => note.kind === "GENERAL")
              .map((n) => (
                <tr key={n.id}>
                  <td
                    colSpan={10}
                    className="border border-black py-2 text-center font-bold"
                  >
                    {n.note}
                  </td>
                  <td className="px-1 text-center">
                    <button
                      onClick={() => deleteNote(n.id)}
                      className="text-muted-foreground hover:text-red-600"
                      aria-label="Delete note"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            <tr className="bg-slate-50">
              <td className="border border-black px-1 py-2">
                <input
                  type="time"
                  className={cellClass}
                  value={newTask.time}
                  onChange={(e) =>
                    setNewTask({ ...newTask, time: e.target.value })
                  }
                />
              </td>
              <td className="border border-black px-1 py-2">
                <select
                  className={cellClass}
                  value={newTask.assignedToUserId}
                  onChange={(e) =>
                    setNewTask({ ...newTask, assignedToUserId: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {data.cleaners.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border border-black px-1 py-2">
                <select
                  className={cellClass}
                  value={newTask.apartmentId}
                  onChange={(e) =>
                    setNewTask({ ...newTask, apartmentId: e.target.value })
                  }
                >
                  <option value="">Apartment…</option>
                  {apartments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.number}
                    </option>
                  ))}
                </select>
              </td>
              <td className="border border-black px-1 py-2">
                <select
                  className={cellClass}
                  value={newTask.type}
                  onChange={(e) =>
                    setNewTask({ ...newTask, type: e.target.value })
                  }
                >
                  {TASK_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
              <td colSpan={7} className="px-1 py-2">
                <Button
                  size="sm"
                  onClick={createTask}
                  disabled={creatingTask || !newTask.apartmentId}
                >
                  {creatingTask ? (
                    <Loader2 className="size-4 mr-1 animate-spin" />
                  ) : (
                    <Plus className="size-4 mr-1" />
                  )}
                  Add task
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// WEEKLY VIEW
// ===========================================================================

function WeeklyView({
  date,
  onDateChange,
}: {
  date: Date;
  onDateChange: (d: Date) => void;
}) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekStr = fmtDate(weekStart);
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingShifts, setEditingShifts] = useState(false);
  const [shiftInputs, setShiftInputs] = useState<
    Record<
      string,
      Record<string, { start: string; end: string; dayOff: boolean }>
    >
  >({});
  const [savingShifts, setSavingShifts] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/schedule?week=${weekStr}`);
        if (!res.ok) throw new Error();
        const d: WeeklyData = await res.json();
        setData(d);

        // Init shift inputs: cleanerId -> dateStr -> { start, end, dayOff }
        const inputs: typeof shiftInputs = {};
        for (const c of d.cleaners) {
          inputs[c.id] = {};
          for (const day of d.days) {
            const existing = day.shifts.find((s) => s.userId === c.id);
            inputs[c.id][day.date] = {
              start: existing?.startTime ?? "",
              end: existing?.endTime ?? "",
              dayOff: existing?.dayOff ?? false,
            };
          }
        }
        setShiftInputs(inputs);
      } catch {
        toast.error("Failed to load weekly schedule");
      } finally {
        setLoading(false);
      }
    },
    [weekStr],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function saveNote(
    day: WeekDay,
    kind: ScheduleNote["kind"],
    value: string,
  ) {
    const existing = day.notes.find((note) => note.kind === kind);
    const trimmed = value.trim();
    try {
      const res = existing
        ? await fetch("/api/schedule/notes", {
            method: trimmed ? "PATCH" : "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              trimmed
                ? { id: existing.id, note: trimmed }
                : { id: existing.id },
            ),
          })
        : trimmed
          ? await fetch("/api/schedule/notes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date: day.date, note: trimmed, kind }),
            })
          : null;
      if (res && !res.ok) throw new Error();
      if (res) await load(true);
    } catch {
      toast.error("Failed to save schedule note");
      await load(true);
    }
  }

  async function saveShifts() {
    setSavingShifts(true);
    try {
      const bulk: any[] = [];
      for (const [userId, days] of Object.entries(shiftInputs)) {
        for (const [dateStr, v] of Object.entries(days)) {
          bulk.push({
            userId,
            date: dateStr,
            startTime: v.start || null,
            endTime: v.end || null,
            dayOff: v.dayOff,
          });
        }
      }
      const res = await fetch("/api/schedule/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk }),
      });
      if (!res.ok) throw new Error();
      toast.success("Weekly shifts saved");
      setEditingShifts(false);
      load();
    } catch {
      toast.error("Failed to save shifts");
    } finally {
      setSavingShifts(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const weekEnd = addDays(weekStart, 6);
  const title = `Schedule Housekeeping ${format(weekStart, "dd/MM")} – ${format(weekEnd, "dd/MM/yyyy")}`;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDateChange(subDays(weekStart, 7))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDateChange(addDays(weekStart, 7))}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(new Date())}
          className="ml-2"
        >
          This week
        </Button>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingShifts(!editingShifts)}
          >
            {editingShifts ? "Cancel" : "Edit shifts"}
          </Button>
        </div>
      </div>

      {/* Weekly shift table */}
      <div className="overflow-x-auto bg-white font-serif text-black">
        <div className="mb-3 border border-black py-1 text-center text-2xl font-bold">
          {title}
        </div>
        <table className="min-w-[900px] w-full border-collapse border border-black text-sm">
          <thead>
            <tr>
              <th className="w-28" rowSpan={2} />
              <th className="w-28" rowSpan={2} />
              {data.days.map((d) => (
                <th
                  key={d.date}
                  className="border border-black px-3 py-1 text-center font-normal"
                >
                  {format(parseISO(d.date), "dd/MM")}
                </th>
              ))}
            </tr>
            <tr>
              {data.days.map((d) => (
                <th
                  key={d.date}
                  className="border border-black px-3 py-1 text-center font-normal"
                >
                  {d.dayOfWeek}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.cleaners.map((c, idx) => (
              <tr key={c.id}>
                {idx === 0 && (
                  <td
                    rowSpan={data.cleaners.length}
                    className="border border-black px-2 text-center"
                  >
                    Housekeeping
                  </td>
                )}
                <td className="border border-black px-3 py-1 text-center whitespace-nowrap">
                  {c.name}
                </td>
                {data.days.map((day) => {
                  const shift = day.shifts.find((s) => s.userId === c.id);
                  const inp = shiftInputs[c.id]?.[day.date];

                  if (editingShifts && inp) {
                    return (
                      <td
                        key={day.date}
                        className="border border-black px-1 py-1"
                      >
                        <div className="flex flex-col gap-1 items-center">
                          {inp.dayOff ? (
                            <span className="text-xs text-red-600 font-bold">
                              OFF
                            </span>
                          ) : (
                            <>
                              <input
                                type="time"
                                className="w-20 text-xs border rounded px-1 py-0.5"
                                value={inp.start}
                                onChange={(e) => {
                                  const next = { ...shiftInputs };
                                  next[c.id] = { ...next[c.id] };
                                  next[c.id][day.date] = {
                                    ...inp,
                                    start: e.target.value,
                                  };
                                  setShiftInputs(next);
                                }}
                              />
                              <input
                                type="time"
                                className="w-20 text-xs border rounded px-1 py-0.5"
                                value={inp.end}
                                onChange={(e) => {
                                  const next = { ...shiftInputs };
                                  next[c.id] = { ...next[c.id] };
                                  next[c.id][day.date] = {
                                    ...inp,
                                    end: e.target.value,
                                  };
                                  setShiftInputs(next);
                                }}
                              />
                            </>
                          )}
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              className="size-3"
                              checked={inp.dayOff}
                              onChange={(e) => {
                                const next = { ...shiftInputs };
                                next[c.id] = { ...next[c.id] };
                                next[c.id][day.date] = {
                                  ...inp,
                                  dayOff: e.target.checked,
                                };
                                setShiftInputs(next);
                              }}
                            />
                            <span className="text-[10px] text-red-600">
                              Off
                            </span>
                          </label>
                        </div>
                      </td>
                    );
                  }

                  // Display mode
                  if (shift?.dayOff) {
                    return (
                      <td
                        key={day.date}
                        className="border border-black bg-yellow-300 px-3 py-1 text-center"
                      >
                        Weekly Off
                      </td>
                    );
                  }

                  if (shift?.startTime) {
                    return (
                      <td
                        key={day.date}
                        className="border border-black px-3 py-1 text-center"
                      >
                        {shift.startTime}-{shift.endTime}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={day.date}
                      className="border border-black px-3 py-1 text-center"
                    >
                      -
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td
                colSpan={2}
                className="border border-black px-2 py-1 text-center"
              >
                Maintenance
              </td>
              {data.days.map((day) => {
                const note = day.notes.find(
                  (item) => item.kind === "MAINTENANCE",
                );
                return (
                  <td key={day.date} className="border border-black px-1 py-1">
                    <CellInput
                      value={note?.note ?? ""}
                      onSave={(value) => saveNote(day, "MAINTENANCE", value)}
                    />
                  </td>
                );
              })}
            </tr>
            <tr>
              <td
                colSpan={2}
                className="border border-black px-2 py-1 text-center font-bold"
              >
                IN CHARGE
              </td>
              {data.days.map((day) => {
                const note = day.notes.find(
                  (item) => item.kind === "IN_CHARGE",
                );
                return (
                  <td key={day.date} className="border border-black px-1 py-1">
                    <CellInput
                      value={note?.note ?? ""}
                      onSave={(value) => saveNote(day, "IN_CHARGE", value)}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        {editingShifts && (
          <div className="border-t px-4 py-3">
            <Button size="sm" onClick={saveShifts} disabled={savingShifts}>
              {savingShifts && <Loader2 className="size-4 mr-1 animate-spin" />}
              Save all shifts
            </Button>
          </div>
        )}
      </div>

      {/* Daily task summaries per day */}
      <div className="overflow-x-auto bg-white font-serif text-black">
        <table className="min-w-[900px] w-full border-collapse border border-black text-sm">
          <tbody>
            {data.days.map((day) => {
              const outs = day.tasks.filter((x) => x.type === "CHECK_OUT");
              const others = day.tasks.filter((x) =>
                ["CLEANING", "REPAIR", "OTHER"].includes(x.type),
              );
              const refreshes = day.tasks.filter((x) => x.type === "REFRESH");
              const parts = [
                ...outs.map((x) => ({
                  key: x.id,
                  cls: "text-black",
                  text: `${x.apartment.number} out`,
                })),
                ...others.map((x) => ({
                  key: x.id,
                  cls: "text-red-700",
                  text: `${x.apartment.number} ${x.title || typeLabel(x.type, x.customTypeName)}`,
                })),
                ...(refreshes.length > 0
                  ? [
                      {
                        key: "refresh",
                        cls: "text-blue-700",
                        text: `Refresh ${refreshes.map((x) => x.apartment.number).join(", ")}`,
                      },
                    ]
                  : []),
                ...day.notes
                  .filter((note) => note.kind === "GENERAL")
                  .map((note) => ({
                    key: note.id,
                    cls: "text-red-700",
                    text: note.note,
                  })),
              ];
              const manualNote = day.notes.find(
                (note) => note.kind === "WEEKLY_NOTE",
              );
              return (
                <tr key={day.date}>
                  <td className="w-28 border border-black px-3 py-1 text-center">
                    {format(parseISO(day.date), "dd/MM")}
                  </td>
                  <td className="w-28 border border-black px-3 py-1 text-center">
                    {day.dayOfWeek}
                  </td>
                  <td className="border border-black px-2 py-1 text-center">
                    <div>
                      {parts.map((part, i) => (
                        <span key={part.key} className={part.cls}>
                          {i > 0 && <span className="text-black">, </span>}
                          {part.text}
                        </span>
                      ))}
                    </div>
                    <CellInput
                      value={manualNote?.note ?? ""}
                      className="mt-1 text-red-700"
                      onSave={(value) => saveNote(day, "WEEKLY_NOTE", value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
