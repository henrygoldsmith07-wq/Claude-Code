#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
const ROOT = path.resolve(import.meta.dirname, "..");
let errors=0;
function checkREADME(file){const text=readFileSync(file,"utf8");const base=path.dirname(file);for(const m of text.matchAll(/\[.*?\]\(([^)]+)\)/g)){let href=m[1].trim().split(/[#\s]/)[0];if(!href||href.startsWith("http")||href.startsWith("mailto:")||href.startsWith("#")||href.startsWith("data:"))continue;const target=path.resolve(base,href);if(!existsSync(target)){console.error(`BROKEN ${file} -> ${href}`);errors++;}}}
for(const f of ["README.md",...readdirSync("apps").map(d=>`apps/${d}/README.md`).filter(f=>existsSync(f))]){if(existsSync(f))checkREADME(f);}
// Each site is its own Vercel project, so a relative ../other-site/ link resolves
// on disk but 404s in production. registry.json:siteUrl is the source of truth.
const reg=JSON.parse(readFileSync(path.join(ROOT,"apps/registry.json"),"utf8"));
const siteUrl=new Map(reg.apps.filter(a=>a.site&&a.siteUrl).map(a=>[path.basename(a.site),a.siteUrl.replace(/\/$/,"")]));
for(const dir of readdirSync(path.join(ROOT,"apps"))){if(!dir.endsWith("-site"))continue;const idx=path.join(ROOT,`apps/${dir}/index.html`);if(!existsSync(idx)){console.error(`MISSING ${idx}`);errors++;continue;}const t=readFileSync(idx,"utf8");
  if(!t.includes("<title>")||!t.includes('meta name="description"')){console.error(`BAD SEO ${idx}`);errors++;}
  const want=siteUrl.get(dir);if(!want){console.error(`NO REGISTRY siteUrl for apps/${dir}`);errors++;}
  const canon=t.match(/<link rel="canonical" href="([^"]+)"/)?.[1]?.replace(/\/$/,"");
  if(!canon){console.error(`NO CANONICAL apps/${dir}`);errors++;}else if(want&&canon!==want){console.error(`CANONICAL MISMATCH apps/${dir}: html=${canon} registry=${want}`);errors++;}
  for(const m of t.matchAll(/href="(\.\.\/[^"]+)"/g)){console.error(`RELATIVE CROSS-SITE LINK apps/${dir} -> ${m[1]} (404s once deployed; use the target's siteUrl)`);errors++;}
  for(const p of ["og:image","og:url"]){const v=t.match(new RegExp(`<meta property="${p}" content="([^"]+)"`))?.[1];if(!v){console.error(`MISSING ${p} apps/${dir}`);errors++;}else if(!v.startsWith("http")){console.error(`RELATIVE ${p} apps/${dir} -> ${v} (crawlers need an absolute URL)`);errors++;}}
  for(const u of new Set([...t.matchAll(/href="(https:\/\/[^"]+?)\/?"/g)].map(m=>m[1]))){if(u.endsWith(".vercel.app")&&![...siteUrl.values()].includes(u)&&!u.includes("claude-code-alpha-nine")){console.error(`UNKNOWN SITE URL apps/${dir} -> ${u} (not in registry.json)`);errors++;}}}
if(errors===0)console.log("check-links OK");else{console.error(`check-links: ${errors} problem(s)`);process.exit(1);}
