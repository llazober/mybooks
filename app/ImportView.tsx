"use client";

import { useEffect, useState, useTransition } from "react";
import { getAccounts, commitJournalBatch, clearEntityTransactions, type JournalBatchTxn } from "./actions";

function toCents(raw: string | number): number {
  if (typeof raw === "number") return Math.round(raw * 100);
  const s = String(raw).trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s);
  const n = Number(s.replace(/[$,()\s]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) * (negative ? -1 : 1);
}

function fromCents(cents: number): string {
  if (cents === 0) return "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return dollars.toString() + "." + rem.toString().padStart(2, "0");
}

function normalizeDate(value: string): string {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return "";
  const year = m[3].length === 2 ? "20" + m[3] : m[3];
  return year + "-" + m[1].padStart(2, "0") + "-" + m[2].padStart(2, "0");
}

function csvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

let KEY_SEQ = 1;

interface ParsedLine {
  key: number;
  date: string;
  account: string;
  debit: string;
  credit: string;
  description: string;
  ref: string;
  isAuto?: boolean;
}

const PLACEHOLDER = `Type\tDate\tEntity Cod Account\tDebit\tCredit\tDescription\tReference
GJ\t7/1/2026\t260\t35\t\tZelle payment\t
GJ\t7/7/2026\t656\t\t700\tCheck\t1626`;

export default function ImportView({
  entityId,
  onChange,
  initialText = "",
}: {
  entityId: string;
  onChange?: () => void;
  initialText?: string;
}) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [text, setText] = useState(initialText);
  const [lines, setLines] = useState<ParsedLine[]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Settings for auto-balance
  const [defaultDebit, setDefaultDebit] = useState("260");
  const [defaultCredit, setDefaultCredit] = useState("656");
  const [autoBalance, setAutoBalance] = useState(true);

  useEffect(() => {
    let active = true;
    getAccounts(entityId)
      .then((acc) => {
        if (active) {
          console.log("Loaded accounts:", acc.length);
          setAccounts(acc);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch accounts:", err);
      });
    return () => {
      active = false;
    };
  }, [entityId]);

  function doPreview() {
    setError(null);
    setOkMsg(null);
    const rows = text
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => (line.includes("\t") ? line.split("\t").map((c) => c.trim()) : csvLine(line)));
    if (!rows.length) {
      setError("No data to preview.");
      return;
    }

    const headers = rows[0].map((c) => c.trim().toLowerCase());
    const hasHeader = headers.some((h) => ["debit", "credit", "entity cod account", "account"].includes(h));
    const body = hasHeader ? rows.slice(1) : rows;

    const idx = (names: string[], fallback: number): number => {
      const found = headers.findIndex((h) => names.includes(h));
      return found >= 0 ? found : fallback;
    };

    const parsed: ParsedLine[] = [];
    for (const cells of body) {
      const date = normalizeDate(cells[idx(["date"], 1)] || "");
      const rawAccount = cells[idx(["entity cod account", "account"], 2)] || "";
      
      let account = rawAccount;
      if (rawAccount && accounts.length > 0) {
        const exact = accounts.find(a => a === rawAccount);
        if (exact) {
          account = exact;
        } else {
          const cleaned = rawAccount.replace(/\./g, "_");
          const pattern = new RegExp(`:${cleaned}-`, "i");
          const partial = accounts.find(a => pattern.test(a) || a.endsWith(`:${cleaned}`));
          if (partial) {
            account = partial;
          }
        }
      }

      const debitRaw = cells[idx(["debit"], 3)] || "";
      const creditRaw = cells[idx(["credit"], 4)] || "";
      const desc = cells[idx(["description", "memo"], 5)] || "";
      const ref = cells[idx(["reference", "ref"], 6)] || "";

      if (!date || (!debitRaw && !creditRaw)) continue;

      parsed.push({
        key: KEY_SEQ++,
        date,
        account,
        debit: fromCents(toCents(debitRaw)),
        credit: fromCents(toCents(creditRaw)),
        description: desc,
        ref,
        isAuto: false,
      });
    }

    // Auto-balance by grouping
    const grouped = new Map<string, ParsedLine[]>();
    for (const p of parsed) {
      const gkey = p.ref ? `${p.date}|${p.ref}` : `${p.date}|${p.description}`;
      if (!grouped.has(gkey)) grouped.set(gkey, []);
      grouped.get(gkey)!.push(p);
    }

    const finalLines: ParsedLine[] = [];
    for (const group of grouped.values()) {
      let totalCents = 0;
      for (const p of group) {
        totalCents += toCents(p.debit);
        totalCents -= toCents(p.credit);
        finalLines.push(p);
      }
      
      if (autoBalance && totalCents !== 0) {
        // Needs balancing
        let balanceAccount = totalCents > 0 ? defaultCredit : defaultDebit;
        if (balanceAccount && accounts.length > 0) {
          const exact = accounts.find(a => a === balanceAccount);
          if (!exact) {
            const cleaned = balanceAccount.replace(/\./g, "_");
            const pattern = new RegExp(`:${cleaned}-`, "i");
            const partial = accounts.find(a => pattern.test(a) || a.endsWith(`:${cleaned}`));
            if (partial) balanceAccount = partial;
          }
        }

        const balCents = Math.abs(totalCents);
        finalLines.push({
          key: KEY_SEQ++,
          date: group[0].date,
          account: balanceAccount,
          debit: totalCents < 0 ? fromCents(balCents) : "",
          credit: totalCents > 0 ? fromCents(balCents) : "",
          description: group[0].description,
          ref: group[0].ref,
          isAuto: true,
        });
      }
    }

    finalLines.sort((a, b) => a.date.localeCompare(b.date));
    setLines(finalLines);
    setPreviewed(true);
    if (finalLines.length === 0) setError("No valid rows found.");
  }

  function setLine(key: number, patch: Partial<ParsedLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  
  function removeLine(key: number) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function doCommit() {
    setError(null);
    setOkMsg(null);
    startTransition(async () => {
      // Group back into transactions for commit
      const grouped = new Map<string, ParsedLine[]>();
      let synth = 0;
      for (const p of lines) {
        if (!p.account || (!p.debit && !p.credit)) continue;
        const gkey = p.ref ? `${p.date}|${p.ref}` : `${p.date}|synth|${synth++}`;
        if (!grouped.has(gkey)) grouped.set(gkey, []);
        grouped.get(gkey)!.push(p);
      }

      const txns: JournalBatchTxn[] = [];
      for (const group of grouped.values()) {
        txns.push({
          date: group[0].date,
          ref: group[0].ref,
          payee: "", // CSV doesn't have a strict payee, we use memo
          memo: group[0].description,
          lines: group.map((g) => ({
            account: g.account,
            debit: g.debit,
            credit: g.credit,
          })),
        });
      }

      const res = await commitJournalBatch(entityId, txns);
      if (!res.ok) {
        setError(res.error || "Import failed");
        return;
      }
      setOkMsg(`Imported ${txns.length} journal entries successfully.`);
      setText("");
      setLines([]);
      setPreviewed(false);
      onChange?.();
    });
  }

  function handleClear() {
    if (!window.confirm("Are you sure you want to delete ALL transactions for this entity? This will NOT delete the chart of accounts.")) return;
    startTransition(async () => {
      const res = await clearEntityTransactions(entityId);
      if (res.ok) {
        setOkMsg("Cleared all transactions successfully.");
        onChange?.();
      } else {
        setError(res.error || "Failed to clear transactions.");
      }
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setText(e.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset to allow uploading same file again
  }

  // Calculate balance for display
  const totalDebit = lines.reduce((s, l) => s + toCents(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + toCents(l.credit), 0);
  const diff = totalDebit - totalCredit;
  const isBalanced = diff === 0 && totalDebit > 0;

  const hasUnknownAccounts = lines.some((l) => !accounts.includes(l.account));

  return (
    <div className="grid">
      <div className="panel span-12">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Journal Entry Import</h2>
          <button className="danger" onClick={handleClear} style={{ padding: "4px 12px", fontSize: "0.85em" }}>
            Clear All Transactions
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Paste tab-separated (Excel copy) or CSV rows containing Journal Entry postings.
          Expected columns: Type, Date, Entity Cod Account, Debit, Credit, Description, Reference.
          The system will auto-balance single-sided entries using the default accounts below.
          <br/>
          <small style={{color:"blue"}}>Loaded Accounts: {accounts.length}</small>
        </p>
        
        {error ? <div className="notice">{error}</div> : null}
        {okMsg ? (
          <div className="notice" style={{ borderColor: "var(--accent)", background: "#e7f1ec", color: "#1c4d3e" }}>
            {okMsg}
          </div>
        ) : null}

        {!previewed && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>Paste data directly below:</strong>
              <label className="button-like" style={{ cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", padding: "4px 8px", background: "var(--bg-alt)", border: "1px solid var(--line)", borderRadius: 4 }}>
                <span style={{ marginRight: 6 }}>📁 Upload CSV File</span>
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
            <textarea
              style={{
                width: "100%",
                minHeight: 150,
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: 10,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 13,
                lineHeight: 1.5,
              }}
              placeholder={PLACEHOLDER}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="form-grid" style={{ marginTop: 10 }}>
              <label className="wide">
                <input type="checkbox" checked={autoBalance} onChange={(e) => setAutoBalance(e.target.checked)} />
                Auto-balance single-sided entries
              </label>
              {autoBalance && (
                <>
                  <label className="wide">
                    Default Auto-Debit Account
                    <input value={defaultDebit} onChange={(e) => setDefaultDebit(e.target.value)} placeholder="e.g. 260" />
                  </label>
                  <label className="wide">
                    Default Auto-Credit Account
                    <input value={defaultCredit} onChange={(e) => setDefaultCredit(e.target.value)} placeholder="e.g. 656" />
                  </label>
                </>
              )}
              <label className="wide">
                <button className="primary" onClick={doPreview} disabled={pending || !text.trim()}>
                  {pending ? "Working…" : "Preview Import"}
                </button>
              </label>
            </div>
          </>
        )}

        {previewed && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Review Entries</h3>
              <button onClick={() => setPreviewed(false)}>Cancel & Paste Again</button>
            </div>
            
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ref</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th className="amount">Debit</th>
                  <th className="amount">Credit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} style={{ background: l.isAuto ? "var(--bg-alt)" : "transparent" }}>
                    <td><input type="date" value={l.date} onChange={(e) => setLine(l.key, { date: e.target.value })} style={{width: 110}} /></td>
                    <td><input value={l.ref} onChange={(e) => setLine(l.key, { ref: e.target.value })} style={{width: 80}} /></td>
                    <td><input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} style={{width: "100%"}} /></td>
                    <td>
                      <div style={{ position: "relative" }}>
                        <select
                          value={l.account}
                          onChange={(e) => setLine(l.key, { account: e.target.value })}
                          style={{
                            width: "100%",
                            borderColor: l.isAuto ? "var(--accent)" : (!accounts.includes(l.account) ? "#b3261e" : undefined),
                            backgroundColor: !accounts.includes(l.account) ? "#f9dedc" : undefined
                          }}
                          title={!accounts.includes(l.account) ? "Account does not exist in Chart of Accounts" : (l.isAuto ? "Auto-injected balancing account" : "")}
                        >
                          {!accounts.includes(l.account) && (
                            <option value={l.account}>{l.account} (Invalid)</option>
                          )}
                          <option value="">-- Select Account --</option>
                          {accounts.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="amount"><input type="number" step="0.01" value={l.debit} onChange={(e) => setLine(l.key, { debit: e.target.value })} style={{width: 80, textAlign: "right"}} /></td>
                    <td className="amount"><input type="number" step="0.01" value={l.credit} onChange={(e) => setLine(l.key, { credit: e.target.value })} style={{width: 80, textAlign: "right"}} /></td>
                    <td>
                      <button className="danger" onClick={() => removeLine(l.key)} style={{ padding: "2px 6px" }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 600 }}>
                  <td colSpan={4} style={{ textAlign: "right" }}>Totals</td>
                  <td className="amount">${fromCents(totalDebit)}</td>
                  <td className="amount">${fromCents(totalCredit)}</td>
                  <td></td>
                </tr>
                {!isBalanced && (
                  <tr>
                    <td colSpan={7} style={{ color: "#b3261e", textAlign: "right", paddingRight: 40 }}>
                      Out of balance by ${fromCents(Math.abs(diff))}
                    </td>
                  </tr>
                )}
                {hasUnknownAccounts && (
                  <tr>
                    <td colSpan={7} style={{ color: "#b3261e", textAlign: "right", paddingRight: 40 }}>
                      Please fix the highlighted accounts. They do not exist in the Chart of Accounts.
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>



            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button
                className="primary"
                onClick={doCommit}
                disabled={pending || !isBalanced || hasUnknownAccounts || lines.length === 0}
              >
                {pending ? "Saving…" : "Post to Ledger"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
