import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORMATS, nextFormat, nextFormatFromRecords } from '../lib/rotation.mjs';

test('rotation starts at the first format when there is no history', () => {
  assert.equal(nextFormat(null), FORMATS[0]);
  assert.equal(nextFormatFromRecords([]), FORMATS[0]);
});

test('rotation advances one step and wraps around', () => {
  assert.equal(nextFormat(FORMATS[0]), FORMATS[1]);
  assert.equal(nextFormat(FORMATS.at(-1)), FORMATS[0]);
});

test('an unknown stored format restarts the cycle', () => {
  assert.equal(nextFormat('Something Else'), FORMATS[0]);
});

test('rotation uses the latest record by date, not insertion order', () => {
  const records = [
    { date: '2026-09-14', format: FORMATS[2] },
    { date: '2026-09-10', format: FORMATS[0] },
  ];
  assert.equal(nextFormatFromRecords(records), FORMATS[3]);
});

test('a full cycle visits every format exactly once', () => {
  const seen = [];
  let last = null;
  for (let i = 0; i < FORMATS.length; i += 1) {
    last = nextFormat(last);
    seen.push(last);
  }
  assert.deepEqual([...seen].sort(), [...FORMATS].sort());
});
