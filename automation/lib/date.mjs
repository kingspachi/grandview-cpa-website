/**
 * YYYY-MM-DD in the configured timezone, so a 07:00 PT run is never filed
 * under the previous or next day because the runner is on UTC.
 *
 * @param {string} timeZone
 * @param {Date} [now]
 */
export function today(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
