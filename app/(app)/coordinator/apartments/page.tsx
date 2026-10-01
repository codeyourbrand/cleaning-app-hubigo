"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Apartment = {
  id: string;
  number: string;
  building: string | null;
  floor: string | null;
  notes: string | null;
};

export default function CoordinatorApartmentsPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number: "", building: "", floor: "", notes: "" });

  async function load() {
    const res = await fetch("/api/apartments");
    const data = await res.json();
    setApartments(data.apartments || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/apartments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Apartment created");
      setForm({ number: "", building: "", floor: "", notes: "" });
      setOpen(false);
      await load();
    } else {
      const data = await res.json();
      toast.error(data.error || "Could not create");
    }
  }

  async function deleteApartment(id: string) {
    const res = await fetch(`/api/apartments/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deleted");
      await load();
    } else {
      const data = await res.json();
      toast.error(data.error || "Could not delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Apartments</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4 mr-1" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create apartment</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="number">Number</Label>
                <Input id="number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="building">Building</Label>
                <Input id="building" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="floor">Floor</Label>
                <Input id="floor" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {apartments.map((a) => (
            <div key={a.id} className="rounded-2xl border bg-card p-4">
              <p className="text-xl font-bold">{a.number}</p>
              <p className="text-sm text-muted-foreground">{a.building || "—"} · Floor {a.floor || "—"}</p>
              <p className="text-sm mt-2">{a.notes}</p>
              <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => deleteApartment(a.id)}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
