/**
 * Content format rotation (brief 4.1).
 *
 * The daily article cycles through five formats. The "last format used" is
 * derived from the queue itself so the state survives a lost container, a
 * re-run, or a switch of automation platform.
 */

export const FORMATS = [
  'Mistake-to-Avoid',
  'Myth-busting',
  'Anonymized Client Story',
  'Checklist',
  'Deadline Reminder',
];

/**
 * @param {string|null|undefined} lastFormat the format of the most recent record
 * @returns {string} the format to use for the next article
 */
export function nextFormat(lastFormat) {
  const index = FORMATS.indexOf(lastFormat);
  if (index === -1) return FORMATS[0];
  return FORMATS[(index + 1) % FORMATS.length];
}

/**
 * Pick the next format from a queue's records. Records may arrive in any
 * order, so the most recent one is chosen by date, falling back to insertion
 * order for same-day records.
 *
 * @param {Array<{date?: string, format?: string}>} records
 */
export function nextFormatFromRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return FORMATS[0];
  const sorted = [...records]
    .map((record, position) => ({ record, position }))
    .sort((a, b) => {
      const dateDiff = String(a.record.date || '').localeCompare(String(b.record.date || ''));
      return dateDiff !== 0 ? dateDiff : a.position - b.position;
    });
  return nextFormat(sorted[sorted.length - 1].record.format);
}
