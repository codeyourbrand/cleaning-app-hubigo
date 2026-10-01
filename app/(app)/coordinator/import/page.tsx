"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  CopyX,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type PreviewRow = {
  row: number;
  apartmentNumber?: string;
  checkoutTime?: string;
  checkinWindow?: string;
  guestsCount?: string;
  nightsCount?: string;
  requests?: string;
  instructions?: string;
};

type ImportStats = {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  created: number;
};

export default function ImportPage() {
  const [csv, setCsv] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [busy, setBusy] = useState(false);

  function parseCsv(text: string): PreviewRow[] {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 1) return [];
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: PreviewRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const row: PreviewRow = { row: i };
      header.forEach((h, idx) => {
        const val = values[idx]?.trim() || "";
        if (h.includes("apartment")) row.apartmentNumber = val;
        if (h.includes("check out") || h === "checkouttime")
          row.checkoutTime = val;
        if (h.includes("check in") || h === "checkinwindow")
          row.checkinWindow = val;
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
    if (rows.length === 0) {
      toast.error("No rows detected. Include a header row.");
      return;
    }
    setStats(null);
    setPreview(rows);
  }

  const validCount = preview?.filter((r) => r.apartmentNumber).length ?? 0;
  const invalidCount = preview ? preview.length - validCount : 0;

  async function handleImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: preview,
          date: new Date(date).toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        toast.success(`Imported ${data.stats.created} tasks`);
      } else {
        toast.error(data.error || "Import failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/coordinator"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import plan</h1>
          <p className="text-sm text-muted-foreground">
            Bulk-create tasks from a spreadsheet
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <section className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <FileSpreadsheet className="size-4 text-primary" /> Source data
          </div>

          <div className="space-y-5">
            <div className="sm:max-w-xs">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                className="h-11"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                All imported tasks will be scheduled for this date.
              </p>
            </div>

            <div>
              <Label htmlFor="csv">Paste CSV / spreadsheet</Label>
              <Textarea
                id="csv"
                rows={8}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                className="font-mono text-xs leading-relaxed sm:text-sm"
                placeholder={
                  "Apartment number, Check out time, Check in window, Guests, Nights, Requests, Instructions\n157, 11:00, 15:00-16:00, 4, 3, Luggage, Prepare sofa"
                }
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                First row must be the header. Columns are matched automatically
                by name.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:flex-1"
              onClick={handlePreview}
            >
              Preview
            </Button>
            <Button
              type="button"
              className="h-11 sm:flex-[2]"
              onClick={handleImport}
              disabled={!preview || busy}
            >
              {busy ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              {busy ? "Importing…" : "Import"}
            </Button>
          </div>
        </section>

        {preview && (
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {preview.length} rows
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3.5" /> {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="size-3.5" /> {invalidCount} invalid
                </span>
              )}
              {stats && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-[color:var(--hubigo-gold-dark)]">
                    <Upload className="size-3.5" /> {stats.created} created
                  </span>
                  {stats.duplicates > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      <CopyX className="size-3.5" /> {stats.duplicates}{" "}
                      duplicates
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium sm:px-6">Apartment</th>
                    <th className="px-3 py-2 font-medium">Checkout</th>
                    <th className="px-3 py-2 font-medium">Check-in</th>
                    <th className="px-3 py-2 font-medium">Guests</th>
                    <th className="px-3 py-2 font-medium">Nights</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-5 py-2 font-medium sm:px-6">
                        {r.apartmentNumber ? (
                          r.apartmentNumber
                        ) : (
                          <span className="text-amber-600">missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.checkoutTime || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.checkinWindow || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.guestsCount || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.nightsCount || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
