# API এর যত কাহিনী

A Chrome DevTools extension that captures API requests from any web page and lets you copy them in one click — endpoint, payload, response, headers, and more.

Use it to debug failing APIs, share bug reports, or replay requests with cURL / `fetch()`.

---

## Quick install (recommended)

**No coding, no Node.js, no build step.**

1. **[Download the latest extension (ZIP)](https://github.com/shamsfarabii/api-monitoring-dev-tool/releases/latest/download/api-monitoring-dev-tool-dist.zip)**
2. Unzip the file — you will get a folder with `manifest.json` inside.
3. Open your browser extensions page:
   - **Chrome:** [chrome://extensions](chrome://extensions)
   - **Edge:** [edge://extensions](edge://extensions)
4. Turn on **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the **unzipped folder**.
6. Done — the extension **"API এর যত কাহিনী"** is installed.

> **First time?** The download link works after the first GitHub release is published (push to `main` triggers an automatic build). If the link is not ready yet, use [Build from source](#build-from-source) below.

---

## How to use

### Open the panel

1. Open any website (or your local app).
2. Open **DevTools** — press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows).
3. Click the **"API এর যত কাহিনী"** tab in DevTools.

If you do not see the tab, click the `»` overflow menu in the DevTools tab bar.

### Capture requests

1. Use the page normally — log in, click buttons, submit forms, etc.
2. Every **fetch** and **XHR** request is captured automatically.
3. Requests appear in the left sidebar as they happen.

> **Note:** Only API-style requests are captured (not images, fonts, or other static assets). Keep the DevTools panel open while testing.

### Copy a request

1. Click a request in the list to see details on the right.
2. Choose a **Format** from the dropdown:
   - **Plain Text** — simple text summary
   - **Markdown Bug Report** — ready to paste into GitHub / Jira
   - **Slack Compact** — short message for Slack
   - **JSON Debug Bundle** — structured JSON for debugging
   - **cURL Replay** — replay the request in terminal
   - **fetch() Replay** — replay in browser JavaScript
3. Click **Include** to choose what goes into the copy (method, endpoint, payload, response, headers, etc.).
4. Click **Copy** — the formatted output is on your clipboard.

### Filter and organize

| Control | What it does |
|--------|----------------|
| **Search** | Filter by method, URL, or status code |
| **View** | Show individual rows or group by API endpoint |
| **Response** | Show all, succeeded only, or failed only (4xx, 5xx, network errors) |
| **Method** | Filter by GET, POST, PUT, etc. |
| **Sort** | Newest, oldest, by status, or slowest first |
| **Clear** | Remove all captured requests |

Your format, filters, and Include settings are saved automatically.

### Redact secrets

Turn on **Redact secrets** in the **Include** menu before copying if you want tokens, cookies, and API keys masked. Leave it on when sharing output with others.

---

## Build from source

For developers who want to change the code or run tests locally.

**Requirements:** Node.js 18+ and npm

```bash
git clone https://github.com/shamsfarabii/api-monitoring-dev-tool.git
cd api-monitoring-dev-tool
npm install
npm run build
```

Load the **`dist/`** folder via **Load unpacked** in `chrome://extensions`.

```bash
# Rebuild automatically when files change
npm run dev

# Run tests
npm test

# Create the same ZIP used for releases
npm run package:dist
```

After rebuilding, click **Reload** on the extension card in `chrome://extensions`.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Download link returns 404 | The first release may not be published yet. Push to `main` or ask a maintainer to run the **Release extension** workflow. Or [build from source](#build-from-source). |
| Extension does not appear in DevTools | Load the **unzipped folder** that contains `manifest.json`, not the ZIP file itself. |
| No requests showing | Interact with the page to trigger API calls. Confirm requests appear in the Network tab as **fetch** or **xhr**. |
| Changes not visible (dev) | Run `npm run build`, then click **Reload** on the extension. |
| Copy does not work | Click inside the DevTools panel first, then try Copy again. Some browsers require a user gesture. |

---

## Project structure

```
ext/
├── src/           # TypeScript source
├── public/        # manifest.json and icons
├── dist/          # Built extension (created by npm run build)
├── panel.html     # DevTools panel UI
└── devtools.html  # DevTools entry point
```

---

## License

Private project — see repository owner for usage terms.
