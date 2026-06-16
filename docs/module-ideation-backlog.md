# Living Module Ideation Backlog

This backlog should be refreshed whenever a module is shipped. Ideas must use data already in the app: contacts, deals, campaigns, calendar dates, income figures, pitch drafts, relationship scores, route windows, and local activity history.

## Priority 1

### 1. Deal Follow-Up Autopilot
- **Module:** Deals
- **Feature name:** Follow-up autopilot
- **What it does:** Shows every contacted deal that needs a reply nudge today, with a ready-to-edit follow-up draft.
- **Why it matters:** Prevents warm booking leads from going cold because the manager forgot the second touch.
- **Complexity:** Medium
- **Dependencies:** Deals, Pitch Room, contact records, follow-up dates

### 2. Route Gap Matcher
- **Module:** Calendar
- **Feature name:** Route gap matcher
- **What it does:** Lists open date windows and suggests existing contacts or deals in nearby cities.
- **Why it matters:** Helps fill travel gaps before a tour route becomes expensive or impractical.
- **Complexity:** Medium
- **Dependencies:** Campaign route stops, contacts, deals, relationship scores

### 3. Pitch Readiness Queue
- **Module:** Press & EPK
- **Feature name:** Pitch readiness queue
- **What it does:** Ranks campaigns and deals by missing materials, then gives the fastest fix first.
- **Why it matters:** Saves the manager from discovering a missing bio, video, or fee detail when a pitch is already due.
- **Complexity:** Low
- **Dependencies:** Campaign required assets, deals, Pitch Room assets

### 4. Income Risk Flags
- **Module:** Income
- **Feature name:** Income risk flags
- **What it does:** Highlights campaigns where projected income is low, costs are high, or too much value is stuck before negotiation.
- **Why it matters:** Gives the manager an early warning before a route becomes financially weak.
- **Complexity:** Low
- **Dependencies:** Deals, campaign costs, confirmed/projected values

### 5. Best Next Contact
- **Module:** People
- **Feature name:** Best next contact
- **What it does:** For each campaign, recommends the single best person to contact next and explains why.
- **Why it matters:** Reduces decision fatigue when the network is large and several people look plausible.
- **Complexity:** Low
- **Dependencies:** Contacts, relationship score, campaign geography, deals

## Priority 2

### 6. Draft Reuse Library
- **Module:** Pitch Room
- **Feature name:** Draft reuse library
- **What it does:** Saves approved pitch drafts by type so similar future emails can start from a proven version.
- **Why it matters:** Speeds up repeat festival, venue, agent, and press outreach without making everything generic.
- **Complexity:** Medium
- **Dependencies:** Pitch drafts, campaign type, act profile

### 7. Deal-to-Calendar Converter
- **Module:** Calendar
- **Feature name:** Deal-to-calendar converter
- **What it does:** When a deal becomes confirmed, prompts the user to create a calendar date from the deal details.
- **Why it matters:** Keeps booking wins from staying hidden in the pipeline instead of appearing in the schedule.
- **Complexity:** Medium
- **Dependencies:** Deals, campaign route stops, calendar items

### 8. Stale Deal Cleaner
- **Module:** Deals
- **Feature name:** Stale deal cleaner
- **What it does:** Shows deals with no movement for 21 days and asks whether to follow up, snooze, or pass.
- **Why it matters:** Keeps the pipeline honest and stops old maybes from inflating projected income.
- **Complexity:** Low
- **Dependencies:** Deals, updated dates, follow-up dates

### 9. Campaign Health Score
- **Module:** Campaigns
- **Feature name:** Campaign health score
- **What it does:** Scores each campaign from readiness, active deals, route coverage, follow-ups, and projected income.
- **Why it matters:** Helps the manager know which campaign needs attention without opening every module.
- **Complexity:** Medium
- **Dependencies:** Campaigns, deals, assets, calendar, income

### 10. Warm Intro Tracker
- **Module:** People
- **Feature name:** Warm intro tracker
- **What it does:** Shows which contacts can introduce the manager to another target contact or organisation.
- **Why it matters:** Makes outreach less cold and improves the odds of a useful reply.
- **Complexity:** Low
- **Dependencies:** Contact `introduced_by`, `connected_to`, notes, relationship scores

## Priority 3

### 11. Campaign Pitch Pack Export
- **Module:** Press & EPK
- **Feature name:** Pitch pack export
- **What it does:** Creates a simple JSON or text pack with campaign bio, links, key assets, and selected draft.
- **Why it matters:** Makes it easier to move approved materials into Airtable, Make, or a manual email workflow later.
- **Complexity:** Low
- **Dependencies:** Assets, act profile, campaign, Pitch Room drafts

### 12. Reply Outcome Logger
- **Module:** Deals
- **Feature name:** Reply outcome logger
- **What it does:** Lets the user log a reply as interested, not a fit, wants materials, negotiating, or booked.
- **Why it matters:** Turns communication outcomes into clean pipeline movement without editing several fields manually.
- **Complexity:** Medium
- **Dependencies:** Deals, contacts, activity history

### 13. Weekly Manager Digest
- **Module:** Today
- **Feature name:** Weekly manager digest
- **What it does:** Summarises wins, stalled deals, follow-ups, route gaps, and missing pitch materials for the week.
- **Why it matters:** Gives an independent manager a reliable weekly operating rhythm.
- **Complexity:** Medium
- **Dependencies:** Today actions, deals, campaigns, calendar, income

### 14. Contact Coverage Map
- **Module:** Radar
- **Feature name:** Contact coverage map
- **What it does:** Groups warm contacts by campaign target region and shows where coverage is strong or weak.
- **Why it matters:** Helps the manager decide where research or introductions are needed before a tour push.
- **Complexity:** Medium
- **Dependencies:** Contacts, campaign target regions, relationship scores

### 15. Fee Memory
- **Module:** Income
- **Feature name:** Fee memory
- **What it does:** Shows previous target or confirmed fees by deal type and campaign to guide new fee estimates.
- **Why it matters:** Reduces guesswork when setting fees for similar festivals, venues, or commissions.
- **Complexity:** Low
- **Dependencies:** Deals, confirmed values, target fees

### 16. One-Click Campaign Brief
- **Module:** Campaigns
- **Feature name:** One-click campaign brief
- **What it does:** Generates a compact internal brief with goal, dates, route gaps, top deals, top contacts, income, and missing materials.
- **Why it matters:** Gives the manager a single shareable view before a planning call or weekly review.
- **Complexity:** Medium
- **Dependencies:** Campaigns, deals, contacts, income, assets

### 17. Draft Quality Checklist
- **Module:** Pitch Room
- **Feature name:** Draft quality checklist
- **What it does:** Checks whether a draft includes a clear ask, campaign link, relevant proof, date window, and respectful follow-up path.
- **Why it matters:** Improves pitch quality without needing a paid AI call.
- **Complexity:** Low
- **Dependencies:** Pitch drafts, campaign facts, assets

### 18. Artist Load Balancer
- **Module:** Today
- **Feature name:** Artist load balancer
- **What it does:** Shows whether one act is receiving all outreach while another active campaign is neglected.
- **Why it matters:** Helps a manager handling 3-6 artists keep portfolio attention balanced.
- **Complexity:** Medium
- **Dependencies:** Acts, campaigns, deals, outreach drafts, follow-ups
