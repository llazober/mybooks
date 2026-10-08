"use client";

import { useEffect, useState } from "react";
import {
  addEntity,
  duplicateEntity,
  listEntities,
  getEntityProtection,
  verifyLogin,
  deleteEntity,
  verifyAdmin,
  reseedSample,
  logout,
  adminResetCompanyPassword,
  type EntitySummary,
} from "./actions";
import DashboardView from "./DashboardView";
import ReportsView from "./ReportsView";
import StatementView from "./StatementView";
import DataEntryView from "./DataEntryView";
import JournalEntryView from "./JournalEntryView";
import ChartView from "./ChartView";
import ImportView from "./ImportView";
import ExportView from "./ExportView";
import { COA_TEMPLATE_LIST } from "@/lib/coa-templates";

// "Start from" dropdown values that seed a starter chart of accounts.
const COA_PREFIX = "coa:";

const ADMIN_TABS = ["Dash", "Summary", "Reports", "Ledger", "Journal", "Chart", "Journal Import", "Export"] as const;
const COMPANY_TABS = ["Dash", "Summary", "Reports", "Ledger"] as const;
type Tab = (typeof ADMIN_TABS)[number];

const SAMPLE_ID = "sample-company";
const SAMPLE_DISPLAY = "_SampleCompany_";

/** Show the read-only sample under a fixed display name, wherever it's listed. */
function relabelSample(list: EntitySummary[]): EntitySummary[] {
  return list.map((e) => (e.id === SAMPLE_ID ? { ...e, name: SAMPLE_DISPLAY } : e));
}

export default function Shell({ initialEntities, session }: { initialEntities: EntitySummary[], session?: any }) {
  const currentTabs = session?.role === "ADMIN" ? ADMIN_TABS : COMPANY_TABS;
  const [entities, setEntities] = useState<EntitySummary[]>(() => relabelSample(initialEntities));
  // Filter text for the company list (matches company name or owner name).
  const [entityQuery, setEntityQuery] = useState("");
  // Everyone starts on the read-only Sample Company by default; fall back to
  // the first entity only if the sample isn't present.
  const [activeId, setActiveId] = useState<string>(
    initialEntities.find((e) => e.id === SAMPLE_ID)?.id ??
      initialEntities[0]?.id ??
      "",
  );
  const [tab, setTab] = useState<Tab>("Summary");
  const [busy, setBusy] = useState(false);
  // Entity-creation modal
  const [showNew, setShowNew] = useState(false);
  const [nName, setNName] = useState("");
  const [nOwner, setNOwner] = useState("");
  const [nPass, setNPass] = useState("");
  const [nCustomerId, setNCustomerId] = useState("");
  const [nErr, setNErr] = useState("");
  // Data source: "" = start from scratch, else duplicate from that entity id.
  const [nSource, setNSource] = useState("coa:vrt-custom");
  const [nSrcPass, setNSrcPass] = useState("");
  const [nSrcProtected, setNSrcProtected] = useState(false);
  // Login modal (when opening a protected entity)
  const [loginFor, setLoginFor] = useState<EntitySummary | null>(null);
  const [lOwner, setLOwner] = useState("");
  const [lPass, setLPass] = useState("");
  const [lErr, setLErr] = useState("");
  // Entities unlocked this session (ids)
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  // Bumped after any write so the Reports view refetches when revisited.
  const [dataVersion, setDataVersion] = useState(0);
  // Brief spin feedback for the manual refresh button.
  const [refreshing, setRefreshing] = useState(false);
  // Cross-tab focus: open a specific txn in the register (set from Statements).
  const [registerFocus, setRegisterFocus] = useState<{ account: string; txId: string } | null>(null);
  // Theme: purely a visual skin. "default" | "pretty" | "dark" | "america250". No data change.
  const [theme, setTheme] = useState<"default" | "pretty" | "dark" | "america250" | "modern">("pretty");
  const [collapsed, setCollapsed] = useState(false);
  // Admin mode (UI gate; deterrent only — see deleteEntity note).
  const [admin, setAdmin] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("beanbooks.theme");
    if (t === "pretty" || t === "dark" || t === "default" || t === "america250" || t === "modern") setTheme(t);
    setCollapsed(localStorage.getItem("beanbooks.navCollapsed") === "1");
    // Remembered owner name prefills both modals.
    const savedOwner = localStorage.getItem("beanbooks.owner") || "";
    setNOwner(savedOwner);
    setLOwner(savedOwner);
  }, []);

  // Deep link: a URL like /?entity=<id>&tab=Ledger&account=<acct>&tx=<id> opens
  // that entity in the given tab focused on a specific transaction. Used by the
  // Bank Feed "already posted ↗" link (opens in a new tab, ready to edit).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const entity = params.get("entity");
    if (!entity) return;
    if (!entities.some((e) => e.id === entity)) return;
    const tabParam = params.get("tab");
    const tx = params.get("tx") || "";
    const account = params.get("account") || "";
    setUnlocked((s) => new Set(s).add(entity)); // arriving via deep link implies access
    setActiveId(entity);
    if (tabParam && (ADMIN_TABS as readonly string[]).includes(tabParam)) setTab(tabParam as Tab);
    if (tx || account) setRegisterFocus({ account, txId: tx });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.classList.toggle("pretty", theme === "pretty");
    document.body.classList.toggle("dark", theme === "dark");
    document.body.classList.toggle("america250", theme === "america250");
    document.body.classList.toggle("modern", theme === "modern");
    localStorage.setItem("beanbooks.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("beanbooks.navCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // When the duplicate source changes, learn whether it's password-protected.
  useEffect(() => {
    setNSrcPass("");
    // Empty ("scratch") and starter-template ("coa:*") sources aren't real
    // entities, so there's no protection to look up.
    if (!nSource || nSource.startsWith(COA_PREFIX)) {
      setNSrcProtected(false);
      return;
    }
    getEntityProtection(nSource).then((p) => setNSrcProtected(p.protected));
  }, [nSource]);

  const active = entities.find((e) => e.id === activeId);

  // Short description shown under the "Start from" picker when a starter
  // chart of accounts is selected.
  const coaHint = nSource.startsWith(COA_PREFIX)
    ? COA_TEMPLATE_LIST.find((t) => COA_PREFIX + t.id === nSource)?.description ?? ""
    : "";

  // Company list: the sample is always pinned first; the rest are searchable by
  // company name or owner name.
  const sampleEntity = entities.find((e) => e.id === SAMPLE_ID);
  const otherEntities = entities.filter((e) => e.id !== SAMPLE_ID);
  const eq = entityQuery.trim().toLowerCase();
  const shownOthers = eq
    ? otherEntities.filter(
        (e) => e.name.toLowerCase().includes(eq) || (e.owner || "").toLowerCase().includes(eq)
      )
    : otherEntities;

  function renderEntityRow(e: EntitySummary) {
    return (
      <div key={e.id} className="entity-row">
        <button
          className={"entity" + (e.id === activeId ? " active" : "")}
          onClick={() => selectEntity(e)}
        >
          {e.name}
        </button>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {session?.role === "ADMIN" && e.id !== SAMPLE_ID ? (
            <button
              title={"Reset password for " + e.name}
              onClick={async (ev) => {
                ev.stopPropagation();
                if (!window.confirm(`Reset password for ${e.name} to '12345'?`)) return;
                const res = await adminResetCompanyPassword(e.id);
                if (res.ok) {
                  window.alert(`Password for ${res.email} has been reset to '12345'.`);
                } else {
                  window.alert(res.error || "Failed to reset password.");
                }
              }}
              style={{ padding: "2px 6px", fontSize: "11px", background: "#e2e8f0", border: "1px solid #cbd5e1", cursor: "pointer", borderRadius: "3px", color: "#475569" }}
            >
              Reset PW
            </button>
          ) : null}
          {admin && e.id !== SAMPLE_ID ? (
            <button
              className="danger entity-del"
              title={"Delete " + e.name}
              onClick={() => handleDelete(e)}
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // Manual refresh: re-pull the active company's data without a browser reload.
  // Bumping dataVersion remounts the data-keyed views (Dashboard, Reports,
  // Statements, Chart, Export) so they refetch from the server.
  function refreshData() {
    setDataVersion((v) => v + 1);
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 500);
  }

  function openNewModal() {
    setNName("");
    setNPass("");
    setNCustomerId("");
    setNErr("");
    setNSource("coa:vrt-custom");
    setNSrcPass("");
    setNOwner(localStorage.getItem("beanbooks.owner") || "");
    setShowNew(true);
  }

  async function handleCreate() {
    const name = nName.trim();
    if (!name) {
      setNErr("Entity name is required.");
      return;
    }
    if ((nOwner.trim() && !nPass) || (!nOwner.trim() && nPass)) {
      setNErr("To create a user account, provide both an email address and a password.");
      return;
    }
    const owner = nOwner.trim();
    setBusy(true);
    setNErr("");
    try {
      let created: EntitySummary;
      if (nSource.startsWith(COA_PREFIX)) {
        // Fresh entity seeded with a starter chart of accounts.
        const template = nSource.slice(COA_PREFIX.length);
        created = {
          ...(await addEntity(name, owner || undefined, nPass || undefined, template, nCustomerId.trim() || undefined)),
          owner,
        };
      } else if (nSource) {
        // Duplicate from an existing entity. Protected sources need a password.
        const src = entities.find((e) => e.id === nSource);
        const res = await duplicateEntity(nSource, name, {
          owner: owner || undefined,
          password: nPass || undefined,
          sourceOwner: localStorage.getItem("beanbooks.owner") || "",
          sourcePassword: nSrcPass || undefined,
          customerId: nCustomerId.trim() || undefined,
        });
        if (!res.ok || !res.id) {
          setNErr(res.error || "Could not duplicate.");
          setBusy(false);
          return;
        }
        created = { id: res.id, name: res.name || name, owner };
        void src;
      } else {
        created = { ...(await addEntity(name, owner || undefined, nPass || undefined, undefined, nCustomerId.trim() || undefined)), owner };
      }
      if (owner) localStorage.setItem("beanbooks.owner", owner);
      setEntities((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setUnlocked((s) => new Set(s).add(created.id)); // creator is unlocked
      setActiveId(created.id);
      setShowNew(false);
      setDataVersion((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }

  // Selecting an entity: prompt for login if it's protected and not yet unlocked.
  async function selectEntity(e: EntitySummary) {
    if (unlocked.has(e.id)) {
      setActiveId(e.id);
      return;
    }
    const prot = await getEntityProtection(e.id);
    if (!prot.protected) {
      setUnlocked((s) => new Set(s).add(e.id));
      setActiveId(e.id);
      return;
    }
    setLErr("");
    setLPass("");
    setLOwner(localStorage.getItem("beanbooks.owner") || prot.owner || "");
    setLoginFor(e);
  }

  async function toggleAdmin() {
    if (admin) {
      setAdmin(false);
      return;
    }
    const pw = window.prompt("Enter admin password:");
    if (pw === null) return;
    const res = await verifyAdmin(pw);
    if (res.ok) setAdmin(true);
    else window.alert("Incorrect admin password.");
  }

  // Overwrite the read-only Sample Company with the current bundled sample
  // ledger. Fixes a stale sample (e.g. one seeded before COGS accounts existed)
  // without wiping any user companies. Admin-gated; bypasses the read-only guard
  // by writing through the store directly (see reseedSample).
  async function handleReseed() {
    if (
      !window.confirm(
        "Reseed the Sample Company with the latest bundled data? This overwrites the sample ledger (user companies are untouched)."
      )
    )
      return;
    setReseeding(true);
    try {
      const res = await reseedSample();
      if (!res.ok) {
        window.alert(res.error || "Could not reseed the sample.");
        return;
      }
      setDataVersion((v) => v + 1); // refresh any open views of the sample
      window.alert("Sample data refreshed from the latest bundled ledger.");
    } finally {
      setReseeding(false);
    }
  }

  async function handleDelete(e: EntitySummary) {
    if (
      !window.confirm(
        `Permanently delete "${e.name}"? This removes the company file and cannot be undone.`
      )
    )
      return;
    const res = await deleteEntity(e.id);
    if (!res.ok) {
      window.alert(res.error || "Could not delete.");
      return;
    }
    setEntities((prev) => prev.filter((x) => x.id !== e.id));
    if (activeId === e.id) {
      const remaining = entities.filter((x) => x.id !== e.id);
      setActiveId(remaining[0]?.id ?? "");
    }
  }

  async function handleLogin() {
    if (!loginFor) return;
    const res = await verifyLogin(loginFor.id, lOwner.trim(), lPass);
    if (!res.ok) {
      setLErr("Incorrect owner name or password.");
      return;
    }
    localStorage.setItem("beanbooks.owner", lOwner.trim());
    setUnlocked((s) => new Set(s).add(loginFor.id));
    setActiveId(loginFor.id);
    setLoginFor(null);
    setLPass("");
  }

  return (
    <div className={"app" + (collapsed ? " nav-collapsed" : "")}>
      <aside>
        <div className="brand">
          {!collapsed && (
            <div className="brand-head">
              <h1>VRT Services</h1>
              <div className="brand-sub">
                <button 
                  className="pill" 
                  style={{ background: '#dc2626', color: 'white', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}
                  onClick={async () => {
                    await logout();
                    window.location.href = '/';
                  }}
                >
                  Log Out
                </button>
              </div>
            </div>
          )}
          <button
            className="nav-toggle"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>

        {!collapsed && (
          <>
            <label className="theme-select" style={{ marginBottom: 16 }}>
              Theme:
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as "default" | "pretty" | "dark" | "america250" | "modern")}
              >
                <option value="default">Default</option>
                <option value="pretty">Pretty</option>
                <option value="dark">Dark</option>
                <option value="america250">America 250</option>
                <option value="modern">Modern View</option>
              </select>
            </label>

            <div className="entity-list">
              {sampleEntity ? renderEntityRow(sampleEntity) : null}
              {otherEntities.length ? (
                <input
                  className="entity-search"
                  placeholder="Search companies or owners…"
                  value={entityQuery}
                  onChange={(e) => setEntityQuery(e.target.value)}
                />
              ) : null}
              {shownOthers.map(renderEntityRow)}
              {eq && shownOthers.length === 0 ? (
                <div className="muted" style={{ fontSize: 12, padding: "2px 4px" }}>
                  No companies match “{entityQuery.trim()}”.
                </div>
              ) : null}
            </div>
            {session?.role === "ADMIN" && (
              <div className="stack">
                <button className="primary" onClick={openNewModal}>
                  + New entity
                </button>
              </div>
            )}
          </>
        )}

        {!collapsed && (
          <div className="nav-footer">
            <button
              className={admin ? "danger" : ""}
              style={{ width: "100%" }}
              onClick={toggleAdmin}
              title="Admin mode lets you delete company files"
            >
              {admin ? "🔓 Admin mode: ON" : "🔒 Admin mode"}
            </button>
            {admin ? (
              <button
                style={{ width: "100%", marginTop: 8 }}
                onClick={handleReseed}
                disabled={reseeding}
                title="Overwrite the Sample Company with the latest bundled sample data"
              >
                {reseeding ? "Reseeding…" : "↻ Reseed sample data"}
              </button>
            ) : null}
          </div>
        )}
      </aside>

      <main>
        <div className="toolbar">
          <div className="entity-title">
            <strong>{active?.name ?? "No entity"}</strong>
            <button
              className={"refresh-btn" + (refreshing ? " spinning" : "")}
              onClick={refreshData}
              disabled={!active}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <span className="refresh-ico">↻</span>
            </button>
          </div>
          <div className="tabs">
            {currentTabs.map((t) => (
              <button
                key={t}
                className={"tab" + (t === tab ? " active" : "")}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {!active ? (
          <div className="panel">
            <p className="muted">Create an entity to get started.</p>
          </div>
        ) : tab === "Dash" ? (
          <DashboardView key={active.id + ":" + dataVersion} entityId={active.id} />
        ) : tab === "Summary" ? (
          <ReportsView key={active.id + ":" + dataVersion} entityId={active.id} />
        ) : tab === "Reports" ? (
          <StatementView
            key={active.id + ":" + dataVersion}
            entityId={active.id}
            onOpenTransaction={(account, txId) => {
              setRegisterFocus({ account, txId });
              setTab("Ledger");
            }}
          />
        ) : tab === "Ledger" ? (
          <DataEntryView
            entityId={active.id}
            onChange={() => setDataVersion((v) => v + 1)}
            focus={registerFocus}
            onFocusConsumed={() => setRegisterFocus(null)}
          />
        ) : tab === "Journal" && session?.role === "ADMIN" ? (
          <JournalEntryView entityId={active.id} onChange={() => setDataVersion((v) => v + 1)} />
        ) : tab === "Chart" && session?.role === "ADMIN" ? (
          <ChartView
            key={active.id + ":" + dataVersion}
            entityId={active.id}
            onChange={() => setDataVersion((v) => v + 1)}
            onOpenAccount={(account) => {
              setRegisterFocus({ account, txId: "" });
              setTab("Ledger");
            }}
          />
        ) : tab === "Journal Import" && session?.role === "ADMIN" ? (
          <ImportView key={active.id} entityId={active.id} onChange={() => setDataVersion((v) => v + 1)} />
        ) : tab === "Export" && session?.role === "ADMIN" ? (
          <ExportView key={active.id + ":" + dataVersion} entityId={active.id} />
        ) : null}
      </main>

      {showNew && (
        <div className="modal-overlay" onClick={() => !busy && setShowNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>New entity</h2>
            {nErr ? <div className="notice">{nErr}</div> : null}
            <div className="modal-grid">
              <label>
                Entity name
                <input
                  autoFocus
                  placeholder="e.g. Acme LLC"
                  value={nName}
                  onChange={(e) => setNName(e.target.value)}
                />
              </label>
              <label>
                Customer ID
                <input
                  placeholder="e.g. CUST-12345"
                  value={nCustomerId}
                  onChange={(e) => setNCustomerId(e.target.value)}
                />
              </label>
              <label>
                User Email Address
                <input
                  placeholder="e.g. client@example.com"
                  value={nOwner}
                  onChange={(e) => setNOwner(e.target.value)}
                />
              </label>
              <label>
                Initial Password
                <input
                  type="password"
                  placeholder="Password for the client to log in"
                  value={nPass}
                  onChange={(e) => setNPass(e.target.value)}
                />
              </label>
              <label>
                Start from
                <select value={nSource} onChange={(e) => setNSource(e.target.value)}>
                  <option value="">Scratch (empty ledger)</option>
                  <optgroup label="Starter chart of accounts">
                    {COA_TEMPLATE_LIST.map((t) => (
                      <option key={t.id} value={COA_PREFIX + t.id}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Duplicate existing">
                    {entities.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              {coaHint ? (
                <p className="muted" style={{ fontSize: 12, margin: "-4px 0 0" }}>
                  {coaHint}
                </p>
              ) : null}
              {nSource && nSrcProtected ? (
                <label>
                  Source password
                  <input
                    type="password"
                    placeholder="Password of the entity you're copying"
                    value={nSrcPass}
                    onChange={(e) => setNSrcPass(e.target.value)}
                  />
                </label>
              ) : null}
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Leave the email and password blank if you do not want to create a client login for this company right now.
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowNew(false)} disabled={busy}>
                Cancel
              </button>
              <button className="primary" onClick={handleCreate} disabled={busy}>
                {busy ? "Creating…" : "Create entity"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loginFor && (
        <div className="modal-overlay" onClick={() => setLoginFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Open “{loginFor.name}”</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              This entity is protected. Enter the owner name and password.
            </p>
            {lErr ? <div className="notice">{lErr}</div> : null}
            <div className="modal-grid">
              <label>
                Owner name
                <input
                  autoFocus
                  value={lOwner}
                  onChange={(e) => setLOwner(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={lPass}
                  onChange={(e) => setLPass(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setLoginFor(null)}>Cancel</button>
              <button className="primary" onClick={handleLogin}>
                Open
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeedback && (
        <div className="modal-overlay" onClick={() => setShowFeedback(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>About mybooks</h2>
            <div className="feedback-body">
              <p>
                This is a private instance of <strong>mybooks</strong>.
                It is based on the open source PlainGL project, which you can find at{" "}
                <a
                  href="https://github.com/hexgarcia/plaingl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  github.com/hexgarcia/plaingl
                </a>
                .
              </p>
              <p>
                This app will continue to improve every week with Hector’s updates
                and those from the <strong>REFRAME SOCIETY</strong> community. Hector
                will be using this app as the ongoing use case for the{" "}
                <strong>“AI Coding Academy for Accountants”</strong> program that
                starts in July 2026. If you are not a current member, check out{" "}
                <a
                  href="https://www.hectorgarcia.com/ai"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  hectorgarcia.com/ai
                </a>
                .
              </p>
              <p style={{ fontSize: "0.8em", opacity: 0.7, marginBottom: 0 }}>
                Build: <code>{process.env.NEXT_PUBLIC_COMMIT_SHA}</code>
              </p>
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={() => setShowFeedback(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
