#!/usr/bin/env node

/**
 * Affected-project evaluator for Vercel's Ignore Command.
 *
 * Vercel calls this from a project's Root Directory. It must return:
 *   0 -> skip this project (no deployment needed)
 *   1 -> continue with the deployment
 *
 * The evaluator is deliberately fail-open when Git cannot provide a reliable
 * diff: an unknown change must deploy rather than silently serving stale code.
 * The pure functions are exported so the dependency graph can be tested
 * without a Vercel checkout or network access.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const MAP_PATH = path.join(REPO_ROOT, 'config', 'affected-deployments.json');

export function normalizePath(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

/** Match the small, explicit glob vocabulary used by the checked-in map. */
export function matchesGlob(filePath, pattern) {
  const file = normalizePath(filePath);
  const glob = normalizePath(pattern);
  let source = '^';

  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char !== '*') {
      source += char === '?' ? '[^/]' : escapeRegex(char);
      continue;
    }

    if (glob[i + 1] === '*') {
      i += 1;
      if (glob[i + 1] === '/') {
        i += 1;
        source += '(?:.*/)?';
      } else {
        source += '.*';
      }
    } else {
      source += '[^/]*';
    }
  }

  return new RegExp(`${source}$`).test(file);
}

export function matchesAny(filePath, patterns = []) {
  return patterns.some((pattern) => matchesGlob(filePath, pattern));
}

export function loadDependencyMap(mapPath = MAP_PATH) {
  return JSON.parse(readFileSync(mapPath, 'utf8'));
}

function sharedPaths(map) {
  return Object.values(map.shared ?? {}).flatMap((shared) => shared.paths ?? []);
}

function isKnownSharedPath(filePath, map) {
  return matchesAny(filePath, sharedPaths(map));
}

function projectRootPaths(map) {
  return Object.values(map.projects ?? {})
    .map((project) => project.rootDirectory)
    .filter((rootDirectory) => rootDirectory && rootDirectory !== '.')
    .map((rootDirectory) => `${rootDirectory}/**`);
}

function isGlobalChange(filePath, map) {
  if (matchesAny(filePath, map.globalPaths)) return true;

  // A new package is an unknown build input until the map explicitly assigns
  // it. Fan out conservatively so adding shared code cannot publish stale apps.
  if (normalizePath(filePath).startsWith('packages/') && !isKnownSharedPath(filePath, map)) {
    return true;
  }

  return false;
}

export function isIgnoredNonRuntimePath(filePath, map) {
  return matchesAny(filePath, map.ignoredPaths);
}

function projectPatterns(projectId, project, map) {
  const patterns = [];
  if (project.rootDirectory && project.rootDirectory !== '.') {
    patterns.push(`${project.rootDirectory}/**`);
  }
  for (const sharedId of project.shared ?? []) {
    const shared = map.shared?.[sharedId];
    if (!shared) throw new Error(`Project ${projectId} references unknown shared dependency ${sharedId}`);
    patterns.push(...(shared.paths ?? []));
  }
  return patterns;
}

export function evaluateProject(projectId, changedPaths, map = loadDependencyMap()) {
  const project = map.projects?.[projectId];
  if (!project) {
    return {
      projectId,
      deploy: true,
      reason: 'unknown-project',
      changedPaths: changedPaths.map(normalizePath)
    };
  }

  if (project.deploy === false || project.kind === 'retired') {
    return { projectId, deploy: false, reason: 'retired-project', changedPaths: [] };
  }

  const normalized = changedPaths.map(normalizePath).filter(Boolean);
  const runtimeChanges = normalized.filter((filePath) => !isIgnoredNonRuntimePath(filePath, map));

  if (runtimeChanges.length === 0) {
    return { projectId, deploy: false, reason: 'documentation-or-test-only', changedPaths: [] };
  }

  const global = runtimeChanges.filter((filePath) => isGlobalChange(filePath, map));
  if (global.length > 0) {
    return { projectId, deploy: true, reason: 'global-build-input', changedPaths: global };
  }

  // A non-documentation path outside every known app/shared root is a new
  // build input until the map says otherwise. This keeps an added root-level
  // runtime folder from silently skipping all existing deployments.
  const unmapped = runtimeChanges.filter((filePath) =>
    !isKnownSharedPath(filePath, map) && !matchesAny(filePath, projectRootPaths(map))
  );
  if (unmapped.length > 0) {
    return { projectId, deploy: true, reason: 'unmapped-runtime-input', changedPaths: unmapped };
  }

  const patterns = projectPatterns(projectId, project, map);
  const matched = runtimeChanges.filter((filePath) => matchesAny(filePath, patterns));
  if (matched.length > 0) {
    return { projectId, deploy: true, reason: 'owned-or-shared-runtime-input', changedPaths: matched };
  }

  return { projectId, deploy: false, reason: 'unrelated-change', changedPaths: [] };
}

export function affectedProjects(changedPaths, map = loadDependencyMap()) {
  return Object.entries(map.projects ?? {})
    .filter(([, project]) => project.deploy !== false && project.kind !== 'retired')
    .filter(([projectId]) => evaluateProject(projectId, changedPaths, map).deploy)
    .map(([projectId]) => projectId);
}

export function readChangedPaths({ base, head, cwd = REPO_ROOT, exec = execFileSync } = {}) {
  if (!base || !head) {
    throw new Error('Both a previous and current commit are required to make a safe deployment decision.');
  }

  const output = exec('git', ['diff', '--name-only', base, head, '--'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return String(output).split(/\r?\n/).map(normalizePath).filter(Boolean);
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function main({ argv = process.argv.slice(2), env = process.env, cwd = REPO_ROOT } = {}) {
  const map = loadDependencyMap();
  const projectId = optionValue(argv, '--project');
  if (!projectId) {
    console.error('vercel-ignore: missing required --project <id>');
    return 1;
  }

  const base = optionValue(argv, '--base') || env.VERCEL_GIT_PREVIOUS_SHA;
  const head = optionValue(argv, '--head') || env.VERCEL_GIT_COMMIT_SHA;

  let changedPaths;
  try {
    changedPaths = readChangedPaths({
      base: base || execFileSync('git', ['rev-parse', 'HEAD^'], { cwd, encoding: 'utf8' }).trim(),
      head: head || execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim(),
      cwd
    });
  } catch (error) {
    // A missing ref, shallow checkout, or unavailable git is not proof that an
    // app is unaffected. Exit 1 so Vercel builds the project instead.
    console.error(`vercel-ignore: unable to establish a reliable diff; deploying (${error.message})`);
    return 1;
  }

  const result = evaluateProject(projectId, changedPaths, map);
  console.log(`vercel-ignore: ${projectId} ${result.deploy ? 'deploy' : 'skip'} (${result.reason})`);
  return result.deploy ? 1 : 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
