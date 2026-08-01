# KWARE Banking

Weekly HELOC / Credit Card velocity banking tracker. React + Vite, Supabase backend, deployed to GitHub Pages.

## Phase 4 status

Added a "Summary" sub-tab next to "Monthly Tracking" inside HELOC Banking: a balance-over-time line chart plus a table of opening/ending balance and change per month, computed the same way as the week view (so they can never disagree).

Not yet built: the Credit Card module and the final polish pass. Those are Phases 5–6.

## Before you run Phase 2 — run the schema SQL

Open your Supabase project → **SQL Editor → New query**, paste in the contents of `supabase/2026-08-01-phase2-schema.sql`, and run it. This creates `module_settings`, `months`, `weeks`, and `bills`, and seeds `module_settings` with your HELOC account names from the design doc.

The Credit Card row in `module_settings` is seeded with placeholder account names (`TBD Checking` / `TBD Credit Card`) — update that row once you tell me the real account names, or just leave it until Phase 5.

```sql
update module_settings
set checking_account_name = 'your checking account name',
    target_account_name = 'your credit card name'
where module = 'credit_card';
```

## One-time app setup (if you haven't already from Phase 1)

### 1. Local install
```bash
npm install
```

### 2. Local env vars
```bash
cp .env.example .env.local
```
`.env.local` is already filled in with your Supabase project URL and publishable key from the design doc — double check them against your Supabase dashboard (Project Settings → API) if the app can't connect.

### 3. Run it locally
```bash
npm run dev
```
Open the local URL it prints. You should see the KWARE Banking shell with a "Supabase connected" pill in the top-right (green dot). If it's red, the URL/key in `.env.local` is wrong.

### 4. Push to GitHub
```bash
git init
git add .
git commit -m "Phase 1: scaffold"
git branch -M main
git remote add origin https://github.com/kt-hardcharger/kware-banking.git
git push -u origin main
```

### 5. Turn on GitHub Pages
In the repo on GitHub: **Settings → Pages → Source → GitHub Actions**.

### 6. Add repo secrets (for the build, not just local dev)
**Settings → Secrets and variables → Actions → New repository secret**, add both:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(same values as `.env.local`)

### 7. Deploy
Push to `main` and the Actions workflow (`.github/workflows/deploy.yml`) builds and publishes automatically. Check the **Actions** tab for progress. Once it's green, the app is live at:

```
https://kt-hardcharger.github.io/kware-banking/
```

## What's next

- ~~Phase 2: Supabase schema (`module_settings`, `months`, `bills`, `weeks`) + bill paste-import + week math~~ done
- ~~Phase 3: HELOC week tabs, New Month carry-forward flow, month dropdown, Google Calendar link~~ done
- ~~Phase 4: HELOC summary tab~~ done
- Phase 5: Credit Card module (separate checking account, CSV charge import, weekly spend total)
- Phase 6: Polish pass

## A note on the week math

`src/lib/weekMath.js` is based on the formulas in `August 2026 Velocity Banking.xlsx` (Week 1-4 tabs), with two corrections you asked for:

- **Bank Threshold** now treats a checking balance above $150 as a real surplus (adds to available funds) instead of always reserving the full distance from $150 regardless of direction.
- **Ending HELOC balance** now includes the week's direct HELOC bills as added debt, on top of the sweep transfer — previously those bills were shown but not counted.
