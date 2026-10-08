// POST /api/reports
//
// Body: {
//   beancount: string,            // the ledger as Beancount text
//   from?: string, to?: string,   // ISO dates for the P&L period
//   asOf?: string,                // balance-sheet / aging date (defaults to `to` or today)
//   arAccount?: string,           // A/R control account (default Assets:AccountsReceivable)
//   apAccount?: string            // A/P control account (default Liabilities:AccountsPayable)
// }
//
// Returns the income statement, balance sheet, and A/R & A/P aging computed by
// the tested lib/beancount engine. All amounts are returned both as integer
// cents and as formatted 2-decimal strings.

import { NextResponse } from "next/server";
import {
  parse,
  incomeStatement,
  balanceSheet,
  aging,
  totals,
  fromCents,
  type ReportLine,
  type AgingRow,
} from "@/lib/beancount";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function line(l: ReportLine) {
  return { account: l.account, cents: l.cents, display: fromCents(l.cents) };
}

function agingRow(r: AgingRow) {
  return {
    party: r.party,
    current: fromCents(r.current),
    d1_30: fromCents(r.d1_30),
    d31_60: fromCents(r.d31_60),
    d61_90: fromCents(r.d61_90),
    d90_plus: fromCents(r.d90_plus),
    total: fromCents(r.total),
    cents: {
      current: r.current,
      d1_30: r.d1_30,
      d31_60: r.d31_60,
      d61_90: r.d61_90,
      d90_plus: r.d90_plus,
      total: r.total,
    },
  };
}

export async function POST(req: Request) {
  let body: {
    beancount?: string;
    from?: string;
    to?: string;
    asOf?: string;
    arAccount?: string;
    apAccount?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.beancount;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Missing 'beancount' text in body" },
      { status: 400 }
    );
  }

  const { ledger, errors } = parse(text);
  const range = { from: body.from, to: body.to };
  const asOf = body.asOf || body.to || today();
  const arAccount = body.arAccount || "Assets:AccountsReceivable";
  const apAccount = body.apAccount || "Liabilities:AccountsPayable";

  const is = incomeStatement(ledger, range);
  const bs = balanceSheet(ledger, asOf);
  const t = totals(ledger, range);
  const ar = aging(ledger, arAccount, asOf);
  const ap = aging(ledger, apAccount, asOf, { flip: true });

  return NextResponse.json({
    meta: {
      asOf,
      range,
      errors, // surfaced, not fatal — lets the UI warn on bad ledgers
    },
    totals: {
      assets: fromCents(t.assets),
      liabilities: fromCents(t.liabilities),
      equity: fromCents(t.equity),
      revenue: fromCents(t.revenue),
      expenses: fromCents(t.expenses),
      netIncome: fromCents(t.netIncome),
      cents: t,
    },
    incomeStatement: {
      income: is.income.map(line),
      expenses: is.expenses.map(line),
      netIncome: { cents: is.netIncome, display: fromCents(is.netIncome) },
    },
    balanceSheet: {
      assets: bs.assets.map(line),
      liabilities: bs.liabilities.map(line),
      equity: bs.equity.map(line),
      currentEarnings: {
        cents: bs.currentEarnings,
        display: fromCents(bs.currentEarnings),
      },
      totalAssets: { cents: bs.totalAssets, display: fromCents(bs.totalAssets) },
      totalLiabEquity: {
        cents: bs.totalLiabEquity,
        display: fromCents(bs.totalLiabEquity),
      },
      balances: bs.balances,
    },
    aging: {
      ar: { account: arAccount, rows: ar.rows.map(agingRow), total: agingRow(ar.total) },
      ap: { account: apAccount, rows: ap.rows.map(agingRow), total: agingRow(ap.total) },
    },
  });
}
