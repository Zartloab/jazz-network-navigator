# Contact Enrichment Process

## Purpose

This process turns the existing venue CRM into reliable, outreach-ready records
without inventing facts or sending messages automatically.

The desired outcome is not to fill every field at any cost. It is to make each
record useful enough to answer four practical questions:

1. Is this organisation a realistic fit?
2. Who is the correct person to approach?
3. How and when should they be contacted?
4. What evidence supports the recommendation?

## Current Data Baseline

The source workbook `Eishan_Gig_CRM.xlsx` contains:

- 108 unique venues or organisations
- 55 historical gigs from 2022 through 2026
- calculated relationship scores and tiers
- booking model, status, lead time, contact window, and next-action fields
- Intro, Follow-up, and Re-book email templates

The most important enrichment gap is contactability:

- named contacts: 45 of 108
- email addresses: 4 of 108
- phone numbers: 7 of 108
- next actions: 70 of 108

The workbook is already strong enough for prioritisation. Enrichment should
focus first on finding verified booking routes and improving scheduling data.

## Current Prototype Behaviour

The app currently includes a **Simulate Make enrichment** action on a contact
record. This is a local, deterministic preview of what an automation could do.
It does not browse the web, call Make, verify a person, or discover contact
details.

The simulation currently:

1. reads the contact's existing notes and latest-interaction text
2. suggests a relationship stage from phrases such as "asked", "send",
   "offered to connect", or "awaiting reply"
3. increases the relationship score only when existing fields provide evidence,
   such as a known email, detailed notes, or a warm introduction
4. derives relationship temperature from the resulting score
5. proposes a follow-up date based on priority:
   - High: three days
   - Medium: seven days
   - Low: fourteen days
6. creates a short AI-style summary from fields already stored in the record
7. marks `make_automation_status` as `enriched_in_prototype`

This simulation is useful for demonstrating workflow and interface behaviour,
but its output is not verified enrichment. A production enrichment must follow
the research, provenance, confidence, and approval stages below.

The current app contact model stores:

```text
identity: name, position, organisation
location: city, country, coordinates, address
classification: category, tags, source type
relationship: stage, score, priority, temperature
history: notes, latest interaction, last-contact date
workflow: next follow-up, next action, opportunity summary
network: introduced by, connected to
contactability: email
automation: Make status and AI summary
```

The workbook contains useful venue and gig fields that are not yet represented
directly in the app model. Those fields should be added before production
import rather than compressed into notes.

## Core Principles

### Preserve source truth

Existing workbook values must remain traceable. Enrichment may add or clarify
information, but it must not silently overwrite historical facts.

### Prefer official sources

Use an organisation's official website, official booking page, verified social
profile, or an existing direct relationship before using third-party
directories.

### Record provenance

Every externally discovered fact should store its source URL, the date checked,
and a confidence level.

### Never guess contact details

Do not infer email addresses from name patterns. Do not invent roles, dates,
fees, venue capacity, or relationship history.

### Human approval remains mandatory

AI may recommend, summarise, classify, and draft. It must not send an email,
change a relationship outcome, or mark a person as contacted without a user
action.

### Minimise personal data

Only collect information needed for professional booking and relationship
management. Avoid private addresses, personal phone numbers, unrelated social
profiles, passwords, payment information, or sensitive notes.

## Target Record Structure

The application should preserve the current contact fields and add the
following venue-specific fields:

| Field | Purpose |
| --- | --- |
| `venue_id` | Stable identifier linking the venue to gigs and outreach |
| `phone` | Public professional contact number |
| `website` | Official organisation website |
| `booking_url` | Official booking, programming, or submission page |
| `state` | State or province |
| `region` | Touring region |
| `booking_model` | Programs and pays, hire only, festival, or does not buy |
| `times_played` | Number of confirmed historical appearances |
| `years_engaged` | Years in which the relationship was active |
| `books_for` | Known programming year or season |
| `lead_time_months` | Typical booking lead time |
| `suggested_template` | Intro, Follow-up, or Re-book |
| `suggested_contact_window` | Plain-language timing guidance |
| `capacity` | Verified audience capacity when useful |
| `genre_fit` | Evidence-based programming fit |
| `last_verified_at` | Date enrichment was last checked |
| `enrichment_status` | Not started, needs research, needs review, or verified |
| `source_urls` | URLs supporting enriched facts |
| `confidence` | High, medium, or low confidence |

Gig history should remain a separate linked dataset:

| Field | Purpose |
| --- | --- |
| `gig_id` | Stable performance identifier |
| `venue_id` | Link to the venue record |
| `date` | Real ISO date where known |
| `date_precision` | Exact day, date range, month, or year |
| `tour_run` | Tour or routing group |
| `performance_type` | Concert, festival, club, hall, gallery, or other |
| `fee` | Agreed or received fee, if appropriate to record |
| `attendance` | Known attendance, if available |
| `outcome_notes` | Operational or relationship outcome |

## Excel-to-App Mapping

| Workbook field | App field |
| --- | --- |
| Venue / Organisation | `company` and venue display name |
| Contact | `full_name`, `first_name`, `last_name` |
| Role / Note | `position` |
| Email | `email` |
| Phone | `phone` |
| City | `city` |
| State | `state` |
| Region | `region` and tags |
| Booking Model | `booking_model` and category |
| Status | pipeline stage |
| Times Played | `times_played` |
| Years Engaged | `years_engaged` |
| Books For | `books_for` |
| Lead Source / Ref By | `introduced_by` |
| Notes / Last Outcome | notes and opportunity summary |
| Relationship Score | `relationship_score` |
| Tier | priority and relationship temperature |
| Suggested Template | `suggested_template` |
| Lead Time (mo) | `lead_time_months` |
| Suggested Contact Window | `suggested_contact_window` |
| Next Action | `recommended_next_action` |

The workbook's calculated relationship score should be preserved during the
first import. The application may later calculate a separate recommendation
score for a specific tour, but it should not replace the source relationship
score.

## Enrichment Workflow

### Phase 1: Import and normalise

1. Create a stable `venue_id` for every Venue CRM row.
2. Import all source values without changing their meaning.
3. Trim accidental whitespace and normalise blank cells to empty values.
4. Convert gig dates into ISO dates where an exact date is known.
5. Preserve ambiguous ranges such as multi-day festivals using
   `date_precision`.
6. Normalise state, region, booking model, status, and template values to
   controlled options.
7. Link Gig History records to venues using `venue_id`.
8. Place uncertain venue matches in a manual review queue.

### Phase 2: Deduplicate and reconcile

Check for duplicates using:

- normalised organisation name
- city and state
- official website domain
- shared email address or phone number

Do not merge records solely because their names look similar. A merge requires
matching location or contact evidence.

When merging:

1. preserve all source notes
2. keep the most specific verified contact details
3. combine performance history
4. retain aliases for future matching
5. record which source records were merged

### Phase 3: Determine pursuit eligibility

Before researching contact details, classify whether the organisation is worth
pursuing:

- **Pursue**: programs and pays, festival, or known viable booking route
- **Conditional**: hire-only venue that may fit a self-produced run
- **Research**: booking model or programming fit is unclear
- **Do not pursue**: explicitly does not buy, permanently closed, or clearly
  unsuitable

This prevents time being spent enriching records that should not enter an
outreach workflow.

### Phase 4: Research official organisation details

Research in this order:

1. official website
2. official programming or booking page
3. official contact page
4. official social profile linked from the website
5. festival or parent-organisation website
6. trusted industry directory
7. existing private notes and introductions

Capture:

- official name
- website
- booking or submission URL
- public booking email
- public professional phone
- current programmer, booker, artistic director, or venue manager
- relevant role
- city, state, region, and country
- programming genres or stated artistic focus
- submission requirements
- known season or booking period
- verified capacity when relevant
- closure, ownership change, or outdated-contact warnings

### Phase 5: Verify the contact route

A record is outreach-ready when it has at least one verified route:

- a named person with professional email
- a public booking email
- an official booking form
- a professional phone number with a clear booking role
- a trusted warm introduction path

Each route receives a confidence level:

- **High**: current official website or direct confirmation
- **Medium**: official social profile, recent program, or trusted referral
- **Low**: third-party listing or source older than 18 months

Low-confidence routes should be reviewed before use.

### Phase 6: Add relationship context

Use the workbook and gig history to calculate or confirm:

- times played
- years engaged
- latest known performance
- whether the venue is a re-book, follow-up, or first-contact target
- known introductions
- last outcome
- current next action

Historical performance should carry more weight than generic online relevance.
A verified past booking is stronger evidence than an inferred genre match.

### Phase 7: Determine timing

The exact follow-up system needs dates rather than only plain-language windows.

For each record:

1. retain `lead_time_months`
2. retain the workbook's suggested contact window
3. identify the target season or proposed tour date
4. calculate a recommended first-contact date
5. calculate a follow-up date seven days after a recorded outreach
6. avoid scheduling outreach when the venue was contacted very recently

If the target season is unknown, use "Plan with next tour" rather than
inventing a date.

### Phase 8: Generate recommendations and drafts

Recommendation ranking should consider:

- target city, state, region, or routing fit
- booking model
- relationship score and tier
- times played
- current status
- contactability and confidence
- lead time
- historical gig outcome
- genre and programming fit
- warm introduction path
- recent contact activity

Draft type selection:

- **Re-book** when `times_played > 0`
- **Follow-up** when status is Contacted or Interested
- **Intro** for a verified new contact
- no draft for Declined, Do not pursue, or unverified contact routes

Generated drafts must remain labelled **Draft** and require user approval.

### Phase 9: Human review

The review screen should show:

- original workbook value
- proposed enriched value
- source URL
- date checked
- confidence
- reason for the change

Reviewers can:

- approve
- edit
- reject
- defer
- mark the source as outdated

Approved values become active. Rejected suggestions remain in an audit log and
must not repeatedly reappear without new evidence.

### Phase 10: Record outreach outcomes

After the user sends a message outside the app, they may mark it Contacted.
That action should:

1. record the date
2. record the draft or subject used
3. set the next follow-up date to seven days later
4. update the pipeline stage
5. retain the previous status in history

Replies should be classified manually or with user-approved AI assistance:

- interested
- requested materials
- awaiting dates
- booked
- declined
- wrong contact
- no longer operating

## Missing-Details Queue

The app should provide a dedicated queue ordered by business value:

1. Tier A venues without a verified contact route
2. previously played venues without an email or booking URL
3. Interested or Contacted venues with missing follow-up dates
4. target-tour locations with weak coverage
5. Tier B venues without a named contact
6. cold prospects and hire-only venues

Each task should be small and explicit, for example:

- "Find an official booking email"
- "Confirm whether this venue still programs live music"
- "Match this gig-history row to a venue"
- "Confirm the current artistic director"
- "Add the official booking page"

## Automation and Make/Airtable Readiness

An approved enrichment payload should include:

```json
{
  "venue_id": "VENUE-001",
  "field": "booking_url",
  "old_value": "",
  "new_value": "https://example.com/bookings",
  "source_url": "https://example.com/contact",
  "verified_at": "2026-06-15",
  "confidence": "high",
  "status": "approved"
}
```

A future Make workflow may:

1. receive approved enrichment payloads
2. create or update an Airtable venue record
3. create a research task for missing details
4. create a Gmail draft only after contact verification
5. notify the user when a follow-up becomes due

It should never auto-send Gmail messages.

### Recommended automation stages

A production workflow should use explicit states so suggested information can
never be mistaken for verified data:

```text
not_started
researching
suggested
needs_review
approved
rejected
verified
stale
```

The automation should write proposed values to a review table or suggestion
object first. Only an approval action should copy the value into the active
contact record.

Suggested Make scenario:

1. receive a venue ID and requested fields from the app
2. retrieve the existing Airtable venue and relationship history
3. search approved public sources in priority order
4. return candidate values with source URLs and timestamps
5. reject unsupported or conflicting values
6. create review items for the remaining suggestions
7. notify the user that review is ready
8. apply only approved fields to Airtable
9. return the updated record to the app
10. create a Gmail draft only after the contact route and outreach copy are
    separately approved

Use idempotency keys such as `venue_id + field + source_url + verified_at` so a
retry does not create duplicate review items.

## Privacy and AI Boundaries

Before sending context to an AI provider:

- exclude passwords, payment data, private addresses, and unrelated personal
  notes
- send only the fields needed for the task
- do not send the entire CRM when one record or shortlist is sufficient
- avoid sending email addresses or phone numbers unless the task explicitly
  requires them
- explain in the interface when contact context will leave the local browser

AI may:

- classify booking models
- summarise public programming information
- compare a venue with a tour brief
- propose a next action
- draft outreach

AI may not:

- invent or infer contact details
- decide that a message was sent
- mark an outcome as confirmed
- overwrite historical data without approval

## Quality Checks

Run these checks after every import or enrichment batch:

- no duplicate `venue_id`
- no duplicate official domains unless they share a parent organisation
- valid email format
- valid URL format
- controlled status, tier, booking model, and confidence values
- relationship score between 0 and 100
- follow-up date not earlier than contact date
- source URL present for externally enriched facts
- Gig History links resolve to a venue or a review task
- Declined and Do not pursue records are excluded from draft generation
- no message is marked sent without a user action

## Success Metrics

Track:

- percentage of Tier A and B venues with a verified contact route
- percentage with an official booking URL
- percentage with a named decision-maker
- percentage with an exact next action
- percentage with a valid follow-up date
- Gig History match rate
- enrichment suggestions approved versus rejected
- replies, bookings, and re-bookings attributable to enriched records
- stale records not verified within the last 12 months

The first operational target should be:

- 100% of Tier A venues reviewed
- 90% of Tier A venues with a verified booking route
- 75% of Tier B venues with a verified booking route
- all Interested and Contacted venues with exact follow-up dates
- all Gig History rows linked or placed in review

## Recommended Rollout

### Batch 1: Priority re-books

Enrich the eight Tier A records first. Verify contacts, booking routes, seasons,
and next actions.

### Batch 2: Existing relationships

Enrich every venue with `times_played > 0`, prioritising those without contact
details.

### Batch 3: Active leads

Enrich Interested and Contacted records and assign exact follow-up dates.

### Batch 4: Tour-specific research

When a tour is created, enrich only relevant records in the target route before
expanding into cold prospects.

### Batch 5: Long-tail maintenance

Review Tier C and D records gradually. Archive closed or unsuitable venues and
re-verify public details annually.

## Definition of Enrichment Complete

A venue is considered enriched when:

- identity and location are confirmed
- booking model is known
- pursuit eligibility is decided
- at least one official source is recorded
- contact route is verified or explicitly marked unavailable
- relationship history is linked
- relationship score and tier are valid
- next action is explicit
- timing guidance is present
- confidence and verification date are recorded
- the record has passed human review

An enriched record is not necessarily outreach-ready. Outreach-ready also
requires a verified route, an appropriate status, and user approval of the
draft.
