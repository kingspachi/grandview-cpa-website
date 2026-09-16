import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertAutomationWritable } from './status.mjs';

/**
 * Local JSON review queue.
 *
 * Useful for development, tests, and a phase-1 pilot that does not yet have a
 * Google account wired up. Not mobile-friendly — the Sheets driver is what the
 * client reviews on their phone.
 */
export function createJsonQueue({ path }) {
  async function readAll() {
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async function writeAll(records) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  }

  return {
    name: 'json',
    listRecords: readAll,

    async appendRecord(record) {
      assertAutomationWritable(record.status);
      const records = await readAll();
      records.push(record);
      await writeAll(records);
      return record;
    },

    async updateRecord(id, patch) {
      if (patch.status) assertAutomationWritable(patch.status);
      const records = await readAll();
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) throw new Error(`No queue record with id ${id}`);
      records[index] = { ...records[index], ...patch };
      await writeAll(records);
      return records[index];
    },
  };
}
