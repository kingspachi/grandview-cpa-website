import { createSign } from 'node:crypto';
import { assertAutomationWritable } from './status.mjs';

/**
 * Google Sheets review queue (brief 4.2) — the mobile-friendly review UI.
 *
 * Auth is a service account (no OAuth consent screen, no refresh-token dance).
 * Share the sheet with the service account address as an Editor.
 *
 * Row 1 must be the header row, in this order:
 */
export const COLUMNS = [
  'ID',
  'Date',
  'Format Used',
  'Chinese Title',
  'English Title',
  'Chinese Content',
  'English Summary',
  'Suggested Image Prompt',
  'Source Citation',
  'Status',
  'Approved By',
  'Approved At',
  'Published Links',
  'Notes',
];

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken({ serviceAccountEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: serviceAccountEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(privateKey, 'base64url');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange ${response.status}: ${await response.text()}`);
  }
  return (await response.json()).access_token;
}

export function recordToRow(record) {
  return [
    record.id ?? '',
    record.date ?? '',
    record.format ?? '',
    record.titleZh ?? '',
    record.titleEn ?? '',
    record.contentZh ?? '',
    record.summaryEn ?? '',
    record.imagePrompt ?? '',
    record.sourceCitation ?? '',
    record.status ?? '',
    record.approvedBy ?? '',
    record.approvedAt ?? '',
    (record.publishedLinks || []).join('\n'),
    record.notes ?? '',
  ];
}

export function rowToRecord(row) {
  const cell = (index) => (row[index] ?? '').toString().trim();
  return {
    id: cell(0),
    date: cell(1),
    format: cell(2),
    titleZh: cell(3),
    titleEn: cell(4),
    contentZh: row[5] ?? '',
    summaryEn: row[6] ?? '',
    imagePrompt: cell(7),
    sourceCitation: cell(8),
    status: cell(9),
    approvedBy: cell(10),
    approvedAt: cell(11),
    publishedLinks: cell(12) ? cell(12).split('\n').filter(Boolean) : [],
    notes: cell(13),
  };
}

export function createSheetsQueue({ spreadsheetId, tabName, serviceAccountEmail, privateKey }) {
  if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
    throw new Error(
      'Sheets queue needs SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.',
    );
  }

  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  let tokenCache = { token: null, expiresAt: 0 };

  async function authHeaders() {
    if (!tokenCache.token || Date.now() > tokenCache.expiresAt) {
      tokenCache = {
        token: await getAccessToken({ serviceAccountEmail, privateKey }),
        expiresAt: Date.now() + 50 * 60 * 1000,
      };
    }
    return { authorization: `Bearer ${tokenCache.token}`, 'content-type': 'application/json' };
  }

  async function call(path, init = {}) {
    const response = await fetch(`${base}${path}`, { ...init, headers: await authHeaders() });
    if (!response.ok) {
      throw new Error(`Sheets API ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }

  const range = (suffix) => encodeURIComponent(`${tabName}!${suffix}`);

  async function listRows() {
    const data = await call(`/values/${range('A2:N')}`);
    return data.values || [];
  }

  return {
    name: 'sheets',

    async listRecords() {
      return (await listRows()).map(rowToRecord).filter((record) => record.id);
    },

    async appendRecord(record) {
      assertAutomationWritable(record.status);
      await call(`/values/${range('A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        body: JSON.stringify({ values: [recordToRow(record)] }),
      });
      return record;
    },

    async updateRecord(id, patch) {
      if (patch.status) assertAutomationWritable(patch.status);
      const rows = await listRows();
      const index = rows.findIndex((row) => (row[0] ?? '').toString().trim() === id);
      if (index === -1) throw new Error(`No queue row with id ${id}`);
      const updated = { ...rowToRecord(rows[index]), ...patch };
      const rowNumber = index + 2; // header row + 1-based indexing
      await call(`/values/${range(`A${rowNumber}:N${rowNumber}`)}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [recordToRow(updated)] }),
      });
      return updated;
    },
  };
}
