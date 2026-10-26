#!/usr/bin/env node
/* Record a 60-80s demo video walkthrough of TokenMetal.
   Uses Playwright's recordVideo. Produces a WebM file at public/demo.webm. */

import { chromium } from "playwright";
import { mkdir, rename, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoDir = join(__dirname, "..", "public", "demo-video");
await mkdir(videoDir, { recursive: true });

const BASE = process.env.TM_URL || "http://localhost:3000";
const SIZE = { width: 1440, height: 900 };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 1,
  recordVideo: { dir: videoDir, size: SIZE },
  storageState: {
    cookies: [],
    origins: [
      {
        origin: BASE,
        localStorage: [
          { name: "tm-skin", value: "metal" }
          // Deliberately NOT setting tm:questDone — we want the quest to appear
        ]
      }
    ]
  }
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[page error]", e.message));

async function type(text) { await page.waitForTimeout(400); }

console.log("Recording demo…");

// Act 1 — Landing (0:00 – 0:12)
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo({ top: 500, behavior: "smooth" }));
await page.waitForTimeout(2200);
await page.evaluate(() => window.scrollTo({ top: 1400, behavior: "smooth" }));
await page.waitForTimeout(2500);

// Act 2 — /invest with onboarding quest (0:12 – 0:40)
await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
await page.waitForSelector(".tmq .modal", { timeout: 8000 });
await page.waitForTimeout(2200);

// Start quest
await page.click('.tmq button[data-act="go"]');
await page.waitForTimeout(1800);

// Round 1 — pick option 1 (forest, low-medium risk)
await page.click('.tmq button[data-opt="1"]');
await page.waitForTimeout(1600);
await page.click('.tmq button[data-act="next"]');
await page.waitForTimeout(1500);

// Round 2 — pick option 1 (shelter / wait)
await page.click('.tmq button[data-opt="1"]');
await page.waitForTimeout(1600);
await page.click('.tmq button[data-act="next"]');
await page.waitForTimeout(1500);

// Round 3 — pick option 1 (ask first)
await page.click('.tmq button[data-opt="1"]');
await page.waitForTimeout(1600);
await page.click('.tmq button[data-act="next"]');
await page.waitForTimeout(2200); // character reveal

// Act 3 — Use profile → see /invest (0:40 – 0:48)
try {
  await page.click('.tmq button[data-act="use"]', { timeout: 3000 });
} catch {
  // fallback: close quest
  try { await page.click('.tmq button[data-act="skip"]'); } catch {}
}
await page.waitForTimeout(2000);

// Act 4 — Switch skins to showcase personality (0:48 – 1:10)
const skinOrder = ["glass", "plush", "grid", "metal"];
for (const skin of skinOrder) {
  await page.evaluate((s) => {
    localStorage.setItem("tm-skin", s);
    document.documentElement.dataset.skin = s;
  }, skin);
  await page.waitForTimeout(skin === "plush" ? 3200 : 2600);
}

// Act 5 — Pick a risk + fetch picks (practice mode) (1:10 – 1:25)
try {
  await page.getByRole("button", { name: /^high$/i }).first().click({ timeout: 2000 });
  await page.waitForTimeout(1200);
} catch {}
try {
  const btn = page.getByRole("button", { name: /show me my 3 picks|get opportunities/i }).first();
  if (await btn.isEnabled()) {
    await btn.click();
    await page.waitForTimeout(3500);
  }
} catch {}
await page.waitForTimeout(1500);

console.log("Finalizing video…");
await ctx.close();
await browser.close();

// Rename the WebM to a stable path
const files = await readdir(videoDir);
const webm = files.find((f) => f.endsWith(".webm"));
if (webm) {
  const target = join(__dirname, "..", "public", "demo.webm");
  await rename(join(videoDir, webm), target);
  console.log(`\n✓ Video saved to public/demo.webm`);
  console.log(`  Preview: ${BASE}/demo.webm`);
} else {
  console.log("⚠ no .webm file produced in", videoDir);
}
