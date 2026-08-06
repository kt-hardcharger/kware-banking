# KWARE Banking — Update Cheat Sheet

Steps for every zip I send you, in order. Skip a step only if the note under it says when to skip.

## 1. Unzip over your existing project folder
Extract the zip and let it overwrite files in your local `kware-banking` folder (same folder you `git push` from). It always contains the full project, not a diff — overwriting is expected and safe.

## 2. Run any new SQL
Check if the zip's `supabase/` folder has a file you haven't run yet. If so: Supabase project → **SQL Editor → New query** → paste it in → Run.
*Skip if there's no new file in `supabase/` since last time.*

## 3. Install (only if package.json changed)
```bash
npm install
```
*Skip unless I told you a dependency changed — most updates don't touch this.*

## 4. Test locally (optional but recommended)
```bash
npm run dev
```
Open the printed URL, click around, confirm it looks right before pushing.

## 5. Commit and push
```bash
git add .
git commit -m "describe the change"
git push
```

## 6. Check the deploy
GitHub repo → **Actions** tab → wait for the green check. Once it's green:
```
https://kt-hardcharger.github.io/kware-banking/
```

---
**Most updates are just steps 1, 5, and 6.** Steps 2–4 only apply when I specifically call them out in my reply.
