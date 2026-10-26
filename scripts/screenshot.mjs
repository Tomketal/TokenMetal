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

const successes = [];
const failures = [];

function attachPageDiagnostics(page, label) {
  page.on("pageerror", (err) => {
    console.error(`[page error] (${label})`, err.message);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error(`[console error] (${label})`, msg.text());
    }
  });
}

// Simulate a user action on the invest page so each skin shot captures a
// different stage of the flow. `action` is one of the keys below; omit it
// (or pass "default") to capture the initial just-loaded state.
async function performInvestAction(page, action) {
  if (!action || action === "default") return;

  if (action === "medium-risk") {
    await page.locator(".risk-dot", { hasText: "Medium" }).click();
  } else if (action === "high-risk-capital-75") {
    await page.locator(".risk-dot", { hasText: "High" }).click();
    await page.evaluate(() => {
      const sliders = document.querySelectorAll('input[type="range"]');
      const s = sliders[0];
      if (!s) return;
      s.value = 75;
      s.dispatchEvent(new Event("input", { bubbles: true }));
      s.dispatchEvent(new Event("change", { bubbles: true }));
    });
  } else if (action === "low-risk-holding") {
    await page.locator(".risk-dot", { hasText: "Low" }).click();
    await page.evaluate(() => {
      const sliders = document.querySelectorAll('input[type="range"]');
      const s = sliders[1];
      if (!s) return;
      // Pick a middle-ish value distinct from the default
      s.value = 30;
      s.dispatchEvent(new Event("input", { bubbles: true }));
      s.dispatchEvent(new Event("change", { bubbles: true }));
    });
  } else if (action === "medium-risk-cta-hover") {
    await page.locator(".risk-dot", { hasText: "Medium" }).click();
    await page.locator(".key-button").hover();
  }

  // Let the UI settle (React state + any CSS transitions) before snapping.
  await page.waitForTimeout(400);
}

async function captureSkinInvest(browser, { skin, viewport, label, fileName, action }) {
  const context = await browser.newContext({
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
  try {
    const page = await context.newPage();
    attachPageDiagnostics(page, label);
    await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });

    // Wait for the device to render fully (fonts, images, WebGL for plush).
    // Plush uses a WebGL fur canvas that needs several seconds to warm up.
    await page.waitForTimeout(skin === "plush" ? 6500 : 1200);

    try {
      await performInvestAction(page, action);
    } catch (err) {
      // Don't abort the shot just because the interaction failed — fall back
      // to whatever state the page is in and log the problem.
      console.error(`[action warn] (${label}) ${action}:`, err.message);
    }

    const file = join(outDir, fileName);
    await page.screenshot({ path: file, fullPage: false, timeout: 90000 });
    console.log(`✓ ${file}`);
    successes.push(fileName);
  } finally {
    await context.close();
  }
}

async function run() {
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true, timeout: 60000 });

  // ---------- desktop invest page in every skin ----------
  // Each skin captures a different stage of the user flow so the shots
  // don't all look like the same "Connect wallet" view.
  const SKIN_ACTIONS = {
    metal: "default",
    glass: "medium-risk",
    plush: "high-risk-capital-75",
    grid: "low-risk-holding"
  };

  for (const skin of SKINS) {
    const fileName = `invest-${skin}-desktop.png`;
    const label = `${skin}-desktop`;
    try {
      await captureSkinInvest(browser, {
        skin,
        viewport: DESKTOP,
        label,
        fileName,
        action: SKIN_ACTIONS[skin]
      });
    } catch (err) {
      console.error(`✗ ${fileName} failed:`, err.message);
      failures.push({ file: fileName, error: err.message });
    }
  }

  // ---------- mobile invest page in Metal + Plush ----------
  // Mobile shots stay on the default state (per spec).
  for (const skin of ["metal", "plush"]) {
    const fileName = `invest-${skin}-mobile.png`;
    const label = `${skin}-mobile`;
    try {
      await captureSkinInvest(browser, {
        skin,
        viewport: MOBILE,
        label,
        fileName
      });
    } catch (err) {
      console.error(`✗ ${fileName} failed:`, err.message);
      failures.push({ file: fileName, error: err.message });
    }
  }

  // ---------- extra skin coverage ----------
  // cryptodays is a skin shot and uses a flow stage (medium risk + CTA hover).
  // Mobile Glass and the extra Grid desktop stay on the default state.
  const extraShots = [
    {
      skin: "cryptodays",
      viewport: DESKTOP,
      fileName: "invest-cryptodays-desktop.png",
      label: "cryptodays-desktop",
      action: "medium-risk-cta-hover"
    },
    { skin: "glass", viewport: MOBILE, fileName: "invest-glass-mobile.png", label: "glass-mobile" },
    { skin: "grid", viewport: DESKTOP, fileName: "invest-grid-desktop.png", label: "grid-desktop" }
  ];
  for (const shot of extraShots) {
    try {
      await captureSkinInvest(browser, shot);
    } catch (err) {
      console.error(`✗ ${shot.fileName} failed:`, err.message);
      failures.push({ file: shot.fileName, error: err.message });
    }
  }

  // ---------- onboarding quest intro screen ----------
  {
    const fileName = "quest-intro.png";
    const context = await browser.newContext({
      viewport: DESKTOP,
      deviceScaleFactor: 2
      // no localStorage -> quest will auto-open
    });
    try {
      const page = await context.newPage();
      attachPageDiagnostics(page, "quest-intro");
      await page.goto(`${BASE}/invest`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const file = join(outDir, fileName);
      await page.screenshot({ path: file, fullPage: false, timeout: 90000 });
      console.log(`✓ ${file}`);
      successes.push(fileName);
    } catch (err) {
      console.error(`✗ ${fileName} failed:`, err.message);
      failures.push({ file: fileName, error: err.message });
    } finally {
      await context.close();
    }
  }

  // ---------- landing hero (desktop + mobile) ----------
  for (const [name, viewport] of [
    ["landing-desktop", DESKTOP],
    ["landing-mobile", MOBILE]
  ]) {
    const fileName = `${name}.png`;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    try {
      const page = await context.newPage();
      attachPageDiagnostics(page, name);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const file = join(outDir, fileName);
      await page.screenshot({ path: file, fullPage: false, timeout: 90000 });
      console.log(`✓ ${file}`);
      successes.push(fileName);
    } catch (err) {
      console.error(`✗ ${fileName} failed:`, err.message);
      failures.push({ file: fileName, error: err.message });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log("\n----- screenshot summary -----");
  console.log(`successes: ${successes.length}`);
  for (const name of successes) console.log(`  ✓ ${name}`);
  console.log(`failures:  ${failures.length}`);
  for (const f of failures) console.log(`  ✗ ${f.file} — ${f.error}`);
  console.log("\nAll screenshots saved to public/screenshots/");

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
