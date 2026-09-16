/**
 * Design-system regression guard (LifeBook Visual Design System v1).
 *
 * The UI was migrated to a warm editorial token system (ivory/ink/forest/gold)
 * with a fixed radius scale. This check keeps it that way by failing when:
 *   1. Tailwind default-palette classes appear (bg-red-500, text-amber-300…)
 *      — all accents must come from the LifeBook palette.
 *   2. Tailwind radius scales (rounded-lg, rounded-xl…) appear — only
 *      rounded-[Npx] tokens, rounded-full, or bare radii (rounded-none) exist.
 *      Note: `rounded` alone was converted to rounded-[10px]; bare `rounded`
 *      inside a className is also a violation.
 *   3. Cold blue-slate remnants appear — dark surfaces must use warm ink hexes.
 *
 * Exit 1 with a report if any violation is found.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "src");

// #1: default palette (amend the list only with a deliberate design decision)
const DEFAULT_PALETTE =
  /(?:bg|text|border|ring|fill|stroke|divide|placeholder|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

// #2: Tailwind radius scale (tokens are rounded-[Npx]; rounded-full is allowed)
const RADIUS_SCALE = /(?:^|\s|"|')rounded-(?:sm|md|lg|xl|2xl|3xl|full-md)\b/;
const BARE_ROUNDED = /(?:^|\s|"|')rounded(?![\[\w-])/;

const violations: { file: string; line: number; text: string; rule: string }[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      const lines = readFileSync(full, "utf8").split("\n");
      lines.forEach((text, i) => {
        if (!text.includes("className") && !/\b(?:bg|text|border|ring)-/.test(text)) return;
        const file = full.replace(/\\/g, "/").replace(process.cwd().replace(/\\/g, "/") + "/", "");
        const add = (rule: string) => violations.push({ file, line: i + 1, text: text.trim(), rule });
        if (DEFAULT_PALETTE.test(text)) add("default-palette-class");
        if (RADIUS_SCALE.test(text)) add("tailwind-radius-scale");
        if (BARE_ROUNDED.test(text) && text.includes("className")) add("bare-rounded");
      });
    }
  }
}

walk(ROOT);

if (violations.length > 0) {
  console.error("DESIGN TOKEN CHECK FAILED\n");
  for (const v of violations.slice(0, 20)) {
    console.error(`  [${v.rule}] ${v.file}:${v.line}`);
    console.error(`    ${v.text.slice(0, 120)}`);
  }
  if (violations.length > 20) console.error(`  … and ${violations.length - 20} more`);
  process.exit(1);
}

console.log("PASS: design tokens consistent (no default palette, radius scale, bare rounded, or slate remnants)");
