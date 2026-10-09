import { formatDateOnly } from "@/lib/datetime";
import { logAudit } from "./audit";
import { prisma } from "./prisma";

const WHAPI_BASE_URL = "https://gate.whapi.cloud";

export type WhatsAppEventType =
  | "TASK_CREATED"
  | "TASK_ASSIGNED"
  | "TASK_TIMING_CHANGED"
  | "TASK_COMMENTED"
  | "TASK_STARTED"
  | "TASK_COMPLETED"
  | "REFRESH_CREATED";

export type WhatsAppDestination = "GROUP" | "USER" | "BOTH";

export const WHATSAPP_EVENT_LABELS: Record<WhatsAppEventType, string> = {
  TASK_CREATED: "New task created",
  TASK_ASSIGNED: "Person assigned to task",
  TASK_TIMING_CHANGED: "Task time changed",
  TASK_COMMENTED: "Comment added to task",
  TASK_STARTED: "Task started",
  TASK_COMPLETED: "Task completed",
  REFRESH_CREATED: "Refresh task auto-created",
};

export const WHATSAPP_DESTINATION_LABELS: Record<WhatsAppDestination, string> =
  {
    GROUP: "Group",
    USER: "Person",
    BOTH: "Group + person",
  };

function getConfig() {
  const token = process.env.WHAPI_TOKEN;
  const groupId = process.env.WHAPI_GROUP_ID;
  return { token, groupId };
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(getConfig().token);
}

/** "…+971 58-590 1656" -> "971585901656@s.whatsapp.net" */
function phoneToChatId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? `${digits}@s.whatsapp.net` : null;
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

async function getSetting(eventType: WhatsAppEventType) {
  return prisma.whatsAppNotificationSetting.findUnique({
    where: { eventType },
  });
}

export interface WhatsAppNotificationOptions {
  /** Person the notification is about (used for USER/BOTH destinations). */
  recipient?: { phone?: string | null; name?: string | null } | null;
  /** Who triggered the event — used as audit log author when logging skips. */
  actorUserId?: string;
  taskId?: string;
}

/**
 * Send a WhatsApp notification according to the per-event destination
 * setting (GROUP, USER or BOTH). USER destinations require a recipient
 * phone number — a missing number is logged to the audit log and skipped.
 *
 * Failures are caught and logged — never propagated to break the caller.
 */
export async function sendWhatsAppNotification(
  eventType: WhatsAppEventType,
  message: string,
  opts: WhatsAppNotificationOptions = {},
): Promise<boolean> {
  try {
    if (!isWhatsAppConfigured()) return false;

    const setting = await getSetting(eventType);
    if (!setting?.enabled) return false;

    const destination = (setting.destination || "GROUP") as WhatsAppDestination;
    const { groupId } = getConfig();
    let sent = false;

    if (destination === "GROUP" || destination === "BOTH") {
      if (groupId) {
        sent = (await sendTextMessage(groupId, message)) || sent;
      }
    }

    if (destination === "USER" || destination === "BOTH") {
      const chatId = opts.recipient?.phone
        ? phoneToChatId(opts.recipient.phone)
        : null;
      if (chatId) {
        sent = (await sendTextMessage(chatId, message)) || sent;
      } else if (opts.actorUserId) {
        await logAudit({
          userId: opts.actorUserId,
          taskId: opts.taskId,
          action: "WHATSAPP_SKIPPED",
          newValue: {
            eventType,
            reason: "Recipient has no valid phone number",
            recipient: opts.recipient?.name ?? null,
          },
        });
      }
    }

    return sent;
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

export function buildTaskTimingChangedMessage(
  task: {
    title?: string | null;
    type: string;
    apartment?: { number: string } | null;
    date: Date | string;
    checkoutTime?: string | null;
    checkinWindow?: string | null;
  },
  previousCheckoutTime?: string | null,
): string {
  const name = task.title || task.type;
  const apt = task.apartment?.number ?? "?";
  const date = formatDateOnly(task.date);
  const next = task.checkoutTime ? `*${task.checkoutTime}*` : "_not set_";
  const checkout = previousCheckoutTime
    ? `Checkout: ~${previousCheckoutTime}~ → ${next}`
    : `Checkout: ${next}`;
  const checkin = task.checkinWindow ? `\nCheck-in: ${task.checkinWindow}` : "";
  return `⚠️ *TIMING CHANGED* ⚠️\n${name} — Apt ${apt}\nDate: ${date}\n${checkout}${checkin}`;
}

export function buildTaskCommentedMessage(
  task: {
    title?: string | null;
    type: string;
    apartment?: { number: string } | null;
  },
  author: string,
  body: string,
): string {
  const name = task.title || task.type;
  const apt = task.apartment?.number ?? "?";
  const excerpt = body.length > 300 ? `${body.slice(0, 300)}…` : body;
  return `💬 *${author}* commented on:\n${name} — Apt ${apt}\n"${excerpt}"`;
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
