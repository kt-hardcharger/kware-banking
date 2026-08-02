# KWARE Banking

Weekly HELOC / Credit Card velocity banking tracker. React + Vite, Supabase backend, deployed to GitHub Pages.

## Layout

Both modules have 3 tabs: **Weeks** (week tabs, transfer instructions, and the week's bill/transaction list), **Import** (bring in bills/income or card transactions, plus manual add), and **Summary** (balance trend across months). The month picker/New Month button sits above Weeks and Import — pick or create a month there and both tabs stay in sync.

## Before you run this — run the schema SQL

Run both, in order, in your Supabase project's **SQL Editor → New query**:

1. `supabase/2026-08-01-phase2-schema.sql` — `module_settings`, `months`, `weeks`, `bills`. Seeds `module_settings` with your HELOC account names, and placeholder names for the Credit Card row.
2. `supabase/2026-08-01-phase5-cc-schema.sql` — adds `cc_transactions` for the Credit Card module's imported charges.

**Update the Credit Card placeholder account names** before using that module — it still says `TBD Checking` / `TBD Credit Card`:

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
- ~~Phase 5: Credit Card module (separate checking account, CSV charge import, weekly spend total)~~ done
- Phase 6: Polish pass

## A note on the week math

`src/lib/weekMath.js` is based on the formulas in `August 2026 Velocity Banking.xlsx` (Week 1-4 tabs), with two corrections you asked for:

- **Bank Threshold** now treats a checking balance above $150 as a real surplus (adds to available funds) instead of always reserving the full distance from $150 regardless of direction.
- **Ending HELOC balance** now includes the week's direct HELOC bills as added debt, on top of the sweep transfer — previously those bills were shown but not counted.

## A note on the Credit Card module's math

`src/lib/ccWeekMath.js` reuses the HELOC module's threshold/available-funds math directly (same shared functions), since the mechanics are the same shape — sweep money between Checking and a debt account, holding back $150. The differences: there's no bill import for this module's checking account (per your description, it's just checking balance + income vs. the $150 threshold, no bills to subtract), and instead of HELOC bills feeding the target account's debt each week, it's the week's card charges from the imported CSV (credit/payment rows in that CSV are excluded from the math — they'd double-count the transfer the app already computes).

## 8/2 changes

- **Import tab**: bills/income rows are now editable inline (Edit → Save/Cancel), and there's a Status filter above the list — set it to "Cleared" or "Paid" to view just those.
- **Weeks tab**: added Status and Account filters above each week's bill list (filters reset when you switch weeks).
- **Math**: bills with status "Cleared" or "Paid" are now excluded from Bank bills / HELOC bills / Available funds / the move-date suggestion — those are already reflected in the balance you enter manually, so including them would double-count. They're still imported and visible, just not summed. This applies to the HELOC module only (per your call) — Credit Card charges aren't affected.
