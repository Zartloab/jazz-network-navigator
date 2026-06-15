# Jazz Network Navigator

A polished local-first relationship intelligence dashboard for musicians, managers, and booking teams.

The interface is organised around five familiar jobs: **Today**, **Projects**,
**Relationships**, **Opportunities**, and **Studio**. Related tools live inside
those workspaces as simple tabs, so users see one task at a time. Hover or focus
the help icons for plain-language guidance.

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
- Creative Studio for booking, festival, press, release, and collaboration pitch packs
- Daily Brief that combines follow-ups, active opportunities, relationship gaps, and profile setup
- Manager Briefing that recommends one focus and flags project or relationship risks
- Project portfolio for tours, releases, campaigns, and collaborations
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

Open **Settings** to see **Contact Data Readiness**. It measures
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
```

Without an API key, the app uses its built-in search, enrichment, and email-generation heuristics.

When an OpenAI key is configured, network questions and email-generation requests
send the relevant contact context to the configured OpenAI API account.

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

## Opportunity Scout

Open **Opportunities** and use the **Scout** tab to describe the locations,
genre, goals, and context that matter.

Scout always starts with the saved contact network. It looks for:

- warm booking, festival, press, release, and collaboration routes
- cities with enough relationship coverage for a coordinated approach
- introductions and connected contacts that reduce cold outreach
- strong relationships with a clear next action

When `OPENAI_API_KEY` is configured, Scout also searches current web sources for
up to three relevant opportunities. Live results are clearly labelled and link
to the source page. A slow or unavailable API never blocks the local network
results.

Opportunity decisions are stored locally:

- **Save** keeps an opportunity for later
- **Start working on it** marks it active
- **Add to project** connects it to a tour, release, campaign, or collaboration
- **Return to inbox** moves saved or active work back to the new-opportunity list
- **Not for me** removes it from the working inbox

The notification bell surfaces a small action list rather than a general
activity feed. It includes overdue follow-ups, high-confidence new
opportunities, and strong relationships without a scheduled next date.

## Daily Brief

Today turns the product’s existing signals into a short daily plan. It can
include due follow-ups, saved and active opportunities, strong relationships
without a next date, and incomplete artist-profile setup.

The brief is capped at six actions and prioritises important work first. Each
item has one primary action. **Done for today** hides it until the next day, and
**Restore hidden** reverses accidental dismissals.

The **Manager Briefing** above the daily list recommends one focus based on due
follow-ups, project tasks, active opportunities, and projects without a next
move. Its signals are factual counts from the local workspace.

## Projects and connected work

Projects provide the shared context for the rest of the app. Create a **Tour**,
**Release**, **Campaign**, or **Collaboration**, then:

1. add practical tasks and optional due dates
2. mark tasks as To do, Doing, or Done
3. add an opportunity to the project from Scout
4. add a contact from the contact profile drawer
5. review every linked person, opportunity, and task from the project desk
6. use Calendar for one list of project dates, task deadlines, follow-ups, and
   opportunity deadlines
7. use Outcomes to record commercial conversations as leads, offers,
   negotiations, confirmed bookings, payments, or lost work
8. add travel, accommodation, production, musician, marketing, and other costs
   to see a currency-safe break-even forecast

Confirmed and paid value is summarised by currency, so different currencies are
never added into a misleading single total. Payment and confirmation statuses
are always entered manually; the app does not infer that money was received.
Planned costs are included in the forecast balance so users can see what a
project still needs to earn. Cost and payment states are also manual.

Project information is stored in the browser with the rest of the local
workspace. Deleting a project removes only the project record; it does not
delete contacts or opportunities.

## Workspace backup

Open **Settings**, then **Backups & automation**. **Full backup** downloads one
JSON file containing contacts, projects, tasks, bookings, costs, opportunities,
artist profile, relationship activity, Tour Builder state, research brief, and
Creative Studio drafts. Contact-only JSON and CSV exports remain available.

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

## Artist Profile and Creative Studio

Open **Studio**, then choose **Artist profile** to create the reusable profile.
Store the facts that
should stay consistent across the app: artist and project names, base city,
genres, biography, current project, goals, useful links, fee guidance, and email
signature.

Tour Builder, email drafting, Opportunity Scout, and Creative Studio reuse this
profile instead of asking for the same information each time.

Use the **Create** tab in Studio to create an editable pack for:

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
