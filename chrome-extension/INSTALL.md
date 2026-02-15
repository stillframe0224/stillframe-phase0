# Quick Install Guide

## Step 1: Create Icons (Required)

Chrome extensions require icon files. Create placeholder icons:

### Option A: Use online icon generator
1. Go to https://www.favicon-generator.org/
2. Upload any image or create a simple design
3. Download as PNG
4. Rename files to: `icon16.png`, `icon48.png`, `icon128.png`
5. Place in `chrome-extension/` folder

### Option B: Use ImageMagick (command line)
```bash
cd chrome-extension
convert -size 16x16 xc:#D9A441 -fill white -gravity center -pointsize 10 -annotate +0+0 'S' icon16.png
convert -size 48x48 xc:#D9A441 -fill white -gravity center -pointsize 30 -annotate +0+0 'S' icon48.png
convert -size 128x128 xc:#D9A441 -fill white -gravity center -pointsize 80 -annotate +0+0 'S' icon128.png
```

### Option C: Download from project assets (if available)
Use existing SHINEN logo/icon and resize to 16x16, 48x48, 128x128.

---

## Step 2: Load Extension in Chrome

1. **Open Extensions Page**
   - Navigate to: `chrome://extensions`
   - Or: Chrome menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the switch in the top-right corner
   - You should see "Load unpacked" button appear

3. **Load the Extension**
   - Click **Load unpacked**
   - Navigate to the `chrome-extension` folder
   - Click **Select Folder**

4. **Verify Installation**
   - "Save to SHINEN" should appear in the extensions list
   - Extension ID will be shown (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

5. **Pin to Toolbar** (Recommended)
   - Click the puzzle icon (Extensions) in Chrome toolbar
   - Find "Save to SHINEN"
   - Click the **pin icon** to make it always visible

---

## Step 3: Test

### Quick Test (GitHub)
1. Go to https://github.com/anthropics/anthropic-sdk-typescript
2. Click the "Save to SHINEN" icon
3. SHINEN should open and show "Saved" banner

### Amazon Test
1. Go to any Amazon product page
2. Click "Save to SHINEN"
3. Card should include high-resolution product image

### FANZA Test (if applicable)
1. Visit a FANZA product page
2. Click "Save to SHINEN"
3. Image should be from `pics.dmm.co.jp`

---

## Troubleshooting

### Icons not showing / "Could not load icon" error
**Solution**: Create the icon files (see Step 1 above). The extension requires at least one icon file to load.

### "This extension may not be safe" warning
**Solution**: This is normal for unpacked extensions. Click "Ignore" or dismiss the warning. The code is open-source and you can inspect `background.js`.

### Extension doesn't appear in toolbar
**Solution**:
1. Check if it's in the Extensions menu (puzzle icon)
2. Pin it to toolbar
3. Reload the extension: `chrome://extensions` → click refresh icon

### "Save to SHINEN failed" in console
**Solution**:
- Check if you're logged into SHINEN (visit https://stillframe-phase0.vercel.app/app)
- Try the fallback: Extension still opens SHINEN with URL, just without image

### No image captured
**Solution**:
- Some sites block script execution (CSP headers)
- Extension will still save URL + title
- Amazon/FANZA should work reliably

---

## Updating the Extension

After making changes to `background.js` or `manifest.json`:

1. Go to `chrome://extensions`
2. Find "Save to SHINEN"
3. Click the **refresh icon** (circular arrow)
4. Test the updated functionality

---

## Uninstalling

1. Go to `chrome://extensions`
2. Find "Save to SHINEN"
3. Click **Remove**
4. Confirm deletion

---

## Next Steps

- Set up keyboard shortcut: Chrome Settings → Extensions → Keyboard shortcuts → Assign Alt+S
- Customize icon with SHINEN branding
- Submit feedback if image extraction fails on specific sites
