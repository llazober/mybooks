// Shared bank-feed dedupe signature. Imported by both the server actions and
// the client Bank Feed view so a row's signature is computed identically on
// both sides. Match rule: date + signed amount (cents) + normalized description.

export function feedNormDesc(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function feedSignature(date: string, amountCents: number, description: string): string {
  return date + "|" + amountCents + "|" + feedNormDesc(description);
}
