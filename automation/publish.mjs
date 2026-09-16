#!/usr/bin/env node
/**
 * Steps 5-7 of the pipeline: publish records a human has approved.
 *
 * Every record passes through assertApproved() before a single byte leaves
 * this process. A record that is Pending Review, Needs Edit or Rejected is
 * skipped — there is no timeout, no fallback, no "publish anyway" flag.
 *
 * Usage: node automation/publish.mjs [--dry-run] [--id <record id>]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.mjs';
import { audit } from './lib/audit.mjs';
import { publishToBlog } from './lib/publish/ftp.mjs';
import { publishToFacebook } from './lib/publish/facebook.mjs';
import { publishToLinkedIn } from './lib/publish/linkedin.mjs';
import { createQueue, assertApproved, ApprovalError, STATUS } from './lib/queue/index.mjs';
import { postFileName, postUrl, renderIndex, renderPost } from './lib/render/html.mjs';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** Render to ./automation/data/preview instead of uploading or posting. */
async function dryRun(record, publishedRecords) {
  const dir = 'automation/data/preview';
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, postFileName(record)), renderPost(record), 'utf8');
  await writeFile(join(dir, 'index.html'), renderIndex([...publishedRecords, record]), 'utf8');
  console.log(`  dry run: wrote ${join(dir, postFileName(record))}`);
  return postUrl(record);
}

async function publishRecord(record, publishedRecords, { isDryRun }) {
  assertApproved(record);
  await audit('approval-verified', {
    id: record.id,
    date: record.date,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
  });

  const links = [];
  let blogUrl = postUrl(record);

  if (isDryRun) {
    blogUrl = await dryRun(record, publishedRecords);
    links.push(blogUrl);
    return links;
  }

  if (config.channels.blog) {
    blogUrl = await publishToBlog(record, publishedRecords);
    links.push(blogUrl);
    await audit('published', { id: record.id, channel: 'blog', url: blogUrl });
  }

  if (config.channels.facebook) {
    const url = await publishToFacebook(record, blogUrl);
    links.push(url);
    await audit('published', { id: record.id, channel: 'facebook', url });
  }

  if (config.channels.linkedin) {
    const url = await publishToLinkedIn(record, blogUrl);
    links.push(url);
    await audit('published', { id: record.id, channel: 'linkedin', url });
  }

  return links;
}

export async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const onlyId = arg('id');
  const queue = createQueue();
  const records = await queue.listRecords();

  const published = records.filter((record) => record.status === STATUS.PUBLISHED);
  const approved = records.filter(
    (record) => record.status === STATUS.APPROVED && (!onlyId || record.id === onlyId),
  );

  if (approved.length === 0) {
    console.log('Nothing approved. Nothing published.');
    return [];
  }

  if (!isDryRun && !Object.values(config.channels).some(Boolean)) {
    console.log(
      `${approved.length} record(s) approved, but every channel is disabled ` +
        '(PUBLISH_BLOG / PUBLISH_FACEBOOK / PUBLISH_LINKEDIN). Phase 1: publish by hand.',
    );
    return [];
  }

  const results = [];
  for (const record of approved) {
    console.log(`Publishing ${record.id} (${record.date}, ${record.format})...`);
    try {
      const links = await publishRecord(record, published, { isDryRun });
      if (!isDryRun) {
        await queue.updateRecord(record.id, {
          status: STATUS.PUBLISHED,
          publishedLinks: links,
        });
        published.push({ ...record, status: STATUS.PUBLISHED });
      }
      results.push({ id: record.id, links });
      console.log(`  ${links.join('\n  ')}`);
    } catch (error) {
      const reason = error instanceof ApprovalError ? 'approval gate' : 'publish error';
      console.error(`  ${reason}: ${error.message}`);
      await audit('publish-failed', { id: record.id, reason, message: error.message });
      if (!isDryRun && !(error instanceof ApprovalError)) {
        await queue.updateRecord(record.id, { status: STATUS.FAILED, notes: error.message });
      }
      process.exitCode = 1;
    }
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
