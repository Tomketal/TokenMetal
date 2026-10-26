#!/usr/bin/env node
/* Render /pitch-deck.html as a proper landscape 1280x720 PDF with background
   graphics. The browser's native "Save as PDF" is unreliable because it uses
   the user's paper size and strips backgrounds by default. */

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.TM_URL || "http://localhost:3000";
const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "tokenmetal-pitch-deck.pdf");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[page error]", e.message));

console.log("Rendering deck → PDF…");
await page.goto(`${BASE}/pitch-deck.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

// Hide the floating toolbar before snapshot
await page.addStyleTag({ content: ".deck-toolbar, .print-help { display: none !important; }" });

// Wait for all images to settle (Next may lazy-load)
await page.evaluate(async () => {
  const imgs = Array.from(document.images);
  await Promise.all(imgs.map((i) => i.complete ? null : new Promise((res) => { i.onload = i.onerror = res; })));
});
await page.waitForTimeout(400);

await page.pdf({
  path: outPath,
  width: "1280px",
  height: "720px",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
  landscape: true
});

await ctx.close();
await browser.close();

console.log(`✓ wrote ${outPath}`);
console.log(`  download at: ${BASE}/tokenmetal-pitch-deck.pdf`);
