"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Apartment = {
  id: string;
  number: string;
  building: string | null;
  floor: string | null;
};

export default function CleanerApartmentsPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/apartments")
      .then((r) => r.json())
      .then((d) => setApartments(d.apartments || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = apartments.filter(
    (a) =>
      a.number.toLowerCase().includes(search.toLowerCase()) ||
      (a.building || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Apartments</h1>
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
          {filtered.map((apt) => (
            <Link key={apt.id} href={`/apartments/${apt.id}`}>
              <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                  <Building2 className="size-6 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{apt.number}</h2>
                  <p className="text-sm text-muted-foreground">
                    {apt.building || "—"} {apt.floor ? `· Floor ${apt.floor}` : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
