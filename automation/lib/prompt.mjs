import { readFile } from 'node:fs/promises';

const SENTINEL = 'PLACEHOLDER-CONTENT-RULES';
const DEFAULT_PATH = 'automation/prompts/content-rules.md';

/**
 * Load the content-rules prompt verbatim (brief 6: "automation must not
 * bypass or truncate these instructions").
 *
 * @param {string} [path]
 * @returns {Promise<string>}
 */
export async function loadContentRules(path = process.env.CONTENT_RULES_PATH || DEFAULT_PATH) {
  const text = await readFile(path, 'utf8');
  if (text.includes(SENTINEL) && process.env.ALLOW_PLACEHOLDER_PROMPT !== '1') {
    throw new Error(
      `${path} is still the placeholder prompt. Replace it with the client's ` +
        'content-rules document, or set ALLOW_PLACEHOLDER_PROMPT=1 to run a smoke test.',
    );
  }
  return text;
}
