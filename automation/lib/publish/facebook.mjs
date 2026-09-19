import { config } from '../../config.mjs';

/**
 * Post to the Facebook Page (brief 4.4).
 *
 * Needs a long-lived Page Access Token with pages_manage_posts.
 *
 * @param {object} record
 * @param {string} blogUrl
 */
export async function publishToFacebook(record, blogUrl) {
  const { pageId, accessToken, graphVersion } = config.facebook;
  if (!pageId || !accessToken) {
    throw new Error('Facebook publishing needs FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.');
  }

  const message = buildMessage(record, blogUrl);
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, link: blogUrl, access_token: accessToken }),
  });

  if (!response.ok) {
    throw new Error(`Facebook Graph API ${response.status}: ${await response.text()}`);
  }

  const { id } = await response.json();
  return `https://www.facebook.com/${id}`;
}

/** Bilingual teaser: Chinese title, English summary, link back to the post. */
export function buildMessage(record, blogUrl) {
  const summary = String(record.summaryEn || '').trim();
  const teaser = summary.length > 600 ? `${summary.slice(0, 597)}...` : summary;
  return [record.titleZh, '', teaser, '', `全文 / Read more: ${blogUrl}`].join('\n');
}
