// Minimal resolver so the content validator can import the TypeScript domain
// modules directly. Node strips the types (--experimental-strip-types); all
// this adds is extensionless relative resolution, which the domain layer uses.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const base = new URL(specifier, pathToFileURL(parent));
    for (const extension of [".ts", ".tsx", "/index.ts"]) {
      const candidate = new URL(`${base.pathname}${extension}`, "file://");
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
