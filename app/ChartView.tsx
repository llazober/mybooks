"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import {
  getAccountRows,
  addAccount,
  removeAccount,
  importAccounts,
  clearEntityAccounts,
  type AccountRowDTO,
} from "./actions";

const ROOTS = ["Assets", "Liabilities", "Equity", "Income", "COGS", "Expenses"];

// Map common singular/typo roots to the canonical Beancount root.
const ROOT_ALIASES: Record<string, string> = {
  asset: "Assets",
  assets: "Assets",
  liability: "Liabilities",
  liabilities: "Liabilities",
  equity: "Equity",
  income: "Income",
  revenue: "Income",
  revenues: "Income",
  cogs: "COGS",
  expense: "Expenses",
  expenses: "Expenses",
};

// Beancount account segments must be single CamelCase tokens (no spaces or
// punctuation). Turn a friendly label like "Chase Checking" into "ChaseChecking".
function toSegment(raw: string): string {
  const words = raw.trim().split(/[^A-Za-z0-9]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

/**
 * Normalize a raw account label into a canonical `Root:Sub:Sub` name.
 * Accepts canonical ("Assets:Bank:Checking") or friendly ("Bank:Chase Checking")
 * input. If the label has no recognizable root, `fallbackRoot` is used; when no
 * fallback is given (bulk import), an unrooted label returns "" (unresolved).
 */
function normalizeAccount(raw: string, fallbackRoot?: string): string {
  const n = raw.trim();
  if (!n) return "";
  const rawSegs = n.split(":").map((s) => s.trim()).filter(Boolean);
  if (rawSegs.length === 0) return "";

  const firstLower = rawSegs[0].toLowerCase();
  const hasRoot = firstLower in ROOT_ALIASES;
  if (!hasRoot && !fallbackRoot) return ""; // no root and nothing to fall back to
  const rootSeg = hasRoot ? ROOT_ALIASES[firstLower] : (fallbackRoot as string);
  const bodySegs = (hasRoot ? rawSegs.slice(1) : rawSegs).map(toSegment).filter(Boolean);
  if (bodySegs.length === 0) return ""; // just a root, no leaf segment

  return [rootSeg, ...bodySegs].join(":");
}

function money(display: string): string {
  const neg = display.startsWith("-");
  const [intPart, dec] = display.replace("-", "").split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-$" : "$") + withCommas + "." + dec;
}

// Parse a formatted balance string ("-1,234.56" or "1234.56") to cents.
function toCents(display: string): number {
  const neg = display.trim().startsWith("-");
  const digits = display.replace(/[^0-9.]/g, "");
  const [intPart, dec = "0"] = digits.split(".");
  const cents = parseInt(intPart || "0", 10) * 100 + parseInt(dec.padEnd(2, "0").slice(0, 2), 10);
  return neg ? -cents : cents;
}

function centsToStr(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  return (neg ? "-" : "") + Math.floor(abs / 100) + "." + String(abs % 100).padStart(2, "0");
}

// A node in the chart-of-accounts tree.
interface TreeNode {
  segment: string; // leaf segment, e.g. "Checking"
  full: string; // full path, e.g. "Assets:Bank:Checking"
  depth: number; // 0 = root (Assets), 1 = first sub, …
  row?: AccountRowDTO; // present if this exact account is `open` (postable)
  rollupCents: number; // this account's own balance + all descendants
  children: TreeNode[];
}

/** Build a parent→child tree from flat account rows. */
function buildTree(rows: AccountRowDTO[]): TreeNode[] {
  const byFull = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  // Ensure a node exists for every path prefix (so parents without their own
  // `open` directive still appear as headers).
  function ensure(full: string): TreeNode {
    const existing = byFull.get(full);
    if (existing) return existing;
    const segs = full.split(":");
    const node: TreeNode = {
      segment: segs[segs.length - 1],
      full,
      depth: segs.length - 1,
      rollupCents: 0,
      children: [],
    };
    byFull.set(full, node);
    if (segs.length === 1) {
      roots.push(node);
    } else {
      const parent = ensure(segs.slice(0, -1).join(":"));
      parent.children.push(node);
    }
    return node;
  }
  for (const r of rows) {
    const node = ensure(r.account);
    node.row = r;
  }
  // Roll up balances (own + descendants).
  function rollup(node: TreeNode): number {
    let sum = node.row ? toCents(node.row.balance) : 0;
    for (const c of node.children) sum += rollup(c);
    node.rollupCents = sum;
    return sum;
  }
  for (const r of roots) rollup(r);
  // Stable order: roots in canonical accounting order, children alphabetical.
  roots.sort((a, b) => ROOTS.indexOf(a.segment) - ROOTS.indexOf(b.segment));
  function sortKids(node: TreeNode) {
    node.children.sort((a, b) => a.segment.localeCompare(b.segment));
    node.children.forEach(sortKids);
  }
  roots.forEach(sortKids);
  return roots;
}

export default function ChartView({
  entityId,
  onChange,
  onOpenAccount,
}: {
  entityId: string;
  onChange?: () => void;
  onOpenAccount?: (account: string) => void;
}) {
  const [rows, setRows] = useState<AccountRowDTO[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [root, setRoot] = useState("Expenses");
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");

  // Bulk "import multiple accounts" state.
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{ ok: boolean; msg: string } | null>(null);

  function refresh() {
    startTransition(async () => {
      setRows(await getAccountRows(entityId));
    });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  // Single-add always has a fallback root (the Type selector).
  function fullName(): string {
    return normalizeAccount(name, root);
  }

  function submit() {
    setError(null);
    const account = fullName();
    startTransition(async () => {
      const res = await addAccount(entityId, account, opening || undefined);
      if (!res.ok) {
        setError(res.error || "Could not add account");
        return;
      }
      setName("");
      setOpening("");
      setRows(await getAccountRows(entityId));
      onChange?.();
    });
  }

  function remove(account: string) {
    setError(null);
    startTransition(async () => {
      const res = await removeAccount(entityId, account);
      if (!res.ok) {
        setError(res.error || "Could not remove account");
        return;
      }
      setRows(await getAccountRows(entityId));
      onChange?.();
    });
  }

  // Parse the paste box into canonical names (deduped) plus any lines we
  // couldn't resolve to a root. The backend still re-validates and skips
  // duplicates; this is just a live preview.
  const parsedBulk = useMemo(() => {
    const canonical: string[] = [];
    const unresolved: string[] = [];
    const seen = new Set<string>();
    for (const line of bulkText.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const norm = normalizeAccount(t);
      if (!norm) {
        unresolved.push(t);
        continue;
      }
      if (seen.has(norm)) continue;
      seen.add(norm);
      canonical.push(norm);
    }
    return { canonical, unresolved };
  }, [bulkText]);

  function importBulk() {
    setError(null);
    setBulkResult(null);
    const accounts = parsedBulk.canonical;
    if (accounts.length === 0) return;
    startTransition(async () => {
      const res = await importAccounts(entityId, accounts);
      if (!res.ok) {
        setBulkResult({ ok: false, msg: res.error || "Import failed" });
        return;
      }
      const parts = [`Added ${res.added ?? 0}`];
      if (res.skipped) parts.push(`skipped ${res.skipped} existing`);
      if (res.invalid && res.invalid.length) parts.push(`${res.invalid.length} invalid`);
      setBulkResult({ ok: true, msg: parts.join(" · ") });
      setBulkText("");
      setRows(await getAccountRows(entityId));
      onChange?.();
    });
  }

  const tree = useMemo(() => buildTree(rows), [rows]);

  // Render a tree node and its descendants as indented table rows.
  function renderNode(node: TreeNode): React.ReactElement[] {
    const hasChildren = node.children.length > 0;
    const isPostable = !!node.row;
    // Parent rows (have children) show the rolled-up balance; leaf postable
    // accounts show their own balance.
    const shown = hasChildren ? node.rollupCents : node.row ? toCents(node.row.balance) : 0;
    const out: React.ReactElement[] = [
      <tr key={node.full} className={hasChildren ? "coa-parent" : "coa-leaf"}>
        <td>
          <span style={{ paddingLeft: node.depth * 22 }}>
            <span style={{ fontWeight: hasChildren ? 600 : 400 }}>{node.segment}</span>
            {hasChildren && isPostable ? (
              <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
                (postable + {node.children.length} sub)
              </span>
            ) : hasChildren ? (
              <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
                ({node.children.length} sub{node.children.length > 1 ? "-accounts" : "-account"})
              </span>
            ) : null}
          </span>
        </td>
        <td>{node.row ? <span className="pill">{node.row.type}</span> : null}</td>
        <td className="amount" style={{ fontWeight: hasChildren ? 600 : 400 }}>
          {isPostable && onOpenAccount ? (
            <button
              type="button"
              className="coa-amount"
              onClick={() => onOpenAccount(node.full)}
              title={"Open " + node.full + " in the Ledger (all dates)"}
            >
              {money(centsToStr(shown))}
            </button>
          ) : (
            money(centsToStr(shown))
          )}
        </td>
        <td className="amount">
          {isPostable ? (
            <button
              onClick={() => remove(node.full)}
              disabled={pending || !node.row!.removable}
              title={node.row!.removable ? "Remove account" : "Has activity — cannot remove"}
            >
              Remove
            </button>
          ) : null}
        </td>
      </tr>,
    ];
    for (const c of node.children) out.push(...renderNode(c));
    return out;
  }

  return (
    <div className="grid">
      <div className="panel span-12">
        <h2>Chart of Accounts Management</h2>
        {error ? <div className="notice">{error}</div> : null}
        
        <div style={{ display: "flex", gap: "20px", marginTop: "10px", alignItems: "center" }}>
          <div>
            <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>Import from CSV</p>
            <input 
              type="file" 
              accept=".csv" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                  const text = ev.target?.result as string;
                  const lines = text.split(/\r?\n/).slice(1);
                  const accountsToImport: string[] = [];
                  
                  for (const line of lines) {
                    if (!line.trim()) continue;
                    const cols = line.split(',');
                    const num = cols[0];
                    const rawName = cols[1];
                    const type = cols[2];
                    if (!rawName || !type) continue;
                    
                    let root = "Expenses";
                    let middle = "";
                    if (type.includes("Current Asset")) { root = "Assets"; middle = "Current"; }
                    else if (type.includes("Fixed Asset")) { root = "Assets"; middle = "Fixed"; }
                    else if (type.includes("Other Asset")) { root = "Assets"; middle = "Other"; }
                    else if (type.includes("Asset")) { root = "Assets"; }
                    else if (type.includes("Current Liability")) { root = "Liabilities"; middle = "Current"; }
                    else if (type.includes("Long Term Liability")) { root = "Liabilities"; middle = "LongTerm"; }
                    else if (type.includes("Liability")) { root = "Liabilities"; }
                    else if (type.includes("Capital")) { root = "Equity"; }
                    else if (type.includes("Income")) { root = "Income"; }
                    else if (type.includes("Goods")) { root = "COGS"; }
                    
                    const cleanNum = num ? num.replace(/\./g, '_') + "-" : "";
                    const words = rawName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
                    const cleanName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
                    const leaf = cleanNum + cleanName;
                    
                    const segments = [root];
                    if (middle) segments.push(middle);
                    segments.push(leaf);
                    
                    accountsToImport.push(segments.join(':'));
                  }
                  
                  setError(null);
                  startTransition(async () => {
                    const res = await importAccounts(entityId, accountsToImport);
                    if (!res.ok) setError("Import failed: " + res.error);
                    else {
                      setRows(await getAccountRows(entityId));
                      onChange?.();
                    }
                  });
                };
                reader.readAsText(file);
              }} 
            />
          </div>

          <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: "20px" }}>
            <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>Testing</p>
            <button 
              className="danger" 
              onClick={() => {
                if (!confirm("Are you sure you want to delete all accounts?")) return;
                startTransition(async () => {
                  await clearEntityAccounts(entityId);
                  setRows(await getAccountRows(entityId));
                  onChange?.();
                });
              }}
              disabled={pending}
            >
              {pending ? "Processing..." : "Delete all accounts"}
            </button>
          </div>
        </div>
      </div>

      <div className="panel span-12">
        <h2>Chart of accounts</h2>
        <p className="muted" style={{ marginTop: -4, marginBottom: 10 }}>
          Sub-accounts are indented under their parent. Parent rows show a
          rolled-up balance (the account plus all of its sub-accounts). Click any
          account balance to open that account in the Ledger (all dates).
        </p>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Type</th>
              <th className="amount">Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="muted" colSpan={4}>
                  No accounts yet
                </td>
              </tr>
            ) : (
              tree.flatMap((node) => renderNode(node))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
