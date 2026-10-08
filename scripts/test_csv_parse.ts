import fs from "fs";

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

const content = fs.readFileSync("d:/vrtservices/TOIRAK'S GROUP HOMES INC_Ending balance on 5-31 (1).csv", "utf-8");
const rows = content
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => (line.includes("\t") ? line.split("\t").map((c) => c.trim()) : csvLine(line)));

const headers = rows[0].map((c) => c.trim().toLowerCase());
console.log("HEADERS:", headers);

const idx = (names: string[], fallback: number): number => {
  const found = headers.findIndex((h) => names.includes(h));
  return found >= 0 ? found : fallback;
};

const dateIdx = idx(["date"], 1);
const accountIdx = idx(["entity cod account", "account"], 2);
const debitIdx = idx(["debit"], 3);
const creditIdx = idx(["credit"], 4);

console.log("Indices:", { dateIdx, accountIdx, debitIdx, creditIdx });

const grouped = new Map<string, number>();

for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const date = cells[dateIdx];
    const ref = cells[idx(["reference", "ref"], 6)] || "";
    const debit = Number(cells[debitIdx]) || 0;
    const credit = Number(cells[creditIdx]) || 0;
    
    // Group by Date
    const gkey = date;
    if (!grouped.has(gkey)) grouped.set(gkey, 0);
    grouped.set(gkey, grouped.get(gkey)! + (debit - credit));
}

let totalDiff = 0;
for (const [key, diff] of grouped.entries()) {
    console.log(`Group ${key} difference: ${diff.toFixed(2)}`);
    totalDiff += diff;
}
console.log(`Total difference for entire file: ${totalDiff.toFixed(2)}`);

