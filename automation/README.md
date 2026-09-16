# Daily content automation

Generates a daily bilingual (Traditional Chinese / English) article with the
Claude API, files it in a review queue, and — only after a human marks it
**Approved** — publishes it to the blog, Facebook and LinkedIn.

```
generate.mjs ──► review queue (Pending Review)
                      │
                      │  ← a person approves, on their phone
                      ▼
publish.mjs  ──► blog (FTP) + Facebook + LinkedIn ──► queue (Published + links)
```

## The approval gate

This is the one rule the code is built around (brief §6).

- `generate.mjs` can only ever write **Pending Review**.
- Both queue drivers refuse a write of **Approved** — `assertAutomationWritable`
  throws. Only a human editing the sheet can set it.
- `publish.mjs` runs `assertApproved` on every record before anything leaves
  the process. It requires `Approved` **and** a non-empty `Approved By` /
  `Approved At`, so a publish is always traceable to a person.
- There is no timeout, no auto-approve, no override flag. An unreviewed article
  is simply never published.

`automation/test/approval.test.mjs` is the regression test for all of that.

## Commands

```bash
npm test                  # unit tests, no credentials needed
npm run content:generate  # generate today's draft into the queue
npm run content:preview   # render approved records to automation/data/preview/
npm run content:publish   # publish approved records to the enabled channels
```

Both entrypoints are idempotent: `generate` skips a date that already has a
record (`--force` to override), and `publish` only looks at `Approved` rows, so
running the poll hourly is safe.

## Setup

1. `cp .env.example .env.local` and fill in what the current phase needs.
2. Replace `automation/prompts/content-rules.md` with the client's content-rules
   document. It is sent to the model **verbatim and in full** — the loader
   refuses to run while the placeholder sentinel is still in the file, so a
   half-configured pipeline cannot produce off-voice content.
3. Smoke test with `QUEUE_DRIVER=json` before pointing at the real sheet.

### Review queue (Google Sheets)

Create a sheet with this header row in row 1, in this order:

`ID | Date | Format Used | Chinese Title | English Title | Chinese Content |
English Summary | Suggested Image Prompt | Source Citation | Status |
Approved By | Approved At | Published Links | Notes`

Then create a Google Cloud service account, enable the Sheets API, and share
the sheet with the service account address as an **Editor**.

Reviewing on a phone: open the row in the Google Sheets app, read the Chinese
content, set **Status** to `Approved` and type your email into **Approved By**
and the time into **Approved At**. Anything other than `Approved` — `Needs
Edit`, `Rejected`, or leaving it alone — means it never publishes.

> Set **Approved By** and **Approved At** with a sheet-side `onEdit` script if
> you want them filled automatically; the automation deliberately will not fill
> them for you, because they are the audit record of who approved what.

## Rollout phases

Each channel is a separate switch, off by default (brief §8). Turn on one, let
it run for a week, then turn on the next.

| Phase | Switch | What it does |
| --- | --- | --- |
| 1 | *(none)* | Generate + queue only. Client publishes by hand. |
| 2 | `PUBLISH_BLOG=true` | Uploads the post over FTPS to Netfirms and rebuilds `/blog/index.html`. |
| 3 | `PUBLISH_FACEBOOK=true` | Posts the bilingual teaser + link to the Page. |
| 4 | `PUBLISH_LINKEDIN=true` | Same to the Company Page, once the API app is approved. |

With every switch off, `publish.mjs` says so and does nothing — that is phase 1
working as designed, not a failure.

## Scheduling

`.github/workflows/daily-content.yml` runs generation at 07:00 PT and polls for
approvals hourly, which needs no server and no n8n licence. It is the cheapest
option for a three-person firm with no IT staff (brief §7.1); n8n or Make can
call the same two scripts later if the client wants a visual editor.

Note the cron is fixed UTC, so the generation run lands at 07:00 PDT and 06:00
PST. `CONTENT_TIMEZONE` keeps the record's *date* correct either way.

## Audit trail

Every generation, approval check, publish and failure appends a JSON line to
`automation/data/audit-log.jsonl` (also uploaded as a 90-day workflow
artifact). The `approval-verified` event records who approved the record and
when, immediately before it goes live.

## Open items from the brief (§7)

- **Netfirms**: confirm FTP/FTPS is on the plan and note any upload rate limit.
  `FTP_SECURE=false` falls back to plain FTP if FTPS is unavailable — avoid it,
  the password crosses the wire in clear text.
- **LinkedIn**: API review is slower than Facebook's. Phase 4 stays off until
  it clears; the client posts to LinkedIn by hand from the approved row.
- **Images**: not automated. The queue carries a `Suggested Image Prompt` for a
  human to act on; no image is attached to any post yet.
