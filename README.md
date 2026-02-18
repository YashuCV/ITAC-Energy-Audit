# ITAC Energy Audit Form

iPad-friendly web form for the ITAC Energy Audit. Auto-saves as you type, works **offline** after first load, and exports to PDF.

## Features

- **10 tabs:** General, Utility, Lighting, HVAC, Compressed Air, Boiler System, Building Envelope, Power System, Chillers, Generator
- **Auto-save** to IndexedDB/localStorage
- **Extra notes** and addable notes pages per section
- **Download PDF** – only sections with content are included
- **Offline** – open once online, then use without internet (e.g. on site)

---

## Deploy to GitHub Pages (one-time setup)

### 1. Create the repo on GitHub

1. Go to [github.com/new](https://github.com/new).
2. Repository name: e.g. `energy-audit-app`.
3. Set to **Public**.
4. Do **not** add a README, .gitignore, or license (we already have files).
5. Click **Create repository**.

### 2. Push the code from your computer

In a terminal, from the **folder that contains** `index.html`, `app.js`, `styles.css`, etc.:

```bash
# Initialize git (if this folder is not already a git repo)
git init

# Add all files
git add .

# First commit
git commit -m "Initial commit: ITAC Energy Audit web app"

# Replace YOUR_USERNAME and YOUR_REPO with your GitHub username and repo name
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push (creates main branch if needed)
git branch -M main
git push -u origin main
```

### 3. Turn on GitHub Pages

Pick **one** of these:

**Option A – Deploy from branch (simplest)**  
1. On GitHub: repo → **Settings** → **Pages**.  
2. **Source:** Deploy from a branch.  
3. **Branch:** `main` (or `master`) → **/ (root)** → **Save**.

**Option B – Deploy with GitHub Actions**  
1. On GitHub: repo → **Settings** → **Pages**.  
2. **Source:** GitHub Actions.  
3. The workflow in `.github/workflows/deploy-pages.yml` runs on every push to `main` and deploys the site.

After 1–2 minutes your app is at: **https://YOUR_USERNAME.github.io/YOUR_REPO/**

---

## Use on iPad (online once, then offline)

1. On the iPad, open **Safari** and go to your GitHub Pages URL (e.g. `https://YOUR_USERNAME.github.io/energy-audit-app/`).
2. Tap **Share** (square with arrow) → **Add to Home Screen** → name it (e.g. “ITAC Energy Audit”) → **Add**.
3. Open the app from the **Home Screen** icon. Use it once with **Wi‑Fi on** so the app and PDF library are cached.
4. After that you can use it **offline** (e.g. on site with no internet).

---

## Updating the app (push changes)

After you change any file (e.g. `index.html`, `app.js`, `styles.css`):

```bash
git add .
git commit -m "Describe your change"
git push
```

GitHub Pages will redeploy automatically; wait a minute and refresh the site (or reopen the Home Screen app).

---

## Files in this repo

| File           | Purpose                          |
|----------------|----------------------------------|
| `index.html`   | Main app page and form markup    |
| `styles.css`   | Layout and styles                |
| `app.js`       | Tabs, save, load, PDF, notes     |
| `sw.js`        | Service worker (offline cache)   |
| `manifest.json`| PWA manifest                     |
| `.nojekyll`    | So GitHub Pages serves files as-is |
| `.github/workflows/deploy-pages.yml` | Optional: deploy via GitHub Actions |

If you use **Deploy from a branch**, no Actions run; Pages serves the repo. If you set **Source: GitHub Actions**, the workflow deploys on every push to `main`.
