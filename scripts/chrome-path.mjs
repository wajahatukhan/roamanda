// Prints the path of the Chromium that Playwright installed, so Lighthouse can reuse it (no second browser download).
import { chromium } from "@playwright/test";

process.stdout.write(chromium.executablePath());
