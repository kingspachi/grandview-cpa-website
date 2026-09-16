import { config } from '../../config.mjs';

const BRAND = {
  green: '#14432a',
  greenLight: '#1d5c3a',
  gold: '#c8a24a',
  paper: '#fbfaf7',
  ink: '#23241f',
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Slug for the published file name: the date plus a transliteration-free
 * fallback, since Chinese titles do not produce useful ASCII slugs.
 */
export function postSlug(record) {
  const ascii = String(record.titleEn || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return ascii ? `${record.date}-${ascii}` : String(record.date);
}

export function postFileName(record) {
  return `${postSlug(record)}.html`;
}

export function postUrl(record) {
  return `${config.site.baseUrl}${config.site.blogPath}/${postFileName(record)}`;
}

/** Minimal markdown-ish paragraph rendering: blank lines separate paragraphs. */
function paragraphs(text) {
  return String(text ?? '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `      <p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

function layout({ title, description, lang, body }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <style>
      :root {
        --green: ${BRAND.green};
        --green-light: ${BRAND.greenLight};
        --gold: ${BRAND.gold};
        --paper: ${BRAND.paper};
        --ink: ${BRAND.ink};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font: 16px/1.75 "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
      }
      header {
        background: var(--green);
        color: #fff;
        padding: 20px 16px;
      }
      header .inner, main, footer .inner { max-width: 720px; margin: 0 auto; }
      header a { color: #fff; text-decoration: none; }
      header .brand { font-size: 18px; font-weight: 700; letter-spacing: 0.02em; }
      header nav { margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; }
      header nav a { border-bottom: 2px solid transparent; padding-bottom: 2px; }
      header nav a:hover { border-bottom-color: var(--gold); }
      main { padding: 32px 16px 56px; }
      h1 { color: var(--green); font-size: 28px; line-height: 1.35; margin: 0 0 4px; }
      h2 { color: var(--green-light); font-size: 20px; margin: 40px 0 8px; }
      .meta { color: #6b6f68; font-size: 14px; margin-bottom: 28px; }
      .rule { height: 3px; background: var(--gold); width: 64px; margin: 0 0 28px; }
      .en { border-top: 1px solid #e2ded3; margin-top: 40px; padding-top: 8px; }
      .source { background: #fff; border-left: 3px solid var(--gold); padding: 12px 16px; font-size: 14px; }
      .source a { color: var(--green-light); }
      .disclaimer { color: #6b6f68; font-size: 13px; margin-top: 40px; }
      footer { background: var(--green); color: #d8dfd8; font-size: 13px; padding: 24px 16px; }
      ul.posts { list-style: none; padding: 0; }
      ul.posts li { border-bottom: 1px solid #e2ded3; padding: 16px 0; }
      ul.posts a { color: var(--green); font-size: 18px; font-weight: 600; text-decoration: none; }
      ul.posts a:hover { color: var(--gold); }
      ul.posts .sub { color: #6b6f68; font-size: 14px; }
      @media (min-width: 640px) { h1 { font-size: 34px; } }
    </style>
  </head>
  <body>
    <header>
      <div class="inner">
        <div class="brand"><a href="${config.site.baseUrl}/">${escapeHtml(config.site.companyName)}</a></div>
        <nav>
          <a href="${config.site.baseUrl}/">首頁 / Home</a>
          <a href="${config.site.baseUrl}${config.site.blogPath}/">稅務資訊 / Blog</a>
          <a href="${config.site.baseUrl}/contact.html">聯絡我們 / Contact</a>
        </nav>
      </div>
    </header>
    <main>
${body}
    </main>
    <footer>
      <div class="inner">© ${new Date().getFullYear()} ${escapeHtml(config.site.companyName)}</div>
    </footer>
  </body>
</html>
`;
}

/**
 * Render one bilingual blog post. Both languages are always emitted — the
 * brief forbids stripping either side (section 6).
 */
export function renderPost(record) {
  const source = record.sourceCitation
    ? `      <p class="source">資料來源 / Source: ${escapeHtml(record.sourceCitation)}</p>\n`
    : '';

  const body = `      <h1>${escapeHtml(record.titleZh)}</h1>
      <p class="meta">${escapeHtml(record.date)} · ${escapeHtml(record.format)}</p>
      <div class="rule"></div>
${paragraphs(record.contentZh)}
${source}      <section class="en">
        <h2>${escapeHtml(record.titleEn || 'In English')}</h2>
${paragraphs(record.summaryEn)}
      </section>
      <p class="disclaimer">本文僅供一般參考，不構成專業意見。請就個別情況聯絡我們。<br />
      This article is general information only and is not professional advice. Please contact us about your own situation.</p>`;

  return layout({
    title: `${record.titleZh} | ${config.site.companyName}`,
    description: String(record.summaryEn || '').slice(0, 160),
    lang: 'zh-Hant',
    body,
  });
}

/**
 * Render the blog index from every published record, newest first.
 *
 * @param {Array<object>} records
 */
export function renderIndex(records) {
  const items = [...records]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(
      (record) => `          <li>
            <a href="${escapeHtml(postFileName(record))}">${escapeHtml(record.titleZh)}</a>
            <div class="sub">${escapeHtml(record.date)} · ${escapeHtml(record.titleEn || '')}</div>
          </li>`,
    )
    .join('\n');

  const body = `      <h1>稅務資訊 / Tax Insights</h1>
      <div class="rule"></div>
      <ul class="posts">
${items}
      </ul>`;

  return layout({
    title: `稅務資訊 / Tax Insights | ${config.site.companyName}`,
    description: 'Bilingual Canadian tax and accounting insights from Grandview Professional Corp.',
    lang: 'zh-Hant',
    body,
  });
}
