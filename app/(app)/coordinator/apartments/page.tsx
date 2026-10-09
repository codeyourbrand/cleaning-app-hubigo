"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Apartment = {
  id: string;
  number: string;
  building: string | null;
  floor: string | null;
  notes: string | null;
};

const emptyForm = { number: "", building: "", floor: "", notes: "" };

export default function CoordinatorApartmentsPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Apartment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/apartments");
    const data = await res.json();
    setApartments(data.apartments || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetDialog() {
    setEditing(null);
    setForm(emptyForm);
  }

  function editApartment(a: Apartment) {
    setEditing(a);
    setForm({
      number: a.number,
      building: a.building || "",
      floor: a.floor || "",
      notes: a.notes || "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/apartments/${editing.id}` : "/api/apartments",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      if (res.ok) {
        toast.success(editing ? "Apartment updated" : "Apartment created");
        setOpen(false);
        resetDialog();
        await load();
      } else {
        const data = await res.json();
        toast.error(data.error || "Could not save");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteApartment(a: Apartment, force = false) {
    const res = await fetch(`/api/apartments/${a.id}${force ? "?force=true" : ""}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Deleted");
      await load();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.taskCount && !force) {
      const confirmed = confirm(
        `${a.number} has ${data.taskCount} task(s). Delete the apartment together with all its tasks? This cannot be undone.`,
      );
      if (confirmed) await deleteApartment(a, true);
      return;
    }
    toast.error(data.error || "Could not delete");
  }

  const filtered = apartments.filter(
    (a) =>
      a.number.toLowerCase().includes(search.toLowerCase()) ||
      (a.building || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Apartments</h1>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetDialog();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit apartment" : "Create apartment"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="number">Number</Label>
                <Input
                  id="number"
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="building">Building</Label>
                <Input
                  id="building"
                  value={form.building}
                  onChange={(e) =>
                    setForm({ ...form, building: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="floor">Floor</Label>
                <Input
                  id="floor"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No apartments found.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow"
            >
              <Link
                href={`/apartments/${a.id}`}
                className="flex items-center gap-4 p-4"
              >
                <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                  <Building2 className="size-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold">{a.number}</h2>
                  <p className="text-sm text-muted-foreground">
                    {a.building || "—"} {a.floor ? `· Floor ${a.floor}` : ""}
                  </p>
                  {a.notes && (
                    <p className="text-xs text-muted-foreground truncate">
                      {a.notes}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex border-t">
                <button
                  onClick={() => editApartment(a)}
                  className="flex-1 py-2 text-sm font-medium hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                >
                  <Pencil className="size-3" /> Edit
                </button>
                <button
                  onClick={() => deleteApartment(a)}
                  className="flex-1 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors border-l"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
