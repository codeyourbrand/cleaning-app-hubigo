import { prisma } from "./prisma";

export type AuditAction =
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_STARTED"
  | "TASK_COMPLETED"
  | "TASK_STATUS_CHANGED"
  | "TASK_EDITED"
  | "TASK_DELETED"
  | "STEP_COMPLETED"
  | "STEP_UNCOMPLETED"
  | "COMMENT_CREATED"
  | "PHOTO_ADDED"
  | "LOST_FOUND_CREATED"
  | "DAMAGE_CREATED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "APARTMENT_CREATED"
  | "APARTMENT_UPDATED"
  | "TASK_IMPORTED"
  | "HOSTFULLY_SYNC"
  | "INVENTORY_CHECKLIST_CREATED"
  | "INVENTORY_CHECKLIST_UPDATED"
  | "INVENTORY_CHECKLIST_DELETED"
  | "INVENTORY_ITEM_ADDED"
  | "INVENTORY_ITEM_UPDATED"
  | "INVENTORY_ITEM_DELETED"
  | "INVENTORY_ITEM_CHECKED"
  | "INVENTORY_ITEM_UNCHECKED"
  | "WHATSAPP_SKIPPED";

/** Map actions to a category for filtering in the logs UI. */
export type AuditCategory = "TASK" | "INVENTORY" | "SYNC" | "OTHER";

const TASK_ACTIONS = new Set<string>([
  "TASK_CREATED",
  "TASK_ASSIGNED",
  "TASK_STARTED",
  "TASK_COMPLETED",
  "TASK_STATUS_CHANGED",
  "TASK_EDITED",
  "TASK_DELETED",
  "STEP_COMPLETED",
  "STEP_UNCOMPLETED",
  "COMMENT_CREATED",
  "PHOTO_ADDED",
  "TASK_IMPORTED",
]);
const INVENTORY_ACTIONS = new Set<string>([
  "INVENTORY_CHECKLIST_CREATED",
  "INVENTORY_CHECKLIST_UPDATED",
  "INVENTORY_CHECKLIST_DELETED",
  "INVENTORY_ITEM_ADDED",
  "INVENTORY_ITEM_UPDATED",
  "INVENTORY_ITEM_DELETED",
  "INVENTORY_ITEM_CHECKED",
  "INVENTORY_ITEM_UNCHECKED",
]);
const SYNC_ACTIONS = new Set<string>(["HOSTFULLY_SYNC"]);

export function getAuditCategory(action: string): AuditCategory {
  if (TASK_ACTIONS.has(action)) return "TASK";
  if (INVENTORY_ACTIONS.has(action)) return "INVENTORY";
  if (SYNC_ACTIONS.has(action)) return "SYNC";
  return "OTHER";
}

export function getAuditActionsByCategory(category: AuditCategory): string[] {
  switch (category) {
    case "TASK":
      return [...TASK_ACTIONS];
    case "INVENTORY":
      return [...INVENTORY_ACTIONS];
    case "SYNC":
      return [...SYNC_ACTIONS];
    default:
      return [];
  }
}

export async function logAudit({
  userId,
  taskId,
  action,
  oldValue,
  newValue,
}: {
  userId: string;
  taskId?: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        taskId,
        action,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}
