import type { Subject, SubjectId, Topic } from "./types";

// Topic lists are a study-planning guide grouped by broad content area, not a
// transcription of the official specification — always check the current
// WJEC/Eduqas spec document for exact assessment objectives and exam weighting.
export const SUBJECTS: Subject[] = [
  { id: "chemistry", name: "Chemistry" },
  { id: "physics", name: "Physics" },
  { id: "biology", name: "Biology" },
  { id: "maths", name: "Maths" },
];

function topics(subjectId: SubjectId, titles: string[]): Topic[] {
  return titles.map((title, i) => ({
    id: `${subjectId}-${i + 1}`,
    subjectId,
    title,
  }));
}

const CHEMISTRY = topics("chemistry", [
  "Atomic structure & the periodic table",
  "Moles, formulae & equations",
  "Bonding: ionic, covalent & metallic",
  "Periodicity & Group 2/7 chemistry",
  "Redox reactions & electrode potentials",
  "Energetics & Hess's law",
  "Reaction kinetics & rate equations",
  "Chemical equilibrium (Kc & Kp)",
  "Acid-base equilibria, pH & buffers",
  "Thermodynamics & Born-Haber cycles",
  "Transition metals & complex ions",
  "Introduction to organic chemistry & isomerism",
  "Alkanes, alkenes & haloalkanes",
  "Alcohols, aldehydes & ketones",
  "Carboxylic acids, esters & derivatives",
  "Aromatic chemistry",
  "Amines, amino acids & polymers",
  "Organic synthesis & spectroscopy (IR, MS, NMR)",
]);

const PHYSICS = topics("physics", [
  "Motion, forces & Newton's laws",
  "Energy, work & power",
  "Materials: Hooke's law & stress-strain",
  "Waves & superposition",
  "Quantum physics & the photoelectric effect",
  "Electric circuits & components",
  "Momentum & collisions",
  "Circular motion & gravitational fields",
  "Simple harmonic motion & oscillations",
  "Thermal physics & ideal gases",
  "Electric & magnetic fields",
  "Capacitance",
  "Nuclear physics & radioactivity",
  "Particle physics & the Standard Model",
  "Astrophysics & cosmology",
]);

const BIOLOGY = topics("biology", [
  "Biological molecules: carbohydrates, lipids, proteins, nucleic acids",
  "Cell structure & organisation",
  "Cell membranes & transport",
  "Enzymes",
  "Cell division: mitosis, meiosis & genetic diversity",
  "Classification & biodiversity",
  "Exchange surfaces & gas exchange",
  "Mass transport: the circulatory system",
  "DNA, genes & protein synthesis",
  "Genetic inheritance & variation",
  "Homeostasis & the nervous system",
  "Hormonal communication & the endocrine system",
  "Populations & ecosystems",
  "Energy & respiration",
  "Photosynthesis",
  "Immunology & disease",
  "Gene technology & biotechnology",
  "Evolution & speciation",
]);

const MATHS = topics("maths", [
  "Algebra & functions",
  "Coordinate geometry",
  "Sequences & series",
  "Trigonometry",
  "Exponentials & logarithms",
  "Differentiation",
  "Integration",
  "Numerical methods",
  "Vectors",
  "Statistical sampling & distributions",
  "Hypothesis testing & correlation",
  "Probability",
  "Kinematics",
  "Forces & Newton's laws (mechanics)",
  "Moments & equilibrium (mechanics)",
]);

export const TOPICS: Topic[] = [...CHEMISTRY, ...PHYSICS, ...BIOLOGY, ...MATHS];

export function topicsForSubject(subjectId: SubjectId): Topic[] {
  return TOPICS.filter((t) => t.subjectId === subjectId);
}

export function findTopic(topicId: string): Topic | undefined {
  return TOPICS.find((t) => t.id === topicId);
}

export function findSubject(subjectId: SubjectId): Subject | undefined {
  return SUBJECTS.find((s) => s.id === subjectId);
}
