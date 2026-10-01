"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  Loader2,
  Building2,
  CalendarClock,
  Users as UsersIcon,
  ListChecks,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Apartment = { id: string; number: string; building: string | null };
type User = { id: string; name: string };

const selectClass =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1";

export default function NewTaskPage() {
  const router = useRouter();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [cleaners, setCleaners] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    apartmentId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    type: "CLEANING" as "CLEANING" | "REPAIR" | "OTHER",
    checkoutTime: "",
    checkinWindow: "",
    guestsCount: "",
    nightsCount: "",
    requests: "",
    instructions: "",
    assignedToUserId: "",
    steps: "Kitchen\nBathroom\nBedrooms\nLiving room\nFloors\nFinal inspection",
  });

  useEffect(() => {
    fetch("/api/apartments")
      .then((r) => r.json())
      .then((d) => setApartments(d.apartments || []));
    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => setCleaners(d.users || []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      date: new Date(form.date),
      guestsCount: form.guestsCount ? parseInt(form.guestsCount) : undefined,
      nightsCount: form.nightsCount ? parseInt(form.nightsCount) : undefined,
      assignedToUserId: form.assignedToUserId || null,
      steps: form.steps
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Task created");
        router.push("/coordinator");
      } else {
        const data = await res.json();
        toast.error(data.error || "Could not create");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/coordinator"
          className="inline-flex size-9 items-center justify-center rounded-lg border hover:bg-muted transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create task</h1>
          <p className="text-sm text-muted-foreground">
            Schedule a cleaning, repair or other job
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Building2 className="size-4 text-primary" /> Apartment & type
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="apartment">Apartment</Label>
              <select
                id="apartment"
                value={form.apartmentId}
                onChange={(e) =>
                  setForm({ ...form, apartmentId: e.target.value })
                }
                className={selectClass}
                required
              >
                <option value="">Select apartment</option>
                {apartments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.number} {a.building ? `· ${a.building}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as typeof form.type })
                }
                className={selectClass}
              >
                <option value="CLEANING">Cleaning</option>
                <option value="REPAIR">Repair</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                className="h-11"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <CalendarClock className="size-4 text-primary" /> Stay details
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="checkoutTime">Checkout time</Label>
              <Input
                id="checkoutTime"
                type="time"
                className="h-11"
                value={form.checkoutTime}
                onChange={(e) =>
                  setForm({ ...form, checkoutTime: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="checkinWindow">Check-in window</Label>
              <Input
                id="checkinWindow"
                className="h-11"
                placeholder="15:00–16:00"
                value={form.checkinWindow}
                onChange={(e) =>
                  setForm({ ...form, checkinWindow: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="guests">Guests</Label>
              <Input
                id="guests"
                type="number"
                min="0"
                className="h-11"
                value={form.guestsCount}
                onChange={(e) =>
                  setForm({ ...form, guestsCount: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="nights">Nights</Label>
              <Input
                id="nights"
                type="number"
                min="0"
                className="h-11"
                value={form.nightsCount}
                onChange={(e) =>
                  setForm({ ...form, nightsCount: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="requests">Requests</Label>
              <Input
                id="requests"
                className="h-11"
                placeholder="Luggage, parking, baby equipment…"
                value={form.requests}
                onChange={(e) => setForm({ ...form, requests: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                value={form.instructions}
                onChange={(e) =>
                  setForm({ ...form, instructions: e.target.value })
                }
                placeholder="Prepare sofa bed, check balcony…"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <UsersIcon className="size-4 text-primary" /> Assignment
          </div>
          <Label htmlFor="assignedTo">Assigned cleaner</Label>
          <select
            id="assignedTo"
            value={form.assignedToUserId}
            onChange={(e) =>
              setForm({ ...form, assignedToUserId: e.target.value })
            }
            className={selectClass}
          >
            <option value="">Unassigned</option>
            {cleaners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <ListChecks className="size-4 text-primary" /> Task steps
          </div>
          <Label htmlFor="steps">One step per line</Label>
          <Textarea
            id="steps"
            rows={6}
            value={form.steps}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
          />
        </section>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            onClick={() => router.push("/coordinator")}
          >
            Cancel
          </Button>
          <Button type="submit" className="h-12 flex-[2]" disabled={submitting}>
            {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
            {submitting ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </div>
  );
}
