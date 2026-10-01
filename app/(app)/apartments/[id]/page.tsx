"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Apartment = {
  id: string;
  number: string;
  building: string | null;
  floor: string | null;
  notes: string | null;
  lostFounds: { id: string; description: string; photoUrl: string | null; createdAt: string; reportedBy: { name: string } }[];
  damages: { id: string; description: string; photoUrl: string | null; createdAt: string; reportedBy: { name: string } }[];
  tasks: { id: string; date: string; status: string; assignedTo: { name: string } | null; media: { url: string }[] }[];
};

export default function ApartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  if (!id) return <Skeleton className="h-screen" />;
  return <ApartmentDetail id={id} />;
}

function ApartmentDetail({ id }: { id: string }) {
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/apartments/${id}`)
      .then((r) => r.json())
      .then((d) => setApartment(d.apartment))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !apartment) return <Skeleton className="h-screen" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
          <Building2 className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{apartment.number}</h1>
          <p className="text-sm text-muted-foreground">
            {apartment.building || "—"} · Floor {apartment.floor || "—"}
          </p>
        </div>
      </div>

      {apartment.notes && (
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</h2>
          <p className="text-sm">{apartment.notes}</p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Lost & Found</h2>
        {apartment.lostFounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No records.</p>
        ) : (
          <div className="space-y-3">
            {apartment.lostFounds.map((item) => (
              <div key={item.id} className="rounded-2xl border bg-card p-4">
                <p className="text-sm font-medium">{item.reportedBy.name} · {new Date(item.createdAt).toLocaleDateString()}</p>
                <p className="text-sm mt-1">{item.description}</p>
                {item.photoUrl && <img src={item.photoUrl} alt="" className="mt-2 size-24 rounded-lg object-cover" />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Damage</h2>
        {apartment.damages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No records.</p>
        ) : (
          <div className="space-y-3">
            {apartment.damages.map((item) => (
              <div key={item.id} className="rounded-2xl border bg-card p-4">
                <p className="text-sm font-medium">{item.reportedBy.name} · {new Date(item.createdAt).toLocaleDateString()}</p>
                <p className="text-sm mt-1">{item.description}</p>
                {item.photoUrl && <img src={item.photoUrl} alt="" className="mt-2 size-24 rounded-lg object-cover" />}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">History</h2>
        {apartment.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history.</p>
        ) : (
          <div className="space-y-3">
            {apartment.tasks.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`}>
                <div className="rounded-2xl border bg-card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{new Date(t.date).toLocaleDateString()}</p>
                    <span className="text-xs uppercase tracking-wide">{t.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t.assignedTo?.name ?? "Unassigned"}</p>
                  {t.media.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {t.media.slice(0, 4).map((m, i) => (
                        <img key={i} src={m.url} alt="" className="size-14 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
