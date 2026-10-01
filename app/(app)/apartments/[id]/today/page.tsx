"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type TodayData = {
  apartment: {
    id: string;
    number: string;
    building: string | null;
    floor: string | null;
  };
  task: {
    id: string;
    status: string;
    checkoutTime: string | null;
    checkinWindow: string | null;
  } | null;
};

export default function ApartmentTodayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  if (!id) return <Skeleton className="h-screen" />;
  return <TodayView id={id} />;
}

function TodayView({ id }: { id: string }) {
  const [data, setData] = useState<TodayData | null>(null);

  useEffect(() => {
    fetch(`/api/apartments/${id}/today`)
      .then((r) => r.json())
      .then((d) => setData(d));
  }, [id]);

  if (!data) return <Skeleton className="h-screen" />;

  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-bold">{data.apartment.number}</h1>
      <p className="text-muted-foreground">
        {data.apartment.building} · Floor {data.apartment.floor}
      </p>

      {data.task ? (
        <div className="rounded-2xl border bg-card p-6 mx-auto max-w-sm">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">
            Today
          </p>
          <p className="text-lg font-semibold mt-1">{data.task.status}</p>
          {data.task.checkoutTime && (
            <p className="text-sm mt-2">Checkout {data.task.checkoutTime}</p>
          )}
          {data.task.checkinWindow && (
            <p className="text-sm">Check-in {data.task.checkinWindow}</p>
          )}
          <Link
            href={`/tasks/${data.task.id}`}
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open task
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 mx-auto max-w-sm">
          <p className="text-muted-foreground">No active task today.</p>
        </div>
      )}
    </div>
  );
}
