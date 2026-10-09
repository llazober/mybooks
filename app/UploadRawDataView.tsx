"use client";

import { useEffect, useState } from "react";
import { getGlobalChartOfAccounts, saveImportDraft, loadImportDraft, clearImportDraft, predictMappings, learnMappings, normalizeDescription } from "./actions";

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

export default function UploadRawDataView({
  entityId,
  onChange,
  onNavigateToImport,
}: {
  entityId: string;
  onChange?: () => void;
  onNavigateToImport?: (data: string) => void;
}) {
  const [accounts, setAccounts] = useState<{num: string, name: string, type: string}[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [previewed, setPreviewed] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>("data");
  const [autofills, setAutofills] = useState<Record<string, string>>({});
  const [showDraftModal, setShowDraftModal] = useState<{headers: string[], rows: string[][], originalFileName?: string, autofills?: Record<string, string>}|null>(null);

  useEffect(() => {
    let active = true;
    getGlobalChartOfAccounts().then((acc) => {
      if (active) setAccounts(acc);
    });
    loadImportDraft(entityId).then((draft) => {
      if (active && draft && draft.headers && draft.rows) {
        setShowDraftModal({ headers: draft.headers, rows: draft.rows, originalFileName: draft.originalFileName, autofills: draft.autofills });
      }
    });
    return () => { active = false; };
  }, [entityId]);



  const CustomAccountSelect = ({ 
    value, 
    accounts, 
    onChange 
  }: { 
    value: string; 
    accounts: {num: string, name: string, type: string}[]; 
    onChange: (val: string) => void 
  }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const displayValue = open ? search : (value || "");

    const filteredAccounts = accounts.filter(a => {
      const term = search.toLowerCase();
      return a.num.toLowerCase().includes(term) || 
             a.name.toLowerCase().includes(term) || 
             a.type.toLowerCase().includes(term);
    });

    return (
      <div style={{ position: "relative", width: "100%", minWidth: 150 }} onMouseLeave={() => setOpen(false)}>
        <input 
          value={displayValue}
          onChange={(e) => {
             setSearch(e.target.value);
             if (!open) setOpen(true);
          }}
          onFocus={() => {
             setSearch("");
             setOpen(true);
          }}
          placeholder={open ? (value || "Search...") : "-- Select --"}
          style={{ 
            width: "100%",
            padding: "4px 8px", 
            cursor: "text", 
            border: "1px solid transparent",
            borderBottom: "1px solid var(--line)",
            background: "transparent",
            minHeight: 24,
            outline: "none"
          }}
        />
        {open && (
          <div style={{ 
            position: "absolute", 
            top: "100%", 
            left: 0, 
            zIndex: 100, 
            background: "white", 
            border: "1px solid var(--line)", 
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            maxHeight: 250, 
            overflowY: "auto",
            minWidth: "100%"
          }}>
            {filteredAccounts.map(a => {
              const label = `${a.num} - ${a.name} - ${a.type}`;
              return (
                <div 
                  key={a.num + a.name}
                  onMouseDown={(e) => { 
                    e.preventDefault(); // Prevents input from losing focus immediately
                    onChange(a.num); 
                    setSearch("");
                    setOpen(false); 
                  }}
                  style={{ 
                    padding: "6px 10px", 
                    cursor: "pointer", 
                    borderBottom: "1px solid #f0f0f0",
                    whiteSpace: "nowrap",
                    background: value === a.num ? "var(--bg-alt)" : "transparent"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-alt)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = value === a.num ? "var(--bg-alt)" : "transparent")}
                >
                  {label}
                </div>
              );
            })}
            {filteredAccounts.length === 0 && (
              <div style={{ padding: "6px 10px", color: "#999" }}>
                No matching accounts
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileText = e.target?.result as string;
      const lines = fileText.trim().split(/\r?\n/).filter(Boolean).map(line => line.includes("\t") ? line.split("\t").map(c => c.trim()) : csvLine(line));
      if (lines.length > 0) {
        const heads = lines[0] || [];
        let body = lines.slice(1);
        
        const descIdx = heads.findIndex(h => h.toLowerCase() === "description");
        const accIdx = heads.findIndex(h => h.toLowerCase() === "account" || h.toLowerCase() === "entity cod account");
        const entIdx = heads.findIndex(h => h.toLowerCase() === "entity code");
        const refIdx = heads.findIndex(h => h.toLowerCase() === "reference");
        
        if (descIdx !== -1) {
          const dict = await predictMappings(entityId);
          const newAutofills: Record<string, string> = {};
          
          body = body.map((row, rIdx) => {
            const desc = row[descIdx];
            if (!desc) return row;
            const norm = normalizeDescription(desc);
            const match = dict[norm];
            if (!match) return row;
            
            const newRow = [...row];
            const applyMatch = (idx: number, val: string | null) => {
              if (idx >= 0 && val && newRow[idx] !== val) {
                newAutofills[`${rIdx}-${idx}`] = newRow[idx] || "";
                newRow[idx] = val;
              }
            };
            
            applyMatch(accIdx, match.accountNumber);
            applyMatch(entIdx, match.entityCode);
            applyMatch(refIdx, match.reference);
            return newRow;
          });
          setAutofills(newAutofills);
        }

        setHeaders(heads);
        setRows(body);
        setOriginalFileName(file.name.replace(/\.[^/.]+$/, ""));
        setPreviewed(true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function updateCell(rIdx: number, cIdx: number, val: string) {
    setRows(prev => {
      const next = [...prev];
      const row = [...next[rIdx]];
      row[cIdx] = val;
      next[rIdx] = row;
      return next;
    });
  }

  return (
    <div className="grid">
      {showDraftModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: 'white', padding: "32px", borderRadius: 12, maxWidth: 450, width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: "var(--fg)" }}>Unsaved Draft Found</h3>
            <p style={{ color: "var(--muted)", marginBottom: 24, lineHeight: 1.5 }}>
              You have a previously saved raw data draft. Would you like to load it and continue where you left off?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => {
                clearImportDraft(entityId);
                setShowDraftModal(null);
              }}>Discard Draft</button>
              <button className="button primary" style={{ background: "var(--accent)", color: "white", border: "none" }} onClick={() => {
                setHeaders(showDraftModal.headers);
                setRows(showDraftModal.rows);
                if (showDraftModal.originalFileName) setOriginalFileName(showDraftModal.originalFileName);
                if (showDraftModal.autofills) setAutofills(showDraftModal.autofills);
                setPreviewed(true);
                setShowDraftModal(null);
              }}>Load Draft</button>
            </div>
          </div>
        </div>
      )}

      <div className="panel span-12">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Upload Raw Data</h2>
        </div>
        
        {okMsg && (
          <div className="notice" style={{ borderColor: "var(--accent)", background: "#e7f1ec", color: "#1c4d3e" }}>
            {okMsg}
          </div>
        )}

        {!previewed && (
          <div style={{ padding: "40px 20px", textAlign: "center", border: "2px dashed var(--line)", borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Select your CSV File</h3>
            <p className="muted">Upload your CSV to view and edit it exactly as it is, with no automatic balancing or validation.</p>
            <label className="button primary" style={{ cursor: "pointer", display: "inline-block", marginTop: 10 }}>
              📁 Select CSV File
              <input
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
            </label>
          </div>
        )}

        {previewed && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>
                Raw Data Editor
                {originalFileName && originalFileName !== "data" && (
                  <span style={{ color: "var(--muted)", fontWeight: "normal", fontSize: "0.85em", marginLeft: 8 }}>
                    ({originalFileName}.csv)
                  </span>
                )}
              </h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="button primary" onClick={async () => {
                  await learnMappings(entityId, headers, rows);
                  const escapeCell = (c: string) => {
                    if (c.includes(',') || c.includes('"') || c.includes('\n')) {
                      return `"${c.replace(/"/g, '""')}"`;
                    }
                    return c;
                  };
                  const headStr = headers.map(escapeCell).join(',');
                  const rowStrs = rows.map(r => r.map(escapeCell).join(','));
                  const csvData = [headStr, ...rowStrs].join('\n');
                  if (onNavigateToImport) onNavigateToImport(csvData);
                }}>
                  ✨ Learn & Proceed to Journal Import
                </button>
                <button onClick={async () => {
                  await saveImportDraft(entityId, { headers, rows, originalFileName, autofills } as any);
                  setOkMsg("Draft saved successfully!");
                  setTimeout(() => setOkMsg(null), 3000);
                }}>
                  💾 Save Draft
                </button>
                <button onClick={() => {
                  const escapeCell = (c: string) => {
                    if (c.includes(',') || c.includes('"') || c.includes('\n')) {
                      return `"${c.replace(/"/g, '""')}"`;
                    }
                    return c;
                  };
                  const headStr = headers.map(escapeCell).join(',');
                  const rowStrs = rows.map(r => r.map(escapeCell).join(','));
                  const csvData = [headStr, ...rowStrs].join('\n');
                  
                  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${originalFileName}_Reviewed.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}>
                  📥 Export as CSV
                </button>
                <button onClick={() => setPreviewed(false)}>Clear & Upload Again</button>
              </div>
            </div>
            
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} style={{ padding: 0, borderBottom: "2px solid var(--line)", textAlign: "left", borderRight: "1px solid var(--line)" }}>
                        <div style={{ 
                          resize: "horizontal", 
                          overflow: "hidden", 
                          minWidth: 120, 
                          padding: 8,
                          display: "flex",
                          alignItems: "center"
                        }}>
                          {h}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: "1px solid var(--line)" }}>
                      {headers.map((header, cIdx) => {
                        const hl = header.toLowerCase();
                        const isAccount = hl === "account" || hl === "entity cod account";
                        const isReadOnly = hl === "debit" || hl === "credit";
                        const val = row[cIdx] ?? "";
                        
                        const autoKey = `${rIdx}-${cIdx}`;
                        const isAutofilled = autofills[autoKey] !== undefined;

                        if (isAccount) {
                          return (
                            <td key={cIdx} style={{ padding: 0, position: "relative" }}>
                              <div style={{ background: isAutofilled ? "#e8f5e9" : "transparent" }}>
                                <CustomAccountSelect 
                                  value={val} 
                                  accounts={accounts} 
                                  onChange={(newVal) => {
                                    updateCell(rIdx, cIdx, newVal);
                                    if (isAutofilled) {
                                      setAutofills(prev => { const n = {...prev}; delete n[autoKey]; return n; });
                                    }
                                  }} 
                                />
                              </div>
                              {isAutofilled && (
                                <div style={{ fontSize: "10px", color: "var(--muted)", position: "absolute", bottom: -2, right: 6, pointerEvents: "none" }}>
                                  ✨ Auto (Orig: {autofills[autoKey] || "blank"})
                                </div>
                              )}
                            </td>
                          );
                        } else {
                          return (
                            <td key={cIdx} style={{ padding: "4px 8px", position: "relative" }}>
                              <input 
                                value={val} 
                                readOnly={isReadOnly}
                                onChange={isReadOnly ? undefined : (e) => {
                                  updateCell(rIdx, cIdx, e.target.value);
                                  if (isAutofilled) {
                                    setAutofills(prev => { const n = {...prev}; delete n[autoKey]; return n; });
                                  }
                                }}
                                style={{ 
                                  width: "100%", 
                                  minWidth: 80, 
                                  border: "1px solid transparent", 
                                  background: isAutofilled ? "#e8f5e9" : "transparent",
                                  cursor: isReadOnly ? "default" : "text",
                                  color: isReadOnly ? "var(--muted)" : "inherit"
                                }}
                                onFocus={isReadOnly ? undefined : (e) => e.target.style.border = "1px solid var(--accent)"}
                                onBlur={isReadOnly ? undefined : (e) => e.target.style.border = "1px solid transparent"}
                              />
                              {isAutofilled && (
                                <div style={{ fontSize: "10px", color: "var(--muted)", position: "absolute", bottom: -2, right: 6, pointerEvents: "none" }}>
                                  ✨ Auto (Orig: {autofills[autoKey] || "blank"})
                                </div>
                              )}
                            </td>
                          );
                        }
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
