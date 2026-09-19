import { config } from '../../config.mjs';
import { buildMessage } from './facebook.mjs';

const API_URL = 'https://api.linkedin.com/rest/posts';
const VERSION = '202409';

/**
 * Post to the LinkedIn Company Page (brief 4.5).
 *
 * LinkedIn's API access review takes longer than Facebook's, so this channel
 * stays behind PUBLISH_LINKEDIN until the app is approved; until then the
 * client posts to LinkedIn by hand from the approved queue row.
 *
 * @param {object} record
 * @param {string} blogUrl
 */
export async function publishToLinkedIn(record, blogUrl) {
  const { organizationId, accessToken } = config.linkedin;
  if (!organizationId || !accessToken) {
    throw new Error('LinkedIn publishing needs LINKEDIN_ORGANIZATION_ID and LINKEDIN_ACCESS_TOKEN.');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'LinkedIn-Version': VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:organization:${organizationId}`,
      commentary: buildMessage(record, blogUrl),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED' },
      content: {
        article: {
          source: blogUrl,
          title: String(record.titleEn || record.titleZh).slice(0, 200),
          description: String(record.summaryEn || '').slice(0, 256),
        },
      },
      lifecycleState: 'PUBLISHED',
    }),
  });

  if (!response.ok) {
    throw new Error(`LinkedIn API ${response.status}: ${await response.text()}`);
  }

  const postId = response.headers.get('x-restli-id');
  return postId ? `https://www.linkedin.com/feed/update/${postId}` : 'posted';
}
