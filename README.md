# API এর যত কাহিনী

A Chrome DevTools extension that captures API requests from any web page and lets you copy them in one click — endpoint, payload, response, headers, and more.

Use it to debug failing APIs, share bug reports, or replay requests with cURL / `fetch()`.

---

## What you need

- **Google Chrome**, **Microsoft Edge**, **Brave**, or another **Chromium-based** browser
- **Node.js 18+** and **npm** (only for building the extension)

---

## Install (5 minutes)

### 1. Get the code

```bash
git clone <your-repo-url>
cd ext
```

Or download the project as a ZIP and unzip it.

### 2. Install dependencies

```bash
npm install
```

### 3. Build the extension

```bash
npm run build
```

This creates a `dist/` folder. **You must load the extension from `dist/`**, not from the project root.

> **Tip:** After you change the source code, run `npm run build` again and click **Reload** on the extension in your browser.

### 4. Load it in Chrome / Edge

1. Open your browser and go to the extensions page:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the **`dist`** folder inside this project (e.g. `ext/dist`).
5. The extension **"API এর যত কাহিনী"** should appear in your list.

You only need to do this once. After rebuilding, use the **Reload** button on the extension card.

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

## Development

```bash
# Rebuild automatically when files change
npm run dev

# Run tests
npm test
```

After `npm run dev`, reload the extension in `chrome://extensions` to see changes.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Extension does not appear in DevTools | Make sure you loaded the **`dist`** folder, not the project root. Reload the extension after building. |
| No requests showing | Interact with the page to trigger API calls. Confirm requests appear in the Network tab as **fetch** or **xhr**. |
| "Load unpacked" fails | Run `npm run build` first — the `dist` folder must exist. |
| Changes not visible | Run `npm run build` (or `npm run dev`), then click **Reload** on the extension. |
| Copy does not work | Click inside the DevTools panel first, then try Copy again. Some browsers require a user gesture. |

---

## Project structure

```
ext/
├── src/           # TypeScript source
├── public/        # manifest.json and icons
├── dist/          # Built extension — load this in the browser
├── panel.html     # DevTools panel UI
└── devtools.html  # DevTools entry point
```

---

## License

Private project — see repository owner for usage terms.
