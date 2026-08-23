// download.ts — one shared trigger for client-side file downloads.
// Four surfaces (privacy export, study export, evidence report, review corpus)
// used to carry near-identical Blob/anchor code.

export function downloadText(filename: string, text: string, mime = "application/json"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadText(filename, JSON.stringify(data, null, 2));
}
