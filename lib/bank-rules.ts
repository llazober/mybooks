// Bank-feed rules engine. Pure data + matching logic, shared by the client
// (Bank Feed view + rules manager) and the server (persistence actions). A rule
// watches incoming bank rows and, when its conditions all match, fills in the
// payee, category, and/or memo — and can optionally auto-post without approval.

export type RuleField = "description" | "bankMemo" | "ref" | "payee" | "amount";
export type TextOp = "contains" | "not_contains" | "equals" | "startsWith" | "regex";
export type AmountOp = "gt" | "lt" | "gte" | "lte" | "eq" | "between";
export type RuleOp = TextOp | AmountOp;

export interface RuleCondition {
  field: RuleField;
  op: RuleOp;
  value: string; // text needle, or a dollar amount for `amount`
  value2?: string; // upper bound for the amount `between` op
}

export type RuleDirection = "any" | "in" | "out";

export interface BankRule {
  id: string;
  name: string;
  enabled: boolean;
  direction: RuleDirection; // money in (deposits), out (withdrawals), or either
  account: string; // "" = applies to every source account; else a specific one
  conditions: RuleCondition[]; // ALL must match (logical AND)
  setPayee: string; // "" = leave unchanged
  setCategory: string; // "" = leave unchanged
  setMemo: string; // "" = leave the memo unchanged
  autoPost: boolean; // post to the ledger without asking for approval
}

/** The fields of a bank-feed row a rule can read. */
export interface RuleRowInput {
  description: string;
  payee: string;
  amountCents: number; // signed: negative = money out
  ref: string;
  bankMemo: string;
}

export const TEXT_FIELDS: RuleField[] = ["description", "bankMemo", "ref", "payee"];

export const FIELD_LABELS: Record<RuleField, string> = {
  description: "Description / memo",
  bankMemo: "Original bank text",
  ref: "Ref / check #",
  payee: "Payee",
  amount: "Amount",
};

export const TEXT_OP_LABELS: Record<TextOp, string> = {
  contains: "contains",
  not_contains: "does not contain",
  equals: "equals",
  startsWith: "starts with",
  regex: "matches regex",
};

export const AMOUNT_OP_LABELS: Record<AmountOp, string> = {
  gt: "greater than",
  lt: "less than",
  gte: "at least",
  lte: "at most",
  eq: "equals",
  between: "between",
};

function fieldText(field: RuleField, row: RuleRowInput): string {
  switch (field) {
    case "description":
      return row.description || "";
    case "bankMemo":
      return row.bankMemo || "";
    case "ref":
      return row.ref || "";
    case "payee":
      return row.payee || "";
    default:
      return "";
  }
}

function conditionMatches(c: RuleCondition, row: RuleRowInput): boolean {
  if (c.field === "amount") {
    const amt = Math.abs(row.amountCents) / 100; // compare magnitude; direction handles sign
    const v = parseFloat(c.value);
    if (!Number.isFinite(v)) return false;
    switch (c.op as AmountOp) {
      case "gt":
        return amt > v;
      case "lt":
        return amt < v;
      case "gte":
        return amt >= v;
      case "lte":
        return amt <= v;
      case "eq":
        return Math.abs(amt - v) < 0.005;
      case "between": {
        const v2 = parseFloat(c.value2 || "");
        if (!Number.isFinite(v2)) return false;
        const lo = Math.min(v, v2);
        const hi = Math.max(v, v2);
        return amt >= lo && amt <= hi;
      }
      default:
        return false;
    }
  }
  const hay = fieldText(c.field, row);
  const hayLc = hay.toLowerCase();
  const needle = (c.value || "").toLowerCase();
  switch (c.op as TextOp) {
    case "contains":
      return needle !== "" && hayLc.includes(needle);
    case "not_contains":
      return needle === "" || !hayLc.includes(needle);
    case "equals":
      return hayLc === needle;
    case "startsWith":
      return hayLc.startsWith(needle);
    case "regex":
      try {
        return new RegExp(c.value, "i").test(hay);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/** True if the rule is enabled, in scope for this source account and direction,
 *  and every condition matches. A rule with no conditions never matches (so an
 *  empty rule can't accidentally rewrite the whole feed). */
export function ruleMatches(rule: BankRule, row: RuleRowInput, sourceAccount: string): boolean {
  if (!rule.enabled) return false;
  if (rule.account && rule.account !== sourceAccount) return false;
  if (rule.direction === "in" && row.amountCents <= 0) return false;
  if (rule.direction === "out" && row.amountCents >= 0) return false;
  if (!rule.conditions.length) return false;
  return rule.conditions.every((c) => conditionMatches(c, row));
}

/** The first enabled rule (in list order) that matches, or null. */
export function firstMatchingRule(
  rules: BankRule[],
  row: RuleRowInput,
  sourceAccount: string
): BankRule | null {
  for (const r of rules) if (ruleMatches(r, row, sourceAccount)) return r;
  return null;
}

/** A concise human summary of a rule, for the manager list. */
export function summarizeRule(rule: BankRule): string {
  const scope = [
    rule.direction === "in" ? "money in" : rule.direction === "out" ? "money out" : "any direction",
    rule.account ? rule.account : "all accounts",
  ].join(" · ");
  const conds = rule.conditions
    .map((c) => {
      if (c.field === "amount") {
        const lbl = AMOUNT_OP_LABELS[c.op as AmountOp] || c.op;
        return `amount ${lbl} ${c.value}${c.op === "between" ? "–" + (c.value2 || "") : ""}`;
      }
      const lbl = TEXT_OP_LABELS[c.op as TextOp] || c.op;
      return `${FIELD_LABELS[c.field]} ${lbl} "${c.value}"`;
    })
    .join(" AND ");
  const acts: string[] = [];
  if (rule.setCategory) acts.push(`category → ${rule.setCategory}`);
  if (rule.setPayee) acts.push(`payee → "${rule.setPayee}"`);
  if (rule.setMemo) acts.push(`memo → "${rule.setMemo}"`);
  if (rule.autoPost) acts.push("auto-post");
  return `${scope} | when ${conds || "(no conditions)"} | ${acts.join(", ") || "(no actions)"}`;
}

/** A fresh, empty rule with a generated id (id passed in to keep this pure). */
export function blankRule(id: string): BankRule {
  return {
    id,
    name: "New rule",
    enabled: true,
    direction: "any",
    account: "",
    conditions: [{ field: "description", op: "contains", value: "" }],
    setPayee: "",
    setCategory: "",
    setMemo: "",
    autoPost: false,
  };
}

/** Validate an imported rules payload into a clean BankRule[] (drops junk). */
export function normalizeImportedRules(data: unknown, genId: (i: number) => string): BankRule[] {
  if (!Array.isArray(data)) return [];
  const out: BankRule[] = [];
  data.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const r = raw as Record<string, unknown>;
    const conditions = Array.isArray(r.conditions)
      ? (r.conditions as unknown[])
          .map((c) => {
            const cc = (c || {}) as Record<string, unknown>;
            return {
              field: String(cc.field || "description") as RuleField,
              op: String(cc.op || "contains") as RuleOp,
              value: String(cc.value ?? ""),
              value2: cc.value2 != null ? String(cc.value2) : undefined,
            };
          })
          .filter((c) => c.field)
      : [];
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : genId(i),
      name: String(r.name || "Imported rule"),
      enabled: r.enabled !== false,
      direction: (["any", "in", "out"].includes(String(r.direction)) ? r.direction : "any") as RuleDirection,
      account: String(r.account || ""),
      conditions,
      setPayee: String(r.setPayee || ""),
      setCategory: String(r.setCategory || ""),
      setMemo: String(r.setMemo || ""),
      autoPost: r.autoPost === true,
    });
  });
  return out;
}
