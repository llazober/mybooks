const fs = require('fs');
let code = fs.readFileSync('app/actions.ts', 'utf8');

// Step 1: Remove `if (pre.length) return { ok: false, error: ... };`
code = code.replace(/if\s*\(\s*pre\.length\s*\)[^{}]*\{\s*ok:\s*false,\s*error:[^{}]+\};\s*/g, '');

// Step 2: Replace `if (post.length) return { ok: false, error: ... };`
const postReplacement = `const preMsgs = new Set(pre.map((e) => e.message));
  const newErrors = post.filter((e) => !preMsgs.has(e.message));
  if (newErrors.length) return { ok: false, error: "Validation failed: " + newErrors[0].message };`;

code = code.replace(/if\s*\(\s*post\.length\s*\)\s*return\s*\{\s*ok:\s*false,\s*error:\s*"Validation failed:\s*"\s*\+\s*post\[0\]\.message\s*\};/g, postReplacement);

fs.writeFileSync('app/actions.ts', code);
console.log('done');
