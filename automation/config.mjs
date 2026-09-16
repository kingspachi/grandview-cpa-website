/**
 * Central configuration + feature flags.
 *
 * Phased rollout (see brief section 8). Each channel is off by default; the
 * client turns one on only after the previous phase has been running cleanly.
 */

function bool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function required(name) {
  const raw = process.env[name];
  if (!raw) throw new Error(`Missing required environment variable: ${name}`);
  return raw;
}

export const config = {
  timezone: process.env.CONTENT_TIMEZONE || 'America/Los_Angeles',

  claude: {
    get apiKey() {
      return required('ANTHROPIC_API_KEY');
    },
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    maxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 4096),
  },

  queue: {
    // 'json'   - local/committed JSON file, zero external accounts (default)
    // 'sheets' - Google Sheets, mobile-friendly review UI (brief 4.2)
    driver: process.env.QUEUE_DRIVER || 'json',
    jsonPath: process.env.QUEUE_JSON_PATH || 'automation/data/queue.json',
    sheets: {
      spreadsheetId: process.env.SHEETS_SPREADSHEET_ID,
      tabName: process.env.SHEETS_TAB_NAME || 'Content Queue',
      serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
  },

  site: {
    baseUrl: (process.env.SITE_BASE_URL || 'https://cga-lau.com').replace(/\/$/, ''),
    blogPath: process.env.SITE_BLOG_PATH || '/blog',
    companyName: 'Grandview Professional Corp.',
  },

  channels: {
    blog: bool('PUBLISH_BLOG'), // phase 2
    facebook: bool('PUBLISH_FACEBOOK'), // phase 3
    linkedin: bool('PUBLISH_LINKEDIN'), // phase 4
  },

  ftp: {
    host: process.env.FTP_HOST,
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    secure: bool('FTP_SECURE', true), // FTPS; set false only if the plan lacks it
    remoteDir: process.env.FTP_REMOTE_DIR || '/blog',
  },

  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    graphVersion: process.env.FACEBOOK_GRAPH_VERSION || 'v21.0',
  },

  linkedin: {
    organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
  },

  auditLogPath: process.env.AUDIT_LOG_PATH || 'automation/data/audit-log.jsonl',
};

export { bool, required };
