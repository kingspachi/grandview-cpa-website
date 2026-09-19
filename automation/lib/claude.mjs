import { config } from '../config.mjs';

const API_URL = 'https://api.anthropic.com/v1/messages';
const REQUIRED_FIELDS = [
  'title_zh',
  'title_en',
  'content_zh',
  'summary_en',
  'image_prompt',
  'source_citation',
];

/**
 * Pull the JSON object out of a model response that may be wrapped in prose
 * or a fenced code block.
 *
 * @param {string} text
 */
export function parseArticle(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Model response contained no JSON object');
  }

  const article = JSON.parse(candidate.slice(start, end + 1));
  const missing = REQUIRED_FIELDS.filter((field) => typeof article[field] !== 'string');
  if (missing.length > 0) {
    throw new Error(`Model response missing fields: ${missing.join(', ')}`);
  }
  if (!article.content_zh.trim() || !article.summary_en.trim()) {
    throw new Error('Model response has empty bilingual content');
  }
  return article;
}

/**
 * Generate one article.
 *
 * @param {{contentRules: string, format: string, date: string, recentTitles?: string[]}} input
 */
export async function generateArticle({ contentRules, format, date, recentTitles = [] }) {
  const avoid = recentTitles.length
    ? `\n\nDo not repeat these recent topics:\n${recentTitles.map((t) => `- ${t}`).join('\n')}`
    : '';

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.claude.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.claude.model,
      max_tokens: config.claude.maxTokens,
      system: contentRules,
      messages: [
        {
          role: 'user',
          content:
            `Write today's article (${date}) using the "${format}" format.` +
            ` Follow every rule in the system prompt. Return only the JSON object.${avoid}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const text = (body.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return parseArticle(text);
}
