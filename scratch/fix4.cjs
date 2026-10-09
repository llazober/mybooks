const fs = require('fs');
let code = fs.readFileSync('app/actions.ts', 'utf8');

const target = `    if (postings.length > 0) {
      ledger.directives.push({
        kind: "transaction",
        date: t.date,
        flag: "*",
        payee: t.payee,
        narration: t.memo || (t.ref ? "Ref: " + t.ref : ""),
        meta: t.ref ? { ref: t.ref } : {},
        postings,
      });
    }`;

const replacement = `    if (postings.length > 0) {
      const sum = postings.reduce((s, p) => s + p.amount, 0);
      if (sum !== 0) {
        return { ok: false, error: "Postings for " + t.date + " must balance to zero (off by " + fromCents(Math.abs(sum)) + ")" };
      }

      ledger.directives.push({
        kind: "transaction",
        date: t.date,
        flag: "*",
        payee: t.payee,
        narration: t.memo || (t.ref ? "Ref: " + t.ref : ""),
        meta: t.ref ? { ref: t.ref } : {},
        postings,
      });
    }`;

code = code.replace(/if\s*\(\s*postings\.length\s*>\s*0\s*\)\s*\{\s*ledger\.directives\.push\(\{\s*kind:\s*"transaction",\s*date:\s*t\.date,\s*flag:\s*"\*",\s*payee:\s*t\.payee,\s*narration:\s*t\.memo\s*\|\|\s*\(t\.ref\s*\?\s*"Ref:\s*"\s*\+\s*t\.ref\s*:\s*""\),\s*meta:\s*t\.ref\s*\?\s*\{\s*ref:\s*t\.ref\s*\}\s*:\s*\{\},\s*postings,?\s*\}\);\s*\}/, replacement);

fs.writeFileSync('app/actions.ts', code);
console.log('done');
