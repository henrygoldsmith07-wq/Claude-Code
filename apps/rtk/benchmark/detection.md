# RTK benchmark — parser-detection accuracy

Generated: 2026-08-13T15:09:00.509Z

**Accuracy: 32/32 (100%)** — every labeled (argv, output) pair must pick the right parser.

| Case | argv | Expected | Detected | Verdict |
| --- | --- | --- | --- | --- |
| tsc via argv | `npx tsc --noEmit` | tsc | tsc | ✓ |
| tsc via output sniff | `npm run typecheck` | tsc | tsc | ✓ |
| vitest via argv | `npx vitest run` | vitest | vitest | ✓ |
| vitest via npm test | `npm test` | vitest | vitest | ✓ |
| vitest via bun test | `bun test` | vitest | vitest | ✓ |
| vitest pass via npm test | `npm test` | vitest | vitest | ✓ |
| jest via argv | `npx jest --runInBand` | jest | jest | ✓ |
| eslint via argv | `npx eslint .` | eslint | eslint | ✓ |
| ruff via argv | `ruff check .` | ruff | ruff | ✓ |
| ruff via output sniff | `python -m lint` | ruff | ruff | ✓ |
| mypy via argv | `mypy src` | mypy | mypy | ✓ |
| pytest via argv | `pytest tests/` | pytest | pytest | ✓ |
| pytest via output sniff | `tox` | pytest | pytest | ✓ |
| cargo via argv | `cargo test` | cargo | cargo | ✓ |
| go test via argv | `go test ./...` | go-test | go-test | ✓ |
| gradle via argv | `./gradlew test` | gradle | gradle | ✓ |
| maven via argv | `mvn test` | maven | maven | ✓ |
| docker via argv | `docker build -t x .` | docker | docker | ✓ |
| k8s via argv | `kubectl get pods` | k8s | k8s | ✓ |
| terraform via argv | `terraform plan` | terraform | terraform | ✓ |
| npm ci failure | `npm ci` | pm | pm | ✓ |
| pnpm install failure | `pnpm install` | pm | pm | ✓ |
| GHA annotations via sniff | `bash ./scripts/build.sh` | gha | gha | ✓ |
| git merge conflict | `git merge feature` | git | git | ✓ |
| git diff stays generic | `git diff` | generic | generic | ✓ |
| next build via argv | `npx next build` | next | next | ✓ |
| next build via sniff | `npm run build` | next | next | ✓ |
| generic command | `ls -la` | generic | generic | ✓ |
| cat build log (no marker) | `cat build.log` | generic | generic | ✓ |
| Windows npm test (cmd) | `cmd /c npm test` | vitest | vitest | ✓ |
| yarn build with next output | `yarn build` | next | next | ✓ |
| terraform apply success | `terraform apply` | terraform | terraform | ✓ |

> Covers the argv fast-path AND output-sniffing path for every parser, plus ambiguous cases that must fall through to `generic` (git diff) and cross-package-manager variants (`npm`/`pnpm`/`bun`/`yarn`, Windows `cmd`).
> CI fails if any row is a miss — detection accuracy is a 100% target on this curated corpus, so regressions surface here before the field.
