"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function LostFoundPage({ params }: { params: Promise<{ id: string }> }) {
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setApartmentId(p.id));
  }, [params]);

  if (!apartmentId) return <Skeleton className="h-screen" />;
  return <LostFoundForm apartmentId={apartmentId} />;
}

function LostFoundForm({ apartmentId }: { apartmentId: string }) {
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/lost-found", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apartmentId, description, photoUrl }),
    });
    if (res.ok) {
      toast.success("Reported");
      router.push(`/apartments/${apartmentId}`);
    } else {
      toast.error("Could not save");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-2xl font-bold">Lost & Found</h1>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was found?"
          required
        />
      </div>

      <div>
        <Label>Photo</Label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          id="photo"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const form = new FormData();
            form.append("file", file);
            form.append("type", "COMMENT");
            const res = await fetch("/api/media", { method: "POST", body: form });
            if (res.ok) {
              const data = await res.json();
              setPhotoUrl(data.media.url);
            }
          }}
        />
        <label htmlFor="photo" className="flex items-center gap-2 border rounded-xl p-4 cursor-pointer hover:bg-muted">
          <Camera className="size-5" />
          <span>{photoUrl ? "Photo added" : "Add photo"}</span>
        </label>
        {photoUrl && <img src={photoUrl} alt="" className="mt-2 size-24 rounded-lg object-cover" />}
      </div>

      <Button type="submit" className="w-full h-12" disabled={loading}>
        {loading ? "Saving..." : "Report"}
      </Button>
    </form>
  );
}
