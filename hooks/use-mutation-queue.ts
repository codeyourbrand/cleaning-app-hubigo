"use client";

import { useState, useEffect } from "react";

export interface QueuedMutation {
  id: string;
  method: string;
  url: string;
  body?: string;
  file?: { name: string; type: string; base64: string } | null;
}

const OUTBOX_KEY = "hubigo_outbox";

function readOutbox(): QueuedMutation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeOutbox(outbox: QueuedMutation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
}

async function base64ToFile(
  fileInfo: NonNullable<QueuedMutation["file"]>,
): Promise<File> {
  const res = await fetch(fileInfo.base64);
  const blob = await res.blob();
  return new File([blob], fileInfo.name, { type: fileInfo.type });
}

export function useMutationQueue() {
  const [outbox, setOutbox] = useState<QueuedMutation[]>([]);

  useEffect(() => {
    setOutbox(readOutbox());
  }, []);

  async function queueMutation(opts: {
    url: string;
    method?: string;
    body?: object;
    file?: File;
  }): Promise<Response> {
    const id = crypto.randomUUID();
    const method = opts.method ?? "POST";
    let bodyStr: string | undefined;
    let fileInfo: QueuedMutation["file"];

    if (opts.body) {
      bodyStr = JSON.stringify(opts.body);
    }

    if (opts.file) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(opts.file!);
      });
      fileInfo = { name: opts.file.name, type: opts.file.type, base64 };
    }

    try {
      const init: RequestInit = { method };
      if (opts.file) {
        const form = new FormData();
        if (opts.body) {
          Object.entries(opts.body).forEach(([k, v]) =>
            form.append(k, String(v)),
          );
        }
        form.append("file", opts.file);
        init.body = form;
      } else if (bodyStr) {
        init.body = bodyStr;
        init.headers = { "Content-Type": "application/json" };
      }
      return await fetch(opts.url, init);
    } catch {
      const item: QueuedMutation = {
        id,
        method,
        url: opts.url,
        body: bodyStr,
        file: fileInfo,
      };
      const updated = [...outbox, item];
      writeOutbox(updated);
      setOutbox(updated);
      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  async function syncOutbox(): Promise<void> {
    const items = readOutbox();
    const remaining: QueuedMutation[] = [];
    for (const item of items) {
      try {
        const init: RequestInit = { method: item.method };
        if (item.file) {
          const file = await base64ToFile(item.file);
          const form = new FormData();
          if (item.body) {
            try {
              const json = JSON.parse(item.body);
              Object.entries(json).forEach(([k, v]) =>
                form.append(k, String(v)),
              );
            } catch {
              // ignore
            }
          }
          form.append("file", file);
          init.body = form;
        } else if (item.body) {
          init.body = item.body;
          init.headers = { "Content-Type": "application/json" };
        }
        const res = await fetch(item.url, init);
        if (!res.ok && res.status !== 409) {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }
    writeOutbox(remaining);
    setOutbox(remaining);
  }

  return { outbox, queueMutation, syncOutbox };
}
