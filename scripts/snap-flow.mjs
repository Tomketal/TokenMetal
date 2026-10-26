#!/usr/bin/env node
/* Capture the 4 actual-user-flow shots for the pitch deck slide 5. */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "screenshots", "flow");
await mkdir(outDir, { recursive: true });

const BASE = "http://localhost:3000";
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

const browser = await chromium.launch();

function state(skin, questDone) {
  const items = [{ name: "tm-skin", value: skin }];
  if (questDone) items.push({ name: "tm:questDone", value: "1" });
  return { cookies: [], origins: [{ origin: BASE, localStorage: items }] };
}

// Shot 1 — Quest intro (metal)
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("metal", false) });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForSelector(".tmq .modal", { timeout: 8000 });
  await p.waitForTimeout(1200);
  await p.locator(".tmq .modal").screenshot({ path: join(outDir, "01-quest-intro.png") });
  await ctx.close();
  console.log("✓ 01-quest-intro");
}

// Shot 2 — Round 1 (the path)
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("metal", false) });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForSelector(".tmq .modal", { timeout: 8000 });
  await p.waitForTimeout(1200);
  await p.click('.tmq button[data-act="go"]');
  await p.waitForTimeout(1200);
  await p.locator(".tmq .modal").screenshot({ path: join(outDir, "02-quest-path.png") });
  await ctx.close();
  console.log("✓ 02-quest-path");
}

// Shot 3 — Character reveal
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("metal", false) });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForSelector(".tmq .modal", { timeout: 8000 });
  await p.waitForTimeout(1000);
  await p.click('.tmq button[data-act="go"]');
  for (let r = 0; r < 3; r++) {
    await p.waitForTimeout(500);
    await p.click('.tmq button[data-opt="1"]');
    await p.waitForTimeout(500);
    const next = await p.$('.tmq button[data-act="next"]');
    if (next) await next.click();
  }
  await p.waitForTimeout(1200);
  await p.locator(".tmq .modal").screenshot({ path: join(outDir, "03-character-reveal.png") });
  await ctx.close();
  console.log("✓ 03-character-reveal");
}

// Shot 4 — The app with picks (grid skin + practice mode, scrolled to picks)
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("grid", true) });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  try {
    const high = p.getByRole("button", { name: /^high$/i }).first();
    await high.click({ timeout: 2000 });
    await p.waitForTimeout(500);
  } catch {}
  try {
    const btn = p.getByRole("button", { name: /show me my 3 picks|get opportunities/i }).first();
    if (await btn.isEnabled()) {
      await btn.click({ timeout: 2000 });
      await p.waitForTimeout(2800);
    }
  } catch {}
  // Scroll to the picks screen on mobile
  try {
    const picksScreen = p.locator(".opportunities-screen, .screen-title, [class*='picks']").first();
    await picksScreen.scrollIntoViewIfNeeded({ timeout: 2000 });
    await p.waitForTimeout(500);
  } catch {
    await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.55, behavior: "instant" }));
  }
  await p.screenshot({ path: join(outDir, "04-picks.png"), fullPage: false });
  await ctx.close();
  console.log("✓ 04-picks");
}

await browser.close();
console.log("done");
