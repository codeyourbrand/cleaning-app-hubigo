"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  parseISO,
} from "date-fns";
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
import { Badge } from "@/components/ui/badge";
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
      return "CLEANING";
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
      return "text-orange-600 font-bold";
    case "CLEANING":
      return "text-purple-600 font-bold";
    case "REPAIR":
      return "text-red-600 font-bold";
    default:
      return "text-gray-700 font-bold";
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

  const dateStr = fmtDate(date);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?date=${dateStr}`);
      if (!res.ok) throw new Error();
      const d: DailyData = await res.json();
      setData(d);
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
  }, [dateStr]);

  useEffect(() => {
    load();
  }, [load]);

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
  const shiftSummary = activeShifts.length > 0
    ? activeShifts.map((s) => s.user.name).join(", ")
    : "No shifts set";
  const shiftTimeRange = activeShifts.length > 0
    ? `${activeShifts[0]?.startTime ?? "?"} – ${activeShifts[0]?.endTime ?? "?"}`
    : "";

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
            {format(date, "EEEE, d MMMM yyyy")}
          </div>
          <div className="text-sm text-muted-foreground">
            FOR{" "}
            {fmtDate(date) === fmtDate(new Date())
              ? "TODAY"
              : fmtDate(date) === fmtDate(addDays(new Date(), 1))
                ? "TOMORROW"
                : format(date, "EEEE").toUpperCase()}
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
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Team on duty</div>
            <div className="text-xs text-muted-foreground">
              {shiftSummary}
              {shiftTimeRange && ` · ${shiftTimeRange}`}
            </div>
          </div>
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
                {savingShifts && <Loader2 className="size-4 mr-1 animate-spin" />}
                Save shifts
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Notes (breaks etc.) */}
      {data.notes.length > 0 && (
        <div className="space-y-1">
          {data.notes.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800"
            >
              <span className="flex-1">{n.note}</span>
              <button
                onClick={() => deleteNote(n.id)}
                className="text-amber-500 hover:text-amber-700"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

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

      {/* Daily task table — matches Excel layout */}
      <div className="rounded-xl border overflow-x-auto">
        <table className="min-w-[1100px] w-full text-sm">
          <thead>
            <tr className="bg-muted/60 border-b">
              <th className="px-3 py-2 text-left font-semibold w-16">Time</th>
              <th className="px-3 py-2 text-left font-semibold">Assigned</th>
              <th className="px-3 py-2 text-left font-semibold w-28">
                Apartment
              </th>
              <th className="px-3 py-2 text-left font-semibold w-32">Status</th>
              <th className="px-3 py-2 text-left font-semibold w-24">
                Checkout
              </th>
              <th className="px-3 py-2 text-center font-semibold w-16">
                Done?
              </th>
              <th className="px-3 py-2 text-left font-semibold w-28">
                Check in
              </th>
              <th className="px-3 py-2 text-center font-semibold w-16">
                Guests
              </th>
              <th className="px-3 py-2 text-center font-semibold w-16">
                Nights
              </th>
              <th className="px-3 py-2 text-left font-semibold">Request</th>
              <th className="px-3 py-2 text-left font-semibold">
                Instructions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.tasks.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No tasks scheduled for this day.
                </td>
              </tr>
            )}
            {data.tasks.map((t) => (
              <tr
                key={t.id}
                className={`hover:bg-muted/30 transition-colors ${
                  t.status === "DONE" ? "opacity-60" : ""
                }`}
              >
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {t.checkoutTime ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {t.assignedTo ? (
                    <span className="font-medium">{t.assignedTo.name}</span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      Unassigned
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-bold">
                  {t.apartment.number}
                </td>
                <td className={`px-3 py-2 ${typeColor(t.type)}`}>
                  {typeLabel(t.type, t.customTypeName)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {t.checkoutTime ?? ""}
                </td>
                <td className="px-3 py-2 text-center text-lg">
                  {statusIcon(t.status)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {t.checkinWindow ?? ""}
                </td>
                <td className="px-3 py-2 text-center">
                  {t.guestsCount ?? ""}
                </td>
                <td className="px-3 py-2 text-center">
                  {t.nightsCount ?? ""}
                </td>
                <td className="px-3 py-2 text-xs max-w-[160px] truncate">
                  {t.requests ?? ""}
                </td>
                <td className="px-3 py-2 text-xs max-w-[160px] truncate">
                  {t.instructions ?? ""}
                </td>
              </tr>
            ))}
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
    Record<string, Record<string, { start: string; end: string; dayOff: boolean }>>
  >({});
  const [savingShifts, setSavingShifts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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
  }, [weekStr]);

  useEffect(() => {
    load();
  }, [load]);

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
  const title = `Schedule ${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`;

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
        <div className="text-lg font-bold">{title}</div>
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
      <div className="rounded-xl border overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="bg-muted/60 border-b">
              <th className="px-3 py-2 text-left font-semibold w-32" />
              {data.days.map((d) => (
                <th key={d.date} className="px-3 py-2 text-center font-semibold">
                  <div>{format(parseISO(d.date), "d MMM")}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {d.dayOfWeek}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.cleaners.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 font-semibold whitespace-nowrap">
                  {c.name}
                </td>
                {data.days.map((day) => {
                  const shift = day.shifts.find((s) => s.userId === c.id);
                  const inp = shiftInputs[c.id]?.[day.date];

                  if (editingShifts && inp) {
                    return (
                      <td key={day.date} className="px-1 py-1">
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
                            <span className="text-[10px] text-red-600">Off</span>
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
                        className="px-3 py-2 text-center bg-red-50"
                      >
                        <span className="text-red-600 font-bold text-xs">
                          Weekly Off
                        </span>
                      </td>
                    );
                  }

                  if (shift?.startTime) {
                    return (
                      <td key={day.date} className="px-3 py-2 text-center">
                        <span className="font-mono text-xs">
                          {shift.startTime}–{shift.endTime}
                        </span>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={day.date}
                      className="px-3 py-2 text-center text-muted-foreground"
                    >
                      —
                    </td>
                  );
                })}
              </tr>
            ))}
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
      <div className="rounded-xl border overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="bg-muted/60 border-b">
              <th className="px-3 py-2 text-left font-semibold w-32">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Tasks</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.days.map((day) => (
              <tr key={day.date} className="hover:bg-muted/30 transition-colors align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="font-semibold">
                    {format(parseISO(day.date), "d MMM")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {day.dayOfWeek}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {day.tasks.length === 0 ? (
                    <span className="text-muted-foreground text-xs">
                      No tasks
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {day.tasks.map((t) => {
                        const label = typeLabel(t.type, t.customTypeName);
                        const isRefresh = t.type === "REFRESH";
                        const isDone = t.status === "DONE";
                        return (
                          <span
                            key={t.id}
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border ${
                              isDone
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 line-through"
                                : isRefresh
                                  ? "bg-amber-50 border-amber-200 text-amber-800"
                                  : "bg-blue-50 border-blue-200 text-blue-800"
                            }`}
                          >
                            {t.apartment.number}{" "}
                            <span className="opacity-70">
                              {label.toLowerCase()}
                            </span>
                            {t.assignedTo && (
                              <span className="opacity-50">
                                · {t.assignedTo.name}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {day.notes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {day.notes.map((n) => (
                        <Badge
                          key={n.id}
                          variant="outline"
                          className="bg-amber-50 border-amber-200 text-amber-800 text-xs"
                        >
                          {n.note}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
