#!/usr/bin/env node
/* For each skin, capture the control module in use (risk + capital + holding).
   This shows the actual product in action per skin, not the top-of-page banner. */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "screenshots", "features");
await mkdir(outDir, { recursive: true });

const BASE = "http://localhost:3000";
const MOBILE = { width: 390, height: 844 };
const browser = await chromium.launch();

const SKINS = ["metal", "glass", "plush", "grid"];

for (const skin of SKINS) {
  const ctx = await browser.newContext({
    viewport: MOBILE, deviceScaleFactor: 2,
    storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [
      { name: "tm-skin", value: skin },
      { name: "tm:questDone", value: "1" }
    ]}]}
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForTimeout(skin === "plush" ? 2400 : 1500);
  // Click High so the risk is visually set
  try {
    await p.getByRole("button", { name: /^high$/i }).first().click({ timeout: 2000 });
    await p.waitForTimeout(400);
  } catch {}
  // Scroll so the control module is centered
  try {
    const control = p.locator(".control-module").first();
    await control.scrollIntoViewIfNeeded({ timeout: 2000 });
    await p.waitForTimeout(500);
  } catch {}
  await p.screenshot({ path: join(outDir, `skin-${skin}-controls.png`), fullPage: false });
  await ctx.close();
  console.log(`✓ skin-${skin}-controls`);
}

await browser.close();
console.log("done");
