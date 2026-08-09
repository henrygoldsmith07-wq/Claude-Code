#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
const ROOT = path.resolve(import.meta.dirname, "..");
let errors=0;
function checkREADME(file){const text=readFileSync(file,"utf8");const base=path.dirname(file);for(const m of text.matchAll(/\[.*?\]\(([^)]+)\)/g)){let href=m[1].trim().split(/[#\s]/)[0];if(!href||href.startsWith("http")||href.startsWith("mailto:")||href.startsWith("#")||href.startsWith("data:"))continue;const target=path.resolve(base,href);if(!existsSync(target)){console.error(`BROKEN ${file} -> ${href}`);errors++;}}}
for(const f of ["README.md",...readdirSync("apps").map(d=>`apps/${d}/README.md`).filter(f=>existsSync(f))]){if(existsSync(f))checkREADME(f);}
const hub=path.join(ROOT,"apps/le-studio-site/index.html");if(existsSync(hub)){const t=readFileSync(hub,"utf8");for(const m of t.matchAll(/href="(\.\.[^\"]+)"/g)){const href=m[1];const target=path.resolve(path.dirname(hub),href);if(!existsSync(target)){console.error(`BROKEN hub -> ${href}`);errors++;}}}
for(const dir of readdirSync(path.join(ROOT,"apps"))){if(!dir.endsWith("-site"))continue;const idx=path.join(ROOT,`apps/${dir}/index.html`);if(!existsSync(idx)){console.error(`MISSING ${idx}`);errors++;continue;}const t=readFileSync(idx,"utf8");if(!t.includes("<title>")||!t.includes('meta name="description"')){console.error(`BAD SEO ${idx}`);errors++;}}
if(errors===0)console.log("check-links OK");else{console.error(`check-links: ${errors} problem(s)`);process.exit(1);}
