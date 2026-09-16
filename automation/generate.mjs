#!/usr/bin/env node
/**
 * Steps 1-3 of the pipeline: generate today's article and file it in the
 * review queue as "Pending Review".
 *
 * This script can never publish and can never approve.
 *
 * Usage: node automation/generate.mjs [--force] [--date YYYY-MM-DD]
 */
import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';
import { audit } from './lib/audit.mjs';
import { generateArticle } from './lib/claude.mjs';
import { today } from './lib/date.mjs';
import { loadContentRules } from './lib/prompt.mjs';
import { createQueue, STATUS } from './lib/queue/index.mjs';
import { nextFormatFromRecords } from './lib/rotation.mjs';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function main() {
  const force = process.argv.includes('--force');
  const date = arg('date') || today(config.timezone);
  const queue = createQueue();
  const records = await queue.listRecords();

  if (!force && records.some((record) => record.date === date)) {
    console.log(`A record already exists for ${date}. Nothing to do (use --force to add another).`);
    return null;
  }

  const format = nextFormatFromRecords(records);
  const contentRules = await loadContentRules();
  const recentTitles = records.slice(-10).map((record) => record.titleEn || record.titleZh);

  console.log(`Generating ${date} article in "${format}" format with ${config.claude.model}...`);
  const article = await generateArticle({ contentRules, format, date, recentTitles });

  const record = {
    id: randomUUID(),
    date,
    format,
    titleZh: article.title_zh,
    titleEn: article.title_en,
    contentZh: article.content_zh,
    summaryEn: article.summary_en,
    imagePrompt: article.image_prompt,
    sourceCitation: article.source_citation,
    status: STATUS.PENDING,
    approvedBy: '',
    approvedAt: '',
    publishedLinks: [],
    notes: '',
  };

  await queue.appendRecord(record);
  await audit('generated', {
    id: record.id,
    date,
    format,
    model: config.claude.model,
    queue: queue.name,
  });

  console.log(`Queued ${record.id} for review — status "${record.status}".`);
  return record;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
