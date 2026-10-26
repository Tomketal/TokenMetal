#!/usr/bin/env node
/* Record the features-demo.html slideshow as a WebM video.
   Plays one full loop (sum of per-scene dur values + small cushion). */
import { chromium } from "playwright";
import { mkdir, rename, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoDir = join(__dirname, "..", "public", "features-demo-video");
await mkdir(videoDir, { recursive: true });

const BASE = process.env.TM_URL || "http://localhost:3000";
const SIZE = { width: 1440, height: 900 };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 1,
  recordVideo: { dir: videoDir, size: SIZE }
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[page error]", e.message));

console.log("Recording features demo…");
await page.goto(`${BASE}/features-demo.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Total duration = sum of data-dur + a 500ms cushion per scene for transitions.
const totalMs = await page.evaluate(() => {
  const scenes = document.querySelectorAll(".scene");
  let sum = 0;
  scenes.forEach((s) => { sum += Number(s.dataset.dur || 4000) + 500; });
  return sum + 1000; // + 1s wrap
});
console.log(`Running for ${(totalMs / 1000).toFixed(1)}s…`);
await page.waitForTimeout(totalMs);

await ctx.close();
await browser.close();

const files = await readdir(videoDir);
const webm = files.find((f) => f.endsWith(".webm"));
if (webm) {
  const target = join(__dirname, "..", "public", "features-demo.webm");
  await rename(join(videoDir, webm), target);
  console.log(`✓ saved to public/features-demo.webm`);
  console.log(`  preview: ${BASE}/features-demo.webm`);
} else {
  console.log("⚠ no .webm found in", videoDir);
}
