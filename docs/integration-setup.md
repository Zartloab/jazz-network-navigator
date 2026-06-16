# Integration Setup

All credentials belong in `.env.local` and must never be exposed to client code.

## Airtable

1. Create a base with `Workspace`, `Acts`, `Campaigns`, `Assets`, `Contacts`,
   and `Opportunities`.
2. Add an `External ID` single-line text field to every table.
3. Add fields matching the names sent by `app/api/airtable/sync/route.ts`.
4. Create a scoped personal access token with record read/write access.
5. Set `AIRTABLE_PERSONAL_ACCESS_TOKEN` and `AIRTABLE_BASE_ID`.
6. Open Settings → Backups & automation and select **Sync operational data**.

Sync uses Airtable upsert behavior and batches a maximum of ten records per
request. The `Workspace` table also needs a long-text `Snapshot` field. That
snapshot restores acts, campaigns, assets, and opportunities on another browser.
The Contacts table receives operational fields only; private raw notes and
unapproved drafts are excluded.

## Make and Gmail

1. Create a Make custom webhook and set `MAKE_WEBHOOK_URL`.
2. Route `action = create_gmail_draft` to Gmail's Create a Draft module.
3. Map subject and body fields.
4. Do not add a Send Email module.
5. Return the Gmail draft ID in a JSON `draftId` field where possible.

The app calls this workflow only after a draft has been explicitly approved.

## Google Calendar

1. Connect Google Calendar in the same Make scenario or a routed scenario.
2. Set `GOOGLE_CALENDAR_ID`.
3. Route `action = upsert_calendar_events` to calendar create/update modules.
4. Store the supplied idempotency key so retries update rather than duplicate.
5. Sync only records whose route status is Confirmed.

## OpenAI

Set `OPENAI_API_KEY`, optionally set `OPENAI_MODEL`, and keep
`OPENAI_MONTHLY_BUDGET_USD=10` for the private beta. The app keeps a seven-day
cache and a local server-side usage ledger under `.private/`.
