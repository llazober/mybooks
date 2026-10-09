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

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('app/actions.ts', code);
    console.log('done');
} else {
    console.log('target not found!');
}
