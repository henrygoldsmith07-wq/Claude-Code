import type { BillingCycle, Subscription } from "./types";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

const VALID_CYCLES: BillingCycle[] = ["weekly", "monthly", "yearly"];

export function parseSubscriptionsCsv(
  text: string,
): Omit<Subscription, "id" | "priceHistory">[] {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => l.trim() === "Subscriptions");
  if (headerIndex === -1) {
    throw new Error('CSV must contain a "Subscriptions" section (as exported by this app)');
  }

  const columns = parseCsvLine(lines[headerIndex + 1]).map((c) => c.trim());
  const nameIdx = columns.indexOf("Name");
  const categoryIdx = columns.indexOf("Category");
  const amountIdx = columns.indexOf("Amount");
  const cycleIdx = columns.indexOf("Billing Cycle");
  const renewalIdx = columns.indexOf("Next Renewal");

  if (nameIdx === -1 || amountIdx === -1) {
    throw new Error("CSV is missing required Name/Amount columns");
  }

  const result: Omit<Subscription, "id" | "priceHistory">[] = [];

  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) break;
    const fields = parseCsvLine(line);
    const name = fields[nameIdx]?.trim();
    const amountCents = Math.round(parseFloat(fields[amountIdx]) * 100);
    if (!name || Number.isNaN(amountCents)) continue;

    const cycleRaw = fields[cycleIdx]?.trim().toLowerCase();
    const billingCycle: BillingCycle = VALID_CYCLES.includes(cycleRaw as BillingCycle)
      ? (cycleRaw as BillingCycle)
      : "monthly";

    result.push({
      name,
      category: fields[categoryIdx]?.trim() || "Other",
      amountCents,
      billingCycle,
      nextRenewalDate: fields[renewalIdx]?.trim() || new Date().toISOString().slice(0, 10),
      active: true,
      isTrial: false,
      trialEndsDate: null,
      splitCount: 1,
      yearlyPriceCents: null,
      notes: "",
      cancelUrl: null,
      lastUsedDate: null,
    });
  }

  return result;
}
