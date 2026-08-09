import { registerBoard, registerQualification } from "./registry";

// ES module imports are hoisted, so the subject modules below actually
// register first. That is safe: registration only stores records, and every
// cross-reference (subject → qualification → board) is resolved lazily by the
// registry's lookup functions, long after this module has finished evaluating.
registerBoard({ id: "wjec", name: "WJEC", country: "United Kingdom" });
registerBoard({ id: "eduqas", name: "Eduqas", country: "United Kingdom" });

registerQualification({
  id: "wjec-alevel",
  boardId: "wjec",
  name: "WJEC A Level",
  level: "A Level",
  grades: ["A*", "A", "B", "C", "D", "E", "U"],
});

// Importing for side effects registers each subject into the registry.
import "./wjec-maths";
import "./wjec-biology";
import "./wjec-chemistry";
import "./wjec-physics";

export * from "./registry";
export { A_LEVEL_BOUNDARIES } from "./helpers";
export type { TopicSpec, UnitSpec } from "./helpers";
