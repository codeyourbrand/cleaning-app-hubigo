/**
 * What the coordinator's WhatsApp button should do for a task.
 *
 * NO_ASSIGNEE     - nobody to message yet
 * PENDING         - assignee has not been notified (or a different person was notified)
 * TIMING_CHANGED  - assignee was notified, but the time was edited afterwards
 * SENT            - assignee has the current assignment and time
 */
export type TaskNotifyState =
  | "NO_ASSIGNEE"
  | "PENDING"
  | "TIMING_CHANGED"
  | "SENT";

export type TaskNotifyInput = {
  assignedToUserId?: string | null;
  assignedTo?: { id: string } | null;
  checkoutTime: string | null;
  whatsappSentAt: Date | string | null;
  whatsappSentToUserId: string | null;
  whatsappSentCheckoutTime: string | null;
};

export function getTaskNotifyState(task: TaskNotifyInput): TaskNotifyState {
  const assigneeId = task.assignedTo?.id ?? task.assignedToUserId ?? null;
  if (!assigneeId) return "NO_ASSIGNEE";
  if (!task.whatsappSentAt || task.whatsappSentToUserId !== assigneeId) {
    return "PENDING";
  }
  const sentTime = task.whatsappSentCheckoutTime ?? null;
  const currentTime = task.checkoutTime ?? null;
  return sentTime === currentTime ? "SENT" : "TIMING_CHANGED";
}
