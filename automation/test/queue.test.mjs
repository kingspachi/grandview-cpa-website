import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createJsonQueue } from '../lib/queue/json.mjs';
import { ApprovalError, STATUS } from '../lib/queue/status.mjs';
import { COLUMNS, recordToRow, rowToRecord } from '../lib/queue/sheets.mjs';

async function tempQueue() {
  const dir = await mkdtemp(join(tmpdir(), 'queue-'));
  const path = join(dir, 'queue.json');
  return { queue: createJsonQueue({ path }), path };
}

const record = {
  id: 'r1',
  date: '2026-09-16',
  format: 'Checklist',
  titleZh: '報稅檢查清單',
  titleEn: 'Filing checklist',
  contentZh: '第一段\n\n第二段',
  summaryEn: 'A checklist.',
  imagePrompt: 'A desk with tax forms',
  sourceCitation: 'CRA — https://canada.ca/example',
  status: STATUS.PENDING,
  approvedBy: '',
  approvedAt: '',
  publishedLinks: [],
  notes: '',
};

test('an empty or missing queue file reads as no records', async () => {
  const { queue } = await tempQueue();
  assert.deepEqual(await queue.listRecords(), []);
});

test('records round-trip through the json queue', async () => {
  const { queue, path } = await tempQueue();
  await queue.appendRecord(record);
  assert.deepEqual(await queue.listRecords(), [record]);
  assert.match(await readFile(path, 'utf8'), /報稅檢查清單/);
});

test('the json queue refuses to write an Approved status', async () => {
  const { queue } = await tempQueue();
  await assert.rejects(
    queue.appendRecord({ ...record, status: STATUS.APPROVED }),
    ApprovalError,
  );
  await queue.appendRecord(record);
  await assert.rejects(
    queue.updateRecord('r1', { status: STATUS.APPROVED }),
    ApprovalError,
  );
});

test('updating an unknown id fails loudly', async () => {
  const { queue } = await tempQueue();
  await assert.rejects(queue.updateRecord('nope', { status: STATUS.PUBLISHED }), /nope/);
});

test('sheet rows round-trip and match the header width', () => {
  const row = recordToRow(record);
  assert.equal(row.length, COLUMNS.length);
  assert.deepEqual(rowToRecord(row), record);
});

test('a human-approved sheet row is read back with its approval intact', () => {
  const row = recordToRow({
    ...record,
    status: STATUS.APPROVED,
    approvedBy: 'philip@cga-lau.com',
    approvedAt: '2026-09-16T15:04:00Z',
    publishedLinks: ['https://cga-lau.com/blog/a.html', 'https://facebook.com/1'],
  });
  const parsed = rowToRecord(row);
  assert.equal(parsed.status, STATUS.APPROVED);
  assert.equal(parsed.approvedBy, 'philip@cga-lau.com');
  assert.equal(parsed.publishedLinks.length, 2);
});
