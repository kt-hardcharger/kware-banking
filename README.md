# KWARE Banking

Weekly HELOC / Credit Card velocity banking tracker. React + Vite, Supabase backend, deployed to GitHub Pages.

## Phase 1 status

This is the scaffold: app shell, module switcher (HELOC / Credit Card), Supabase connectivity check, design tokens, and the deploy pipeline. No banking data or tables yet — that's Phase 2+.

## One-time setup (do this before anything else)

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

- Phase 2: Supabase schema (`accounts`, `months`, `bills`, `weeks`) + bill paste-import + week math
- Phase 3: HELOC month/week UI, New Month flow, Google Calendar link
- Phase 4: HELOC summary tab
- Phase 5: Credit Card module (separate checking account, CSV charge import, weekly spend total)
- Phase 6: Polish pass
