/**
 * Review-queue status vocabulary and the approval gate.
 *
 * Brief section 6: "No autonomous publishing — approval gate is mandatory,
 * not optional." Nothing in this codebase may set APPROVED; only a human
 * editing the review queue can.
 */

export const STATUS = {
  PENDING: 'Pending Review',
  APPROVED: 'Approved',
  NEEDS_EDIT: 'Needs Edit',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
  FAILED: 'Publish Failed',
};

/** Statuses the automation is allowed to write. Approved is deliberately absent. */
export const AUTOMATION_WRITABLE = [STATUS.PENDING, STATUS.PUBLISHED, STATUS.FAILED];

export class ApprovalError extends Error {}

/**
 * Throw unless the record carries a complete human approval.
 *
 * @param {{status?: string, approvedBy?: string, approvedAt?: string, id?: string}} record
 */
export function assertApproved(record) {
  const label = record?.id ? `Record ${record.id}` : 'Record';
  if (!record || record.status !== STATUS.APPROVED) {
    throw new ApprovalError(`${label}: status is "${record?.status}", refusing to publish.`);
  }
  if (!record.approvedBy || !record.approvedAt) {
    throw new ApprovalError(
      `${label}: marked Approved but the audit trail is incomplete ` +
        '(approvedBy / approvedAt missing). Refusing to publish.',
    );
  }
  return true;
}

/**
 * Guard for writes made by the automation itself.
 *
 * @param {string} status
 */
export function assertAutomationWritable(status) {
  if (!AUTOMATION_WRITABLE.includes(status)) {
    throw new ApprovalError(`Automation may not set status "${status}".`);
  }
  return true;
}
