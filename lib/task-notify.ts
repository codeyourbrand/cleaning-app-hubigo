/**
 * What the coordinator's WhatsApp button should do for a task.
 *
 * NO_ASSIGNEE     - nobody to message yet
 * PENDING         - at least one assignee has not been notified (or a different
 *                   person was notified)
 * TIMING_CHANGED  - every assignee was notified, but the time was edited
 *                   afterwards for at least one of them
 * SENT            - all current assignees have the current assignment and time
 */
export type TaskNotifyState =
  | "NO_ASSIGNEE"
  | "PENDING"
  | "TIMING_CHANGED"
  | "SENT";

type AssigneeWithSendState = {
  id: string;
  whatsappSentAt?: Date | string | null;
  whatsappSentCheckoutTime?: string | null;
};

export type TaskNotifyInput = {
  assignedTo?: AssigneeWithSendState[] | null;
  checkoutTime: string | null;
};

export function getTaskNotifyState(task: TaskNotifyInput): TaskNotifyState {
  const assignees = task.assignedTo ?? [];
  if (assignees.length === 0) return "NO_ASSIGNEE";

  const anyPending = assignees.some(
    (a) =>
      !a.whatsappSentAt || a.whatsappSentCheckoutTime !== task.checkoutTime,
  );
  if (!anyPending) return "SENT";

  const anyTimingChanged = assignees.some(
    (a) => a.whatsappSentAt && a.whatsappSentCheckoutTime !== task.checkoutTime,
  );
  return anyTimingChanged ? "TIMING_CHANGED" : "PENDING";
}
