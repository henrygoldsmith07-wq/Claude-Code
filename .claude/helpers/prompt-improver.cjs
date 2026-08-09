#!/usr/bin/env node
/**
 * Automatic Prompt Improver (UserPromptSubmit hook)
 *
 * Runs on every message. A fast local gate skips trivial input (slash
 * commands, short replies, pasted code); substantive prompts get a
 * single-pass rewrite from a headless Haiku call, injected back into the
 * session as additionalContext. Fails open: on any error or timeout it
 * exits 0 with no output so the user's message is never delayed or blocked.
 *
 * Usage (invoked by Claude Code, JSON on stdin):
 *   echo '{"prompt":"..."}' | node prompt-improver.cjs
 *
 * Env:
 *   PROMPT_IMPROVER_DISABLED=1   kill switch
 *   PROMPT_IMPROVER_ACTIVE=1     recursion guard (set for the child session)
 *   PROMPT_IMPROVER_MODEL        model override
 *   PROMPT_IMPROVER_MIN_CHARS    gate threshold override
 *   PROMPT_IMPROVER_MIN_WORDS    gate threshold override
 *   PROMPT_IMPROVER_TIMEOUT_MS   LLM timeout override
 *   PROMPT_IMPROVER_CMD          CLI override (testing stub)
 *
 * Per-message opt-out: end the message with --raw or include [noimprove].
 */

const { spawn } = require('child_process');
const os = require('os');

const MODEL = process.env.PROMPT_IMPROVER_MODEL || 'claude-haiku-4-5-20251001';
const MIN_CHARS = parseInt(process.env.PROMPT_IMPROVER_MIN_CHARS, 10) || 80;
const MIN_WORDS = parseInt(process.env.PROMPT_IMPROVER_MIN_WORDS, 10) || 12;
const LLM_TIMEOUT_MS = parseInt(process.env.PROMPT_IMPROVER_TIMEOUT_MS, 10) || 40000;
const STDIN_TIMEOUT_MS = 3000;
const CLI = process.env.PROMPT_IMPROVER_CMD || 'claude';

const REWRITE_INSTRUCTION = `You are a prompt-improvement engine. Rewrite the user message below as a single-pass improvement.

Rules:
- Preserve the author's intent exactly. Never invent requirements, scope, or preferences that are not implied by the original.
- Make the goal and the expected deliverable explicit.
- Add light structure (short sections or bullet points) when the message mixes several asks.
- Where the original is ambiguous, state the assumption you are making inline, e.g. "(assuming X)".
- Keep it concise; do not pad. Keep the entire output under 250 words unless the original is longer than that.

Special case: if the message contains or discusses an LLM prompt (a system prompt, prompt template, agent definition, or SKILL.md body), improve that embedded prompt using Claude prompt-engineering best practices — clear role, XML-tagged sections, explicit output format, examples where useful — and append a one-line rationale per change.

Output ONLY the improved prompt text. No preamble, no commentary, no code fences.

User message:
`;

function fail(msg) {
  if (process.env.PROMPT_IMPROVER_DEBUG) process.stderr.write(`[prompt-improver] ${msg}\n`);
  process.exit(0);
}

// ── Gate ────────────────────────────────────────────────────────────────────

function looksLikeCodePaste(prompt) {
  const lines = prompt.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 4) return false;
  const codeLine = /^(\s{2,}|\t)|[{};]\s*$|^\s*(at\s+\S+\s+\(|File ")|=>|^\s*(import|from|const|let|var|function|def|class|return|if|for|while)\b|^\s*[<\[]|Error:|Traceback/;
  const codeish = lines.filter((l) => codeLine.test(l)).length;
  if (codeish / lines.length < 0.6) return false;
  // A prose opening sentence means there is a real request wrapped around the paste.
  const opening = lines[0].trim();
  const prose = /^(please|can|could|why|how|what|where|when|fix|debug|explain|help|here|this|i |i'|the )/i;
  return !prose.test(opening);
}

function shouldSkip(prompt) {
  if (process.env.PROMPT_IMPROVER_DISABLED === '1') return 'disabled';
  if (process.env.PROMPT_IMPROVER_ACTIVE === '1') return 'recursion guard';
  const trimmed = prompt.trim();
  if (!trimmed) return 'empty';
  if (/^[/!#]/.test(trimmed)) return 'command/bash/memory shortcut';
  if (/--raw\s*$/.test(trimmed) || trimmed.includes('[noimprove]')) return 'opt-out marker';
  if (trimmed.length < MIN_CHARS) return 'below min chars';
  if (trimmed.split(/\s+/).length < MIN_WORDS) return 'below min words';
  if (looksLikeCodePaste(trimmed)) return 'code/log paste';
  return null;
}

// ── Rewrite ─────────────────────────────────────────────────────────────────

function rewrite(prompt) {
  return new Promise((resolve) => {
    const child = spawn(CLI, ['-p', '--model', MODEL], {
      cwd: os.tmpdir(), // avoid loading this project's settings/hooks in the child
      env: { ...process.env, PROMPT_IMPROVER_ACTIVE: '1' },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let out = '';
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(null);
    }, LLM_TIMEOUT_MS);
    child.stdout.on('data', (d) => (out += d));
    child.on('error', () => finish(null));
    child.on('close', (code) => finish(code === 0 && out.trim() ? out.trim() : null));
    child.stdin.write(REWRITE_INSTRUCTION + prompt);
    child.stdin.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data), STDIN_TIMEOUT_MS);
    process.stdin.on('data', (d) => (data += d));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function main() {
  const raw = await readStdin();
  let prompt = '';
  try {
    prompt = String(JSON.parse(raw).prompt || '');
  } catch {
    fail('unparseable stdin');
  }
  const skip = shouldSkip(prompt);
  if (skip) fail(`skipped: ${skip}`);

  const improved = await rewrite(prompt);
  if (!improved) fail('rewrite unavailable');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext:
          'Automated prompt-improvement pass. A clarified version of the ' +
          "user's request follows. The user's original message is " +
          'authoritative for intent; use this version to fill gaps and ' +
          'structure your work:\n\n' + improved,
      },
    })
  );
  process.exit(0);
}

main().catch(() => process.exit(0));
