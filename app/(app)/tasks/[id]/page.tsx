"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  MessageSquare,
  Camera,
  ArrowLeft,
  Luggage,
  Car,
  Baby,
  AlertTriangle,
  Search,
  X,
  Clock,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useMutationQueue } from "@/hooks/use-mutation-queue";

export default function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [taskId, setTaskId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setTaskId(p.id));
  }, [params]);

  if (!taskId) return <Skeleton className="h-screen" />;
  return <TaskDetail taskId={taskId} />;
}

type Step = { id: string; name: string; done: boolean; doneAt?: string };
type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  parentId: string | null;
  media: { id: string; url: string; type: string }[];
  replies?: Comment[];
};
type Task = {
  id: string;
  title: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  type: "CHECK_OUT" | "REFRESH" | "CLEANING" | "REPAIR" | "OTHER";
  customTypeName: string | null;
  date: string;
  checkoutTime: string | null;
  checkinWindow: string | null;
  guestsCount: number | null;
  nightsCount: number | null;
  requests: string | null;
  instructions: string | null;
  apartment: {
    id: string;
    number: string;
    building: string | null;
    floor: string | null;
  };
  assignedTo: { id: string; name: string } | null;
  startedAt?: string;
  doneAt?: string;
  steps: Step[];
  media: { id: string; url: string; type: string }[];
  comments: Comment[];
};

function getTaskTypeLabel(type: string, customTypeName?: string | null) {
  switch (type) {
    case "CHECK_OUT":
      return "Check-out";
    case "REFRESH":
      return "Refresh";
    case "CLEANING":
      return "Cleaning";
    case "REPAIR":
      return "Repair";
    case "OTHER":
      return customTypeName || "Other";
    default:
      return type;
  }
}

function TaskDetail({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const online = useOnlineStatus();
  const { queueMutation } = useMutationQueue();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const loadTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      setTask(data.task);
    } catch {
      toast.error("Could not load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    loadTask();
  }, [loadTask]);

  async function startTask() {
    setBusy(true);
    const res = online
      ? await fetch(`/api/tasks/${taskId}/start`, { method: "POST" })
      : await queueMutation({
          url: `/api/tasks/${taskId}/start`,
          method: "POST",
        });
    if (res.ok) {
      toast.success("Started");
      await loadTask();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Could not start");
    }
    setBusy(false);
  }

  async function completeTask() {
    setBusy(true);
    const res = online
      ? await fetch(`/api/tasks/${taskId}/done`, { method: "POST" })
      : await queueMutation({
          url: `/api/tasks/${taskId}/done`,
          method: "POST",
        });
    if (res.ok) {
      toast.success("Done — saved");
      await loadTask();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Could not complete");
    }
    setBusy(false);
  }

  async function toggleStep(stepId: string, done: boolean) {
    if (!task) return;
    // Optimistic update
    setTask((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) =>
          s.id === stepId
            ? {
                ...s,
                done,
                doneAt: done ? new Date().toISOString() : undefined,
              }
            : s,
        ),
      };
    });

    const res = online
      ? await fetch(`/api/tasks/${taskId}/steps/${stepId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done }),
        })
      : await queueMutation({
          url: `/api/tasks/${taskId}/steps/${stepId}`,
          method: "PATCH",
          body: { done },
        });
    if (!res.ok) {
      // Revert on failure
      setTask((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === stepId ? { ...s, done: !done, doneAt: undefined } : s,
          ),
        };
      });
      toast.error("Could not update step");
    }
  }

  async function addComment(body: string, parentId?: string, files?: File[]) {
    const res = online
      ? await fetch(`/api/tasks/${taskId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, body, parentId }),
        })
      : await queueMutation({
          url: `/api/tasks/${taskId}/comments`,
          method: "POST",
          body: { taskId, body, parentId },
        });
    if (res.ok) {
      const data = await res.json();
      // Upload comment photos
      if (files && files.length > 0) {
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("taskId", taskId);
          fd.append("commentId", data.comment.id);
          fd.append("type", "COMMENT");
          await fetch("/api/media", { method: "POST", body: fd });
        }
      }
      toast.success("Sent");
      await loadTask();
    } else {
      toast.error("Could not send comment");
    }
  }

  async function uploadTaskPhoto(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("taskId", taskId);
    form.append("type", "BEFORE");
    const res = online
      ? await fetch("/api/media", { method: "POST", body: form })
      : await queueMutation({
          url: "/api/media",
          method: "POST",
          body: { taskId, type: "BEFORE" },
          file,
        });
    if (res.ok) {
      toast.success("Photo added");
      await loadTask();
    } else {
      toast.error("Could not add photo");
    }
  }

  if (loading || !task) {
    return <TaskSkeleton />;
  }

  const statusBadge =
    task.status === "DONE"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : task.status === "IN_PROGRESS"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-red-100 text-red-700 border-red-200";

  const allPhotos = task.media;
  const allStepsDone = task.steps.length > 0 && task.steps.every((s) => s.done);
  const typeLabel = getTaskTypeLabel(task.type, task.customTypeName);

  return (
    <div className="pb-24">
      {/* Header: task name + apartment number */}
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">
              {task.title || typeLabel}
            </h1>
            <Badge className={statusBadge} variant="outline">
              {task.status.replace("_", " ")}
            </Badge>
          </div>
          <Link
            href={`/apartments/${task.apartment.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {task.apartment.number}
            {task.apartment.building ? ` · ${task.apartment.building}` : ""}
            {task.apartment.floor ? ` · Floor ${task.apartment.floor}` : ""}
          </Link>
        </div>
      </div>

      {/* Photos at top */}
      <Section title="Photos">
        <div className="grid grid-cols-3 gap-2">
          {allPhotos.map((p) => (
            <div
              key={p.id}
              className="aspect-square rounded-xl overflow-hidden bg-muted"
            >
              <img
                src={p.url}
                alt="Task photo"
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          <button
            onClick={() => photoInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted"
            aria-label="Add photo"
          >
            <Camera className="size-6 mb-1" />
            <span className="text-xs">Add photo</span>
          </button>
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadTaskPhoto(file);
            e.target.value = "";
          }}
        />
      </Section>

      <div className="space-y-1 text-sm text-muted-foreground mb-4">
        <p>Type: {typeLabel}</p>
        {task.assignedTo && <p>Assigned to: {task.assignedTo.name}</p>}
      </div>

      {/* Cleaning times */}
      {(task.startedAt || task.doneAt) && (
        <div className="flex gap-4 mb-4 p-3 rounded-xl bg-muted/50">
          {task.startedAt && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-amber-600" />
              <span>
                Started:{" "}
                {new Date(task.startedAt).toLocaleString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          )}
          {task.doneAt && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>
                Finished:{" "}
                {new Date(task.doneAt).toLocaleString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        {task.status !== "DONE" && task.status !== "IN_PROGRESS" && (
          <Button
            className="flex-1 h-14 text-lg"
            onClick={startTask}
            disabled={busy}
          >
            Start
          </Button>
        )}
        {task.status === "IN_PROGRESS" && (
          <Button
            className="flex-1 h-14 text-lg"
            onClick={completeTask}
            disabled={busy}
          >
            Done
          </Button>
        )}
        {task.status === "DONE" && (
          <Button className="flex-1 h-14 text-lg" disabled>
            Completed
          </Button>
        )}
      </div>

      <Section title="Details">
        <Detail label="Checkout time" value={task.checkoutTime} />
        <Detail label="Check-in window" value={task.checkinWindow} />
        <Detail label="Guests" value={task.guestsCount?.toString()} />
        <Detail label="Nights" value={task.nightsCount?.toString()} />
        <Detail label="Requests" value={task.requests} />
        <Detail label="Instructions" value={task.instructions} />
      </Section>

      <Section title="Cleaning plan">
        <div className="space-y-2">
          {task.steps.map((step) => (
            <button
              key={step.id}
              onClick={() => toggleStep(step.id, !step.done)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-muted transition-colors text-left"
              aria-pressed={step.done}
            >
              {step.done ? (
                <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="size-6 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1">
                <p
                  className={
                    step.done ? "line-through text-muted-foreground" : ""
                  }
                >
                  {step.name}
                </p>
                {step.doneAt && (
                  <p className="text-xs text-muted-foreground">
                    Done {new Date(step.doneAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
        {allStepsDone && task.status !== "DONE" && (
          <p className="mt-2 text-sm text-emerald-600 font-medium">
            All steps done. Mark task as Done.
          </p>
        )}
      </Section>

      <Section title="Comments">
        <CommentTree comments={task.comments} onReply={addComment} />
        <CommentForm
          onSubmit={(body, files) => addComment(body, undefined, files)}
        />
      </Section>

      <div className="flex gap-2 mt-4">
        <Link
          href={`/apartments/${task.apartment.id}/lost-found/new`}
          className="flex-1 inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Search className="size-4 mr-1" /> Lost & Found
        </Link>
        <Link
          href={`/apartments/${task.apartment.id}/damage/new`}
          className="flex-1 inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <AlertTriangle className="size-4 mr-1" /> Damage
        </Link>
      </div>
    </div>
  );
}

function TaskSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-1 border-b last:border-0">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function CommentTree({
  comments,
  onReply,
}: {
  comments: Comment[];
  onReply: (body: string, parentId?: string, files?: File[]) => void;
}) {
  const [replying, setReplying] = useState<string | null>(null);

  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">No comments yet.</p>;
  }

  return (
    <div className="space-y-4">
      {comments.map((c) => (
        <div key={c.id} className="border rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {c.author.name.charAt(0)}
            </div>
            <span className="text-sm font-medium">{c.author.name}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(c.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm mb-2">{c.body}</p>
          {c.media?.length > 0 && (
            <div className="flex gap-2 mb-2">
              {c.media.map((m) => (
                <img
                  key={m.id}
                  src={m.url}
                  alt=""
                  className="size-16 rounded-lg object-cover"
                />
              ))}
            </div>
          )}
          <button
            onClick={() => setReplying(replying === c.id ? null : c.id)}
            className="text-xs text-primary font-medium"
          >
            Reply
          </button>
          {replying === c.id && (
            <CommentForm
              onSubmit={(body, files) => {
                onReply(body, c.id, files);
                setReplying(null);
              }}
              placeholder="Reply..."
            />
          )}
          {c.replies && c.replies.length > 0 && (
            <div className="mt-3 pl-4 border-l-2 space-y-3">
              {c.replies.map((r) => (
                <div key={r.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {r.author.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{r.author.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{r.body}</p>
                  {r.media?.length > 0 && (
                    <div className="flex gap-2 mt-1">
                      {r.media.map((m) => (
                        <img
                          key={m.id}
                          src={m.url}
                          alt=""
                          className="size-16 rounded-lg object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CommentForm({
  onSubmit,
  placeholder = "Add comment",
}: {
  onSubmit: (body: string, files?: File[]) => void;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    setFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim() && files.length === 0) return;
        onSubmit(body, files.length > 0 ? files : undefined);
        setBody("");
        setFiles([]);
        setPreviews([]);
      }}
    >
      {previews.length > 0 && (
        <div className="flex gap-2 mb-2">
          {previews.map((src, i) => (
            <div key={i} className="relative size-16">
              <img
                src={src}
                alt="Preview"
                className="size-16 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1 -right-1 size-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach photo"
        >
          <ImageIcon className="size-4" />
        </Button>
        <Button type="submit" size="sm">
          <MessageSquare className="size-4 mr-1" /> Send
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </form>
  );
}
