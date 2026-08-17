/**
 * Start-up plumbing for the browser entry point.
 *
 * Everything here exists because of one gap between running the app locally
 * and serving it from a CDN: booting is expensive. The demo generates 180 days
 * of synthetic events and runs a full relationship scan before React has
 * anything to render — about 1.5s on a laptop and 7s on a throttled phone.
 * Locally, against a warm dev server, that is invisible. Served over a network
 * to a real device it is a blank white page, and a boot that *throws* is a
 * blank white page forever, with the only evidence in a console nobody opens.
 *
 * So the entry point paints a fallback first (it ships inside index.html, so
 * it costs no JavaScript), yields the main thread to let it appear, and turns
 * any failure into something the page states out loud.
 *
 * Kept separate from main.tsx because that module boots on import and cannot
 * be pulled into a test.
 */

/**
 * Resolves after the browser has had a chance to paint.
 *
 * `requestAnimationFrame` fires *before* the frame is painted, so a task
 * queued inside it would still block that paint; the nested `setTimeout`
 * pushes the work into a macrotask that runs after it.
 */
export function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
}

/**
 * Replaces the boot fallback with a failure the reader can act on.
 *
 * Built with DOM calls rather than React: whatever broke may have broken
 * during module evaluation, and this is the last thing standing. The message
 * is set as text, never as markup — an error string can carry anything.
 */
export function renderBootFailure(container: Element, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);

  const panel = document.createElement("div");
  panel.className = "boot boot--failed";
  panel.setAttribute("role", "alert");

  const heading = document.createElement("h1");
  heading.textContent = "Pulse could not start";

  const explanation = document.createElement("p");
  explanation.textContent =
    "The analysis runs entirely in this browser, so nothing was sent anywhere. Reloading is usually enough; if it is not, this is a bug in the build.";

  const reason = document.createElement("p");
  reason.className = "boot__reason";
  reason.textContent = detail;

  panel.append(heading, explanation, reason);
  container.replaceChildren(panel);
}
