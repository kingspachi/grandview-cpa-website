import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ApprovalError,
  STATUS,
  assertApproved,
  assertAutomationWritable,
} from '../lib/queue/status.mjs';

const approved = {
  id: 'abc',
  status: STATUS.APPROVED,
  approvedBy: 'philip@cga-lau.com',
  approvedAt: '2026-09-16T15:04:00Z',
};

test('a fully approved record passes the gate', () => {
  assert.equal(assertApproved(approved), true);
});

for (const status of [STATUS.PENDING, STATUS.NEEDS_EDIT, STATUS.REJECTED, STATUS.FAILED]) {
  test(`"${status}" never passes the gate`, () => {
    assert.throws(() => assertApproved({ ...approved, status }), ApprovalError);
  });
}

test('an undefined or empty record never passes the gate', () => {
  assert.throws(() => assertApproved(undefined), ApprovalError);
  assert.throws(() => assertApproved({}), ApprovalError);
});

test('Approved without a complete audit trail is refused', () => {
  assert.throws(() => assertApproved({ ...approved, approvedBy: '' }), ApprovalError);
  assert.throws(() => assertApproved({ ...approved, approvedAt: '' }), ApprovalError);
});

test('the automation may not write the Approved status itself', () => {
  assert.throws(() => assertAutomationWritable(STATUS.APPROVED), ApprovalError);
  assert.equal(assertAutomationWritable(STATUS.PENDING), true);
  assert.equal(assertAutomationWritable(STATUS.PUBLISHED), true);
});
