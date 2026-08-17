/**
 * Deploy-config check for the monorepo.
 *
 * Every Vercel project in this repo points at a subdirectory via its Root
 * Directory setting, and reads the `vercel.json` found *there*. That makes the
 * per-app config the contract, and this script checks the contract holds.
 *
 * The failure that prompted this: the repository root carried
 * `{"framework": "nextjs"}` while containing no package.json and no Next.js
 * app at all. Any project whose Root Directory was left at the repo root
 * inherited it and died with "No Next.js version detected" — an error that
 * points at the wrong thing entirely.
 *
 * Exit 1 on failure (CI-friendly).
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appsDir = path.join(root, 'apps');

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    fail(`${path.relative(root, p)}: invalid JSON — ${e.message}`);
    return null;
  }
};

/**
 * A lockfile that merely *exists* is not enough: Vercel installs with `npm ci`,
 * which refuses to run when the lockfile disagrees with package.json. That is
 * exactly how apps/emotion-tracker broke — its package.json asked for
 * @anthropic-ai/sdk ^0.116.0 while the lockfile still pinned 0.110.0, and every
 * install died with "lock file's ... does not satisfy ...".
 *
 * npm mirrors package.json's dependency ranges into the lockfile's root entry
 * (`packages[""]`), so comparing the two catches drift without a network call.
 * We also confirm each dependency actually resolves to a node in the tree,
 * which is the other half of what `npm ci` complains about ("Missing: x from
 * lock file").
 */
function checkLockInSync(rel, pkg, lock) {
  if (!lock) return;
  const rootEntry = lock.packages?.[''];
  if (!rootEntry) {
    // lockfileVersion 1 has no `packages` map, so there is nothing to compare.
    warn(`${rel}/package-lock.json is lockfileVersion ${lock.lockfileVersion ?? '?'}; regenerate it with npm 7+ so drift can be detected.`);
    return;
  }

  for (const field of ['dependencies', 'devDependencies']) {
    const declared = pkg[field] || {};
    const locked = rootEntry[field] || {};
    for (const [name, range] of Object.entries(declared)) {
      if (!(name in locked)) {
        fail(`${rel}: ${name} is in package.json ${field} but missing from the lockfile — npm ci will fail. Run npm install in ${rel}.`);
      } else if (locked[name] !== range) {
        fail(`${rel}: package.json asks for ${name}@${range} but the lockfile records ${name}@${locked[name]} — npm ci will fail. Run npm install in ${rel}.`);
      }
    }
    for (const name of Object.keys(locked)) {
      if (!(name in declared)) {
        fail(`${rel}: the lockfile still carries ${field} entry ${name}, which package.json no longer declares. Run npm install in ${rel}.`);
      }
    }
  }

  // Every declared dependency needs a resolved node somewhere in the tree.
  // npm hoists most to node_modules/<name>, but nests on version conflicts.
  const installed = new Set();
  for (const key of Object.keys(lock.packages)) {
    const at = key.lastIndexOf('node_modules/');
    if (at !== -1) installed.add(key.slice(at + 'node_modules/'.length));
  }
  for (const name of Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) })) {
    if (!installed.has(name)) {
      fail(`${rel}: ${name} is declared but has no entry in the lockfile tree — npm ci will fail with "Missing: ${name} from lock file". Run npm install in ${rel}.`);
    }
  }
}

// Frameworks Vercel builds for us. `null` is the "Other" preset: no build,
// serve files as they are.
const VITE = 'vite';
const NEXT = 'nextjs';
const IGNORE_COMMAND = 'git diff --quiet HEAD^ HEAD -- .';

// Apps that are deliberately not web-deployable. Listing them explicitly means
// a new app is never silently assumed to be one of these.
const NOT_DEPLOYABLE = {
  rtk: 'Node CLI',
  'dictation-typer': 'Python desktop app',
  'meeting-recorder': 'Electron desktop app',
};

// ---- 1. the repository root must not claim to be an app ---------------------

const rootConfigPath = path.join(root, 'vercel.json');
if (!existsSync(rootConfigPath)) {
  warn('No root vercel.json. A project left pointing at the repo root will publish the whole repository as static files.');
} else {
  const rootConfig = readJson(rootConfigPath);
  if (rootConfig) {
    if (rootConfig.framework) {
      fail(
        `Root vercel.json declares framework "${rootConfig.framework}", but there is no app at the repository root. `
        + 'Any Vercel project whose Root Directory is the repo root will fail with a misleading error. '
        + 'Leave framework null and let the build command explain the real fix.',
      );
    }
    if (!rootConfig.buildCommand || !/exit 1/.test(rootConfig.buildCommand)) {
      fail('Root vercel.json should fail fast with a build command that names the fix (set Root Directory to an app).');
    }
  }
}

// ---- 2. every app directory is either deployable or explicitly not ----------

const apps = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

for (const app of apps) {
  const dir = path.join(appsDir, app);
  const rel = `apps/${app}`;
  const configPath = path.join(dir, 'vercel.json');
  const pkgPath = path.join(dir, 'package.json');
  const isSite = app.endsWith('-site');
  const hasPkg = existsSync(pkgPath);

  if (NOT_DEPLOYABLE[app]) {
    if (existsSync(configPath)) {
      fail(`${rel} is a ${NOT_DEPLOYABLE[app]} and should not carry a vercel.json.`);
    }
    continue;
  }

  if (!existsSync(configPath)) {
    fail(`${rel} has no vercel.json — its deploy settings live only in the Vercel dashboard, where they cannot be reviewed.`);
    continue;
  }

  const config = readJson(configPath);
  if (!config) continue;

  // Every deployable app skips the build when its own directory is untouched.
  // Without this, a one-line change to one app rebuilds every project in the
  // monorepo and posts a deploy comment for each.
  if (config.ignoreCommand !== IGNORE_COMMAND) {
    fail(`${rel}/vercel.json: expected ignoreCommand ${JSON.stringify(IGNORE_COMMAND)}, found ${JSON.stringify(config.ignoreCommand ?? null)}.`);
  }

  if (isSite) {
    if (config.framework !== null) {
      fail(`${rel}/vercel.json: a static site needs "framework": null (the "Other" preset), found ${JSON.stringify(config.framework)}.`);
    }
    if (config.outputDirectory !== '.') {
      fail(`${rel}/vercel.json: a static site serves from ".", found ${JSON.stringify(config.outputDirectory)}.`);
    }
    if (!existsSync(path.join(dir, 'index.html'))) {
      fail(`${rel} has no index.html to serve.`);
    }
    continue;
  }

  // Build-step apps.
  if (!hasPkg) {
    fail(`${rel} has a vercel.json but no package.json.`);
    continue;
  }

  const pkg = readJson(pkgPath);
  if (!pkg) continue;

  if (!pkg.scripts?.build) {
    fail(`${rel}/package.json has no build script, but the app is configured to deploy.`);
  }

  // Vercel installs from the lockfile in the Root Directory. Without one the
  // deployed dependency tree is whatever npm resolves that day.
  const npmLock = path.join(dir, 'package-lock.json');
  const hasLock = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
    .some((f) => existsSync(path.join(dir, f)));
  if (!hasLock) {
    fail(`${rel} has no lockfile — Vercel would resolve dependencies fresh on every deploy.`);
  } else if (existsSync(npmLock)) {
    checkLockInSync(rel, pkg, readJson(npmLock));
  }

  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  // A workspace or file: dependency cannot resolve when Root Directory is the
  // app folder, because Vercel only uploads that folder.
  for (const [name, range] of Object.entries(deps)) {
    if (typeof range === 'string' && /^(workspace:|file:|link:)/.test(range)) {
      fail(`${rel} depends on ${name}@${range}, which cannot resolve from a Root Directory of ${rel}.`);
    }
  }

  if (config.framework === NEXT) {
    if (!deps.next) fail(`${rel}/vercel.json declares framework "nextjs" but next is not a dependency.`);
  } else if (config.framework === VITE) {
    if (!deps.vite) fail(`${rel}/vercel.json declares framework "vite" but vite is not a dependency.`);
    if (config.outputDirectory !== 'dist') {
      fail(`${rel}/vercel.json: a Vite app outputs to "dist", found ${JSON.stringify(config.outputDirectory)}.`);
    }
  } else {
    fail(`${rel}/vercel.json: unrecognised framework ${JSON.stringify(config.framework)}. Expected "nextjs" or "vite".`);
  }
}

// ---- 3. the registry agrees that these apps exist ---------------------------

const registryPath = path.join(appsDir, 'registry.json');
if (existsSync(registryPath)) {
  const registry = readJson(registryPath);
  // Marketing sites are registered on their parent app's `site` field rather
  // than as entries of their own — see siteConvention in the registry.
  const known = new Set();
  for (const a of registry?.apps || []) {
    if (a.id) known.add(a.id);
    if (a.site) known.add(path.basename(a.site));
  }
  for (const app of apps) {
    if (!known.has(app)) {
      warn(`apps/${app} is neither an entry in apps/registry.json nor the site of one.`);
    }
  }
}

// ---- report ----------------------------------------------------------------

for (const w of warnings) console.warn(`warning  ${w}`);
for (const e of errors) console.error(`error    ${e}`);

const deployable = apps.filter((a) => !NOT_DEPLOYABLE[a] && a !== 'registry.json');
if (errors.length) {
  console.error(`\n${errors.length} problem(s) across ${deployable.length} deployable app(s).`);
  process.exit(1);
}
console.log(`Deploy config OK: ${deployable.length} deployable apps, ${Object.keys(NOT_DEPLOYABLE).length} intentionally not deployed.`);
