// Non-action helpers for entity actions. Kept out of the "use server" file
// because that file may only export async functions.

import { createHash } from "node:crypto";
import type { Ledger } from "@/lib/beancount";

/** Hash owner+password for storage. NOTE: client-side gating on a public file
 *  is a deterrent, not real security. Plaintext is never stored. */
export function pwHash(owner: string, password: string): string {
  return createHash("sha256")
    .update(owner.trim().toLowerCase() + ":" + password)
    .digest("hex");
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "entity-" + Date.now()
  );
}

/** The read-only sample entity id (cannot be edited; can be duplicated freely). */
export const READONLY_SAMPLE_ID = "sample-company";

export const READONLY_MSG =
  "This is the read-only Sample Company. Duplicate it to a new entity to make changes.";

/** True if the entity is the protected read-only sample. */
export function isReadOnly(id: string, ledger?: Ledger): boolean {
  if (id === READONLY_SAMPLE_ID) return true;
  return !!ledger && ledger.options.bb_readonly === "1";
}
