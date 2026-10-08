import fs from "fs";
import { pgStore } from "../lib/store/pg";
import { createHash } from "crypto";

const CSV_PATH = "d:/vrtservices/Chart of accounts.csv";
const ENTITY_NAME = "Toirak's Group Homes Inc";
const ENTITY_ID = "toiraks-group-homes-inc";
const OWNER = "Toirak";
const PASSWORD = "12345";

function pwHash(owner: string, pass: string): string {
  const payload = owner.trim().toLowerCase() + ":" + pass;
  return createHash("sha256").update(payload).digest("hex");
}

async function run() {
  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  
  let text = 'option "title" "' + ENTITY_NAME + '"\noption "operating_currency" "USD"\n';
  text += 'option "bb_owner" "' + OWNER + '"\noption "bb_pwhash" "' + pwHash(OWNER, PASSWORD) + '"\n\n';

  const date = "2026-01-01"; // Generic start date

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 3) continue;
    
    const num = cols[0];
    const rawName = cols[1];
    const drakeType = cols[2];
    if (!num || !rawName || !drakeType) continue;

    const name = rawName.replace(/[^a-zA-Z0-9]/g, "");

    let root = "Expenses";
    if (drakeType.includes("Asset")) root = "Assets";
    else if (drakeType.includes("Liability")) root = "Liabilities";
    else if (drakeType === "Capital") root = "Equity";
    else if (drakeType === "Income") root = "Income";
    else if (drakeType === "Cost of Goods") root = "COGS";
    
    let sub = "";
    if (drakeType === "Current Asset") sub = "Current:";
    else if (drakeType === "Fixed Asset") sub = "Fixed:";
    else if (drakeType === "Other Asset") sub = "Other:";
    else if (drakeType === "Current Liability") sub = "Current:";
    else if (drakeType === "Long Term Liability") sub = "LongTerm:";

    const accountStr = `${root}:${sub}${num.replace(/\./g, "_")}-${name}`;
    text += `${date} open ${accountStr}\n`;
  }

  await pgStore.saveEntity(ENTITY_ID, text);
  console.log("Entity created successfully with ID:", ENTITY_ID);
}

run().catch(console.error);
