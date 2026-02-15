# Test Checklist

## Prerequisites
- [ ] Extension installed (`chrome://extensions` shows "Save to SHINEN")
- [ ] Logged into SHINEN (https://stillframe-phase0.vercel.app/app)
- [ ] Extension pinned to toolbar (visible icon)

---

## Quick Test (GitHub - 2 min)

**URL**: https://github.com/anthropics/anthropic-sdk-typescript

**Steps**:
1. Navigate to the repository page
2. (Optional) Select some text from README
3. Click "Save to SHINEN" icon

**Expected**:
- [ ] New tab opens with SHINEN
- [ ] Green "Saved" banner appears
- [ ] Card shows: GitHub repo URL, title
- [ ] Card image: GitHub social preview or avatar
- [ ] Selected text (if any) appears in card

**Debug** (if failed):
- Check `chrome://extensions` → Inspect service worker → Console tab
- Check SHINEN Network tab for `POST /rest/v1/cards`

---

## Amazon Test (3 min)

**URL**: https://www.amazon.com/dp/B0CX23V2ZK (or any product)

**Steps**:
1. Navigate to product page
2. Click "Save to SHINEN"

**Expected**:
- [ ] Card shows: Product URL, title
- [ ] **Image is high-resolution product image** (from `data-a-dynamic-image`)
- [ ] Image URL starts with `https://m.media-amazon.com/` or `https://images-na.ssl-images-amazon.com/`

**Debug**:
- Inspect service worker → Console → Check for `landingImage` extraction
- Verify `img` parameter in opened URL contains `media-amazon.com`

---

## FANZA Test (3 min)

**URL**: https://www.dmm.co.jp/digital/videoa/-/detail/=/cid=... (or any product)

**Steps**:
1. Navigate to FANZA/DMM product page
2. Click "Save to SHINEN"

**Expected**:
- [ ] Card shows: Product URL, title
- [ ] **Image from `pics.dmm.co.jp`**
- [ ] Image URL: `https://pics.dmm.co.jp/...` (NOT `//pics.dmm.co.jp/...`)

**Debug**:
- Check service worker console for FANZA extraction
- Verify `norm()` function converted `//pics.dmm.co.jp` → `https://pics.dmm.co.jp`

---

## URL Normalization Test (2 min)

Test protocol-relative and double-encoded URLs.

**Manual Test**:
1. Open any site
2. Open service worker console (`chrome://extensions` → Inspect)
3. Run in console:
```javascript
chrome.scripting.executeScript({
  target: { tabId: /* current tab ID */ },
  func: () => {
    function norm(raw) {
      if (!raw) return null;
      let x = raw.trim();
      if (!x) return null;
      if (x.includes('%2F') || x.includes('%3A')) {
        try {
          const decoded = decodeURIComponent(x);
          if (/^https?:\/\//.test(decoded) || /^\/\//.test(decoded)) {
            x = decoded;
          }
        } catch (e) {}
      }
      if (x.startsWith('//')) {
        x = 'https:' + x;
      }
      if (x.startsWith('/')) {
        try {
          x = new URL(x, location.href).href;
        } catch (e) {
          return null;
        }
      }
      if (!/^https?:\/\//.test(x)) {
        return null;
      }
      return x.slice(0, 2000);
    }

    // Test cases
    console.log('Test 1 (protocol-relative):', norm('//pics.dmm.co.jp/img.jpg'));
    console.log('Test 2 (double-encoded):', norm('https%3A%2F%2Fexample.com%2Fimage.jpg'));
    console.log('Test 3 (relative path):', norm('/images/logo.png'));
    return 'Tests completed - check console';
  }
});
```

**Expected Console Output**:
```
Test 1 (protocol-relative): https://pics.dmm.co.jp/img.jpg
Test 2 (double-encoded): https://example.com/image.jpg
Test 3 (relative path): https://[current-domain]/images/logo.png
```

---

## Edge Cases (Optional - 5 min)

### CSP-blocked sites
**URL**: https://developer.mozilla.org/en-US/

**Expected**:
- [ ] Fallback save works (URL + title, no image)
- [ ] No console errors (or graceful error handling)

### Sites without images
**URL**: https://news.ycombinator.com/

**Expected**:
- [ ] Card saves with URL + title
- [ ] No image (or fallback SVG)
- [ ] No errors

### Selected text
**URL**: Any site

**Steps**:
1. Select 2-3 paragraphs of text
2. Click "Save to SHINEN"

**Expected**:
- [ ] Selected text appears in card body (after URL)
- [ ] Truncated to 1200 chars if longer

---

## Performance Test (1 min)

**Steps**:
1. Click "Save to SHINEN" on 5 different sites rapidly
2. Check all cards saved correctly

**Expected**:
- [ ] All 5 cards created
- [ ] No duplicates
- [ ] No "Save failed" errors

---

## Summary

**Pass Criteria**:
- [ ] GitHub test: ✅ (URL + image + optional selection)
- [ ] Amazon test: ✅ (High-res product image)
- [ ] FANZA test: ✅ (pics.dmm.co.jp image, normalized to https://)
- [ ] No console errors on standard sites

**If any test fails**:
1. Check service worker console for specific error
2. Verify SHINEN is logged in and accessible
3. Test with fallback: Remove image extraction code and test URL-only save
4. Report issue with: Site URL + Console error + Expected vs actual behavior
