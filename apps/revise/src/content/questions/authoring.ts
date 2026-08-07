import type { AoCode, ContentSource, Id, Question, QuestionKind, QuestionPart, VerificationStatus } from "@/domain/types";

// Compact authoring format for the seed question bank. Ids are deterministic
// (`seed-q:<slug>`) so re-seeding never duplicates a question or orphans the
// attempts already recorded against it.

export interface PartSpec {
  label?: string;
  prompt: string;
  marks: number;
  /** One awardable mark-scheme point per entry, in examiner shorthand. */
  scheme: string[];
  answer: string;
  aos?: AoCode[];
}

export interface QuestionSpec {
  slug: string;
  subjectId: Id;
  topics: string[];
  kind?: QuestionKind;
  stem: string;
  options?: string[];
  correctIndex?: number;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  calculator?: boolean;
  parts: PartSpec[];
  source?: ContentSource;
  verification?: VerificationStatus;
  lastChecked?: string | null;
  specVersion?: string;
  aos?: AoCode[];
}

const SEED_CREATED_AT = "2025-01-01T00:00:00.000Z";

export function defineQuestion(spec: QuestionSpec): Question {
  const id = `seed-q:${spec.slug}`;
  const parts: QuestionPart[] = spec.parts.map((part, i) => ({
    id: `${id}:${i}`,
    label: part.label ?? (spec.parts.length > 1 ? `(${"abcdefgh"[i]})` : ""),
    prompt: part.prompt,
    marks: part.marks,
    markScheme: part.scheme,
    modelAnswer: part.answer,
    aos: part.aos,
  }));

  const aos =
    spec.aos ?? [...new Set(parts.flatMap((p) => p.aos ?? []))] as AoCode[];

  return {
    id,
    subjectId: spec.subjectId,
    topicIds: spec.topics.map((t) => `${spec.subjectId}.${t}`),
    kind: spec.kind ?? (spec.options ? "mcq" : parts.length > 1 ? "structured" : "short"),
    stem: spec.stem,
    options: spec.options,
    correctIndex: spec.correctIndex,
    parts,
    totalMarks: parts.reduce((a, p) => a + p.marks, 0),
    calculatorAllowed: spec.calculator ?? true,
    difficulty: spec.difficulty ?? 3,
    origin: "seed",
    source: spec.source ?? "authored",
    verification: spec.verification ?? "unverified",
    lastChecked: spec.lastChecked ?? null,
    specVersion: spec.specVersion,
    aos: aos.length ? aos : undefined,
    createdAt: SEED_CREATED_AT,
  };
}

export function defineQuestions(specs: QuestionSpec[]): Question[] {
  return specs.map(defineQuestion);
}
