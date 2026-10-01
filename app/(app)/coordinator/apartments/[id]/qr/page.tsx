"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export default function QrPage() {
  const { id } = useParams<{ id: string }>();
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/apartments/${id}/qr`)
      .then((r) => r.json())
      .then((d) => setDataUrl(d.dataUrl));
  }, [id]);

  if (!dataUrl) return <Skeleton className="aspect-square max-w-sm mx-auto rounded-2xl" />;

  return (
    <div className="text-center space-y-4">
      <h1 className="text-2xl font-bold">Apartment QR</h1>
      <img src={dataUrl} alt="QR code for apartment" className="mx-auto rounded-2xl border" />
      <p className="text-sm text-muted-foreground">Scan to open today&apos;s apartment view.</p>
    </div>
  );
}
