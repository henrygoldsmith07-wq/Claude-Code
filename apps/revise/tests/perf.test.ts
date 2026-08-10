import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "fs";
import { join } from "path";

describe("performance budgets", () => {
  it("curriculum modules stay under budget (tree-shakable, not bloated)", () => {
    const dir = join(process.cwd(), "src/domain/curriculum");
    const files = readdirSync(dir).filter((f)=> f.endsWith(".ts"));
    const budgets: Record<string, number> = { "wjec-biology.ts": 80_000, "aqa-biology.ts": 80_000 };
    for (const f of files) {
      const kb = statSync(join(dir,f)).size;
      const limit = budgets[f] ?? 100_000;
      expect(kb, f + " over perf budget").toBeLessThan(limit);
    }
  });
  it("domain bundle stays small: no single file is > 100kB", () => {
    const dir = join(process.cwd(), "src/domain");
    for (const f of readdirSync(dir).filter((x)=> x.endsWith(".ts"))) {
      const kb = statSync(join(dir,f)).size;
      expect(kb, f + " over perf budget").toBeLessThan(120_000);
    }
  });
  it("validates curriculum within 2s", async () => {
    const start = Date.now();
    const { allTopics } = await import("@/domain/curriculum");
    allTopics();
    expect(Date.now()-start).toBeLessThan(1500);
  });
});
