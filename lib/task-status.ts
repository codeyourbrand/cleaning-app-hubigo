export type TaskStatusKey = "TODO" | "IN_PROGRESS" | "DONE";

type TaskStatusStyle = {
  label: string;
  /** Pill/badge colours. */
  badge: string;
  /** Tinted card background + border. */
  tile: string;
  /** Solid accent bar / dot. */
  accent: string;
};

const TASK_STATUS_STYLES: Record<TaskStatusKey, TaskStatusStyle> = {
  TODO: {
    label: "TO DO",
    badge: "bg-red-100 text-red-700 border-red-200",
    tile: "bg-red-50 border-red-200",
    accent: "bg-red-500",
  },
  IN_PROGRESS: {
    label: "IN PROGRESS",
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    tile: "bg-sky-50 border-sky-200",
    accent: "bg-sky-400",
  },
  DONE: {
    label: "DONE",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    tile: "bg-emerald-50 border-emerald-200",
    accent: "bg-emerald-500",
  },
};

export function taskStatusStyle(status: string): TaskStatusStyle {
  return TASK_STATUS_STYLES[status as TaskStatusKey] ?? TASK_STATUS_STYLES.TODO;
}
