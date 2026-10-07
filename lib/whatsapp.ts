import { formatDateOnly } from "@/lib/datetime";
import { prisma } from "./prisma";

const WHAPI_BASE_URL = "https://gate.whapi.cloud";

export type WhatsAppEventType =
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_STARTED"
  | "TASK_COMPLETED"
  | "REFRESH_CREATED";

export const WHATSAPP_EVENT_LABELS: Record<WhatsAppEventType, string> = {
  TASK_CREATED: "New task created",
  TASK_ASSIGNED: "Person assigned to task",
  TASK_STARTED: "Task started",
  TASK_COMPLETED: "Task completed",
  REFRESH_CREATED: "Refresh task auto-created",
};

function getConfig() {
  const token = process.env.WHAPI_TOKEN;
  const groupId = process.env.WHAPI_GROUP_ID;
  return { token, groupId };
}

export function isWhatsAppConfigured(): boolean {
  const { token, groupId } = getConfig();
  return Boolean(token && groupId);
}

async function sendTextMessage(to: string, body: string): Promise<boolean> {
  const { token } = getConfig();
  if (!token) {
    console.warn("[WhatsApp] WHAPI_TOKEN not configured, skipping message");
    return false;
  }

  try {
    const res = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, body }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[WhatsApp] API error ${res.status}: ${errorBody}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] Failed to send message:", err);
    return false;
  }
}

/**
 * Check if a specific event type is enabled in the WhatsApp notification
 * settings. Returns false if no settings exist.
 */
async function isEventEnabled(eventType: WhatsAppEventType): Promise<boolean> {
  const setting = await prisma.whatsAppNotificationSetting.findUnique({
    where: { eventType },
  });
  return setting?.enabled ?? false;
}

/**
 * Send a WhatsApp notification to the configured group, if the event type
 * is enabled and the integration is configured.
 *
 * Failures are caught and logged — never propagated to break the caller.
 */
export async function sendWhatsAppNotification(
  eventType: WhatsAppEventType,
  message: string,
): Promise<boolean> {
  try {
    if (!isWhatsAppConfigured()) return false;

    const enabled = await isEventEnabled(eventType);
    if (!enabled) return false;

    const { groupId } = getConfig();
    if (!groupId) return false;

    return await sendTextMessage(groupId, message);
  } catch (err) {
    console.error("[WhatsApp] Notification error:", err);
    return false;
  }
}

/** Direct send bypassing event-type check — for test messages. */
export async function sendWhatsAppTestMessage(
  message: string,
): Promise<boolean> {
  const { groupId } = getConfig();
  if (!groupId) return false;
  return sendTextMessage(groupId, message);
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

type TaskSchedule = {
  checkoutTime?: string | null;
  checkinWindow?: string | null;
};

function formatTaskSchedule(task: TaskSchedule): string {
  return [
    task.checkoutTime ? `Checkout: ${task.checkoutTime}` : null,
    task.checkinWindow ? `Check-in: ${task.checkinWindow}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTaskCreatedMessage(task: {
  title?: string | null;
  type: string;
  apartment?: { number: string } | null;
  date: Date | string;
  checkoutTime?: string | null;
  checkinWindow?: string | null;
}): string {
  const name = task.title || task.type;
  const apt = task.apartment?.number ?? "?";
  const date = formatDateOnly(task.date);
  const schedule = formatTaskSchedule(task);
  return `📋 *New task*\n${name} — Apt ${apt}\nDate: ${date}${schedule ? `\n${schedule}` : ""}`;
}

export function buildTaskAssignedMessage(task: {
  title?: string | null;
  type: string;
  apartment?: { number: string } | null;
  assignedTo?: { name: string } | null;
  date: Date | string;
  checkoutTime?: string | null;
  checkinWindow?: string | null;
}): string {
  const name = task.title || task.type;
  const apt = task.apartment?.number ?? "?";
  const person = task.assignedTo?.name ?? "?";
  const date = formatDateOnly(task.date);
  const schedule = formatTaskSchedule(task);
  return `👤 *${person}* assigned to:\n${name} — Apt ${apt}\nDate: ${date}${schedule ? `\n${schedule}` : ""}`;
}

export function buildTaskStartedMessage(task: {
  title?: string | null;
  type: string;
  apartment?: { number: string } | null;
  startedBy?: { name: string } | null;
}): string {
  const name = task.title || task.type;
  const apt = task.apartment?.number ?? "?";
  const person = task.startedBy?.name ?? "?";
  return `▶️ *${person}* started:\n${name} — Apt ${apt}`;
}

export function buildTaskCompletedMessage(task: {
  title?: string | null;
  type: string;
  apartment?: { number: string } | null;
  doneBy?: { name: string } | null;
}): string {
  const name = task.title || task.type;
  const apt = task.apartment?.number ?? "?";
  const person = task.doneBy?.name ?? "?";
  return `✅ *${person}* completed:\n${name} — Apt ${apt}`;
}

export function buildRefreshCreatedMessage(task: {
  apartment?: { number: string } | null;
  date: Date | string;
}): string {
  const apt = task.apartment?.number ?? "?";
  const date = formatDateOnly(task.date);
  return `🔄 *Auto-refresh* created\nApt ${apt}\nDate: ${date}`;
}
