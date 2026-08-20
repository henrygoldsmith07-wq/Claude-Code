import { describe, expect, it } from "vitest";
import { actionableErrors, buildErrorModel } from "@/domain/error-model";
import type { Mistake } from "@/domain/types";

const base = (overrides: Partial<Mistake> = {}): Mistake => ({
  id: "m1",
  userId: "u",
  subjectId: "maths",
  topicId: "maths.algebra",
  marksLost: 1,
  description: "The sign changed in the final line.",
  category: "method",
  misconception: "significant-figures",
  resolved: false,
  createdAt: "2025-06-01T12:00:00.000Z",
  ...overrides,
});

describe("error model", () => {
  it("groups repeated misconceptions and preserves recency-weighted severity", () => {
    const model = buildErrorModel({
      now: new Date("2025-06-03T12:00:00.000Z"),
      mistakes: [
        base(),
        base({ id: "m2", topicId: "maths.functions", marksLost: 2, createdAt: "2025-06-03T09:00:00.000Z" }),
      ],
    });

    expect(model).toHaveLength(1);
    expect(model[0].key).toBe("misconception:significant-figures");
    expect(model[0].frequency).toBe(2);
    expect(model[0].openCount).toBe(2);
    expect(model[0].marksLost).toBe(3);
    expect(model[0].topicIds).toEqual(["maths.algebra", "maths.functions"]);
    expect(model[0].status).toBe("recurring");
    expect(model[0].recencyWeight).toBeGreaterThan(0.9);
  });

  it("marks a repaired pattern as improving and removes it from actionables", () => {
    const model = buildErrorModel({
      mistakes: [
        base({ resolved: true, resolvedAt: "2025-06-02T12:00:00.000Z", retestCount: 2 }),
        base({ id: "m2", resolved: true, resolvedAt: "2025-06-03T12:00:00.000Z", retestCount: 1 }),
      ],
      now: new Date("2025-06-04T12:00:00.000Z"),
    });
    expect(model[0].status).toBe("improving");
    expect(actionableErrors(model, "maths")).toEqual([]);
  });
});
