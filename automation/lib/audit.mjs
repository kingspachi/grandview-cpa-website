import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from '../config.mjs';

/**
 * Append-only audit trail (brief 6). One JSON object per line so it can be
 * tailed, grepped, or loaded into a sheet without a parser.
 *
 * @param {string} event
 * @param {object} details
 */
export async function audit(event, details = {}) {
  const line = JSON.stringify({ at: new Date().toISOString(), event, ...details });
  await mkdir(dirname(config.auditLogPath), { recursive: true });
  await appendFile(config.auditLogPath, `${line}\n`, 'utf8');
  console.log(`[audit] ${line}`);
}
