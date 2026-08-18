export type PersonalEvidenceErrorCode = "EXPORT_FAILED";

export class PersonalEvidenceError extends Error {
  constructor(
    readonly code: PersonalEvidenceErrorCode,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PersonalEvidenceError";
  }
}
