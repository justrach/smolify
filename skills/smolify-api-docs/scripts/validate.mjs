import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Usage: validate.mjs <bundle.json>");

const bundle = JSON.parse(await readFile(resolve(input), "utf8"));
const errors = [];
const slugPattern = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/;

if (bundle.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (!["codex", "smolify"].includes(bundle.generator?.name)) errors.push("generator.name must be codex or smolify");
if (!bundle.generator?.model) errors.push("generator.model is required");
if (!Array.isArray(bundle.pages) || bundle.pages.length === 0) errors.push("pages must not be empty");
if (!Array.isArray(bundle.navigation) || bundle.navigation.length === 0) errors.push("navigation must not be empty");

const pageSlugs = new Set();
for (const [index, page] of (bundle.pages ?? []).entries()) {
  if (!slugPattern.test(page.slug ?? "")) errors.push(`pages[${index}].slug is invalid`);
  if (pageSlugs.has(page.slug)) errors.push(`duplicate page slug: ${page.slug}`);
  pageSlugs.add(page.slug);
  if (!page.title?.trim()) errors.push(`pages[${index}].title is required`);
  if ((page.title?.length ?? 0) > 120) errors.push(`pages[${index}].title exceeds 120 characters`);
  if ((page.description?.length ?? 0) > 240) errors.push(`pages[${index}].description exceeds 240 characters`);
  if (!page.markdown?.trim()) errors.push(`pages[${index}].markdown is required`);
  if ((page.markdown?.length ?? 0) > 250_000) errors.push(`pages[${index}].markdown exceeds 250,000 characters`);
  if ((page.sourceFiles?.length ?? 0) > 100) errors.push(`pages[${index}].sourceFiles exceeds 100 entries`);
  if (/<script\b|javascript:|<iframe\b/i.test(page.markdown ?? "")) {
    errors.push(`pages[${index}] contains unsafe HTML or a javascript URL`);
  }
}

for (const group of bundle.navigation ?? []) {
  for (const item of group.items ?? []) {
    if (!pageSlugs.has(item.slug)) errors.push(`navigation references missing page: ${item.slug}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Valid Smolify bundle: ${bundle.pages.length} pages`);
}
