// Stable transaction identity.
//
// The register needs to target a specific transaction for edit/delete. We use
// the transaction's `meta.id`. ensureIds() assigns a stable id to any
// transaction missing one; because serialize() writes metadata back to the
// file, ids persist across reads once the ledger has been saved.

import { Ledger, Transaction } from "./types";

/**
 * Ensure every transaction has a unique `meta.id`. Returns true if any id was
 * added (caller should persist). Ids are stable across reads once written.
 */
export function ensureIds(ledger: Ledger): boolean {
  const seen = new Set<string>();
  for (const d of ledger.directives) {
    if (d.kind === "transaction" && d.meta.id) seen.add(d.meta.id);
  }
  let counter = 0;
  let changed = false;
  const nextId = (date: string): string => {
    let id: string;
    do {
      counter++;
      id = "tx-" + date.replace(/-/g, "") + "-" + counter.toString(36);
    } while (seen.has(id));
    seen.add(id);
    return id;
  };
  for (const d of ledger.directives) {
    if (d.kind !== "transaction") continue;
    if (!d.meta.id) {
      d.meta.id = nextId(d.date);
      changed = true;
    }
  }
  return changed;
}

/** Find a transaction by its stable id. */
export function findById(ledger: Ledger, id: string): Transaction | undefined {
  return ledger.directives.find(
    (d): d is Transaction => d.kind === "transaction" && d.meta.id === id
  );
}
