"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
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

type Role = "CLEANER" | "COORDINATOR";

type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
};

type UserForm = {
  name: string;
  email: string;
  phone: string;
  role: Role;
  password: string;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  phone: "",
  role: "CLEANER",
  password: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetDialog() {
    setEditingUser(null);
    setForm(emptyForm);
  }

  function editUser(user: User) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: user.role,
      password: "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const body = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role,
      ...(form.password ? { password: form.password } : {}),
      ...(!editingUser ? { active: true } : {}),
    };

    try {
      const res = await fetch(
        editingUser ? `/api/users/${editingUser.id}` : "/api/users",
        {
          method: editingUser ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not save user");
        return;
      }

      toast.success(editingUser ? "User updated" : "User created");
      setOpen(false);
      resetDialog();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    if (res.ok) {
      toast.success("Updated");
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) resetDialog();
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
                {editingUser ? "Edit user" : "Create user"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as Role })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="CLEANER">Cleaner</option>
                  <option value="COORDINATOR">Coordinator</option>
                </select>
              </div>
              <div>
                <Label htmlFor="password">
                  {editingUser ? "New password" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  minLength={6}
                  required={!editingUser}
                  placeholder={editingUser ? "Leave empty to keep current" : ""}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving..." : editingUser ? "Save changes" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {users.map((user) => (
            <div key={user.id} className="rounded-2xl border bg-card p-4">
              <p className="text-lg font-bold">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.role}</p>
              <p className="text-sm">{user.email || user.phone}</p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${user.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                >
                  {user.active ? "Active" : "Inactive"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editUser(user)}
                >
                  <Pencil className="size-4 mr-1" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleActive(user)}
                >
                  {user.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
