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
  },
];

export function specFor(subjectId: Id): SpecManifestEntry | undefined {
  return SPEC_MANIFEST.find((s) => s.subjectId === subjectId);
}
