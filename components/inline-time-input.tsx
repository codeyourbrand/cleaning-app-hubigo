"use client";

import { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineTimeInputProps {
  value: string | null;
  onSave: (value: string | null) => void;
  className?: string;
}

export function InlineTimeInput({
  value,
  onSave,
  className,
}: InlineTimeInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  function startEdit() {
    setDraft(value ?? "");
    setIsEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next !== value) {
      onSave(next);
    }
    setIsEditing(false);
  }

  function cancel() {
    setDraft(value ?? "");
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="time"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        className={cn(
          "h-7 w-24 rounded border border-input bg-white px-1 text-center text-sm font-semibold tabular-nums focus:border-ring focus:outline-none",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded border border-transparent bg-white/80 px-2 text-sm font-semibold tabular-nums shadow-sm transition-colors hover:border-input",
        className,
      )}
    >
      <Clock className="size-3.5 text-muted-foreground" />
      {value ?? "--:--"}
    </button>
  );
}
