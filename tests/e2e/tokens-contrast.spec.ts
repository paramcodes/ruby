import { expect, test } from "@playwright/test";

// These token pairs and thresholds are encoded from the comments in
// src/styles/tokens.css. If a token value changes such that a floor is
// violated, this test fails and surfaces the regression before it ships.

const SURFACES = [
  "--color-canvas",
  "--color-surface",
  "--color-surface-raised",
  "--color-surface-sunken"
] as const;

// Floors stated in src/styles/tokens.css comments:
//  - subtle text: "owes WCAG AA 4.5:1 on every surface in both themes"
//  - body text: WCAG AA 4.5:1 on every surface
//  - interactive border: "clears WCAG 1.4.11 non-text contrast (3:1) against
//    canvas, surface, raised, and sunken in both themes"
//  - focus ring: "--focus-ring-color: var(--color-accent)" — 3:1 on every surface
const TEXT_TOKENS = [
  { label: "subtle text", token: "--color-text-subtle", floor: 4.5 },
  { label: "body text", token: "--color-text", floor: 4.5 },
  {
    label: "interactive border",
    token: "--color-border-interactive",
    floor: 3.0
  },
  { label: "focus ring", token: "--color-accent", floor: 3.0 }
] as const;

// WCAG relative luminance from sRGB channels
function luminance(r: number, g: number, b: number): number {
  const channels = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const l1 = luminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = luminance(rgb2[0], rgb2[1], rgb2[2]);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test("design token contrast meets WCAG floors stated in tokens.css", async ({
  page
}) => {
  // The sign-in page loads the root layout which imports globals.css → tokens.css.
  // No database or auth secret is needed to read computed CSS values.
  await page.goto("/sign-in");

  const allTokens = [...SURFACES, ...TEXT_TOKENS.map((t) => t.token)];

  // Read all token colors as sRGB RGB triplets in both color schemes.
  // Uses a 1x1 canvas to force the browser to resolve oklch()/color-mix()/
  // light-dark() to sRGB, since getComputedStyle may return oklch() directly.
  const results = await page.evaluate((tokens: string[]) => {
    (document.documentElement as HTMLElement).style.colorScheme = "light";

    const probe = document.createElement("span");
    probe.style.visibility = "hidden";
    probe.style.position = "absolute";
    probe.style.left = "-9999px";
    document.body.appendChild(probe);

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No 2D canvas context");
    }

    function read(token: string): [number, number, number] {
      probe.style.color = `var(${token})`;
      const cssColor = getComputedStyle(probe).color;
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      return [data[0], data[1], data[2]];
    }

    function schemeValues(
      scheme: string
    ): Record<string, [number, number, number]> {
      (document.documentElement as HTMLElement).style.colorScheme = scheme;
      const result: Record<string, [number, number, number]> = {};
      for (const token of tokens) {
        result[token] = read(token);
      }
      return result;
    }

    const light = schemeValues("light");
    const dark = schemeValues("dark");
    (document.documentElement as HTMLElement).style.colorScheme = "";
    document.body.removeChild(probe);

    return { light, dark };
  }, allTokens);

  const { light, dark } = results as {
    light: Record<string, [number, number, number]>;
    dark: Record<string, [number, number, number]>;
  };

  for (const { label, token, floor } of TEXT_TOKENS) {
    for (const surface of SURFACES) {
      const lightRatio = contrastRatio(light[token], light[surface]);
      const darkRatio = contrastRatio(dark[token], dark[surface]);

      expect(
        lightRatio,
        `${label} (${token}) on ${surface} in light: ${lightRatio.toFixed(2)}:1 (floor ${floor}:1)`
      ).toBeGreaterThanOrEqual(floor);

      expect(
        darkRatio,
        `${label} (${token}) on ${surface} in dark: ${darkRatio.toFixed(2)}:1 (floor ${floor}:1)`
      ).toBeGreaterThanOrEqual(floor);
    }
  }
});
