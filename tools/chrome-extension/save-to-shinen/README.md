# Save to SHINEN - Chrome Extension

Minimal Chrome Extension (Manifest V3) for one-click saving to SHINEN.

## Features

- ✅ One-click save current tab to SHINEN
- ✅ Automatic extraction:
  - URL, title, selected text
  - Open Graph / Twitter Card images
  - JSON-LD metadata
  - Amazon product images (largest resolution)
  - FANZA/DMM media (pics.dmm.co.jp)
- ✅ URL normalization (protocol-relative, double-encoding)
- ✅ Works on Amazon, FANZA, Medium, GitHub, and all standard sites

## Installation

### 1. Load Unpacked Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder
5. The "Save to SHINEN" extension should appear in your toolbar

### 2. Pin to Toolbar (Recommended)

1. Click the **Extensions** puzzle icon in Chrome toolbar
2. Find "Save to SHINEN"
3. Click the **pin icon** to keep it visible

## Usage

1. Visit any page you want to save
2. (Optional) Select text you want to capture
3. Click the **Save to SHINEN** extension icon
4. SHINEN opens in a new tab and auto-saves the page
5. Look for the green "Saved" banner

## Tested Sites

- ✅ GitHub repositories
- ✅ Amazon product pages (extracts largest image)
- ✅ FANZA/DMM product pages (pics.dmm.co.jp)
- ✅ Medium articles
- ✅ Twitter/X posts
- ✅ Standard blogs and news sites

## Technical Details

### Extraction Priority

1. **Meta tags**: `og:image`, `og:image:secure_url`, `twitter:image`
2. **JSON-LD**: `image`, `thumbnailUrl` (handles `@graph` arrays)
3. **Amazon-specific**:
   - `#landingImage[data-old-hires]`
   - `#landingImage[data-a-dynamic-image]` (sorted by pixel area)
   - `#imgTagWrapperId img`
   - `img[data-a-dynamic-image]` (mobile)
4. **FANZA/DMM-specific**:
   - Images containing `pics.dmm.co.jp` or `dmm.co.jp`
   - Picks largest image (area > 5000px²)

### URL Normalization

- Protocol-relative URLs (`//example.com`) → `https://example.com`
- Relative paths (`/path`) → absolute URLs
- Double-encoded URLs (`https%3A%2F%2F...`) → decoded once
- Only accepts `http://` and `https://`

### Permissions

- `tabs`: Read URL and title
- `scripting`: Execute content extraction in active tab
- `activeTab`: Access page DOM when clicked
- `<all_urls>`: Extract images from any domain

## Troubleshooting

### Extension icon not visible
- Check if Developer mode is ON in `chrome://extensions`
- Reload the extension after making changes
- Pin the extension to toolbar

### No image captured
- Check browser console (F12) for errors
- Some sites block script execution (CSP)
- Try selecting text first to test basic functionality

### "Save to SHINEN failed" error
- Falls back to minimal save (URL only)
- Check if you're logged into SHINEN
- Verify network connection

## Development

### File Structure

```
chrome-extension/
├── manifest.json      # Extension manifest (MV3)
├── background.js      # Service worker (click handler + extraction)
├── icon16.png         # Toolbar icon (16x16)
├── icon48.png         # Extension page icon (48x48)
├── icon128.png        # Web store icon (128x128)
└── README.md          # This file
```

### Building Icons

Icons are not included in this minimal version. To add icons:

1. Create 16x16, 48x48, and 128x128 PNG images
2. Save as `icon16.png`, `icon48.png`, `icon128.png`
3. Use a simple design (e.g., SHINEN logo or bookmark icon)

Or use placeholder icons:
```bash
# Create placeholder icons (requires ImageMagick)
convert -size 16x16 xc:#D9A441 -fill white -pointsize 10 -annotate +2+12 'S' icon16.png
convert -size 48x48 xc:#D9A441 -fill white -pointsize 30 -annotate +8+36 'S' icon48.png
convert -size 128x128 xc:#D9A441 -fill white -pointsize 80 -annotate +20+96 'S' icon128.png
```

### Debugging

1. Open `chrome://extensions`
2. Find "Save to SHINEN"
3. Click **Inspect views: service worker**
4. Check Console tab for errors

## Version History

### v1.0.0 (Initial Release)
- One-click save to SHINEN
- Amazon/FANZA image extraction
- URL normalization
- JSON-LD support

## License

Same as SHINEN project

## Support

For issues or feature requests, contact SHINEN support.

## Chat Completion Beep (ChatGPT / Claude)

After reloading the extension, beep works without first click/keypress because playback is handled by an offscreen document.

### Quick Test

1. Reload the extension at `chrome://extensions`
2. Open `https://chatgpt.com/` or `https://claude.ai/`
3. Send a prompt and wait for generation to finish
4. You hear one high beep on normal completion, or two low beeps when error-like text is detected
5. If no sound, check tab mute state and macOS output device selection
