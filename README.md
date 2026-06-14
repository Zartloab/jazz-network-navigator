# Jazz Network Navigator

A polished local-first relationship intelligence dashboard for musicians, managers, and booking teams.

The interface uses a focused sidebar workspace: Home shows today’s priorities,
while Tour Builder, Follow-ups, Contacts, Pipeline, Network Map, and Ask AI each
open as a separate task area. Hover or focus the help icons for plain-language
guidance.

## Features

- Interactive relationship radar map with temperature and category filters
- Prioritised weekly follow-up queue
- Opportunity-stage kanban
- Searchable and editable contact directory
- LocalStorage persistence, reset, add-contact, and JSON/CSV export
- Local network question answering without an API key
- Email draft generation with local templates
- Optional OpenAI-powered network answers and email drafts
- AI Tour Builder with contact recommendations, outreach drafts, CRM stages, and follow-up reminders
- Opportunity Scout with network signals, optional live web research, source links, and saved decisions
- Reusable Artist Profile for consistent pitches, drafts, links, and tour details
- Creative Studio for booking, festival, press, release, and collaboration pitch packs
- In-app notifications for due follow-ups, strong opportunities, and relationships missing a next date
- Make.com automation blueprint and enrichment simulation

## Contact enrichment

The detailed process for cleaning, verifying, enriching, reviewing, and safely
activating contact records is documented in
[Contact enrichment process](docs/contact-enrichment-process.md).

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

Open **Tour Builder** from the sidebar.

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

Open **Opportunity Scout** from the sidebar and describe the locations, genre,
goals, and context that matter.

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
- **Not for me** removes it from the working inbox

The notification bell surfaces a small action list rather than a general
activity feed. It includes overdue follow-ups, high-confidence new
opportunities, and strong relationships without a scheduled next date.

## Artist Profile and Creative Studio

Open **Settings** to create the reusable Artist Profile. Store the facts that
should stay consistent across the app: artist and project names, base city,
genres, biography, current project, goals, useful links, fee guidance, and email
signature.

Tour Builder, email drafting, Opportunity Scout, and Creative Studio reuse this
profile instead of asking for the same information each time.

Open **Creative Studio** to create an editable pack for:

- booking pitches
- festival applications
- press stories
- release campaigns
- collaboration ideas

The app creates a deterministic local draft first. When `OPENAI_API_KEY` is
available, it can refine that pack using only the saved profile and creative
brief. Generated copy remains a draft and the prompt explicitly prevents
invented achievements, reviews, audience figures, collaborators, or dates.

## Validation

```bash
npm run typecheck
npm run build
```
