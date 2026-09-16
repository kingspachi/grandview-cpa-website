import { config } from '../../config.mjs';
import { createJsonQueue } from './json.mjs';
import { createSheetsQueue } from './sheets.mjs';

export function createQueue(driver = config.queue.driver) {
  switch (driver) {
    case 'json':
      return createJsonQueue({ path: config.queue.jsonPath });
    case 'sheets':
      return createSheetsQueue(config.queue.sheets);
    default:
      throw new Error(`Unknown QUEUE_DRIVER "${driver}" (expected "json" or "sheets")`);
  }
}

export * from './status.mjs';
