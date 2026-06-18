# Hamed Artist Manager

A private, campaign-based artist management beta for Hamed Sadeghi. It brings
tours, releases, bookings, commissions, relationships, opportunities, materials,
drafts, deadlines, and commercial outcomes into one focused workspace.

The interface is organised around six familiar jobs: **Today**, **Deals**,
**Campaigns**, **People**, **Pitch Room**, and **Setup**. Related tools live
inside those workspaces as simple tabs or secondary actions, so users see one
task at a time. Hover or focus the help icons for plain-language guidance.

## Hamed-first portfolio

The beta starts with editable, website-sourced profiles for:

- Eishan Ensemble
- Hamed Sadeghi Solo
- Vazesh
- Empty Voices
- Screen and Stage composition

It also offers six suggested campaigns, including the Eishan Europe Tour 2026,
Northern Rhapsody, solo recital bookings, Vazesh festival bookings, composer
commissions, and Empty Voices presenter/funding development.

Public website information is labelled as unconfirmed until Hamed reviews it in
**Setup → Portfolio & assets**. The app never treats a public tour statement
as a confirmed booking.

## Features

- Interactive relationship radar map with temperature and category filters
- Prioritised weekly follow-up queue
- Opportunity-stage kanban
- Searchable and editable contact directory
- LocalStorage persistence, reset, add-contact, and JSON/CSV export
- Full workspace backup and restore for local projects, commercial data, relationship history, and drafts
- Local network question answering without an API key
- Email draft generation with local templates
- Optional OpenAI-powered network answers and email drafts
- AI Tour Builder with contact recommendations, outreach drafts, CRM stages, and follow-up reminders
- Opportunity Scout with network signals, optional live web research, source links, and saved decisions
- Reusable Artist Profile for consistent pitches, drafts, links, and tour details
- Pitch Room for booking, festival, press, release, and collaboration pitch packs
- Today brief that combines deals, follow-ups, active opportunities, relationship gaps, and profile setup
- Today manager plan that recommends the next booking moves, deal follow-ups, route gaps, and pitch blockers
- First-class Deals pipeline for leads, pitch-ready opportunities, contacted prospects, follow-ups, interest, negotiation, confirmation, and passed work
- Booking Money summary for confirmed income, projected income, open deal value, follow-ups due, and route gaps
- Pitch readiness checks on every deal before outreach is drafted
- Campaign portfolio for tours, releases, bookings, commissions, and funding
- Separate act profiles so Eishan, Vazesh, solo, orchestral, and screen/stage work use the correct facts
- Campaign route windows with Confirmed, Tentative, and Available states
- Campaign-specific opportunity ranking and creative drafts
- Website-source provenance and explicit factual confirmation
- Project task desks with due dates, progress, linked contacts, and linked opportunities
- Booking and deal ledger with offer, negotiation, confirmation, payment, and lost statuses
- Project budget and break-even forecast for planned, committed, and paid costs
- Contact activity history for relationship changes, follow-ups, project links, enrichment, and notes
- Combined project calendar for tasks, project dates, follow-ups, and opportunity deadlines
- Universal workspace search for navigation, projects, contacts, and opportunities with `Cmd/Ctrl + K`
- Data Readiness dashboard with contactability metrics and a prioritised enrichment queue
- In-app notifications for due follow-ups, strong opportunities, and relationships missing a next date
- Make.com automation blueprint and enrichment simulation

## Contact enrichment

The detailed process for cleaning, verifying, enriching, reviewing, and safely
activating contact records is documented in
[Contact enrichment process](docs/contact-enrichment-process.md).

The living backlog for future manager-focused modules is documented in
[Module ideation backlog](docs/module-ideation-backlog.md). Refresh it after
each shipped module so the next sprint stays tied to real workflow gaps.

Open **Setup** to see **Contact Data Readiness**. It measures
verified email-route coverage, location coverage, clear next actions, and
follow-up scheduling for active relationships. The queue recommends the
highest-value missing detail to fix for up to six contacts and opens the
selected contact directly.

The app never guesses an email address. Users should add only verified public
details or relationship information they can confirm.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Encrypted seed data

The repository contains only an AES-256-GCM encrypted contact bundle:

```text
data/jazz_network_seed_contacts.encrypted.json
```

On first load, the app asks for a separately shared passphrase and decrypts the
contacts inside the browser. The passphrase is not stored in GitHub. Decrypted
contacts persist in that browser's localStorage until **Reset demo data** is used.

To regenerate the encrypted bundle from a local source file:

```bash
node scripts/encrypt-seed.mjs path/to/contacts.json data/jazz_network_seed_contacts.encrypted.json path/to/passphrase.txt
```

## Optional OpenAI integration

Create `.env.local`:

```bash
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-5.5
OPENAI_MONTHLY_BUDGET_USD=10
```

Without an API key, the app uses its built-in search, enrichment, and email-generation heuristics.

When an OpenAI key is configured, network questions and email-generation requests
send the relevant contact context to the configured OpenAI API account.

### AI spending protection

The app enforces its own monthly server-side budget rather than relying only on
provider alerts. The default limit is US$10.

- equivalent requests are cached for seven days
- requests reserve a conservative estimated cost before calling OpenAI
- live Find Work research asks for confirmation
- the app blocks paid requests when the monthly limit is reached
- local recommendations and deterministic drafts continue to work
- Setup displays the current remaining budget

Local development usage is stored in `.private/ai-usage.json`, which is ignored
by Git. A production deployment should move this ledger to the operational
database or Airtable.

## Campaign workflow

1. Open **Campaigns** and select one campaign.
2. Review the website-sourced facts and activate the campaign.
3. Confirm its goal, dates, ensemble size, fee guidance, and required materials.
4. Open **Find Work**. Every search belongs to the selected campaign.
5. Save strong opportunities and link them to the campaign.
6. Open **Pitch Room** to create campaign-specific outreach.
7. Approve a draft before creating a Gmail draft. Nothing is auto-sent.
8. Mark real route dates Confirmed before syncing them to Calendar.

The Europe 2026 route starts with open date windows only. These are planning
windows, not claimed bookings.

## AI Tour Builder

Open **Projects**, then choose **Plan a tour**.

1. Add a tour name, target cities or countries, dates, style, goal, fee, weekly
   outreach limit, and any useful context.
2. Select **Build My Tour Plan**.
3. Review recommended contacts grouped by location.
4. Edit, approve, skip, or mark each draft as contacted.
5. Move contacts through the Tour CRM board as replies and opportunities develop.
6. When a contact is marked **Contacted**, the app creates a follow-up date seven
   days later. Due contacts appear in **Needs Follow-Up** with a draft reminder.

All outreach is clearly marked as a draft. The app never sends email and never
marks a message as sent automatically.

### Recommendation scoring

The deterministic recommendation engine ranks the existing enriched contacts
using:

- target city and country matches
- relevance of the contact type to the selected tour goal
- relationship temperature and relationship score
- high, medium, or low priority
- time since the last recorded contact
- notes that mention introductions, venues, festivals, booking, press, labels,
  or promoters
- warm introduction paths and genre context

The strongest matches are grouped by city or country. With `OPENAI_API_KEY`
configured, OpenAI improves the first-outreach and follow-up drafts using the
tour brief and shortlisted contact context. Without a key, realistic
deterministic drafts are generated locally.

### Export Outreach Pack

Approve the drafts you want to use, then select **Export Outreach Pack**. The
downloaded JSON contains an `automationPayload` array with:

```text
tour_id
contact_id
contact_name
email
subject
body
follow_up_date
status
```

Only approved or later-stage contacts are included. Drafts that were skipped or
not reviewed are not exported.

### Future Make, Airtable, and Gmail connection

The exported payload is ready to become the input for a Make webhook or an
Airtable import. A later automation can:

1. receive each approved payload in Make
2. create or update an Airtable outreach record
3. create a Gmail draft using `subject` and `body`
4. wait for explicit human approval in Gmail before sending
5. update Airtable and the tour workflow after a send or reply

The recommended production workflow should continue creating Gmail drafts rather
than sending automatically, preserving the approval step used in this prototype.

## Airtable, Make, Gmail, and Calendar

Add the optional server-side variables:

```bash
AIRTABLE_PERSONAL_ACCESS_TOKEN=
AIRTABLE_BASE_ID=
MAKE_WEBHOOK_URL=
GOOGLE_CALENDAR_ID=
```

Create these Airtable tables with an `External ID` field:

- Workspace, with an additional long-text `Snapshot` field
- Acts
- Campaigns
- Assets
- Contacts
- Opportunities

The first sync upserts records by `External ID`, so repeating a sync does not
create duplicates. A sanitized workspace snapshot restores acts, campaigns,
assets, and opportunities on another browser. Contact operational fields sync,
but private raw relationship notes and unapproved drafts are excluded.

The Make webhook receives only explicit approved actions:

- `create_gmail_draft` creates a Gmail draft with `send: false`
- `upsert_calendar_events` creates or updates confirmed dates using stable
  idempotency keys

The app does not include a send-email action. Draft approval and actual sending
remain separate human decisions.

## Campaign Find Work

Open **Find Work**, choose the campaign, and review its automatically prepared
weekly network shortlist. Each campaign gets at most one free network scan every
seven days unless the user manually runs another scan.

Scout always starts with the saved contact network. It looks for:

- warm booking, festival, press, release, and collaboration routes
- cities with enough relationship coverage for a coordinated approach
- introductions and connected contacts that reduce cold outreach
- strong relationships with a clear next action

When `OPENAI_API_KEY` is configured, Find Work can search current official sources
for up to three additional opportunities. The app asks before this paid search.
Live results are labelled, source-linked, campaign-specific, and combined into
a shortlist capped at ten. A slow, unavailable, or budget-blocked API never
blocks local network results.

Opportunity decisions are stored locally:

- **Save** keeps an opportunity for later
- **Start working on it** marks it active
- **Add to campaign** connects it to a tour, release, campaign, or collaboration
- **Return to inbox** moves saved or active work back to the new-opportunity list
- **Not for me** removes it from the working inbox

The notification bell surfaces a small action list rather than a general
activity feed. It includes overdue follow-ups, high-confidence new
opportunities, and strong relationships without a scheduled next date.

## Today

Today turns the product’s booking signals into a short manager plan. It can
include the most valuable active deal, booking follow-ups due now, route gaps,
missing pitch materials, and strong relationships without a next date.

The plan is capped at five actions and prioritises money-moving work first.
Each item has one primary action. **Done** hides it for the day, and **Restore
hidden moves** reverses accidental dismissals.

## Deals

Deals is the main booking pipeline. It tracks practical opportunities such as
festival pitches, venue dates, booking-agent routes, commissions, funding leads,
and press opportunities.

Deal stages are:

- **Lead**
- **Pitch Ready**
- **Contacted**
- **Follow-Up Due**
- **Interested**
- **Negotiating**
- **Confirmed**
- **Passed**

Each deal stores the related campaign or act, contact or opportunity, city,
country, deal type, target fee, projected value, status, next step, follow-up
date, confidence score, missing materials, notes, and source. Marking a deal as
**Contacted** creates a follow-up date seven days later if one is not already
set. Confirmed value is only recorded when the user manually moves a deal to
**Confirmed**.

The Booking Money panel summarises confirmed income, projected income, open deal
value, follow-ups due, route gaps, and the strongest booking move today. These
are working estimates, not accounting records.

Every deal also shows pitch readiness. The app checks campaign facts, the
selected act, dates or availability, fee guidance, and required materials such
as biography, EPK, music, live video, press quote, and technical rider. Outreach
remains draft-only and is never sent automatically.

## Campaigns and connected work

Campaigns provide the shared context for the rest of the app. Use a **Tour**,
**Release**, **Bookings**, **Commissions**, or **Funding** campaign, then:

1. add practical tasks and optional due dates
2. mark tasks as To do, Doing, or Done
3. add an opportunity to the campaign from Find Work
4. automatically carry warm contacts into the campaign when an opportunity is linked
5. review linked people, opportunities, materials, tasks, route gaps, and money
6. use Calendar for confirmed dates, task deadlines, follow-ups, and
   opportunity deadlines
7. use Deals to record commercial conversations as leads, pitch-ready targets,
   contacted prospects, follow-ups, interest, negotiation, confirmation, or
   passed work
8. add travel, accommodation, production, musician, marketing, and other costs
   to see a currency-safe break-even forecast

Confirmed and paid value is summarised by currency, so different currencies are
never added into a misleading single total. Payment and confirmation statuses
are always entered manually; the app does not infer that money was received.
Planned costs are included in the forecast balance so users can see what a
project still needs to earn. Cost and payment states are also manual.

Campaign information is stored in the browser with the rest of the local
workspace. Removing a campaign removes only the campaign record; it does not
delete contacts or opportunities.

## Workspace backup

Open **Setup**, then **Backups & automation**. **Full backup** downloads one
JSON file containing contacts, projects, tasks, bookings, costs, opportunities,
booking deals, artist profile, relationship activity, Tour Builder state, research brief, and
Pitch Room drafts. Contact-only JSON and CSV exports remain available.

Use **Restore backup** to select a previously exported workspace file. The app
validates the file and asks for confirmation before replacing anything in the
current browser. A full backup contains decrypted contact and relationship
information, so it should be stored and shared as a private file.

## Relationship activity

Open any contact and choose **Activity**. The timeline records meaningful CRM
changes such as relationship stage, warmth, priority, follow-up dates, project
links, and enrichment updates. Users can also add a plain-language note without
editing the original imported notes.

Activity is stored locally in the browser. Generated drafts and copied emails
are not logged as sent communication, and the timeline never claims that an
email was delivered.

When a user adds a relationship note, the local assistant suggests a pipeline
stage, next action, and follow-up date from the language in that note. The
suggestion is not applied automatically: the user reviews the proposed profile
changes and must select **Save changes**.

## Universal search

Select **Search** in the top bar or press `Cmd + K` on macOS and `Ctrl + K` on
Windows or Linux. Search accepts a person, company, city, project, opportunity,
or workspace name. Opening a contact from search also opens the complete contact
profile.

## Artist Profile and Pitch Room

Open **Pitch Room**, then choose **Artist profile** to create the reusable profile.
Store the facts that
should stay consistent across the app: artist and project names, base city,
genres, biography, current project, goals, useful links, fee guidance, and email
signature.

Tour Builder, email drafting, Find Work, and Pitch Room reuse this
profile instead of asking for the same information each time.

Use the **Create** tab in Pitch Room to create an editable pack for:

- booking pitches
- festival applications
- press stories
- release campaigns
- collaboration ideas

The app creates a deterministic local draft first. When `OPENAI_API_KEY` is
available, it can refine that pack using only the saved profile and creative
brief. Generated copy remains a draft and the prompt explicitly prevents
invented achievements, reviews, audience figures, collaborators, or dates.
Draft kits remain local to the browser and can be copied or deleted by the
user.

## Validation

```bash
npm run typecheck
npm run build
```
