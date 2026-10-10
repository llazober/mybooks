"use client";

import { useEffect, useState, useTransition, Fragment } from "react";
import {
  getRegister,
  getAccounts,
  updateTransaction,
  addJournalEntry,
  deleteTransaction,
  type RegisterRowDTO,
} from "./actions";
import { toCents, fromCents } from "@/lib/beancount";

function money(display: string): string {
  if (!display) return "";
  const neg = display.startsWith("-");
  const [intPart, dec] = display.replace("-", "").split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-$" : "$") + withCommas + "." + dec;
}

function formatDate(iso: string) {
  if (!iso) return "";
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : iso;
}

/** Quick date-range presets for the register, computed from today. */
function registerPresets(): { label: string; from: string; to: string }[] {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const q = Math.floor(m / 3);
  const ym = (yy: number, mm: number, dd: number) => iso(new Date(Date.UTC(yy, mm, dd)));
  const monthEnd = (yy: number, mm: number) => ym(yy, mm + 1, 0);
  return [
    { label: "This month", from: ym(y, m, 1), to: monthEnd(y, m) },
    { label: "This quarter", from: ym(y, q * 3, 1), to: monthEnd(y, q * 3 + 2) },
    { label: "YTD", from: ym(y, 0, 1), to: iso(now) },
    { label: "This year", from: ym(y, 0, 1), to: ym(y, 11, 31) },
    { label: "Last year", from: ym(y - 1, 0, 1), to: ym(y - 1, 11, 31) },
    { label: "All time", from: "", to: "" },
  ];
}

interface EditState {
  date: string;
  ref: string;
  payee: string;
  narration: string;
  postings: { account: string; amount: string }[]; // amount signed: + debit, - credit
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---- single-line inline register editing ---------------------------------
// A "register draft" models one transaction from the point of view of the
// filtered account A: A gets a single debit OR credit (its leg), and one or
// more counter postings make up the other side. A single counter auto-balances
// (its amount mirrors A); two or more counters are a split the user allocates.

const NEW_KEY = "__new__";
let CKEY = 1;

interface CounterLine {
  key: number;
  account: string;
  amount: string; // signed decimal: debit +, credit −. Only used when split.
}
interface RegDraft {
  date: string;
  ref: string;
  payee: string;
  narration: string;
  aDebit: string; // account A debit leg ("" if this tx credits A)
  aCredit: string; // account A credit leg
  counters: CounterLine[];
}

function rowToDraft(r: RegisterRowDTO, accountA: string): RegDraft {
  const counters = r.postings
    .filter((p) => p.account !== accountA)
    .map((p) => ({
      key: CKEY++,
      account: p.account,
      amount: p.debitCents ? p.debit : p.creditCents ? "-" + p.credit : "",
    }));
  return {
    date: r.date,
    ref: r.ref,
    payee: r.payee,
    narration: r.narration,
    aDebit: r.filterDebit,
    aCredit: r.filterCredit,
    counters: counters.length ? counters : [{ key: CKEY++, account: "", amount: "" }],
  };
}

function blankDraft(defaultCounter: string): RegDraft {
  return {
    date: today(),
    ref: "",
    payee: "",
    narration: "",
    aDebit: "",
    aCredit: "",
    counters: [{ key: CKEY++, account: defaultCounter, amount: "" }],
  };
}

function aAmountCents(d: RegDraft): number {
  return toCents(d.aDebit) - toCents(d.aCredit);
}
function isSplit(d: RegDraft): boolean {
  return d.counters.length > 1;
}
function counterSumCents(d: RegDraft): number {
  return d.counters.reduce((s, c) => s + toCents(c.amount), 0);
}
function draftBalanceCents(d: RegDraft): number {
  // Simple (single counter) always balances because the counter mirrors A.
  return isSplit(d) ? aAmountCents(d) + counterSumCents(d) : 0;
}
function draftValid(d: RegDraft): boolean {
  const a = aAmountCents(d);
  if (a === 0) return false;
  if (!isSplit(d)) return !!d.counters[0].account;
  return (
    d.counters.every((c) => c.account && toCents(c.amount) !== 0) &&
    draftBalanceCents(d) === 0
  );
}

/** Signed postings for updateTransaction (amount as a decimal string). */
function draftPostings(d: RegDraft, accountA: string): { account: string; amount: string }[] {
  const a = aAmountCents(d);
  if (!isSplit(d)) {
    return [
      { account: accountA, amount: fromCents(a) },
      { account: d.counters[0].account, amount: fromCents(-a) },
    ];
  }
  return [
    { account: accountA, amount: fromCents(a) },
    ...d.counters.map((c) => ({ account: c.account, amount: c.amount })),
  ];
}

export default function RegisterView({
  entityId,
  accountsHint,
  focus,
  onFocusConsumed,
  onChange,
}: {
  entityId: string;
  accountsHint?: string[];
  focus?: { account: string; txId: string } | null;
  onFocusConsumed?: () => void;
  onChange?: () => void;
}) {
  const [filter, setFilter] = useState(focus?.account || "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [focusTxId, setFocusTxId] = useState<string | null>(focus?.txId || null);
  const [rows, setRows] = useState<RegisterRowDTO[]>([]);
  const [accounts, setAccounts] = useState<string[]>(accountsHint ?? []);
  const [opening, setOpening] = useState("");
  const [hasOpening, setHasOpening] = useState(false);
  const [singleLine, setSingleLine] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh(f = filter, fr = from, t = to) {
    startTransition(async () => {
      const reg = await getRegister(entityId, f, {
        from: fr || undefined,
        to: t || undefined,
      });
      setRows(reg.rows);
      setAccounts(reg.accounts);
      setOpening(reg.openingBalance);
      setHasOpening(reg.hasOpening);
    });
  }

  useEffect(() => {
    getAccounts(entityId).then(setAccounts);
    refresh(filter, from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  // When arriving via "open this transaction", open its edit row once loaded.
  // A focus with an empty txId means "filter to the account only" (e.g. from
  // a Balance Sheet line) — the account filter is already applied via state.
  useEffect(() => {
    if (!focus) return;
    if (focusTxId && rows.length > 0) {
      const target = rows.find((r) => r.id === focusTxId);
      if (target) {
        beginEdit(target);
        setTimeout(() => {
          document.getElementById("reg-tx-" + focusTxId)?.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 60);
      }
      setFocusTxId(null);
      onFocusConsumed?.();
    } else if (!focusTxId) {
      onFocusConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, focusTxId, focus]);

  function changeFilter(f: string) {
    setFilter(f);
    setEditingId(null);
    refresh(f, from, to);
  }

  function applyRange(fr: string, t: string) {
    setFrom(fr);
    setTo(t);
    refresh(filter, fr, t);
  }

  function beginEdit(r: RegisterRowDTO) {
    setError(null);
    setEditingId(r.id);
    setEdit({
      date: r.date,
      ref: r.ref,
      payee: r.payee,
      narration: r.narration,
      // signed amount: debit positive, credit negative
      postings: r.postings.map((p) => ({
        account: p.account,
        amount: p.debitCents ? p.debit : "-" + p.credit,
      })),
    });
  }

  function setPosting(i: number, field: "account" | "amount", value: string) {
    if (!edit) return;
    const next = { ...edit, postings: edit.postings.map((p) => ({ ...p })) };
    next.postings[i][field] = value;
    setEdit(next);
  }

  function addPostingRow() {
    if (!edit) return;
    setEdit({ ...edit, postings: [...edit.postings, { account: accounts[0] || "", amount: "" }] });
  }

  function removePostingRow(i: number) {
    if (!edit) return;
    setEdit({ ...edit, postings: edit.postings.filter((_, j) => j !== i) });
  }

  function editSum(): number {
    if (!edit) return 0;
    return edit.postings.reduce((s, p) => {
      const n = Number(String(p.amount).replace(/[$,()\s]/g, ""));
      return s + (Number.isFinite(n) ? Math.round(n * 100) : 0);
    }, 0);
  }

  function save() {
    if (!edit || !editingId) return;
    setError(null);
    startTransition(async () => {
      const res = await updateTransaction(entityId, editingId, {
        date: edit.date,
        ref: edit.ref,
        payee: edit.payee,
        narration: edit.narration,
        postings: edit.postings,
      });
      if (!res.ok) {
        setError(res.error || "Could not save");
        return;
      }
      setEditingId(null);
      setEdit(null);
      refresh();
      onChange?.();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteTransaction(entityId, id);
      if (!res.ok) {
        setError(res.error || "Could not delete");
        return;
      }
      if (editingId === id) {
        setEditingId(null);
        setEdit(null);
      }
      refresh();
      onChange?.();
    });
  }

  const balanced = editSum() === 0;

  return (
    <div className="panel span-12">
      <div className="reg-toolbar">
        <h2 style={{ margin: 0 }}>Ledger</h2>
        <div className="reg-controls">
          <select value={filter} onChange={(e) => changeFilter(e.target.value)} style={{ width: 260 }}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <div className="toggle-stack">
            <label className="toggle">
              <input
                type="checkbox"
                checked={singleLine}
                onChange={(e) => setSingleLine(e.target.checked)}
              />
              Single-line (Excel)
            </label>
            {/* Hidden per request: Edit checkbox */}
          </div>
        </div>
      </div>

      <div className="reg-daterow">
        <div className="presets">
          {registerPresets().map((p) => (
            <button key={p.label} onClick={() => applyRange(p.from, p.to)} disabled={pending}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="reg-dates">
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="primary" onClick={() => refresh(filter, from, to)} disabled={pending}>
            {pending ? "…" : "Apply"}
          </button>
          <button onClick={() => applyRange("", "")} disabled={pending}>
            Clear
          </button>
        </div>
      </div>
      {from && !filter ? (
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
          Tip: pick an account above to see a beginning balance for the date range.
        </p>
      ) : null}

      {error ? <div className="notice">{error}</div> : null}

      {singleLine ? (
        filter ? (
          <EditableRegister
            entityId={entityId}
            filter={filter}
            rows={rows}
            accounts={accounts}
            opening={opening}
            hasOpening={hasOpening}
            from={from}
            editMode={editMode}
            pending={pending}
            onChanged={() => {
              refresh();
              onChange?.();
            }}
            onError={setError}
          />
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
              Pick an account above to edit rows inline or add a new transaction directly in the register.
            </p>
            <table className="reg flat">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payee</th>
                  <th>Memo</th>
                  <th>Postings</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={4}>
                      No transactions
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.date)}</td>
                      <td>{r.payee}</td>
                      <td>{r.ref ? "[" + r.ref + "] " : ""}{r.narration}</td>
                      <td>{r.postings.map((p) => p.account).join(", ")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )
      ) : (
        <table className="reg">
          <thead>
            <tr>
              <th>Date</th>
              <th>Payee / Memo</th>
              <th>Account</th>
              <th className="amount">Debit</th>
              <th className="amount">Credit</th>
              {filter ? <th className="amount">Balance</th> : null}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {hasOpening ? (
              <tr className="begbal">
                <td colSpan={5}>
                  <strong>Beginning balance</strong>{" "}
                  <span className="muted">(before {from})</span>
                </td>
                <td className="amount">
                  <strong>{money(opening)}</strong>
                </td>
                <td></td>
              </tr>
            ) : null}
            {rows.length === 0 ? (
              <tr>
                <td className="muted" colSpan={filter ? 7 : 6}>
                  No transactions
                </td>
              </tr>
            ) : (
              rows.map((r) =>
                editingId === r.id && edit ? (
                  <EditRows
                    key={r.id}
                    anchorId={"reg-tx-" + r.id}
                    edit={edit}
                    accounts={accounts}
                    filter={filter}
                    balanced={balanced}
                    sum={editSum()}
                    pending={pending}
                    onField={(f, v) => setEdit({ ...edit, [f]: v })}
                    onPosting={setPosting}
                    onAddPosting={addPostingRow}
                    onRemovePosting={removePostingRow}
                    onSave={save}
                    onCancel={() => {
                      setEditingId(null);
                      setEdit(null);
                      setError(null);
                    }}
                  />
                ) : (
                  <ViewRows key={r.id} r={r} filter={filter} onEdit={() => beginEdit(r)} onDelete={() => remove(r.id)} />
                )
              )
            )}
          </tbody>
        </table>
      )}

      <style>{`
        .reg-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
        .reg-controls { display:flex; align-items:flex-start; gap:14px; }
        .toggle-stack { display:flex; flex-direction:column; gap:4px; }
        .toggle { display:flex; flex-direction:row; align-items:center; gap:6px; color:var(--ink); font-weight:600; }
        .toggle input { width:auto; }
        table.reg td, table.reg th { vertical-align: top; }
        table.flat td { white-space: nowrap; }
        /* Inline register editing */
        .reg-edit-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; flex-wrap:wrap; }
        table.reg-edit input, table.reg-edit select { width:100%; min-width:0; box-sizing:border-box; }
        table.reg-edit td { vertical-align: middle; }
        tr.reg-active td { background: rgba(14,165,164,0.08); }
        td.reg-actions { position: sticky; right: 0; background: var(--paper, #fff); white-space:nowrap; box-shadow: -6px 0 6px -6px rgba(0,0,0,0.15); }
        body.pretty td.reg-actions { background: var(--paper, #fff); }
        .reg-memocell { display:flex; gap:4px; align-items:center; }
        .reg-memocell input.ref { width:52px; flex:0 0 auto; }
        .reg-splitbtn { padding:2px 7px; min-height:0; font-size:12px; }
        .reg-split-editor { display:flex; flex-direction:column; gap:6px; padding:8px 0; }
        .reg-split-line { display:flex; gap:8px; align-items:center; }
        .reg-split-line select { flex:1; }
        .reg-split-line input.amt { width:120px; flex:0 0 auto; text-align:right; }
        .txgroup td { border-bottom: 0; }
        .txgroup.last td { border-bottom: 1px solid var(--line); }
        .editbar { display:flex; gap:8px; align-items:center; margin-top:8px; }
        .reg-daterow { display:flex; align-items:flex-end; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-bottom:12px; }
        .reg-dates { display:flex; align-items:flex-end; gap:8px; }
        .reg-dates label { display:grid; gap:4px; font-size:11px; }
        .reg-dates input { width:150px; }
        .reg-dates button { white-space:nowrap; }
        tr.begbal td { background: #f1f3ea; border-top: 1px solid var(--line); }
        body.pretty tr.begbal td { background: rgba(14,165,164,0.06); }
      `}</style>
    </div>
  );
}

function ViewRows({
  r,
  filter,
  onEdit,
  onDelete,
}: {
  r: RegisterRowDTO;
  filter: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const span = filter ? 7 : 6;
  return (
    <>
      <tr className="txgroup">
        <td>{formatDate(r.date)}</td>
        <td>
          <strong>{r.payee || "—"}</strong>
          {r.ref ? <span className="pill" style={{ marginLeft: 6 }}>Ref {r.ref}</span> : null}
          {r.narration ? <div className="muted">{r.narration}</div> : null}
          {r.bankMemo ? (
            <div className="muted" style={{ fontSize: 11 }} title={r.bankMemo}>
              🏦 {r.bankMemo}
            </div>
          ) : null}
          {filter ? <div className="muted">Counter: {r.counterLabel}</div> : null}
        </td>
        <td>{r.postings[0]?.account}</td>
        <td className="amount">{money(r.postings[0]?.debit)}</td>
        <td className="amount">{money(r.postings[0]?.credit)}</td>
        {filter ? <td className="amount">{money(r.runningBalance)}</td> : null}
        <td className="amount">
        </td>
      </tr>
      {r.postings.slice(1).map((p, i) => {
        const last = i === r.postings.length - 2;
        return (
          <tr key={i} className={"txgroup" + (last ? " last" : "")}>
            <td></td>
            <td></td>
            <td>{p.account}</td>
            <td className="amount">{money(p.debit)}</td>
            <td className="amount">{money(p.credit)}</td>
            {filter ? <td></td> : null}
            <td className="amount"></td>
          </tr>
        );
      })}
    </>
  );
}

function EditRows({
  edit,
  accounts,
  filter,
  balanced,
  sum,
  pending,
  onField,
  onPosting,
  onAddPosting,
  onRemovePosting,
  onSave,
  onCancel,
  anchorId,
}: {
  edit: EditState;
  accounts: string[];
  filter: string;
  balanced: boolean;
  sum: number;
  pending: boolean;
  onField: (f: "date" | "ref" | "payee" | "narration", v: string) => void;
  onPosting: (i: number, field: "account" | "amount", v: string) => void;
  onAddPosting: () => void;
  onRemovePosting: (i: number) => void;
  onSave: () => void;
  onCancel: () => void;
  anchorId?: string;
}) {
  const colSpan = filter ? 7 : 6;
  return (
    <>
      <tr className="txgroup" id={anchorId}>
        <td>
          <input type="date" value={edit.date} onChange={(e) => onField("date", e.target.value)} style={{ marginBottom: 6 }} />
          <input
            placeholder="Ref #"
            value={edit.ref}
            onChange={(e) => onField("ref", e.target.value)}
          />
        </td>
        <td colSpan={colSpan - 1}>
          <input
            placeholder="Payee"
            value={edit.payee}
            onChange={(e) => onField("payee", e.target.value)}
            style={{ marginBottom: 6 }}
          />
          <input
            placeholder="Memo / description"
            value={edit.narration}
            onChange={(e) => onField("narration", e.target.value)}
          />
        </td>
      </tr>
      {edit.postings.map((p, i) => (
        <tr key={i} className="txgroup">
          <td></td>
          <td className="muted" style={{ fontSize: 11 }}>
            {i === 0 ? "Postings (debit +, credit −):" : ""}
          </td>
          <td>
            <select value={p.account} onChange={(e) => onPosting(i, "account", e.target.value)}>
              {accounts.includes(p.account) ? null : <option value={p.account}>{p.account}</option>}
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </td>
          <td colSpan={filter ? 3 : 2}>
            <input
              type="number"
              step="0.01"
              placeholder="signed amount"
              value={p.amount}
              onChange={(e) => onPosting(i, "amount", e.target.value)}
            />
          </td>
          <td className="amount">
            {edit.postings.length > 2 ? (
              <button onClick={() => onRemovePosting(i)} title="Remove posting">
                ×
              </button>
            ) : null}
          </td>
        </tr>
      ))}
      <tr className="txgroup last">
        <td></td>
        <td colSpan={colSpan}>
          <div className="editbar">
            {/* Hidden per request: <button onClick={onAddPosting}>+ Add posting</button> */}
            <span className={"pill " + (balanced ? "good" : "bad")}>
              {balanced ? "balanced ✓" : "off by " + (sum / 100).toFixed(2)}
            </span>
            <span style={{ flex: 1 }} />
            {/* Hidden per request:
            <button className="primary" onClick={onSave} disabled={pending || !balanced}>
              {pending ? "Saving…" : "Save"}
            </button>
            */}
            <button onClick={onCancel} disabled={pending}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}

/**
 * The single-line register with inline editing. Requires a filtered account
 * (account A). When editMode is on, every row is editable; focusing a row makes
 * it "active" and reveals a Save button (Enter also saves). Tab / Shift-Tab move
 * between fields natively. "New transaction" adds a blank register line. A single
 * counter category auto-balances; two or more become an inline split.
 */
function EditableRegister({
  entityId,
  filter,
  rows,
  accounts,
  opening,
  hasOpening,
  from,
  editMode,
  pending,
  onChanged,
  onError,
}: {
  entityId: string;
  filter: string;
  rows: RegisterRowDTO[];
  accounts: string[];
  opening: string;
  hasOpening: boolean;
  from: string;
  editMode: boolean;
  pending: boolean;
  onChanged: () => void;
  onError: (msg: string | null) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, RegDraft>>({});
  const [newDraft, setNewDraft] = useState<RegDraft | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const defaultCounter = accounts.find((a) => a !== filter) || "Expenses:Uncategorized";
  const showActions = editMode || !!newDraft;
  const colCount = showActions ? 9 : 8;

  // Rebuild per-row drafts from the current rows whenever edit mode is on. Runs
  // only when rows/filter/editMode change (not on keystrokes), so in-progress
  // edits persist; a refresh after saving resets drafts to the saved values.
  useEffect(() => {
    if (!editMode) {
      setDrafts({});
      return;
    }
    const next: Record<string, RegDraft> = {};
    for (const r of rows) next[r.id] = rowToDraft(r, filter);
    setDrafts(next);
  }, [rows, editMode, filter]);

  function getDraft(key: string): RegDraft | null {
    return key === NEW_KEY ? newDraft : drafts[key] ?? null;
  }
  function update(key: string, updater: (d: RegDraft) => RegDraft) {
    if (key === NEW_KEY) setNewDraft((d) => (d ? updater(d) : d));
    else setDrafts((m) => (m[key] ? { ...m, [key]: updater(m[key]) } : m));
  }
  function setField(key: string, field: "date" | "ref" | "payee" | "narration", v: string) {
    update(key, (d) => ({ ...d, [field]: v }));
  }
  function setA(key: string, which: "debit" | "credit", v: string) {
    update(key, (d) => ({ ...d, aDebit: which === "debit" ? v : "", aCredit: which === "credit" ? v : "" }));
  }
  function setSimpleCategory(key: string, account: string) {
    update(key, (d) => ({ ...d, counters: [{ ...d.counters[0], account }] }));
  }
  function convertToSplit(key: string) {
    update(key, (d) => {
      const a = aAmountCents(d);
      const first = { ...d.counters[0], amount: fromCents(-a) };
      return { ...d, counters: [first, { key: CKEY++, account: "", amount: "" }] };
    });
    setActiveKey(key);
  }
  function setCounter(key: string, ci: number, field: "account" | "amount", v: string) {
    update(key, (d) => ({
      ...d,
      counters: d.counters.map((c, i) => (i === ci ? { ...c, [field]: v } : c)),
    }));
  }
  function addCounter(key: string) {
    update(key, (d) => ({ ...d, counters: [...d.counters, { key: CKEY++, account: "", amount: "" }] }));
  }
  function removeCounter(key: string, ci: number) {
    update(key, (d) => {
      let counters = d.counters.filter((_, i) => i !== ci);
      if (counters.length === 0) counters = [{ key: CKEY++, account: "", amount: "" }];
      return { ...d, counters };
    });
  }

  function saveDraft(key: string) {
    const d = getDraft(key);
    if (!d || !draftValid(d)) return;
    onError(null);
    const postings = draftPostings(d, filter);
    startSave(async () => {
      let res;
      if (key === NEW_KEY) {
        const lines = postings.map((p) => {
          const c = toCents(p.amount);
          return c >= 0
            ? { account: p.account, debit: fromCents(c), credit: "" }
            : { account: p.account, debit: "", credit: fromCents(-c) };
        });
        res = await addJournalEntry(entityId, {
          date: d.date,
          payee: d.payee,
          memo: d.narration,
          ref: d.ref,
          lines,
        });
      } else {
        res = await updateTransaction(entityId, key, {
          date: d.date,
          ref: d.ref,
          payee: d.payee,
          narration: d.narration,
          postings,
        });
      }
      if (!res.ok) {
        onError(res.error || "Could not save");
        return;
      }
      if (key === NEW_KEY) setNewDraft(null);
      setActiveKey(null);
      onChanged();
    });
  }

  function removeTx(id: string) {
    onError(null);
    startSave(async () => {
      const res = await deleteTransaction(entityId, id);
      if (!res.ok) {
        onError(res.error || "Could not delete");
        return;
      }
      setActiveKey(null);
      onChanged();
    });
  }

  function startNew() {
    setNewDraft(blankDraft(defaultCounter));
    setActiveKey(NEW_KEY);
  }
  function cancel(key: string) {
    if (key === NEW_KEY) {
      setNewDraft(null);
    } else {
      const r = rows.find((x) => x.id === key);
      if (r) setDrafts((m) => ({ ...m, [key]: rowToDraft(r, filter) }));
    }
    if (activeKey === key) setActiveKey(null);
    onError(null);
  }

  function renderEditRow(key: string, d: RegDraft, isNew: boolean, balance: string, bankMemo: string) {
    const split = isSplit(d);
    const active = activeKey === key;
    const valid = draftValid(d);
    const bal = draftBalanceCents(d);
    const categoryOptions = accounts.filter((a) => a !== filter);
    return (
      <Fragment key={key}>
        <tr
          className={active ? "reg-active" : ""}
          onFocus={() => setActiveKey(key)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveDraft(key);
            }
          }}
        >
          <td>
            <input type="date" value={d.date} onChange={(e) => setField(key, "date", e.target.value)} />
          </td>
          <td>
            <input value={d.payee} placeholder="Payee" onChange={(e) => setField(key, "payee", e.target.value)} />
          </td>
          <td>
            <div className="reg-memocell">
              <input className="ref" value={d.ref} placeholder="Ref" onChange={(e) => setField(key, "ref", e.target.value)} />
              <input value={d.narration} placeholder="Memo" onChange={(e) => setField(key, "narration", e.target.value)} />
            </div>
            {bankMemo ? (
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }} title={bankMemo}>
                🏦 {bankMemo.length > 32 ? bankMemo.slice(0, 32) + "…" : bankMemo}
              </div>
            ) : null}
          </td>
          <td>{filter}</td>
          <td>
            {split ? (
              <span className="pill">— Split —</span>
            ) : (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <select value={d.counters[0].account} onChange={(e) => setSimpleCategory(key, e.target.value)}>
                  <option value="">— category —</option>
                  {categoryOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <button type="button" className="reg-splitbtn" title="Split into multiple categories" onClick={() => convertToSplit(key)}>
                  ⑂
                </button>
              </div>
            )}
          </td>
          <td className="amount">
            <input type="number" step="0.01" value={d.aDebit} placeholder="0.00" onChange={(e) => setA(key, "debit", e.target.value)} />
          </td>
          <td className="amount">
            <input type="number" step="0.01" value={d.aCredit} placeholder="0.00" onChange={(e) => setA(key, "credit", e.target.value)} />
          </td>
          <td className="amount">{isNew ? "" : money(balance)}</td>
          <td className="reg-actions">
            {active ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  className="primary"
                  onClick={() => saveDraft(key)}
                  disabled={pending || saving || !valid}
                  title={valid ? "Save (Enter)" : "Enter an amount and category"}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => cancel(key)} disabled={saving}>
                  Cancel
                </button>
                {!isNew ? (
                  <button className="danger" onClick={() => removeTx(key)} disabled={saving} title="Delete transaction">
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </td>
        </tr>
        {split && active ? (
          <tr className="reg-active">
            <td></td>
            <td colSpan={8}>
              <div className="reg-split-editor">
                <span className="muted" style={{ fontSize: 11 }}>
                  Split categories — must balance to the {filter} amount (debit +, credit −):
                </span>
                {d.counters.map((c, ci) => (
                  <div className="reg-split-line" key={c.key}>
                    <select value={c.account} onChange={(e) => setCounter(key, ci, "account", e.target.value)}>
                      <option value="">— category —</option>
                      {categoryOptions.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <input
                      className="amt"
                      type="number"
                      step="0.01"
                      value={c.amount}
                      placeholder="signed amount"
                      onChange={(e) => setCounter(key, ci, "amount", e.target.value)}
                    />
                    <button className="reg-splitbtn" onClick={() => removeCounter(key, ci)} title="Remove line">
                      ×
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button className="reg-splitbtn" onClick={() => addCounter(key)}>
                    + Split line
                  </button>
                  <span className={"pill " + (bal === 0 ? "good" : "bad")}>
                    {bal === 0 ? "balanced ✓" : "off by " + (bal / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </td>
          </tr>
        ) : null}
      </Fragment>
    );
  }

  function renderReadRow(r: RegisterRowDTO) {
    return (
      <tr key={r.id}>
        <td>{formatDate(r.date)}</td>
        <td>{r.payee}</td>
        <td>
          {r.ref ? "[" + r.ref + "] " : ""}
          {r.narration}
          {r.bankMemo ? (
            <div className="muted" style={{ fontSize: 11 }} title={r.bankMemo}>
              🏦 {r.bankMemo.length > 40 ? r.bankMemo.slice(0, 40) + "…" : r.bankMemo}
            </div>
          ) : null}
        </td>
        <td>{filter}</td>
        <td>{r.counterLabel}</td>
        <td className="amount">{money(r.filterDebit)}</td>
        <td className="amount">{money(r.filterCredit)}</td>
        <td className="amount">{money(r.runningBalance)}</td>
        {showActions ? <td className="reg-actions"></td> : null}
      </tr>
    );
  }

  return (
    <>
      <div className="reg-edit-head">
        <span className="muted" style={{ fontSize: 12 }}>
          Register for <strong>{filter}</strong>
          {editMode ? " · editing on — focus a row, then Save (or press Enter)" : ""}
        </span>
        {/* Hidden per request: <button className="primary" onClick={startNew} disabled={!!newDraft || pending}>+ New transaction</button> */}
      </div>
      <table className="reg flat reg-edit">
        <thead>
          <tr>
            <th>Date</th>
            <th>Payee</th>
            <th>Memo</th>
            <th>Account</th>
            <th>Category</th>
            <th className="amount">Debit</th>
            <th className="amount">Credit</th>
            <th className="amount">Balance</th>
            {showActions ? <th></th> : null}
          </tr>
        </thead>
        <tbody>
          {hasOpening ? (
            <tr className="begbal">
              <td colSpan={7}>
                <strong>Beginning balance</strong> <span className="muted">(before {from})</span>
              </td>
              <td className="amount">
                <strong>{money(opening)}</strong>
              </td>
              {showActions ? <td></td> : null}
            </tr>
          ) : null}
          {newDraft ? renderEditRow(NEW_KEY, newDraft, true, "", "") : null}
          {rows.length === 0 && !newDraft ? (
            <tr>
              <td className="muted" colSpan={colCount}>
                No transactions
              </td>
            </tr>
          ) : (
            rows.map((r) =>
              editMode && drafts[r.id]
                ? renderEditRow(r.id, drafts[r.id], false, r.runningBalance, r.bankMemo)
                : renderReadRow(r)
            )
          )}
        </tbody>
      </table>
    </>
  );
}
