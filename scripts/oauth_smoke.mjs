#!/usr/bin/env node
// OAuth smoke test — non-interactive, zero secrets in output
const BASE = "https://stillframe-phase0.vercel.app";
const SUPABASE = "https://zrfvqbygfkreuaivzvar.supabase.co";
const results = [];

async function check(label, url, opts = {}) {
  try {
    const res = await fetch(url, { redirect: "manual", ...opts });
    const status = res.status;
    const location = res.headers.get("location") || "";
    return { label, status, location, ok: true };
  } catch (e) {
    return { label, status: 0, location: "", ok: false, error: e.message };
  }
}

async function main() {
  console.log("=== OAuth Smoke Test ===\n");

  try {
    // Test 1: debug-auth key_length
    const r1 = await fetch(`${BASE}/api/debug-auth`);
    const d1 = await r1.json();
    const keyOk = d1.key_length >= 200;
    results.push({ label: "debug-auth key_length", value: d1.key_length, pass: keyOk });
    console.log(`[${keyOk ? "PASS" : "FAIL"}] debug-auth key_length=${d1.key_length}`);

    // Test 2: Supabase authorize → Google 302
    const authUrl = `${SUPABASE}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(BASE + "/auth/callback")}`;
    const r2 = await check("authorize→google", authUrl);
    const authOk = [301, 302, 303].includes(r2.status) && r2.location.includes("accounts.google.com");
    results.push({ label: "authorize redirect", status: r2.status, location_prefix: r2.location.slice(0, 80), pass: authOk });
    console.log(`[${authOk ? "PASS" : "FAIL"}] authorize status=${r2.status} location=${r2.location.slice(0, 80)}...`);

    // Test 3: callback without code → should redirect (302 to login or error page)
    const r3 = await check("callback bare", `${BASE}/auth/callback`);
    const cbOk = [301, 302, 303, 307, 308, 400].includes(r3.status);
    results.push({ label: "callback bare", status: r3.status, location_prefix: r3.location.slice(0, 80), pass: cbOk });
    console.log(`[${cbOk ? "PASS" : "FAIL"}] callback status=${r3.status} location=${r3.location.slice(0, 60)}`);
  } catch (err) {
    console.error(`[FATAL] Unexpected error: ${err.message}`);
    process.exit(1);
  }

  // Summary
  const allPass = results.every((r) => r.pass);
  console.log(`\n=== RESULT: ${allPass ? "PASS" : "FAIL"} ===`);
  process.exit(allPass ? 0 : 1);
}

main();
