"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Apartment = { id: string; number: string; building: string | null };
type User = { id: string; name: string };

export default function NewTaskPage() {
  const router = useRouter();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [cleaners, setCleaners] = useState<User[]>([]);
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
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create Task</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="apartment">Apartment</Label>
          <select
            id="apartment"
            value={form.apartmentId}
            onChange={(e) => setForm({ ...form, apartmentId: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as any })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="CLEANING">Cleaning</option>
              <option value="REPAIR">Repair</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="checkoutTime">Checkout time</Label>
            <Input
              id="checkoutTime"
              type="time"
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
              placeholder="15:00–16:00"
              value={form.checkinWindow}
              onChange={(e) =>
                setForm({ ...form, checkinWindow: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="guests">Guests</Label>
            <Input
              id="guests"
              type="number"
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
              value={form.nightsCount}
              onChange={(e) =>
                setForm({ ...form, nightsCount: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <Label htmlFor="requests">Requests</Label>
          <Input
            id="requests"
            value={form.requests}
            onChange={(e) => setForm({ ...form, requests: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="instructions">Instructions</Label>
          <Textarea
            id="instructions"
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="assignedTo">Assigned cleaner</Label>
          <select
            id="assignedTo"
            value={form.assignedToUserId}
            onChange={(e) =>
              setForm({ ...form, assignedToUserId: e.target.value })
            }
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="">Unassigned</option>
            {cleaners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="steps">Task steps (one per line)</Label>
          <Textarea
            id="steps"
            rows={6}
            value={form.steps}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
          />
        </div>

        <Button type="submit" className="w-full h-12">
          Create task
        </Button>
      </form>
    </div>
  );
}
