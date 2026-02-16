#!/usr/bin/env node

/**
 * Production AI Organize Endpoint Probe
 *
 * Deterministic probe for /api/ai-organize to establish ground truth about
 * production endpoint status, headers, and response format.
 *
 * Exit codes:
 * - 0: Endpoint exists (status != 404)
 * - 1: Endpoint returns 404 (deployment issue)
 * - 2: Network/fetch error
 */

const PROD_URL = "https://stillframe-phase0.vercel.app";

async function probeAiOrganize() {
  console.log("=== Production /api/ai-organize Probe ===\n");

  try {
    const response = await fetch(`${PROD_URL}/api/ai-organize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "probe-test" })
    });

    // Extract headers
    const status = response.status;
    const contentType = response.headers.get("content-type") || "unknown";
    const vercelId = response.headers.get("x-vercel-id") || "none";
    const vercelCache = response.headers.get("x-vercel-cache") || "none";

    // Read body (text first, then try JSON)
    const bodyText = await response.text();
    let bodyJson = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      // Not JSON, keep as text
    }

    // Print results
    console.log(`Status: ${status}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`X-Vercel-ID: ${vercelId}`);
    console.log(`X-Vercel-Cache: ${vercelCache}`);
    console.log();

    if (bodyJson) {
      console.log("Body (JSON):");
      console.log(JSON.stringify(bodyJson, null, 2));
    } else {
      const snippet = bodyText.slice(0, 200);
      console.log("Body (text, first 200 chars):");
      console.log(snippet);
      if (bodyText.length > 200) {
        console.log(`... (${bodyText.length - 200} more chars)`);
      }
    }
    console.log();

    // Verdict
    if (status === 404) {
      console.error("❌ FAIL: Endpoint returns 404 (deployment issue)");
      process.exit(1);
    } else {
      console.log(`✅ PASS: Endpoint exists (status ${status}, not 404)`);
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ FAIL: Network/fetch error:", error.message);
    process.exit(2);
  }
}

probeAiOrganize();
