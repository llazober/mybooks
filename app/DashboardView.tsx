"use client";

import { useEffect, useState, useTransition } from "react";
import { getDashboard, type DashboardDTO } from "./actions";

function money(display: string): string {
  // display is a plain 2-decimal string like "-1250.00"; add $ and thousands.
  const neg = display.startsWith("-");
  const [intPart, dec] = display.replace("-", "").split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-$" : "$") + withCommas + "." + dec;
}

/** Width (%) of a bar relative to the larger of two values. */
function barPct(value: string, peer: string): number {
  const v = Math.abs(parseFloat(value) || 0);
  const p = Math.abs(parseFloat(peer) || 0);
  const max = Math.max(v, p);
  return max === 0 ? 0 : Math.round((v / max) * 100);
}

function formatDate(iso: string) {
  if (!iso) return "";
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : iso;
}

export default function DashboardView({ entityId }: { entityId: string }) {
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [from, setFrom] = useState(() => {
    const y = new Date().getUTCFullYear();
    return `${y}-01-01`;
  });
  const [to, setTo] = useState(() => {
    const y = new Date().getUTCFullYear();
    return `${y}-12-31`;
  });
  const [pending, startTransition] = useTransition();

  function load(f: string, t: string) {
    startTransition(async () => {
      setData(await getDashboard(entityId, { from: f || undefined, to: t || undefined }));
    });
  }

  useEffect(() => {
    load(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  function applyPreset(f: string, t: string) {
    setFrom(f);
    setTo(t);
    load(f, t);
  }

  // Label for the period (defaults to YTD of the period-end year).
  const periodLabel =
    data && (from || to)
      ? `${data.ytdFrom} → ${data.asOf}`
      : data
      ? `YTD ${data.ytdFrom.slice(0, 4)}`
      : "";

  return (
    <div className="grid">
      <div className="panel span-12">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Dashboard</h2>
            <div className="muted">
              {data
                ? `Balances as of ${data.asOf} · P&L for ${periodLabel}`
                : pending
                ? "Loading…"
                : "—"}
            </div>
          </div>
          {data ? (
            <span className={"pill " + (data.balances ? "good" : "bad")}>
              {data.balances ? "books balanced ✓" : "out of balance"}
            </span>
          ) : null}
        </div>

        <div className="presets" style={{ marginTop: 12 }}>
          {dashPresets().map((p) => (
            <button key={p.label} onClick={() => applyPreset(p.from, p.to)} disabled={pending}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="dash-dates">
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="primary" onClick={() => load(from, to)} disabled={pending}>
            {pending ? "…" : "Apply"}
          </button>
          <button onClick={() => applyPreset("", "")} disabled={pending}>
            Reset (YTD)
          </button>
        </div>



        <div className="metric-row" style={{ marginTop: 14 }}>
          <div className="metric">
            <span>Cash on hand</span>
            <strong>{data ? money(data.cash) : "—"}</strong>
          </div>
          <div className="metric">
            <span>A/R outstanding</span>
            <strong>{data ? money(data.arTotal) : "—"}</strong>
          </div>
          <div className="metric">
            <span>A/P outstanding</span>
            <strong>{data ? money(data.apTotal) : "—"}</strong>
          </div>
          <div className="metric">
            <span>Net income</span>
            <strong>{data ? money(data.netIncomeYtd) : "—"}</strong>
          </div>
        </div>
      </div>

      {/* Income vs expenses (period) */}
      <div className="panel span-6">
        <h2>Income vs. expenses · {periodLabel}</h2>
        {data ? (
          <div className="dash-bars">
            <div className="dash-bar-row">
              <span className="dash-bar-label">Income</span>
              <div className="dash-bar-track">
                <div
                  className="dash-bar dash-bar-income"
                  style={{ width: barPct(data.revenueYtd, data.expensesYtd) + "%" }}
                />
              </div>
              <span className="amount dash-bar-value">{money(data.revenueYtd)}</span>
            </div>
            <div className="dash-bar-row">
              <span className="dash-bar-label">Expenses</span>
              <div className="dash-bar-track">
                <div
                  className="dash-bar dash-bar-expense"
                  style={{ width: barPct(data.expensesYtd, data.revenueYtd) + "%" }}
                />
              </div>
              <span className="amount dash-bar-value">{money(data.expensesYtd)}</span>
            </div>
            <div className="dash-bar-row dash-bar-net">
              <span className="dash-bar-label">Net</span>
              <div className="dash-bar-track" />
              <span className="amount dash-bar-value">
                <strong>{money(data.netIncomeYtd)}</strong>
              </span>
            </div>
          </div>
        ) : (
          <p className="muted">{pending ? "Loading…" : "No data"}</p>
        )}
      </div>

      {/* What needs attention */}
      <div className="panel span-6">
        <h2>Needs attention</h2>
        <table>
          <tbody>
            <tr>
              <td>Overdue receivables</td>
              <td className="amount">{data ? money(data.arOverdue) : "—"}</td>
            </tr>
            <tr>
              <td>Overdue payables</td>
              <td className="amount">{data ? money(data.apOverdue) : "—"}</td>
            </tr>
            <tr>
              <td>Accounts</td>
              <td className="amount">{data ? data.accountCount : "—"}</td>
            </tr>
            <tr>
              <td>Transactions</td>
              <td className="amount">{data ? data.txnCount.toLocaleString() : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Top customers (YTD) */}
      <div className="panel span-6">
        <h2>Top customers · {periodLabel}</h2>
        <table>
          <thead>
            <tr>
              <th>Customer / payee</th>
              <th className="amount">Income</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.topCustomers.length === 0 ? (
              <tr>
                <td className="muted" colSpan={2}>
                  {pending ? "Loading…" : "No income yet this year"}
                </td>
              </tr>
            ) : (
              data.topCustomers.map((r) => (
                <tr key={r.payee}>
                  <td>{r.payee}</td>
                  <td className="amount">{money(r.display)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent activity */}
      <div className="panel span-6">
        <h2>Recent activity</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Payee / memo</th>
              <th className="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.recent.length === 0 ? (
              <tr>
                <td className="muted" colSpan={3}>
                  {pending ? "Loading…" : "No transactions yet"}
                </td>
              </tr>
            ) : (
              data.recent.map((t, i) => {
                // Show the largest-magnitude posting amount as the headline figure.
                const top = t.postings
                  .slice()
                  .sort(
                    (a, b) =>
                      Math.abs(parseFloat(b.display)) - Math.abs(parseFloat(a.display))
                  )[0];
                return (
                  <tr key={i}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {formatDate(t.date)}
                    </td>
                    <td>{t.payee || t.narration || "—"}</td>
                    <td className="amount">{top ? money(top.display) : ""}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .dash-dates { display:flex; align-items:flex-end; gap:8px; margin-top:4px; flex-wrap:wrap; }
        .dash-dates label { display:grid; gap:4px; font-size:11px; }
        .dash-dates input { width:150px; }
        .dash-dates button { white-space:nowrap; }
      `}</style>
    </div>
  );
}

/** Quick date-range presets for the dashboard, computed from today. */
function dashPresets(): { label: string; from: string; to: string }[] {
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
  ];
}
