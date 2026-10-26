#!/usr/bin/env node
/* Comprehensive demo screenshot matrix for TokenMetal pitch.
   Captures landing + /invest in every skin, onboarding quest at each step,
   both desktop and mobile viewports. Saves to public/screenshots/demo/. */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "screenshots", "demo");
await mkdir(outDir, { recursive: true });

const BASE = process.env.TM_URL || "http://localhost:3000";
const SKINS = ["metal", "glass", "plush", "grid", "cryptodays"];
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const ok = [];
const fail = [];

const browser = await chromium.launch();

function skinState(skin, questDone = true) {
  const items = [{ name: "tm-skin", value: skin }];
  if (questDone) items.push({ name: "tm:questDone", value: "1" });
  return { cookies: [], origins: [{ origin: BASE, localStorage: items }] };
}

async function ctxFor(skin, viewport, { quest = false } = {}) {
  return browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    storageState: skinState(skin, !quest)
  });
}

async function shot(file, fn) {
  try {
    await fn();
    ok.push(file);
    console.log("✓", file);
  } catch (err) {
    fail.push({ file, error: err.message });
    console.error("✗", file, err.message);
  }
}

// 1) Landing (desktop + mobile)
for (const [name, vp] of [["landing-desktop", DESKTOP], ["landing-mobile", MOBILE]]) {
  await shot(`${name}.png`, async () => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
    await ctx.close();
  });
}

// 2) /invest INITIAL per skin, desktop + mobile
for (const skin of SKINS) {
  for (const [label, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
    const file = `invest-${skin}-${label}.png`;
    await shot(file, async () => {
      const ctx = await ctxFor(skin, vp);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
      await page.waitForTimeout(skin === "plush" ? 2400 : 1600);
      await page.screenshot({ path: join(outDir, file), fullPage: false });
      await ctx.close();
    });
  }
}

// 3) /invest with risk HIGH selected + picks fetched (practice mode)
for (const skin of SKINS) {
  for (const [label, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
    const file = `invest-${skin}-picks-${label}.png`;
    await shot(file, async () => {
      const ctx = await ctxFor(skin, vp);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
      await page.waitForTimeout(skin === "plush" ? 2400 : 1600);
      try {
        const high = page.getByRole("button", { name: /^high$/i }).first();
        await high.click({ timeout: 2000 });
        await page.waitForTimeout(400);
      } catch {}
      try {
        const btn = page.getByRole("button", { name: /show me my 3 picks|get opportunities|finding your 3 picks/i }).first();
        if (await btn.isEnabled()) {
          await btn.click({ timeout: 2000 });
          await page.waitForTimeout(2800);
        }
      } catch {}
      await page.screenshot({ path: join(outDir, file), fullPage: false });
      await ctx.close();
    });
  }
}

// 4) Onboarding quest INTRO per skin, desktop + mobile
for (const skin of SKINS) {
  for (const [label, vp] of [["desktop", DESKTOP], ["mobile", MOBILE]]) {
    const file = `quest-intro-${skin}-${label}.png`;
    await shot(file, async () => {
      const ctx = await browser.newContext({
        viewport: vp,
        deviceScaleFactor: 2,
        storageState: skinState(skin, /* questDone */ false)
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
      await page.waitForSelector(".tmq .modal", { timeout: 8000 });
      await page.waitForTimeout(skin === "plush" ? 1800 : 1000);
      await page.screenshot({ path: join(outDir, file), fullPage: false });
      await ctx.close();
    });
  }
}

// 5) Onboarding quest ROUND 1 (path) — plush skin only for personality
await shot(`quest-round1-plush-desktop.png`, async () => {
  const ctx = await browser.newContext({
    viewport: DESKTOP, deviceScaleFactor: 2,
    storageState: skinState("plush", false)
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await page.waitForSelector(".tmq .modal", { timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.click('.tmq button[data-act="go"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, "quest-round1-plush-desktop.png"), fullPage: false });
  await ctx.close();
});

// 6) Quest character reveal — pick first option 3 times
await shot(`quest-reveal-metal-desktop.png`, async () => {
  const ctx = await browser.newContext({
    viewport: DESKTOP, deviceScaleFactor: 2,
    storageState: skinState("metal", false)
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await page.waitForSelector(".tmq .modal", { timeout: 8000 });
  await page.waitForTimeout(1000);
  await page.click('.tmq button[data-act="go"]');
  for (let r = 0; r < 3; r++) {
    await page.waitForTimeout(600);
    await page.click('.tmq button[data-opt="0"]');
    await page.waitForTimeout(500);
    const next = await page.$('.tmq button[data-act="next"]');
    if (next) await next.click();
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(outDir, "quest-reveal-metal-desktop.png"), fullPage: false });
  await ctx.close();
});

await browser.close();

console.log("\n----- demo-shots summary -----");
console.log(`ok:      ${ok.length}`);
console.log(`failed:  ${fail.length}`);
for (const f of fail) console.log("  ✗", f.file, "—", f.error);
