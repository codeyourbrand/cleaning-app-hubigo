"use client";

import { formatDate } from "@/lib/datetime";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  ArrowUpDown,
  Building2,
  Warehouse,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Checklist = {
  id: string;
  name: string;
  type: "APARTMENT" | "STORAGE";
  notes: string | null;
  apartment: { id: string; number: string; building: string | null } | null;
  createdBy: { id: string; name: string };
  _count: { items: number };
  updatedAt: string;
};

type Apartment = { id: string; number: string; building: string | null };

type Tab = "APARTMENT" | "STORAGE";
type SortField = "name" | "apartment" | "updatedAt";
type SortDir = "asc" | "desc";

const selectClass =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1";

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("APARTMENT");
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const [apartments, setApartments] = useState<Apartment[]>([]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("type", tab);
    if (search) params.set("search", search);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    try {
      const res = await fetch(`/api/inventory/checklists?${params}`);
      const data = await res.json();
      setChecklists(data.checklists || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tab, sortBy, sortDir]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/apartments")
      .then((r) => r.json())
      .then((d) => setApartments(d.apartments || []));
  }, []);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" /> New checklist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create checklist</DialogTitle>
            </DialogHeader>
            <CreateChecklistForm
              apartments={apartments}
              defaultType={tab}
              onCreated={() => {
                setCreateOpen(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === "APARTMENT" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("APARTMENT")}
        >
          <Building2 className="size-4 mr-1" /> Apartments
        </Button>
        <Button
          variant={tab === "STORAGE" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("STORAGE")}
        >
          <Warehouse className="size-4 mr-1" /> Storage rooms
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search checklists..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Sort buttons */}
      <div className="flex gap-2 text-sm">
        <span className="text-muted-foreground py-1">Sort:</span>
        {[
          { field: "name" as SortField, label: "Name" },
          ...(tab === "APARTMENT"
            ? [{ field: "apartment" as SortField, label: "Apartment" }]
            : []),
          { field: "updatedAt" as SortField, label: "Updated" },
        ].map((s) => (
          <Button
            key={s.field}
            variant={sortBy === s.field ? "secondary" : "ghost"}
            size="sm"
            onClick={() => toggleSort(s.field)}
          >
            {s.label}
            {sortBy === s.field && (
              <ArrowUpDown className="size-3 ml-1" />
            )}
          </Button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : checklists.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No checklists yet. Create one to get started.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {checklists.map((c) => (
            <Link key={c.id} href={`/coordinator/inventory/${c.id}`}>
              <div className="rounded-2xl border bg-card p-4 hover:shadow-md transition-shadow h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg truncate">{c.name}</h3>
                    {c.apartment && (
                      <p className="text-sm text-muted-foreground">
                        {c.apartment.number}
                        {c.apartment.building
                          ? ` · ${c.apartment.building}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">
                    <Package className="size-3 mr-1" />
                    {c._count.items}
                  </Badge>
                </div>
                {c.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {c.notes}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Updated {formatDate(c.updatedAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateChecklistForm({
  apartments,
  defaultType,
  onCreated,
}: {
  apartments: Apartment[];
  defaultType: Tab;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: defaultType,
    apartmentId: "",
    notes: "",
    itemsText: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const items = form.itemsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name, quantity: 1 }));

    try {
      const res = await fetch("/api/inventory/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          apartmentId:
            form.type === "APARTMENT" && form.apartmentId
              ? form.apartmentId
              : null,
          notes: form.notes || undefined,
          items,
        }),
      });
      if (res.ok) {
        toast.success("Checklist created");
        onCreated();
      } else {
        const data = await res.json();
        toast.error(data.error || "Could not create");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="cl-name">Name</Label>
        <Input
          id="cl-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Kitchen inventory, Bedroom linens..."
          required
        />
      </div>
      <div>
        <Label htmlFor="cl-type">Type</Label>
        <select
          id="cl-type"
          value={form.type}
          onChange={(e) =>
            setForm({ ...form, type: e.target.value as Tab })
          }
          className={selectClass}
        >
          <option value="APARTMENT">Apartment</option>
          <option value="STORAGE">Storage room</option>
        </select>
      </div>
      {form.type === "APARTMENT" && (
        <div>
          <Label htmlFor="cl-apartment">Apartment</Label>
          <select
            id="cl-apartment"
            value={form.apartmentId}
            onChange={(e) =>
              setForm({ ...form, apartmentId: e.target.value })
            }
            className={selectClass}
          >
            <option value="">Select apartment</option>
            {apartments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} {a.building ? `· ${a.building}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <Label htmlFor="cl-notes">Notes</Label>
        <Input
          id="cl-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Optional notes..."
        />
      </div>
      <div>
        <Label htmlFor="cl-items">Items (one per line)</Label>
        <Textarea
          id="cl-items"
          rows={5}
          value={form.itemsText}
          onChange={(e) => setForm({ ...form, itemsText: e.target.value })}
          placeholder="Towels&#10;Bed sheets&#10;Pillows&#10;Kitchen knife set&#10;Pots and pans"
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating..." : "Create checklist"}
      </Button>
    </form>
  );
}
