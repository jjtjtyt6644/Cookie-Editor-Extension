# Cookie Editor Pro 🍪

A powerful, beautiful browser extension to create, edit, and delete cookies — rebuilt with a modern glassmorphism UI.

## Features

- **View all cookies** for the current tab, sorted alphabetically
- **Create / Edit / Delete** cookies with a smooth slide-up panel
- **Search & filter** cookies by name, value, or domain in real-time
- **Cookie flags** — color-coded badges for Secure, HttpOnly, Session, SameSite
- **Bulk select** — checkbox-select multiple cookies to delete or export at once
- **Import** cookies from JSON, Header string, or Netscape format
- **Export** cookies to JSON, Header string, or Netscape format, then copy to clipboard
- **Dark / Light theme** toggle with persisted preference
- **Glassmorphism UI** — animated blobs, frosted glass panels, smooth transitions

## Install in Chrome / Edge / Brave

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select this folder (`cookie-editor-pro/`)
5. The 🍪 icon appears in your toolbar — pin it!

## Install in Firefox

1. Rename `manifest.firefox.json` → `manifest.json` (back up the Chrome one first)
2. Open `about:debugging`
3. Click **This Firefox** → **Load Temporary Add-on**
4. Select `manifest.json` from this folder

## File Structure

```
cookie-editor-pro/
├── manifest.json           # Chrome / Edge / Brave (MV3)
├── manifest.firefox.json   # Firefox (MV2)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html          # Main UI
│   ├── popup.css           # Glassmorphism styles
│   └── popup.js            # All cookie logic
└── background/
    └── background.js       # Tab change listener
```

## Permissions Used

| Permission | Reason |
|---|---|
| `cookies` | Read/write cookies for all sites |
| `activeTab` | Get the current tab's URL |
| `tabs` | Listen for tab switches |
| `clipboardWrite` | Copy exported cookies |
| `<all_urls>` | Access cookies across all domains |

## Export Formats

**JSON** — Full cookie object array with all properties  
**Header** — `name=value; name2=value2` format (for HTTP headers)  
**Netscape** — Classic cookie.txt format compatible with curl, wget

## Improvements Over Original Cookie-Editor

| Feature | Original | Pro |
|---|---|---|
| UI style | Flat / utilitarian | Glassmorphism |
| Bulk select | ❌ | ✅ |
| Inline search | ✅ | ✅ Enhanced |
| Flag badges | Text only | Color-coded |
| Edit panel | Full page | Smooth slide-up |
| Confirm dialog | Browser native | Custom styled |
| Toast notifications | Basic | Animated |
| Theme toggle | Settings page | One-click header |
| Import formats | JSON | JSON + Header + Netscape |
| Export formats | JSON + Header | JSON + Header + Netscape |

## License

MIT 
