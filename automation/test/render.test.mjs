import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseArticle } from '../lib/claude.mjs';
import { buildMessage } from '../lib/publish/facebook.mjs';
import { escapeHtml, postFileName, renderIndex, renderPost } from '../lib/render/html.mjs';

const record = {
  id: 'r1',
  date: '2026-09-16',
  format: 'Myth-busting',
  titleZh: '關於 GST/HST 的迷思',
  titleEn: 'GST/HST myths',
  contentZh: '第一段內容\n\n第二段內容',
  summaryEn: 'Two myths about GST/HST registration.',
  sourceCitation: 'CRA — https://canada.ca/example',
};

test('a rendered post keeps both languages', () => {
  const html = renderPost(record);
  assert.match(html, /關於 GST\/HST 的迷思/);
  assert.match(html, /Two myths about GST\/HST registration\./);
  assert.match(html, /第一段內容/);
  assert.match(html, /第二段內容/);
});

test('a rendered post carries the source citation and the disclaimer', () => {
  const html = renderPost(record);
  assert.match(html, /canada\.ca\/example/);
  assert.match(html, /not professional advice/);
});

test('a post without a citation omits the source block', () => {
  assert.doesNotMatch(renderPost({ ...record, sourceCitation: '' }), /Source:/);
});

test('user content is escaped, not injected', () => {
  const html = renderPost({ ...record, titleZh: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(escapeHtml('a & "b"'), 'a &amp; &quot;b&quot;');
});

test('file names are date-prefixed and ascii-safe', () => {
  assert.equal(postFileName(record), '2026-09-16-gst-hst-myths.html');
  assert.equal(postFileName({ date: '2026-09-16', titleEn: '' }), '2026-09-16.html');
});

test('the index lists posts newest first', () => {
  const html = renderIndex([
    { ...record, date: '2026-09-10', titleZh: '舊文' },
    { ...record, date: '2026-09-16', titleZh: '新文' },
  ]);
  assert.ok(html.indexOf('新文') < html.indexOf('舊文'));
});

test('the social teaser is bilingual and links back to the blog', () => {
  const message = buildMessage(record, 'https://cga-lau.com/blog/a.html');
  assert.match(message, /關於 GST\/HST 的迷思/);
  assert.match(message, /Two myths/);
  assert.match(message, /https:\/\/cga-lau\.com\/blog\/a\.html/);
});

test('a very long summary is truncated for social, not the blog', () => {
  const long = 'x'.repeat(900);
  assert.ok(buildMessage({ ...record, summaryEn: long }, 'u').includes('...'));
  assert.match(renderPost({ ...record, summaryEn: long }), /x{900}/);
});

test('model output is parsed out of a fenced code block', () => {
  const article = parseArticle(
    'Here you go:\n```json\n' +
      JSON.stringify({
        title_zh: '標題',
        title_en: 'Title',
        content_zh: '內容',
        summary_en: 'Summary',
        image_prompt: 'prompt',
        source_citation: '',
      }) +
      '\n```',
  );
  assert.equal(article.title_en, 'Title');
});

test('incomplete model output is rejected', () => {
  assert.throws(() => parseArticle('no json here'), /no JSON object/);
  assert.throws(() => parseArticle('{"title_zh":"a"}'), /missing fields/);
});
