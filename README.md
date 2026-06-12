# Jazz Network Navigator

A polished local-first relationship intelligence dashboard for musicians, managers, and booking teams.

## Features

- Interactive relationship radar map with temperature and category filters
- Prioritised weekly follow-up queue
- Opportunity-stage kanban
- Searchable and editable contact directory
- LocalStorage persistence, reset, add-contact, and JSON/CSV export
- Local network question answering without an API key
- Email draft generation with local templates
- Optional OpenAI-powered network answers and email drafts
- Make.com automation blueprint and enrichment simulation

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

## Validation

```bash
npm run typecheck
npm run build
```
