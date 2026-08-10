import type { Id, Topic, TopicMastery } from "./types";

// ---------------------------------------------------------------------------
// Prerequisite / topic-dependency graph.
//
// Topics are not independent. "Equilibria" assumes "Moles"; "Integration"
// assumes "Differentiation". When a topic is weak and its prerequisite is
// also weak, fixing the prerequisite first recovers more marks per hour than
// grinding the downstream topic in isolation. This module makes that explicit
// so the Weak-topic diagnosis and the recommender can surface it.
//
// The graph is *additive*: curriculum modules can declare edges, but nothing
// breaks if they do not — unknown topics simply have no prerequisites.
// ---------------------------------------------------------------------------

/** One directed edge: `prerequisiteId` should be secure before `topicId`. */
export interface PrerequisiteEdge {
  topicId: Id;
  prerequisiteId: Id;
  /** "You will struggle with X until Y is secure." Shown verbatim in the UI. */
  reason?: string;
}

// Curated edges for the two specifications. IDs are fully-qualified topic ids
// so AQA and WJEC can diverge without colliding.
const EDGES: PrerequisiteEdge[] = [
  // Chemistry — physical
  { topicId: "wjec-alevel-chemistry.equilibria", prerequisiteId: "wjec-alevel-chemistry.moles", reason: "Equilibrium calculations reuse mole and concentration work" },
  { topicId: "wjec-alevel-chemistry.acids-bases", prerequisiteId: "wjec-alevel-chemistry.equilibria", reason: "pH and buffers are a special case of equilibrium" },
  { topicId: "wjec-alevel-chemistry.kinetics", prerequisiteId: "wjec-alevel-chemistry.moles", reason: "Rate equations need mole and gas-volume fluency" },
  { topicId: "wjec-alevel-chemistry.energetics", prerequisiteId: "wjec-alevel-chemistry.bonding", reason: "Enthalpy cycles reuse bonding and structure ideas" },
  { topicId: "aqa-alevel-chemistry.equilibria", prerequisiteId: "aqa-alevel-chemistry.moles", reason: "Equilibrium calculations reuse mole and concentration work" },
  { topicId: "aqa-alevel-chemistry.acids-bases", prerequisiteId: "aqa-alevel-chemistry.equilibria", reason: "pH and buffers are a special case of equilibrium" },
  { topicId: "aqa-alevel-chemistry.kinetics", prerequisiteId: "aqa-alevel-chemistry.moles", reason: "Rate equations need mole and gas-volume fluency" },
  { topicId: "aqa-alevel-chemistry.energetics", prerequisiteId: "aqa-alevel-chemistry.bonding", reason: "Enthalpy cycles reuse bonding and structure ideas" },
  // Physics
  { topicId: "wjec-alevel-physics.kinematics-dynamics", prerequisiteId: "wjec-alevel-physics.motion", reason: "Dynamics assumes kinematics fluency" },
  { topicId: "wjec-alevel-physics.forces-energy", prerequisiteId: "wjec-alevel-physics.kinematics-dynamics", reason: "Work/energy needs the kinematics base" },
  { topicId: "aqa-alevel-physics.kinematics-dynamics", prerequisiteId: "aqa-alevel-physics.motion", reason: "Dynamics assumes kinematics fluency" },
  { topicId: "aqa-alevel-physics.forces-energy", prerequisiteId: "aqa-alevel-physics.kinematics-dynamics", reason: "Work/energy needs the kinematics base" },
  // Maths
  { topicId: "wjec-alevel-maths.integration", prerequisiteId: "wjec-alevel-maths.differentiation", reason: "Integration inverts differentiation — secure the derivative first" },
  { topicId: "wjec-alevel-maths.vectors", prerequisiteId: "wjec-alevel-maths.trigonometry", reason: "Vectors lean on trigonometry" },
  { topicId: "aqa-alevel-maths.integration", prerequisiteId: "aqa-alevel-maths.differentiation", reason: "Integration inverts differentiation — secure the derivative first" },
  { topicId: "aqa-alevel-maths.vectors", prerequisiteId: "aqa-alevel-maths.trigonometry", reason: "Vectors lean on trigonometry" },
  // Biology
  { topicId: "wjec-alevel-biology.respiration", prerequisiteId: "wjec-alevel-biology.enzymes", reason: "Respiration is an enzyme-controlled pathway" },
  { topicId: "wjec-alevel-biology.genetics-inheritance", prerequisiteId: "wjec-alevel-biology.nucleic-acids", reason: "Genetics assumes the nucleic-acid base" },
  { topicId: "aqa-alevel-biology.respiration", prerequisiteId: "aqa-alevel-biology.enzymes", reason: "Respiration is an enzyme-controlled pathway" },
  { topicId: "aqa-alevel-biology.genetics-inheritance", prerequisiteId: "aqa-alevel-biology.nucleic-acids", reason: "Genetics assumes the nucleic-acid base" },
];

export function prerequisiteEdges(): PrerequisiteEdge[] { return [...EDGES]; }

export function prerequisitesFor(topicId: Id): Id[] {
  return EDGES.filter((e) => e.topicId === topicId).map((e) => e.prerequisiteId);
}

export function dependentsOf(topicId: Id): Id[] {
  return EDGES.filter((e) => e.prerequisiteId === topicId).map((e) => e.topicId);
}

export interface DependencyReport {
  topicId: Id;
  weak: boolean;
  blockedBy: Array<{ prerequisiteId: Id; weak: boolean; reason?: string }>;
  blocks: Id[]; // downstream topics that depend on this one
}

/**
 * For each topic, report which prerequisites are also weak ("blocked") and
 * which downstream topics it blocks. Sorted so blocked topics come first.
 */
export function dependencyReport(input: { topics: Topic[]; mastery: TopicMastery[] }): DependencyReport[] {
  const masteryById = new Map(input.mastery.map((m) => [m.topicId, m]));
  const byId = new Map(input.topics.map((t) => [t.id, t]));
  const weakSet = new Set(input.mastery.filter((m) => m.weak).map((m) => m.topicId));
  const out: DependencyReport[] = [];
  for (const topic of input.topics) {
    const weak = weakSet.has(topic.id);
    const blockedBy = EDGES.filter((e) => e.topicId === topic.id && byId.has(e.prerequisiteId))
      .map((e) => ({ prerequisiteId: e.prerequisiteId, weak: weakSet.has(e.prerequisiteId), reason: e.reason }));
    const blocks = EDGES.filter((e) => e.prerequisiteId === topic.id && byId.has(e.topicId)).map((e) => e.topicId);
    // Only surface topics that participate in the graph or are weak
    if (blockedBy.length || blocks.length || weak) {
      out.push({ topicId: topic.id, weak, blockedBy, blocks });
    }
  }
  // Blocked weak topics first (best fix-the-prerequisite opportunities)
  out.sort((a, b) => {
    const aBlocked = a.blockedBy.some((x) => x.weak) ? 1 : 0;
    const bBlocked = b.blockedBy.some((x) => x.weak) ? 1 : 0;
    if (aBlocked !== bBlocked) return bBlocked - aBlocked;
    if (a.weak !== b.weak) return a.weak ? -1 : 1;
    return 0;
  });
  return out;
}

/**
 * Pick the highest-leverage prerequisite to fix first among weak topics that
 * are blocked. Returns null when no blocked weak topic exists.
 */
export function bestPrerequisiteFix(input: { topics: Topic[]; mastery: TopicMastery[]; marksPerHour?: Map<Id, number> }): { topicId: Id; prerequisiteId: Id; reason?: string } | null {
  const masteryById = new Map(input.mastery.map((m) => [m.topicId, m]));
  const weakSet = new Set(input.mastery.filter((m) => m.weak).map((m) => m.topicId));
  const candidates: Array<{ topicId: Id; prerequisiteId: Id; reason?: string; mastery: number; mph?: number }> = [];
  for (const e of EDGES) {
    if (!weakSet.has(e.topicId)) continue;
    if (!weakSet.has(e.prerequisiteId)) continue;
    const m = masteryById.get(e.prerequisiteId);
    if (!m) continue;
    candidates.push({ topicId: e.topicId, prerequisiteId: e.prerequisiteId, reason: e.reason, mastery: m.mastery, mph: input.marksPerHour?.get(e.prerequisiteId) });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (a.mph != null && b.mph != null && a.mph !== b.mph) return b.mph - a.mph;
    return a.mastery - b.mastery;
  });
  const c = candidates[0];
  return { topicId: c.topicId, prerequisiteId: c.prerequisiteId, reason: c.reason };
}
