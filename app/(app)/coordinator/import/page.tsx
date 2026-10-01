"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function ImportPage() {
  const [csv, setCsv] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [preview, setPreview] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  function parseCsv(text: string) {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 1) return [];
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const row: any = { row: i };
      header.forEach((h, idx) => {
        const val = values[idx]?.trim() || "";
        if (h.includes("apartment")) row.apartmentNumber = val;
        if (h.includes("check out") || h === "checkouttime") row.checkoutTime = val;
        if (h.includes("check in") || h === "checkinwindow") row.checkinWindow = val;
        if (h === "guests") row.guestsCount = val;
        if (h === "nights") row.nightsCount = val;
        if (h === "requests") row.requests = val;
        if (h === "instructions") row.instructions = val;
      });
      rows.push(row);
    }
    return rows;
  }

  function handlePreview() {
    const rows = parseCsv(csv);
    setPreview(rows);
  }

  async function handleImport() {
    if (!preview) return;
    setBusy(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: preview, date: new Date(date).toISOString() }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(`Imported ${data.stats.created} tasks`);
    } else {
      toast.error(data.error || "Import failed");
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Import plan</h1>

      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="csv">Paste CSV / spreadsheet</Label>
        <Textarea
          id="csv"
          rows={10}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder="Apartment number, Check out time, Check in window, Guests, Nights, Requests, Instructions"
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handlePreview}>Preview</Button>
        <Button type="button" onClick={handleImport} disabled={!preview || busy}>
          {busy ? "Importing..." : "Import"}
        </Button>
      </div>

      {preview && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground mb-2">{preview.length} rows found</p>
          <ul className="text-sm space-y-1 max-h-60 overflow-auto">
            {preview.map((r, i) => (
              <li key={i}>
                {r.apartmentNumber || "?"} · checkout {r.checkoutTime || "—"} · check-in {r.checkinWindow || "—"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
