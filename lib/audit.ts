import { prisma } from "./prisma";

export type AuditAction =
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_STARTED"
  | "TASK_COMPLETED"
  | "TASK_STATUS_CHANGED"
  | "TASK_EDITED"
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
  | "HOSTFULLY_SYNC";

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
