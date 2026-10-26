#!/usr/bin/env node
/* Capture deeper product-feature screenshots for the pitch deck:
   control module, risk pills, picks screen, positions, skin switcher. */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "screenshots", "features");
await mkdir(outDir, { recursive: true });

const BASE = "http://localhost:3000";
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const browser = await chromium.launch();

function state(skin) {
  return {
    cookies: [],
    origins: [{ origin: BASE, localStorage: [
      { name: "tm-skin", value: skin },
      { name: "tm:questDone", value: "1" }
    ]}]
  };
}

// Shot A — the control module (risk + capital + holding) at MEDIUM risk, metal skin
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("metal") });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  // Scroll past wallet dock to show the control panel
  const control = p.locator(".control-module").first();
  try {
    await control.scrollIntoViewIfNeeded({ timeout: 2000 });
    await p.waitForTimeout(400);
  } catch {}
  await p.screenshot({ path: join(outDir, "a-controls.png"), fullPage: false });
  await ctx.close();
  console.log("✓ a-controls");
}

// Shot B — picks screen with 3 token cards (grid skin + practice mode, scrolled)
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("grid") });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  try {
    await p.getByRole("button", { name: /^high$/i }).first().click({ timeout: 2000 });
    await p.waitForTimeout(400);
  } catch {}
  try {
    const btn = p.getByRole("button", { name: /show me my 3 picks|get opportunities/i }).first();
    if (await btn.isEnabled()) {
      await btn.click({ timeout: 2000 });
      await p.waitForTimeout(3200);
    }
  } catch {}
  // Scroll so the picks screen is centered
  try {
    const picks = p.locator(".opportunities-screen, .screen-title").first();
    await picks.scrollIntoViewIfNeeded({ timeout: 2000 });
    await p.waitForTimeout(400);
  } catch {
    await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight * 0.5, behavior: "instant" }));
  }
  await p.screenshot({ path: join(outDir, "b-picks.png"), fullPage: false });
  await ctx.close();
  console.log("✓ b-picks");
}

// Shot C — positions panel (empty state is fine, shows the tracking feature)
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("glass") });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  try {
    const positions = p.locator(".positions-panel, [class*='position']").first();
    await positions.scrollIntoViewIfNeeded({ timeout: 2000 });
    await p.waitForTimeout(400);
  } catch {
    await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  }
  await p.screenshot({ path: join(outDir, "c-positions.png"), fullPage: false });
  await ctx.close();
  console.log("✓ c-positions");
}

// Shot D — skin switcher open (shows the 5-skin system in action)
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("metal") });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  try {
    await p.click(".skin-switcher-button", { timeout: 2000 });
    await p.waitForTimeout(500);
  } catch {}
  await p.screenshot({ path: join(outDir, "d-skin-switcher.png"), fullPage: false });
  await ctx.close();
  console.log("✓ d-skin-switcher");
}

// Shot E — practice mode banner (shows the "try without a wallet" feature)
{
  const ctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 2, storageState: state("metal") });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  // scroll to the bottom banner "Practice mode: no real trade"
  try {
    const practice = p.locator("text=Practice mode").first();
    await practice.scrollIntoViewIfNeeded({ timeout: 2000 });
    await p.waitForTimeout(400);
  } catch {
    await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  }
  await p.screenshot({ path: join(outDir, "e-practice-mode.png"), fullPage: false });
  await ctx.close();
  console.log("✓ e-practice-mode");
}

await browser.close();
console.log("done");
