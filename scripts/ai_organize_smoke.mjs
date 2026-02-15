#!/usr/bin/env node

/**
 * AI Organize Smoke Test
 *
 * Verifies that /api/ai-organize correctly rejects unauthenticated requests.
 * This is a regression check - we don't test the full AI flow (which requires auth + OpenAI key),
 * just that the endpoint exists and has basic auth protection.
 *
 * Expected error format: { error: { code: "ERROR_CODE", message: "..." } } or legacy { error: "..." }
 */

const PROD_URL = "https://stillframe-phase0.vercel.app";

async function testAiOrganize() {
  console.log("Testing /api/ai-organize authentication...");

  try {
    const response = await fetch(`${PROD_URL}/api/ai-organize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: "test-id" })
    });

    // Expect 401 (Unauthorized) or 403 (Forbidden)
    if (response.status !== 401 && response.status !== 403) {
      console.error(`❌ FAIL: Expected 401/403 for unauthenticated request, got ${response.status}`);
      process.exit(1);
    }

    const body = await response.json();
    if (!body.error) {
      console.error("❌ FAIL: Response missing 'error' field");
      console.error("Body:", body);
      process.exit(1);
    }

    console.log(`✅ PASS: AI organize correctly rejects unauthenticated requests (${response.status})`);
  } catch (error) {
    console.error("❌ FAIL: Request error:", error.message);
    process.exit(1);
  }
}

testAiOrganize();
