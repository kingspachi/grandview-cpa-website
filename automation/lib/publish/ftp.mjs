import { Client } from 'basic-ftp';
import { Readable } from 'node:stream';
import { config } from '../../config.mjs';
import { postFileName, postUrl, renderIndex, renderPost } from '../render/html.mjs';

function upload(client, remoteName, html) {
  return client.uploadFrom(Readable.from([Buffer.from(html, 'utf8')]), remoteName);
}

/**
 * Publish the post to Netfirms over FTPS and refresh the blog index.
 *
 * Netfirms has no REST API, so FTP is the only integration path (brief 4.3).
 *
 * @param {object} record the approved record being published
 * @param {Array<object>} publishedRecords every record already live, for the index
 */
export async function publishToBlog(record, publishedRecords) {
  const { host, user, password, secure, remoteDir } = config.ftp;
  if (!host || !user || !password) {
    throw new Error('Blog publishing needs FTP_HOST, FTP_USER and FTP_PASSWORD.');
  }

  const client = new Client(30_000);
  try {
    await client.access({ host, user, password, secure });
    await client.ensureDir(remoteDir);
    await upload(client, postFileName(record), renderPost(record));
    await upload(client, 'index.html', renderIndex([...publishedRecords, record]));
  } finally {
    client.close();
  }

  return postUrl(record);
}
