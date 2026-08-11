/** End-to-end security review notes (static, auditable). */
export const SECURITY_REVIEW = {
  r2: "Private bucket; presigned PUT/GET only; CORS restricted to app origin. No public R2 URL by default.",
  mongo: "Connection pooled, indexes on shareId/createdAt/recurringKey/workspaceId; shareId nanoid(12) public link, meeting detail requires ObjectId.",
  auth: "Desktop uploads require x-api-key === DESKTOP_API_KEY; share page is readOnly; transcript PATCH is authenticated.",
  encryption: "Optional WebCrypto AES-GCM local encryption before upload (passphrase PBKDF2 120k). No plaintext local blob when enabled.",
  retention: "retentionDays + /api/cron/retention auto-delete; export JSON/Markdown; R2 object deleted with record.",
  transcription: "Groq Whisper via server-side fetch; bytes never logged; chunked for large files.",
} as const;
