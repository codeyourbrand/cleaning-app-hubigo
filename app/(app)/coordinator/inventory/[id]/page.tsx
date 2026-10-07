"use client";

import { formatDateTime } from "@/lib/datetime";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Pencil,
  Save,
  X,
  GripVertical,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type CheckedBy = { id: string; name: string } | null;
type Item = {
  id: string;
  name: string;
  quantity: number;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: CheckedBy;
  order: number;
  notes: string | null;
};
type Checklist = {
  id: string;
  name: string;
  type: "APARTMENT" | "STORAGE";
  notes: string | null;
  apartment: {
    id: string;
    number: string;
    building: string | null;
    floor: string | null;
  } | null;
  createdBy: { id: string; name: string };
  items: Item[];
};

type SortField = "name" | "order" | "checked" | "quantity";

export default function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [checklistId, setChecklistId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setChecklistId(p.id));
  }, [params]);

  if (!checklistId) return <Skeleton className="h-screen" />;
  return <ChecklistDetail checklistId={checklistId} />;
}

function ChecklistDetail({ checklistId }: { checklistId: string }) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>("order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState(1);
  const [editNotes, setEditNotes] = useState("");
  const [editChecklistOpen, setEditChecklistOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/checklists/${checklistId}`);
      const data = await res.json();
      setChecklist(data.checklist);
    } catch {
      toast.error("Could not load checklist");
    } finally {
      setLoading(false);
    }
  }, [checklistId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function toggleItem(item: Item) {
    // Optimistic
    setChecklist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.id === item.id
            ? {
                ...i,
                checked: !i.checked,
                checkedAt: !i.checked ? new Date().toISOString() : null,
              }
            : i,
        ),
      };
    });

    const res = await fetch(
      `/api/inventory/checklists/${checklistId}/items/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: !item.checked }),
      },
    );
    if (!res.ok) {
      // Revert
      setChecklist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === item.id ? { ...i, checked: item.checked } : i,
          ),
        };
      });
      toast.error("Could not update item");
    }
  }

  async function deleteItem(itemId: string) {
    const res = await fetch(
      `/api/inventory/checklists/${checklistId}/items/${itemId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setChecklist((prev) => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.filter((i) => i.id !== itemId) };
      });
      toast.success("Removed");
    } else {
      toast.error("Could not remove");
    }
  }

  async function saveItemEdit(itemId: string) {
    const res = await fetch(
      `/api/inventory/checklists/${checklistId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          quantity: editQty,
          notes: editNotes || null,
        }),
      },
    );
    if (res.ok) {
      setEditingId(null);
      await load();
      toast.success("Saved");
    } else {
      toast.error("Could not save");
    }
  }

  async function deleteChecklist() {
    const res = await fetch(`/api/inventory/checklists/${checklistId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Checklist deleted");
      router.push("/coordinator/inventory");
    } else {
      toast.error("Could not delete");
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQty(item.quantity);
    setEditNotes(item.notes || "");
  }

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  if (loading || !checklist) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Hide legacy "section" header rows (── Room ──) stored as items
  const visibleItems = checklist.items.filter((i) => i.notes !== "section");

  const sortedItems = [...visibleItems].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "checked":
        return (Number(a.checked) - Number(b.checked)) * dir;
      case "quantity":
        return (a.quantity - b.quantity) * dir;
      default:
        return (a.order - b.order) * dir;
    }
  });

  const checkedCount = visibleItems.filter((i) => i.checked).length;
  const totalCount = visibleItems.length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/coordinator/inventory"
          className="inline-flex size-9 items-center justify-center rounded-lg border hover:bg-muted transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{checklist.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              {checklist.type === "APARTMENT" ? "Apartment" : "Storage"}
            </Badge>
            {checklist.apartment && (
              <span>
                {checklist.apartment.number}
                {checklist.apartment.building
                  ? ` · ${checklist.apartment.building}`
                  : ""}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditChecklistOpen(true)}
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      {/* Progress */}
      <div className="mb-4 p-3 rounded-xl bg-muted/50">
        <div className="flex items-center justify-between text-sm mb-1">
          <span>
            {checkedCount} / {totalCount} checked
          </span>
          <span className="text-muted-foreground">
            {totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0}
            %
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{
              width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {checklist.notes && (
        <p className="text-sm text-muted-foreground mb-4">{checklist.notes}</p>
      )}

      {/* Sort + Add */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 text-sm">
          {(
            [
              { field: "order" as SortField, label: "Default" },
              { field: "name" as SortField, label: "Name" },
              { field: "checked" as SortField, label: "Status" },
              { field: "quantity" as SortField, label: "Qty" },
            ] as const
          ).map((s) => (
            <Button
              key={s.field}
              variant={sortBy === s.field ? "secondary" : "ghost"}
              size="sm"
              onClick={() => toggleSort(s.field)}
              className="h-8 px-2 text-xs"
            >
              {s.label}
              {sortBy === s.field && <ArrowUpDown className="size-3 ml-1" />}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4 mr-1" /> Add item
        </Button>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {sortedItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No items yet. Add some items to this checklist.
          </div>
        )}
        {sortedItems.map((item) => (
          <div key={item.id}>
            {editingId === item.id ? (
              <div className="rounded-xl border p-3 space-y-2 bg-muted/30">
                <div className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Item name"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={editQty}
                    onChange={(e) => setEditQty(parseInt(e.target.value) || 0)}
                    className="w-20"
                    placeholder="Qty"
                  />
                </div>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => saveItemEdit(item.id)}
                    className="flex-1"
                  >
                    <Save className="size-4 mr-1" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors group">
                <button
                  onClick={() => toggleItem(item)}
                  className="shrink-0"
                  aria-label={item.checked ? "Uncheck" : "Check"}
                >
                  {item.checked ? (
                    <CheckCircle2 className="size-6 text-emerald-600" />
                  ) : (
                    <Circle className="size-6 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium ${item.checked ? "line-through text-muted-foreground" : ""}`}
                  >
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Qty: {item.quantity}</span>
                    {item.notes && <span>· {item.notes}</span>}
                    {item.checkedAt && item.checkedBy && (
                      <span>
                        · Checked by {item.checkedBy.name}{" "}
                        {formatDateTime(item.checkedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => startEdit(item)}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => deleteItem(item.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete checklist */}
      <div className="mt-8 pt-4 border-t">
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={deleteChecklist}
        >
          <Trash2 className="size-4 mr-1" /> Delete checklist
        </Button>
      </div>

      {/* Add items dialog */}
      <AddItemsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        checklistId={checklistId}
        onAdded={load}
      />

      {/* Edit checklist dialog */}
      <EditChecklistDialog
        open={editChecklistOpen}
        onOpenChange={setEditChecklistOpen}
        checklist={checklist}
        onUpdated={load}
      />
    </div>
  );
}

function AddItemsDialog({
  open,
  onOpenChange,
  checklistId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  checklistId: string;
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name) => ({ name, quantity: 1 }));
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/inventory/checklists/${checklistId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );
      if (res.ok) {
        toast.success(`Added ${items.length} item(s)`);
        setText("");
        onOpenChange(false);
        onAdded();
      } else {
        toast.error("Could not add items");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add items</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="items-text">Items (one per line)</Label>
            <textarea
              id="items-text"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              placeholder="Towels (4)&#10;Pillow cases&#10;Dish soap"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Adding..." : "Add items"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditChecklistDialog({
  open,
  onOpenChange,
  checklist,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  checklist: Checklist;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(checklist.name);
  const [notes, setNotes] = useState(checklist.notes || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(checklist.name);
    setNotes(checklist.notes || "");
  }, [checklist]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/checklists/${checklist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, notes: notes || null }),
      });
      if (res.ok) {
        toast.success("Updated");
        onOpenChange(false);
        onUpdated();
      } else {
        toast.error("Could not update");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit checklist</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
