import type { Id, IsoDate } from "./types";

// One entry per qualification·subject spec that Revise tracks.
export interface SpecManifestEntry {
  subjectId: Id;
  boardId: string;
  qualificationId: string;
  specCode: string;
  level: string;
  version: string;
  releaseDate: IsoDate;
  lastChecked: IsoDate;
  url?: string;
  // How many discrete statements from the spec doc this subject's topics claim
  // to cover. Kept here so tooling can assert coverage without crawling topics.
  statementsTotal?: number;
  /** Paper/unit breakdown when known — duration, marks, weighting already live on Subject.papers. */
  paperBreakdown?: Array<{ paperId: Id; unit: string; durationMinutes: number; marks: number; weight: number }>;
}

export const SPEC_MANIFEST: SpecManifestEntry[] = [
  {
    subjectId: "wjec-alevel-physics",
    boardId: "wjec",
    qualificationId: "wjec-alevel",
    specCode: "A200QS",
    level: "A Level",
    version: "2024-1.0",
    releaseDate: "2024-09-01",
    lastChecked: "2026-08-01",
    url: "https://www.wjec.co.uk/qualifications/physics-as-a-level/",
    statementsTotal: 189,
    paperBreakdown: [{ paperId: "wjec-alevel-physics.as", unit: "AS Units 1 & 2", durationMinutes: 210, marks: 160, weight: 0.4 },{ paperId: "wjec-alevel-physics.u3", unit: "Unit 3", durationMinutes: 135, marks: 100, weight: 0.25 },{ paperId: "wjec-alevel-physics.u4", unit: "Unit 4", durationMinutes: 120, marks: 100, weight: 0.25 },{ paperId: "wjec-alevel-physics.u5", unit: "Unit 5", durationMinutes: 180, marks: 30, weight: 0.1 }],
  },
  {
    subjectId: "wjec-alevel-chemistry",
    boardId: "wjec",
    qualificationId: "wjec-alevel",
    specCode: "A100QS",
    level: "A Level",
    version: "2024-1.0",
    releaseDate: "2024-09-01",
    lastChecked: "2026-08-01",
    url: "https://www.wjec.co.uk/qualifications/chemistry-as-a-level/",
    statementsTotal: 212,
    paperBreakdown: [{ paperId: "wjec-alevel-chemistry.as", unit: "AS Units 1 & 2", durationMinutes: 210, marks: 160, weight: 0.4 },{ paperId: "wjec-alevel-chemistry.u3", unit: "Unit 3", durationMinutes: 105, marks: 80, weight: 0.25 },{ paperId: "wjec-alevel-chemistry.u4", unit: "Unit 4", durationMinutes: 105, marks: 80, weight: 0.25 },{ paperId: "wjec-alevel-chemistry.u5", unit: "Unit 5", durationMinutes: 150, marks: 30, weight: 0.1 }],
  },
  {
    subjectId: "wjec-alevel-biology",
    boardId: "wjec",
    qualificationId: "wjec-alevel",
    specCode: "A400QS",
    level: "A Level",
    version: "2024-1.0",
    releaseDate: "2024-09-01",
    lastChecked: "2026-08-01",
    url: "https://www.wjec.co.uk/qualifications/biology-as-a-level/",
    statementsTotal: 204,
    paperBreakdown: [{ paperId: "wjec-alevel-biology.as", unit: "AS Units 1 & 2", durationMinutes: 210, marks: 160, weight: 0.4 },{ paperId: "wjec-alevel-biology.u3", unit: "Unit 3", durationMinutes: 120, marks: 90, weight: 0.25 },{ paperId: "wjec-alevel-biology.u4", unit: "Unit 4", durationMinutes: 105, marks: 90, weight: 0.25 },{ paperId: "wjec-alevel-biology.u5", unit: "Unit 5", durationMinutes: 120, marks: 30, weight: 0.1 }],
  },
  {
    subjectId: "wjec-alevel-maths",
    boardId: "wjec",
    qualificationId: "wjec-alevel",
    specCode: "A00-A60",
    level: "A Level",
    version: "2024-1.0",
    releaseDate: "2024-09-01",
    lastChecked: "2026-08-01",
    url: "https://www.wjec.co.uk/qualifications/mathematics-as-a-level/",
    statementsTotal: 178,
    paperBreakdown: [{ paperId: "wjec-alevel-maths.u1", unit: "Unit 1", durationMinutes: 150, marks: 120, weight: 0.25 },{ paperId: "wjec-alevel-maths.u2", unit: "Unit 2", durationMinutes: 105, marks: 60, weight: 0.25 },{ paperId: "wjec-alevel-maths.u3", unit: "Unit 3", durationMinutes: 150, marks: 120, weight: 0.3 },{ paperId: "wjec-alevel-maths.u4", unit: "Unit 4", durationMinutes: 105, marks: 60, weight: 0.2 }],
  },
];

export function specFor(subjectId: Id): SpecManifestEntry | undefined {
  return SPEC_MANIFEST.find((s) => s.subjectId === subjectId);
}
