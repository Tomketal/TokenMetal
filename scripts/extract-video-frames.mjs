#!/usr/bin/env node
/* Extract frames from Token Metal demo live.mp4 by playing in a headless
   Chromium page and screenshotting at specified timestamps. */
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "screenshots", "video-frames");
await mkdir(OUT, { recursive: true });

const VIDEO = "http://localhost:3000/screenshots/Token%20Metal%20demo%20live.mp4";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const html = `
<!doctype html>
<html><body style="margin:0;background:#000;display:grid;place-items:center;height:100vh;">
<video id="v" src="${VIDEO}" muted playsinline preload="auto" style="max-width:100%;max-height:100%;"></video>
</body></html>`;
await page.setContent(html);
await page.waitForFunction(() => {
  const v = document.getElementById("v");
  return v && v.readyState >= 1 && isFinite(v.duration) && v.duration > 0;
}, { timeout: 30000 });

const duration = await page.evaluate(() => document.getElementById("v").duration);
console.log(`video duration: ${duration.toFixed(1)}s`);

// Sample 20 frames uniformly across the video
const samples = 20;
for (let i = 0; i < samples; i++) {
  const t = (duration * (i + 0.5)) / samples;
  await page.evaluate((tt) => new Promise((res) => {
    const v = document.getElementById("v");
    v.onseeked = () => res();
    v.currentTime = tt;
  }), t);
  await page.waitForTimeout(200);
  const file = join(OUT, `frame-${String(i + 1).padStart(2, "0")}-t${t.toFixed(0)}s.png`);
  await page.locator("video").screenshot({ path: file });
  console.log(`✓ ${file}`);
}
await browser.close();
console.log("done");
