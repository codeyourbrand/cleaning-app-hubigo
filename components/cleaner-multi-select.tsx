"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Cleaner = { id: string; name: string };

interface CleanerMultiSelectProps {
  cleaners: Cleaner[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function CleanerMultiSelect({
  cleaners,
  selected,
  onChange,
  placeholder = "Assign cleaners",
  className,
}: CleanerMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCleaners = cleaners.filter((c) => selected.includes(c.id));

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent",
          selected.length === 0 && "text-muted-foreground",
        )}
      >
        <UserRound className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">
          {selected.length === 0
            ? placeholder
            : selectedCleaners.map((c) => c.name).join(", ")}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-background p-1 shadow-lg">
          {cleaners.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No cleaners
            </p>
          )}
          {cleaners.map((cleaner) => {
            const isSelected = selected.includes(cleaner.id);
            return (
              <button
                key={cleaner.id}
                type="button"
                onClick={() => toggle(cleaner.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  isSelected ? "bg-accent" : "hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                  {cleaner.name}
                </span>
              </button>
            );
          })}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="size-4" />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
