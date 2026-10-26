#!/usr/bin/env node
/* Capture product screenshots across all 5 skins for the pitch deck.
   Writes to public/screenshots/pitch/. Run against local dev server. */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "screenshots", "pitch");
await mkdir(outDir, { recursive: true });

const BASE = process.env.TM_URL || "http://localhost:3000";
const SKINS = ["metal", "glass", "plush", "grid", "cryptodays"];
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const ok = [];
const fail = [];
const skipped = [];

const browser = await chromium.launch();

async function capture(skin, viewport, label, { withPicks = false } = {}) {
  const file = `${skin}-${label}.png`;
  const ctx = await browser.newContext({
    viewport,
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
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[err ${file}]`, e.message));
  try {
    await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
    await page.waitForTimeout(skin === "plush" ? 2400 : 1600);
    if (withPicks) {
      try {
        const btn = page.getByRole("button", { name: /get opportunities/i }).first();
        await btn.waitFor({ timeout: 3000 });
        if (await btn.isEnabled()) {
          await btn.click();
          await page.waitForTimeout(2600);
        } else {
          skipped.push(file + " (button disabled)");
        }
      } catch {
        skipped.push(file + " (no get-opp button)");
      }
    }
    await page.screenshot({ path: join(outDir, file), fullPage: false });
    ok.push(file);
    console.log("✓", file);
  } catch (err) {
    fail.push({ file, error: err.message });
    console.error("✗", file, err.message);
  } finally {
    await ctx.close();
  }
}

for (const skin of SKINS) {
  await capture(skin, DESKTOP, "desktop");
  await capture(skin, MOBILE, "mobile");
  await capture(skin, DESKTOP, "picks-desktop", { withPicks: true });
  await capture(skin, MOBILE, "picks-mobile", { withPicks: true });
}

await browser.close();

console.log("\n----- pitch-shots summary -----");
console.log(`ok:      ${ok.length}`);
console.log(`skipped: ${skipped.length}`);
console.log(`failed:  ${fail.length}`);
for (const s of skipped) console.log("  …", s);
for (const f of fail) console.log("  ✗", f.file, "—", f.error);
