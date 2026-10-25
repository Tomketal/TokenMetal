#!/usr/bin/env node
/* Capture product screenshots of /invest in each skin, plus the landing hero and
   onboarding quest. Run against the local dev server (default http://localhost:3001).

   Usage:  node scripts/screenshot.mjs
*/

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "screenshots");

const BASE = process.env.TM_URL || "http://localhost:3001";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const SKINS = ["metal", "glass", "plush", "grid"];

async function run() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();

  // ---------- desktop invest page in every skin ----------
  for (const skin of SKINS) {
    const context = await browser.newContext({
      viewport: DESKTOP,
      deviceScaleFactor: 2,
      storageState: {
        cookies: [],
        origins: [
          {
            origin: BASE,
            localStorage: [
              { name: "tm-skin", value: skin },
              { name: "tm:questDone", value: "1" }
            ]
          }
        ]
      }
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });

    // Wait for the device to render fully (fonts, images, WebGL for plush)
    await page.waitForTimeout(skin === "plush" ? 1800 : 900);

    const file = join(outDir, `invest-${skin}-desktop.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`✓ ${file}`);

    await context.close();
  }

  // ---------- mobile invest page in Metal + Plush ----------
  for (const skin of ["metal", "plush"]) {
    const context = await browser.newContext({
      viewport: MOBILE,
      deviceScaleFactor: 2,
      storageState: {
        cookies: [],
        origins: [
          {
            origin: BASE,
            localStorage: [
              { name: "tm-skin", value: skin },
              { name: "tm:questDone", value: "1" }
            ]
          }
        ]
      }
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
    await page.waitForTimeout(skin === "plush" ? 1800 : 900);

    const file = join(outDir, `invest-${skin}-mobile.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`✓ ${file}`);

    await context.close();
  }

  // ---------- onboarding quest intro screen ----------
  {
    const context = await browser.newContext({
      viewport: DESKTOP,
      deviceScaleFactor: 2
      // no localStorage -> quest will auto-open
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const file = join(outDir, "quest-intro.png");
    await page.screenshot({ path: file, fullPage: false });
    console.log(`✓ ${file}`);
    await context.close();
  }

  // ---------- landing hero (desktop + mobile) ----------
  for (const [name, viewport] of [
    ["landing-desktop", DESKTOP],
    ["landing-mobile", MOBILE]
  ]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const file = join(outDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`✓ ${file}`);
    await context.close();
  }

  await browser.close();
  console.log("\nAll screenshots saved to public/screenshots/");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
