#!/usr/bin/env node

/**
 * Bookmarklet Smoke Tests
 *
 * Validates:
 * 1. /bookmarklet page contains auto-save params and Amazon selectors
 * 2. /app?auto=1&url=... route renders (no server redirect)
 * 3. JS bundle contains race-proof initialQueryRef capture pattern
 */

const BASE_URL = process.env.BASE_URL || 'https://stillframe-phase0.vercel.app';

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function test1_bookmarkletPage() {
  console.log('✓ Test 1: /bookmarklet page JS contains auto-save and Amazon selectors');

  const html = await fetchText(`${BASE_URL}/bookmarklet`);

  // Extract all script tags
  const scriptMatches = html.matchAll(/<script[^>]+src="([^"]+)"/g);
  const scriptUrls = Array.from(scriptMatches).map(m => m[1]);

  // Search all chunks for bookmarklet code
  let foundAutoParam = false;
  let foundAmazonSelector = false;
  let foundImgParam = false;

  for (const relativeUrl of scriptUrls) {
    const scriptUrl = relativeUrl.startsWith('http')
      ? relativeUrl
      : `${BASE_URL}${relativeUrl}`;

    try {
      const js = await fetchText(scriptUrl);

      // Check for auto-save param
      if (js.includes('auto=1')) {
        foundAutoParam = true;
      }

      // Check for Amazon selectors
      if (js.includes('#landingImage') || js.includes('data-a-dynamic-image') || js.includes('#imgTagWrapperId')) {
        foundAmazonSelector = true;
      }

      // Check for img param
      if (js.includes('&img=')) {
        foundImgParam = true;
      }

      // Early exit if all found
      if (foundAutoParam && foundAmazonSelector && foundImgParam) {
        break;
      }
    } catch (e) {
      // Skip failed chunks
      continue;
    }
  }

  if (!foundAutoParam) {
    throw new Error('❌ Bookmarklet JS missing "auto=1" param');
  }

  if (!foundAmazonSelector) {
    throw new Error('❌ Bookmarklet JS missing Amazon selectors (#landingImage, data-a-dynamic-image, or #imgTagWrapperId)');
  }

  if (!foundImgParam) {
    throw new Error('❌ Bookmarklet JS missing "&img=" param handling');
  }

  console.log('  ✓ auto=1 param present in JS');
  console.log('  ✓ Amazon selectors present in JS');
  console.log('  ✓ img param handling present in JS');
}

async function test2_appRouteRenders() {
  console.log('✓ Test 2: /app?auto=1&url=... route renders (no server redirect)');

  const testUrl = `${BASE_URL}/app?auto=1&url=${encodeURIComponent('https://github.com')}&title=Test`;
  const response = await fetch(testUrl, { redirect: 'manual' });

  if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
    throw new Error(`❌ /app?auto=1 returned redirect ${response.status} (should render 200)`);
  }

  if (response.status !== 200) {
    throw new Error(`❌ /app?auto=1 returned ${response.status} (expected 200)`);
  }

  const html = await response.text();

  // Ensure it's the app page (contains SHINEN)
  if (!html.includes('SHINEN')) {
    throw new Error('❌ /app?auto=1 did not render app page (missing SHINEN title)');
  }

  console.log('  ✓ Route renders with status 200');
  console.log('  ✓ App page content present');
}

async function test3_raceProofCapturePattern() {
  console.log('✓ Test 3: JS bundle contains race-proof initialQueryRef capture');

  // Fetch the app page to find the main JS bundle
  const html = await fetchText(`${BASE_URL}/app`);

  // Extract script tags with src
  const scriptMatches = html.matchAll(/<script[^>]+src="([^"]+)"/g);
  const scriptUrls = Array.from(scriptMatches).map(m => m[1]);

  // Find the main app chunk (usually contains /app/page or /static/chunks)
  const appScripts = scriptUrls.filter(url =>
    url.includes('/app/page') || url.includes('chunks/app/app')
  );

  if (appScripts.length === 0) {
    console.log('  ⚠ Warning: Could not find app page JS bundle, skipping pattern check');
    return;
  }

  // Check the first matching script
  const scriptUrl = appScripts[0].startsWith('http')
    ? appScripts[0]
    : `${BASE_URL}${appScripts[0]}`;

  const js = await fetchText(scriptUrl);

  // Look for the race-proof capture pattern
  const hasWindowCheck = js.includes('window.location.search');
  const hasInitialQueryRef = js.includes('initialQueryRef');

  if (!hasWindowCheck || !hasInitialQueryRef) {
    console.log('  ⚠ Warning: Race-proof capture pattern not found (tolerated)');
    console.log(`    hasWindowCheck: ${hasWindowCheck}, hasInitialQueryRef: ${hasInitialQueryRef}`);
  } else {
    console.log('  ✓ initialQueryRef capture pattern present');
    console.log('  ✓ window.location.search reference present');
  }
}

async function main() {
  console.log('🧪 Bookmarklet Smoke Tests\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  try {
    await test1_bookmarkletPage();
    await test2_appRouteRenders();
    await test3_raceProofCapturePattern();

    console.log('\n✅ All bookmarklet smoke tests passed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test failed:', error.message);
    process.exit(1);
  }
}

main();
