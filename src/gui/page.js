/**
 * src/gui/page.js — Fluid HTML GUI for the Parties & Contracts Manager
 *
 * Exports a single HTML string that is served at GET / and GET /gui.
 * The page communicates with the REST API using fetch() and relative
 * paths — no build step or external dependencies required.
 *
 * Layout: fluid CSS Grid — two-column (table + detail panel) on wide
 * screens, single-column on narrow screens. Supports light/dark mode
 * via prefers-color-scheme. Font sizes scale fluidly with clamp().
 */

export const guiPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parties &amp; Contracts Manager</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:           #f0f2f5;
      --surface:      #ffffff;
      --surface2:     #f8fafc;
      --border:       #e2e8f0;
      --text:         #1a202c;
      --text-muted:   #718096;
      --primary:      #3b82f6;
      --primary-dark: #1d4ed8;
      --danger:       #ef4444;
      --success:      #10b981;
      --radius:       8px;
      --shadow:       0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06);
      --shadow-md:    0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg:       #0f172a;
        --surface:  #1e293b;
        --surface2: #334155;
        --border:   #475569;
        --text:     #f1f5f9;
        --text-muted: #94a3b8;
      }
    }

    html {
      font-size: clamp(13px, 1vw + 10px, 15px);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    body {
      background: var(--bg);
      color: var(--text);
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ─────────────────────────────────────────────────────── */
    .app-header {
      background: #1e3a5f;
      color: white;
      padding: .65rem 1.25rem;
      display: flex;
      align-items: center;
      gap: .75rem;
      flex-shrink: 0;
      box-shadow: var(--shadow-md);
    }
    .app-header h1 { font-size: 1.1rem; font-weight: 700; flex: 1; letter-spacing: -.01em; }
    .app-header .hdr-actions { display: flex; gap: .5rem; }

    /* ── Section nav ─────────────────────────────────────────────────── */
    .section-nav {
      display: flex;
      background: var(--surface);
      border-bottom: 2px solid var(--border);
      flex-shrink: 0;
    }
    .section-nav-btn {
      padding: .55rem 1.25rem;
      border: none; background: none;
      font-size: .9rem; font-weight: 500; cursor: pointer;
      color: var(--text-muted);
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      transition: color .1s; font-family: inherit;
    }
    .section-nav-btn.active { color: var(--primary); border-bottom-color: var(--primary); }

    /* ── App layout (fluid grid) ─────────────────────────────────────── */
    .app-layout {
      display: grid;
      grid-template-columns: 1fr auto;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    /* ── List panel ──────────────────────────────────────────────────── */
    .list-panel {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    /* ── Filters ─────────────────────────────────────────────────────── */
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: .5rem;
      padding: .65rem 1rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .filters input,
    .filters select {
      flex: 1 1 110px;
      padding: .38rem .6rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface2);
      color: var(--text);
      font-size: .85rem;
    }
    .filters input:focus,
    .filters select:focus { outline: 2px solid var(--primary); outline-offset: -1px; }

    /* ── Table ───────────────────────────────────────────────────────── */
    .table-wrap { overflow: auto; flex: 1; }
    table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    thead th {
      position: sticky; top: 0; z-index: 1;
      background: var(--surface);
      padding: .55rem 1rem;
      text-align: left;
      font-size: .75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--text-muted);
      border-bottom: 2px solid var(--border);
    }
    tbody tr {
      cursor: pointer;
      border-bottom: 1px solid var(--border);
      transition: background .1s;
    }
    tbody tr:hover  { background: var(--surface2); }
    tbody tr.active { background: #dbeafe; }
    @media (prefers-color-scheme: dark) { tbody tr.active { background: #1e3a5f; } }

    td { padding: .55rem 1rem; }
    .td-name   { font-weight: 500; }
    .td-type   { color: var(--primary); font-size: .8rem; white-space: nowrap; }
    .td-loc    { color: var(--text-muted); }
    .td-actions { white-space: nowrap; text-align: right; width: 1%; }
    .empty-row td { text-align: center; color: var(--text-muted); padding: 3rem 1rem; font-size: .9rem; }

    /* ── Detail panel (fluid width) ──────────────────────────────────── */
    .detail-panel {
      width: 0;
      overflow: hidden;
      transition: width .22s ease;
      background: var(--surface);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .detail-panel.open { width: clamp(290px, 36vw, 460px); }

    .detail-inner {
      width: clamp(290px, 36vw, 460px);
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .detail-header {
      padding: .65rem 1rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: .5rem;
      flex-shrink: 0;
    }
    .detail-header h2 {
      flex: 1; font-size: .975rem; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .detail-body  { padding: 1rem; flex: 1; overflow-y: auto; }
    .detail-footer {
      padding: .65rem 1rem;
      border-top: 1px solid var(--border);
      display: flex; gap: .5rem;
      flex-shrink: 0;
    }

    /* ── Field list ──────────────────────────────────────────────────── */
    .field-list { display: grid; gap: .45rem; margin-bottom: 1rem; }
    .field-row  { display: grid; grid-template-columns: 100px 1fr; gap: .5rem; font-size: .875rem; }
    .field-label { color: var(--text-muted); font-size: .78rem; padding-top: .12rem; }
    .field-value { font-weight: 500; word-break: break-word; }

    /* ── JSON block ──────────────────────────────────────────────────── */
    .json-block {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: .7rem;
      font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
      font-size: .72rem;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 280px;
      overflow: auto;
      color: var(--text);
    }

    /* ── Buttons ─────────────────────────────────────────────────────── */
    .btn {
      padding: .38rem .8rem;
      border: none; border-radius: var(--radius);
      cursor: pointer; font-size: .875rem; font-weight: 500;
      transition: opacity .13s, transform .08s;
      display: inline-flex; align-items: center; gap: .3rem;
      white-space: nowrap;
    }
    .btn:hover  { opacity: .86; }
    .btn:active { opacity: .72; transform: scale(.98); }
    .btn-primary   { background: var(--primary); color: white; }
    .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text); }
    .btn-danger    { background: var(--danger);  color: white; }
    .btn-ghost     { background: transparent; border: 1px solid transparent; color: var(--text-muted); padding: .3rem .45rem; border-radius: 6px; }
    .btn-ghost:hover { background: var(--surface2); color: var(--text); border-color: var(--border); }
    .btn-sm { padding: .24rem .5rem; font-size: .78rem; }
    .btn-header { color: white !important; border-color: rgba(255,255,255,.35) !important; }

    /* ── Dialog / Modal ──────────────────────────────────────────────── */
    dialog {
      padding: 0; border: none;
      border-radius: calc(var(--radius) * 1.5);
      box-shadow: 0 20px 60px rgba(0,0,0,.3);
      background: var(--surface); color: var(--text);
      width: min(540px, 96vw);
      max-height: 92dvh;
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    dialog::backdrop {
      background: rgba(0,0,0,.45);
      backdrop-filter: blur(3px);
    }
    .dialog-header {
      padding: .9rem 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: .5rem;
      flex-shrink: 0;
    }
    .dialog-header h3 { flex: 1; font-size: 1rem; font-weight: 600; }
    .dialog-body   { padding: 1.25rem; overflow-y: auto; flex: 1; }
    .dialog-footer {
      padding: .7rem 1.25rem;
      border-top: 1px solid var(--border);
      display: flex; justify-content: flex-end; gap: .5rem;
      flex-shrink: 0;
    }

    /* ── Form ────────────────────────────────────────────────────────── */
    .form-group { margin-bottom: .8rem; }
    .form-label {
      display: block;
      font-size: .78rem; font-weight: 500;
      color: var(--text-muted); margin-bottom: .28rem;
    }
    .form-label .req { color: var(--danger); }
    .form-control {
      display: block; width: 100%;
      padding: .42rem .65rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface2); color: var(--text);
      font-size: .875rem;
      font-family: inherit;
    }
    .form-control:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
    textarea.form-control { resize: vertical; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: .65rem; }
    .section-label {
      font-size: .72rem; font-weight: 700;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: .07em; margin: .8rem 0 .45rem;
    }

    /* ── Error list ──────────────────────────────────────────────────── */
    .error-list { margin-top: .5rem; }
    .error-item { font-size: .8rem; color: var(--danger); padding: .22rem 0; }

    /* ── Tabs ────────────────────────────────────────────────────────── */
    .tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
    .tab-btn {
      padding: .48rem 1rem; border: none; background: none;
      font-size: .875rem; cursor: pointer;
      color: var(--text-muted); border-bottom: 2px solid transparent;
      transition: color .1s; font-family: inherit;
    }
    .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 500; }
    .tab-panel       { display: none; }
    .tab-panel.active { display: block; }

    /* ── Toast ───────────────────────────────────────────────────────── */
    .toast-wrap {
      position: fixed; bottom: 1rem; right: 1rem;
      display: flex; flex-direction: column; gap: .45rem;
      z-index: 9999; pointer-events: none;
    }
    .toast {
      padding: .55rem 1rem; border-radius: var(--radius);
      font-size: .875rem; color: white;
      box-shadow: var(--shadow-md);
      animation: toastIn .18s ease forwards;
    }
    .toast-success { background: var(--success); }
    .toast-error   { background: var(--danger); }
    @keyframes toastIn {
      from { transform: translateX(110%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }

    /* ── Section visibility ──────────────────────────────────────────── */
    .app-section { display: none; flex: 1; overflow: hidden; min-height: 0; }
    .app-section.active { display: flex; flex-direction: column; }

    /* ── Mobile overrides ────────────────────────────────────────────── */
    @media (max-width: 600px) {
      .detail-panel.open {
        position: fixed; inset: 0;
        width: 100% !important;
        z-index: 300; border-left: none;
        box-shadow: var(--shadow-md);
      }
      .detail-inner { width: 100%; }
      .td-loc { display: none; }
      .form-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<!-- ── Header ──────────────────────────────────────────────────────────────── -->
<header class="app-header">
  <h1>&#127970; Parties &amp; Contracts Manager</h1>
  <div class="hdr-actions">
    <button class="btn btn-secondary btn-header" id="btn-ai">&#10024; Generate</button>
    <button class="btn btn-primary" id="btn-new">+ New</button>
  </div>
</header>

<!-- ── Section nav ─────────────────────────────────────────────────────────── -->
<nav class="section-nav">
  <button class="section-nav-btn active" data-section="parties">&#128101; Parties</button>
  <button class="section-nav-btn"        data-section="contracts">&#128196; Contracts</button>
</nav>

<!-- ════════════════════════════════════════════════════════════════════════════
     PARTIES SECTION
  ══════════════════════════════════════════════════════════════════════════════ -->
<div class="app-section active" id="section-parties">
  <div class="app-layout">

    <!-- List panel -->
    <div class="list-panel">
      <div class="filters">
        <input id="f-name" type="search" placeholder="Search by name&#8230;" autocomplete="off">
        <select id="f-type">
          <option value="">All types</option>
          <option>Person</option>
          <option>Organization</option>
          <option>LocalBusiness</option>
          <option>InsuranceAgency</option>
          <option>LegalService</option>
          <option>MedicalOrganization</option>
          <option>EducationalOrganization</option>
          <option>GovernmentOrganization</option>
          <option>NGO</option>
          <option>Corporation</option>
        </select>
        <input id="f-loc" type="search" placeholder="Location&#8230;" autocomplete="off">
        <button class="btn btn-secondary btn-sm" id="btn-filter">Filter</button>
        <button class="btn btn-secondary btn-sm" id="btn-reset" title="Clear filters">&#215;</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th class="td-loc">Location</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="party-tbody">
            <tr class="empty-row"><td colspan="4">Loading&#8230;</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail panel -->
    <aside class="detail-panel" id="detail-panel">
      <div class="detail-inner">
        <div class="detail-header">
          <h2 id="detail-name">&#8212;</h2>
          <button class="btn btn-ghost" id="btn-close-detail" title="Close">&#215;</button>
        </div>
        <div class="detail-body" id="detail-body"></div>
        <div class="detail-footer">
          <button class="btn btn-secondary" id="btn-edit-detail">&#9998; Edit</button>
          <button class="btn btn-danger"    id="btn-delete-detail">&#128465; Delete</button>
        </div>
      </div>
    </aside>

  </div>
</div><!-- /#section-parties -->

<!-- ════════════════════════════════════════════════════════════════════════════
     CONTRACTS SECTION
  ══════════════════════════════════════════════════════════════════════════════ -->
<div class="app-section" id="section-contracts">
  <div class="app-layout">

    <!-- List panel -->
    <div class="list-panel">
      <div class="filters">
        <input id="cf-name" type="search" placeholder="Search by name&#8230;" autocomplete="off">
        <select id="cf-type">
          <option value="">All types</option>
          <option>FinancialProduct</option>
          <option>HealthInsurancePlan</option>
        </select>
        <input id="cf-party" type="search" placeholder="Party @id&#8230;" autocomplete="off">
        <button class="btn btn-secondary btn-sm" id="btn-cfilter">Filter</button>
        <button class="btn btn-secondary btn-sm" id="btn-creset" title="Clear filters">&#215;</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th class="td-loc">Provider</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody id="contract-tbody">
            <tr class="empty-row"><td colspan="4">Loading&#8230;</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail panel -->
    <aside class="detail-panel" id="cdetail-panel">
      <div class="detail-inner">
        <div class="detail-header">
          <h2 id="cdetail-name">&#8212;</h2>
          <button class="btn btn-ghost" id="btn-close-cdetail" title="Close">&#215;</button>
        </div>
        <div class="detail-body" id="cdetail-body"></div>
        <div class="detail-footer">
          <button class="btn btn-secondary" id="btn-edit-cdetail">&#9998; Edit</button>
          <button class="btn btn-danger"    id="btn-delete-cdetail">&#128465; Delete</button>
        </div>
      </div>
    </aside>

  </div>
</div><!-- /#section-contracts -->

<!-- ── Party Create / Edit dialog ───────────────────────────────────────────── -->
<dialog id="party-dialog">
  <div class="dialog-header">
    <h3 id="dialog-title">New Party</h3>
    <button class="btn btn-ghost" id="btn-close-dialog">&#215;</button>
  </div>
  <div class="dialog-body">

    <!-- Tabs (hidden on edit) -->
    <div class="tabs" id="dialog-tabs">
      <button class="tab-btn active" data-tab="form">Form</button>
      <button class="tab-btn"        data-tab="ai">&#10024; AI&nbsp;Generate</button>
    </div>

    <!-- Form tab -->
    <div class="tab-panel active" id="tab-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="fp-name">Name <span class="req">*</span></label>
          <input class="form-control" id="fp-name" type="text" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="fp-type">Type <span class="req">*</span></label>
          <select class="form-control" id="fp-type">
            <option>Person</option>
            <option>Organization</option>
            <option>LocalBusiness</option>
            <option>InsuranceAgency</option>
            <option>LegalService</option>
            <option>MedicalOrganization</option>
            <option>EducationalOrganization</option>
            <option>GovernmentOrganization</option>
            <option>NGO</option>
            <option>Corporation</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="fp-desc">Description</label>
        <input class="form-control" id="fp-desc" type="text">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="fp-email">Email</label>
          <input class="form-control" id="fp-email" type="email">
        </div>
        <div class="form-group">
          <label class="form-label" for="fp-phone">Telephone</label>
          <input class="form-control" id="fp-phone" type="text">
        </div>
      </div>

      <div class="section-label">Address</div>
      <div class="form-group">
        <label class="form-label" for="fp-street">Street</label>
        <input class="form-control" id="fp-street" type="text">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="fp-city">City</label>
          <input class="form-control" id="fp-city" type="text">
        </div>
        <div class="form-group">
          <label class="form-label" for="fp-region">Region / State</label>
          <input class="form-control" id="fp-region" type="text">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="fp-postal">Postal Code</label>
          <input class="form-control" id="fp-postal" type="text">
        </div>
        <div class="form-group">
          <label class="form-label" for="fp-country">Country Code</label>
          <input class="form-control" id="fp-country" type="text" placeholder="DE, FR, US&#8230;">
        </div>
      </div>
      <div id="form-errors" class="error-list"></div>
    </div>

    <!-- AI Generate tab -->
    <div class="tab-panel" id="tab-ai">
      <div class="form-group">
        <label class="form-label" for="fp-prompt">
          Describe the party in plain language
        </label>
        <textarea
          class="form-control" id="fp-prompt" rows="5"
          placeholder="e.g. Create a law firm called Dupont &amp; Associates in Lyon with two lawyers."
        ></textarea>
      </div>
      <div id="ai-errors" class="error-list"></div>
    </div>

  </div><!-- /.dialog-body -->
  <div class="dialog-footer">
    <button class="btn btn-secondary" id="btn-cancel-dialog">Cancel</button>
    <button class="btn btn-primary"   id="btn-submit-dialog">Create</button>
  </div>
</dialog>

<!-- ── Contract Create / Edit dialog ────────────────────────────────────────── -->
<dialog id="contract-dialog">
  <div class="dialog-header">
    <h3 id="cdialog-title">New Contract</h3>
    <button class="btn btn-ghost" id="btn-close-cdialog">&#215;</button>
  </div>
  <div class="dialog-body">

    <!-- Tabs (hidden on edit) -->
    <div class="tabs" id="cdialog-tabs">
      <button class="tab-btn active" data-ctab="cform">Form</button>
      <button class="tab-btn"        data-ctab="cai">&#10024; AI&nbsp;Generate</button>
    </div>

    <!-- Form tab -->
    <div class="tab-panel active" id="tab-cform">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="cp-name">Policy Name <span class="req">*</span></label>
          <input class="form-control" id="cp-name" type="text" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="cp-type">Type <span class="req">*</span></label>
          <select class="form-control" id="cp-type">
            <option>FinancialProduct</option>
            <option>HealthInsurancePlan</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="cp-desc">Description</label>
        <input class="form-control" id="cp-desc" type="text">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="cp-valid-from">Valid From</label>
          <input class="form-control" id="cp-valid-from" type="date">
        </div>
        <div class="form-group">
          <label class="form-label" for="cp-valid-through">Valid Through</label>
          <input class="form-control" id="cp-valid-through" type="date">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="cp-fees">Fees &amp; Premiums</label>
        <input class="form-control" id="cp-fees" type="text" placeholder="e.g. Monthly premium: €45.00">
      </div>
      <div class="form-group">
        <label class="form-label" for="cp-area">Area Served</label>
        <input class="form-control" id="cp-area" type="text" placeholder="e.g. DE, Hamburg, Europe">
      </div>

      <div class="section-label">Provider (Insurer) <span class="req">*</span> or Insured Party required</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="cp-provider-name">Provider Name</label>
          <input class="form-control" id="cp-provider-name" type="text" placeholder="Allianz, AOK&#8230;">
        </div>
        <div class="form-group">
          <label class="form-label" for="cp-provider-type">Provider Type</label>
          <select class="form-control" id="cp-provider-type">
            <option value="">— select —</option>
            <option>InsuranceAgency</option>
            <option>Organization</option>
            <option>Corporation</option>
            <option>LocalBusiness</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="cp-provider-id">Provider @id (URI)</label>
        <input class="form-control" id="cp-provider-id" type="text" placeholder="urn:uuid:&#8230;">
      </div>

      <div class="section-label">Insured Party (Policyholder)</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="cp-insured-name">Insured Name</label>
          <input class="form-control" id="cp-insured-name" type="text">
        </div>
        <div class="form-group">
          <label class="form-label" for="cp-insured-type">Insured Type</label>
          <select class="form-control" id="cp-insured-type">
            <option value="">— select —</option>
            <option>Person</option>
            <option>Organization</option>
            <option>Corporation</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="cp-insured-id">Insured @id (URI)</label>
        <input class="form-control" id="cp-insured-id" type="text" placeholder="urn:uuid:&#8230;">
      </div>

      <div id="cform-errors" class="error-list"></div>
    </div>

    <!-- AI Generate tab -->
    <div class="tab-panel" id="tab-cai">
      <div class="form-group">
        <label class="form-label" for="cp-prompt">
          Describe the contract in plain language
        </label>
        <textarea
          class="form-control" id="cp-prompt" rows="5"
          placeholder="e.g. Create a home insurance policy called Komplett-Schutz offered by Allianz to Maria Schmidt."
        ></textarea>
      </div>
      <div id="cai-errors" class="error-list"></div>
    </div>

  </div><!-- /.dialog-body -->
  <div class="dialog-footer">
    <button class="btn btn-secondary" id="btn-cancel-cdialog">Cancel</button>
    <button class="btn btn-primary"   id="btn-submit-cdialog">Create</button>
  </div>
</dialog>

<!-- ── Toast container ──────────────────────────────────────────────────────── -->
<div class="toast-wrap" id="toasts"></div>

<script>
'use strict';

// ── State ────────────────────────────────────────────────────────────────────
var parties    = [];
var activeId   = null;
var editingId  = null;
var activeTab  = 'form';

var contracts   = [];
var cActiveId   = null;
var cEditingId  = null;
var cActiveTab  = 'cform';

var currentSection = 'parties';

// ── Utility ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast toast-' + (type || 'success');
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(function() { el.remove(); }, 4000);
}

function showErrors(containerId, errs) {
  var el = document.getElementById(containerId);
  el.innerHTML = (errs || []).map(function(e) {
    return '<div class="error-item">&#9888; ' + esc(e) + '</div>';
  }).join('');
}

// ── API helpers ──────────────────────────────────────────────────────────────
function apiFetch(path, opts) {
  opts = opts || {};
  var headers = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(path, {
    method:  opts.method  || 'GET',
    headers: headers,
    body:    opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }).then(function(res) {
    if (res.status === 204) return null;
    return res.json().then(function(data) {
      if (!res.ok) {
        var err = new Error(data.error || 'Request failed');
        err.errors = data.errors;
        throw err;
      }
      return data;
    });
  });
}

// ── Section switching ────────────────────────────────────────────────────────
function switchSection(section) {
  currentSection = section;
  document.querySelectorAll('.section-nav-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.section === section);
  });
  document.querySelectorAll('.app-section').forEach(function(s) {
    s.classList.toggle('active', s.id === 'section-' + section);
  });
  document.getElementById('btn-new').textContent = section === 'parties' ? '+ New Party' : '+ New Contract';
  document.getElementById('btn-ai').title = section === 'parties' ? 'AI Generate Party' : 'AI Generate Contract';
}

document.querySelectorAll('.section-nav-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { switchSection(btn.dataset.section); });
});

// ════════════════════════════════════════════════════════════════════════════
// PARTIES
// ════════════════════════════════════════════════════════════════════════════

function loadParties() {
  var qs = new URLSearchParams();
  var name = document.getElementById('f-name').value.trim();
  var type = document.getElementById('f-type').value;
  var loc  = document.getElementById('f-loc').value.trim();
  if (name) qs.set('name',            name);
  if (type) qs.set('type',            type);
  if (loc)  qs.set('addressLocality', loc);

  var tbody = document.getElementById('party-tbody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Loading&#8230;</td></tr>';

  return apiFetch('/parties?' + qs).then(function(data) {
    parties = data;
    renderPartyTable();
  }).catch(function(e) {
    toast(e.message, 'error');
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Failed to load parties.</td></tr>';
  });
}

function renderPartyTable() {
  var tbody = document.getElementById('party-tbody');
  if (!parties.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No parties found. Use &ldquo;+ New Party&rdquo; to add one.</td></tr>';
    return;
  }
  tbody.innerHTML = parties.map(function(p) {
    var loc     = (p.address && p.address.addressLocality) ? p.address.addressLocality : '';
    var isActive = p['@id'] === activeId ? ' class="active"' : '';
    return '<tr data-id="' + esc(p['@id']) + '"' + isActive + '>' +
      '<td class="td-name">'    + esc(p.name)     + '</td>' +
      '<td class="td-type">'    + esc(p['@type']) + '</td>' +
      '<td class="td-loc">'     + esc(loc)         + '</td>' +
      '<td class="td-actions">' +
        '<button class="btn btn-ghost btn-sm btn-edit"   title="Edit">&#9998;</button>' +
        '<button class="btn btn-ghost btn-sm btn-delete" title="Delete">&#128465;</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function findParty(id) {
  for (var i = 0; i < parties.length; i++) {
    if (parties[i]['@id'] === id) return parties[i];
  }
  return null;
}

function openDetail(id) {
  var p = findParty(id);
  if (!p) return;
  activeId = id;
  renderPartyTable();
  document.getElementById('detail-name').textContent = p.name;
  document.getElementById('detail-body').innerHTML   = buildPartyDetailHtml(p);
  document.getElementById('detail-panel').classList.add('open');
}

function buildPartyDetailHtml(p) {
  var addr = p.address || {};
  var rows = [
    ['Type',        esc(p['@type'])],
    p.description   ? ['Description', esc(p.description)]              : null,
    p.email         ? ['Email',        '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>'] : null,
    p.telephone     ? ['Phone',        esc(p.telephone)]                : null,
    addr.streetAddress   ? ['Street',   esc(addr.streetAddress)]        : null,
    addr.addressLocality ? ['City',     esc(addr.addressLocality)]      : null,
    addr.addressRegion   ? ['Region',   esc(addr.addressRegion)]        : null,
    addr.postalCode      ? ['Postal',   esc(addr.postalCode)]           : null,
    addr.addressCountry  ? ['Country',  esc(addr.addressCountry)]       : null,
    ['ID', '<span style="font-family:monospace;font-size:.72rem;word-break:break-all">' + esc(p['@id']) + '</span>'],
  ].filter(Boolean);

  var fieldHtml = '<div class="field-list">' +
    rows.map(function(r) {
      return '<div class="field-row">' +
        '<span class="field-label">' + esc(r[0]) + '</span>' +
        '<span class="field-value">' + r[1] + '</span>' +
      '</div>';
    }).join('') +
  '</div>';

  var jsonHtml = '<div class="section-label">JSON-LD</div>' +
    '<div class="json-block">' + esc(JSON.stringify(p, null, 2)) + '</div>';

  return fieldHtml + jsonHtml;
}

function closeDetail() {
  activeId = null;
  renderPartyTable();
  document.getElementById('detail-panel').classList.remove('open');
}

var FORM_FIELDS = [
  'fp-name','fp-desc','fp-email','fp-phone',
  'fp-street','fp-city','fp-region','fp-postal','fp-country','fp-prompt',
];

function openDialog(partyId) {
  partyId = partyId || null;
  editingId = partyId;
  var isEdit = partyId !== null;

  setTab('form');
  document.getElementById('dialog-title').textContent = isEdit ? 'Edit Party' : 'New Party';
  document.getElementById('dialog-tabs').style.display = isEdit ? 'none' : '';
  document.getElementById('form-errors').innerHTML = '';
  document.getElementById('ai-errors').innerHTML   = '';

  FORM_FIELDS.forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('fp-type').value = 'Person';

  if (isEdit) {
    var p = findParty(partyId);
    if (p) {
      var addr = p.address || {};
      document.getElementById('fp-name').value    = p.name           || '';
      document.getElementById('fp-type').value    = p['@type']       || 'Person';
      document.getElementById('fp-desc').value    = p.description    || '';
      document.getElementById('fp-email').value   = p.email          || '';
      document.getElementById('fp-phone').value   = p.telephone      || '';
      document.getElementById('fp-street').value  = addr.streetAddress    || '';
      document.getElementById('fp-city').value    = addr.addressLocality  || '';
      document.getElementById('fp-region').value  = addr.addressRegion    || '';
      document.getElementById('fp-postal').value  = addr.postalCode       || '';
      document.getElementById('fp-country').value = addr.addressCountry   || '';
    }
  }

  document.getElementById('btn-submit-dialog').textContent = isEdit ? 'Save Changes' : 'Create';
  document.getElementById('party-dialog').showModal();
  document.getElementById('fp-name').focus();
}

function closeDialog() {
  document.getElementById('party-dialog').close();
}

function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#party-dialog .tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('#party-dialog .tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'tab-' + tab);
  });
  var lbl = tab === 'ai' ? 'Generate & Save' : (editingId ? 'Save Changes' : 'Create');
  document.getElementById('btn-submit-dialog').textContent = lbl;
}

function buildPartyFromForm() {
  var name    = document.getElementById('fp-name').value.trim();
  var type    = document.getElementById('fp-type').value;
  var desc    = document.getElementById('fp-desc').value.trim();
  var email   = document.getElementById('fp-email').value.trim();
  var phone   = document.getElementById('fp-phone').value.trim();
  var street  = document.getElementById('fp-street').value.trim();
  var city    = document.getElementById('fp-city').value.trim();
  var region  = document.getElementById('fp-region').value.trim();
  var postal  = document.getElementById('fp-postal').value.trim();
  var country = document.getElementById('fp-country').value.trim();

  if (!name) throw new Error('Name is required.');

  var party = { '@context': 'https://schema.org', '@type': type, name: name };
  if (desc)  party.description = desc;
  if (email) party.email       = email;
  if (phone) party.telephone   = phone;

  if (street || city || region || postal || country) {
    party.address = { '@type': 'PostalAddress' };
    if (street)  party.address.streetAddress   = street;
    if (city)    party.address.addressLocality = city;
    if (region)  party.address.addressRegion   = region;
    if (postal)  party.address.postalCode      = postal;
    if (country) party.address.addressCountry  = country;
  }

  return party;
}

function submitDialog() {
  var btn = document.getElementById('btn-submit-dialog');
  btn.disabled = true;

  var promise;
  if (activeTab === 'ai') {
    var prompt = document.getElementById('fp-prompt').value.trim();
    if (!prompt) {
      showErrors('ai-errors', ['Prompt is required.']);
      btn.disabled = false;
      return;
    }
    promise = apiFetch('/parties/generate', { method: 'POST', body: { prompt: prompt } })
      .then(function(result) {
        var arr = Array.isArray(result) ? result : [result];
        arr.forEach(function(p) { parties.unshift(p); });
        toast('Party generated and saved!');
        closeDialog();
        renderPartyTable();
        if (arr.length) openDetail(arr[0]['@id']);
      })
      .catch(function(e) { showErrors('ai-errors', e.errors || [e.message]); });
  } else {
    var party;
    try { party = buildPartyFromForm(); }
    catch (e) { showErrors('form-errors', [e.message]); btn.disabled = false; return; }

    if (editingId) {
      promise = apiFetch('/parties/' + encodeURIComponent(editingId), { method: 'PATCH', body: party })
        .then(function(updated) {
          for (var i = 0; i < parties.length; i++) {
            if (parties[i]['@id'] === editingId) { parties[i] = updated; break; }
          }
          toast('Party updated.');
          closeDialog();
          renderPartyTable();
          openDetail(editingId);
        })
        .catch(function(e) { showErrors('form-errors', e.errors || [e.message]); });
    } else {
      promise = apiFetch('/parties', { method: 'POST', body: party })
        .then(function(created) {
          parties.unshift(created);
          toast('Party created.');
          closeDialog();
          renderPartyTable();
          openDetail(created['@id']);
        })
        .catch(function(e) { showErrors('form-errors', e.errors || [e.message]); });
    }
  }

  promise.finally(function() { btn.disabled = false; });
}

function deleteParty(id) {
  if (!confirm('Delete this party? This action cannot be undone.')) return;
  apiFetch('/parties/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function() {
      parties = parties.filter(function(p) { return p['@id'] !== id; });
      if (activeId === id) closeDetail();
      renderPartyTable();
      toast('Party deleted.');
    })
    .catch(function(e) { toast(e.message, 'error'); });
}

// ════════════════════════════════════════════════════════════════════════════
// CONTRACTS
// ════════════════════════════════════════════════════════════════════════════

function loadContracts() {
  var qs = new URLSearchParams();
  var name   = document.getElementById('cf-name').value.trim();
  var type   = document.getElementById('cf-type').value;
  var party  = document.getElementById('cf-party').value.trim();
  if (name)  qs.set('name',    name);
  if (type)  qs.set('type',    type);
  if (party) qs.set('partyId', party);

  var tbody = document.getElementById('contract-tbody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Loading&#8230;</td></tr>';

  return apiFetch('/contracts?' + qs).then(function(data) {
    contracts = data;
    renderContractTable();
  }).catch(function(e) {
    toast(e.message, 'error');
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Failed to load contracts.</td></tr>';
  });
}

function renderContractTable() {
  var tbody = document.getElementById('contract-tbody');
  if (!contracts.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No contracts found. Use &ldquo;+ New Contract&rdquo; to add one.</td></tr>';
    return;
  }
  tbody.innerHTML = contracts.map(function(c) {
    var provider = '';
    if (c.provider) {
      provider = typeof c.provider === 'string' ? c.provider : (c.provider.name || '');
    } else if (c.offeredBy) {
      provider = typeof c.offeredBy === 'string' ? c.offeredBy : (c.offeredBy.name || '');
    }
    var isActive = c['@id'] === cActiveId ? ' class="active"' : '';
    return '<tr data-id="' + esc(c['@id']) + '"' + isActive + '>' +
      '<td class="td-name">'    + esc(c.name)     + '</td>' +
      '<td class="td-type">'    + esc(c['@type']) + '</td>' +
      '<td class="td-loc">'     + esc(provider)    + '</td>' +
      '<td class="td-actions">' +
        '<button class="btn btn-ghost btn-sm btn-cedit"   title="Edit">&#9998;</button>' +
        '<button class="btn btn-ghost btn-sm btn-cdelete" title="Delete">&#128465;</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function findContract(id) {
  for (var i = 0; i < contracts.length; i++) {
    if (contracts[i]['@id'] === id) return contracts[i];
  }
  return null;
}

function openCDetail(id) {
  var c = findContract(id);
  if (!c) return;
  cActiveId = id;
  renderContractTable();
  document.getElementById('cdetail-name').textContent = c.name;
  document.getElementById('cdetail-body').innerHTML   = buildContractDetailHtml(c);
  document.getElementById('cdetail-panel').classList.add('open');
}

function refLabel(ref) {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  var parts = [];
  if (ref.name) parts.push(ref.name);
  if (ref['@type']) parts.push('(' + ref['@type'] + ')');
  return parts.join(' ') || ref['@id'] || '';
}

function buildContractDetailHtml(c) {
  var rows = [
    ['Type',        esc(c['@type'])],
    c.description              ? ['Description',  esc(c.description)]              : null,
    c.identifier               ? ['Identifier',   esc(c.identifier)]               : null,
    (c.provider || c.offeredBy) ? ['Provider',    esc(refLabel(c.provider || c.offeredBy))] : null,
    c.insuredParty             ? ['Insured',       esc(refLabel(c.insuredParty))]   : null,
    c.areaServed               ? ['Area Served',   esc(c.areaServed)]               : null,
    c.validFrom                ? ['Valid From',    esc(c.validFrom)]                : null,
    c.validThrough             ? ['Valid Through', esc(c.validThrough)]             : null,
    c.feesAndCommissionsSpecification ? ['Fees', esc(c.feesAndCommissionsSpecification)] : null,
    ['ID', '<span style="font-family:monospace;font-size:.72rem;word-break:break-all">' + esc(c['@id']) + '</span>'],
  ].filter(Boolean);

  var fieldHtml = '<div class="field-list">' +
    rows.map(function(r) {
      return '<div class="field-row">' +
        '<span class="field-label">' + esc(r[0]) + '</span>' +
        '<span class="field-value">' + r[1] + '</span>' +
      '</div>';
    }).join('') +
  '</div>';

  var jsonHtml = '<div class="section-label">JSON-LD</div>' +
    '<div class="json-block">' + esc(JSON.stringify(c, null, 2)) + '</div>';

  return fieldHtml + jsonHtml;
}

function closeCDetail() {
  cActiveId = null;
  renderContractTable();
  document.getElementById('cdetail-panel').classList.remove('open');
}

var CONTRACT_FORM_FIELDS = [
  'cp-name','cp-desc','cp-valid-from','cp-valid-through','cp-fees','cp-area',
  'cp-provider-name','cp-provider-id','cp-insured-name','cp-insured-id','cp-prompt',
];

function openCDialog(contractId) {
  contractId = contractId || null;
  cEditingId = contractId;
  var isEdit = contractId !== null;

  setCTab('cform');
  document.getElementById('cdialog-title').textContent = isEdit ? 'Edit Contract' : 'New Contract';
  document.getElementById('cdialog-tabs').style.display = isEdit ? 'none' : '';
  document.getElementById('cform-errors').innerHTML = '';
  document.getElementById('cai-errors').innerHTML   = '';

  CONTRACT_FORM_FIELDS.forEach(function(id) { document.getElementById(id).value = ''; });
  document.getElementById('cp-type').value          = 'FinancialProduct';
  document.getElementById('cp-provider-type').value = '';
  document.getElementById('cp-insured-type').value  = '';

  if (isEdit) {
    var c = findContract(contractId);
    if (c) {
      document.getElementById('cp-name').value         = c.name          || '';
      document.getElementById('cp-type').value         = c['@type']      || 'FinancialProduct';
      document.getElementById('cp-desc').value         = c.description   || '';
      document.getElementById('cp-valid-from').value   = c.validFrom     || '';
      document.getElementById('cp-valid-through').value = c.validThrough || '';
      document.getElementById('cp-fees').value         = c.feesAndCommissionsSpecification || '';
      document.getElementById('cp-area').value         = c.areaServed    || '';
      var prov = c.provider || c.offeredBy;
      if (prov && typeof prov === 'object') {
        document.getElementById('cp-provider-name').value = prov.name      || '';
        document.getElementById('cp-provider-type').value = prov['@type']  || '';
        document.getElementById('cp-provider-id').value   = prov['@id']    || '';
      }
      if (c.insuredParty && typeof c.insuredParty === 'object') {
        document.getElementById('cp-insured-name').value = c.insuredParty.name     || '';
        document.getElementById('cp-insured-type').value = c.insuredParty['@type'] || '';
        document.getElementById('cp-insured-id').value   = c.insuredParty['@id']   || '';
      }
    }
  }

  document.getElementById('btn-submit-cdialog').textContent = isEdit ? 'Save Changes' : 'Create';
  document.getElementById('contract-dialog').showModal();
  document.getElementById('cp-name').focus();
}

function closeCDialog() {
  document.getElementById('contract-dialog').close();
}

function setCTab(tab) {
  cActiveTab = tab;
  document.querySelectorAll('#contract-dialog .tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.ctab === tab);
  });
  document.querySelectorAll('#contract-dialog .tab-panel').forEach(function(p) {
    p.classList.toggle('active', p.id === 'tab-' + tab);
  });
  var lbl = tab === 'cai' ? 'Generate & Save' : (cEditingId ? 'Save Changes' : 'Create');
  document.getElementById('btn-submit-cdialog').textContent = lbl;
}

function buildContractFromForm() {
  var name         = document.getElementById('cp-name').value.trim();
  var type         = document.getElementById('cp-type').value;
  var desc         = document.getElementById('cp-desc').value.trim();
  var validFrom    = document.getElementById('cp-valid-from').value.trim();
  var validThrough = document.getElementById('cp-valid-through').value.trim();
  var fees         = document.getElementById('cp-fees').value.trim();
  var area         = document.getElementById('cp-area').value.trim();
  var provName     = document.getElementById('cp-provider-name').value.trim();
  var provType     = document.getElementById('cp-provider-type').value;
  var provId       = document.getElementById('cp-provider-id').value.trim();
  var insName      = document.getElementById('cp-insured-name').value.trim();
  var insType      = document.getElementById('cp-insured-type').value;
  var insId        = document.getElementById('cp-insured-id').value.trim();

  if (!name) throw new Error('Policy name is required.');
  if (!provName && !provId && !insName && !insId) {
    throw new Error('At least one party reference is required: Provider or Insured Party.');
  }

  var contract = { '@context': 'https://schema.org', '@type': type, name: name };
  if (desc)         contract.description = desc;
  if (validFrom)    contract.validFrom   = validFrom;
  if (validThrough) contract.validThrough = validThrough;
  if (fees)         contract.feesAndCommissionsSpecification = fees;
  if (area)         contract.areaServed  = area;

  if (provName || provId) {
    contract.provider = {};
    if (provType) contract.provider['@type'] = provType;
    if (provId)   contract.provider['@id']   = provId;
    if (provName) contract.provider.name      = provName;
  }

  if (insName || insId) {
    contract.insuredParty = {};
    if (insType) contract.insuredParty['@type'] = insType;
    if (insId)   contract.insuredParty['@id']   = insId;
    if (insName) contract.insuredParty.name      = insName;
  }

  return contract;
}

function submitCDialog() {
  var btn = document.getElementById('btn-submit-cdialog');
  btn.disabled = true;

  var promise;
  if (cActiveTab === 'cai') {
    var prompt = document.getElementById('cp-prompt').value.trim();
    if (!prompt) {
      showErrors('cai-errors', ['Prompt is required.']);
      btn.disabled = false;
      return;
    }
    promise = apiFetch('/contracts/generate', { method: 'POST', body: { prompt: prompt } })
      .then(function(result) {
        var arr = Array.isArray(result) ? result : [result];
        arr.forEach(function(c) { contracts.unshift(c); });
        toast('Contract generated and saved!');
        closeCDialog();
        renderContractTable();
        if (arr.length) openCDetail(arr[0]['@id']);
      })
      .catch(function(e) { showErrors('cai-errors', e.errors || [e.message]); });
  } else {
    var contract;
    try { contract = buildContractFromForm(); }
    catch (e) { showErrors('cform-errors', [e.message]); btn.disabled = false; return; }

    if (cEditingId) {
      promise = apiFetch('/contracts/' + encodeURIComponent(cEditingId), { method: 'PATCH', body: contract })
        .then(function(updated) {
          for (var i = 0; i < contracts.length; i++) {
            if (contracts[i]['@id'] === cEditingId) { contracts[i] = updated; break; }
          }
          toast('Contract updated.');
          closeCDialog();
          renderContractTable();
          openCDetail(cEditingId);
        })
        .catch(function(e) { showErrors('cform-errors', e.errors || [e.message]); });
    } else {
      promise = apiFetch('/contracts', { method: 'POST', body: contract })
        .then(function(created) {
          contracts.unshift(created);
          toast('Contract created.');
          closeCDialog();
          renderContractTable();
          openCDetail(created['@id']);
        })
        .catch(function(e) { showErrors('cform-errors', e.errors || [e.message]); });
    }
  }

  promise.finally(function() { btn.disabled = false; });
}

function deleteContract(id) {
  if (!confirm('Delete this contract? This action cannot be undone.')) return;
  apiFetch('/contracts/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function() {
      contracts = contracts.filter(function(c) { return c['@id'] !== id; });
      if (cActiveId === id) closeCDetail();
      renderContractTable();
      toast('Contract deleted.');
    })
    .catch(function(e) { toast(e.message, 'error'); });
}

// ── Header button routing ─────────────────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', function() {
  if (currentSection === 'parties') openDialog();
  else openCDialog();
});
document.getElementById('btn-ai').addEventListener('click', function() {
  if (currentSection === 'parties') { openDialog(); setTab('ai'); }
  else { openCDialog(); setCTab('cai'); }
});

// ── Party event wiring ────────────────────────────────────────────────────────
document.getElementById('btn-filter').addEventListener('click', loadParties);
document.getElementById('btn-reset').addEventListener('click', function() {
  document.getElementById('f-name').value = '';
  document.getElementById('f-type').value = '';
  document.getElementById('f-loc').value  = '';
  loadParties();
});

['f-name', 'f-type', 'f-loc'].forEach(function(id) {
  document.getElementById(id).addEventListener('keydown', function(e) {
    if (e.key === 'Enter') loadParties();
  });
});

document.getElementById('party-tbody').addEventListener('click', function(e) {
  var row = e.target.closest('tr[data-id]');
  if (!row) return;
  var id = row.dataset.id;
  if (e.target.closest('.btn-edit'))   { openDialog(id); return; }
  if (e.target.closest('.btn-delete')) { deleteParty(id); return; }
  openDetail(id);
});

document.getElementById('btn-close-detail').addEventListener('click', closeDetail);
document.getElementById('btn-edit-detail').addEventListener('click', function() {
  if (activeId) openDialog(activeId);
});
document.getElementById('btn-delete-detail').addEventListener('click', function() {
  if (activeId) deleteParty(activeId);
});

document.getElementById('btn-close-dialog').addEventListener('click', closeDialog);
document.getElementById('btn-cancel-dialog').addEventListener('click', closeDialog);
document.getElementById('btn-submit-dialog').addEventListener('click', submitDialog);

document.querySelectorAll('#party-dialog .tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { setTab(btn.dataset.tab); });
});

document.getElementById('party-dialog').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeDialog();
});
document.getElementById('party-dialog').addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeDialog();
});

// ── Contract event wiring ─────────────────────────────────────────────────────
document.getElementById('btn-cfilter').addEventListener('click', loadContracts);
document.getElementById('btn-creset').addEventListener('click', function() {
  document.getElementById('cf-name').value  = '';
  document.getElementById('cf-type').value  = '';
  document.getElementById('cf-party').value = '';
  loadContracts();
});

['cf-name', 'cf-type', 'cf-party'].forEach(function(id) {
  document.getElementById(id).addEventListener('keydown', function(e) {
    if (e.key === 'Enter') loadContracts();
  });
});

document.getElementById('contract-tbody').addEventListener('click', function(e) {
  var row = e.target.closest('tr[data-id]');
  if (!row) return;
  var id = row.dataset.id;
  if (e.target.closest('.btn-cedit'))   { openCDialog(id); return; }
  if (e.target.closest('.btn-cdelete')) { deleteContract(id); return; }
  openCDetail(id);
});

document.getElementById('btn-close-cdetail').addEventListener('click', closeCDetail);
document.getElementById('btn-edit-cdetail').addEventListener('click', function() {
  if (cActiveId) openCDialog(cActiveId);
});
document.getElementById('btn-delete-cdetail').addEventListener('click', function() {
  if (cActiveId) deleteContract(cActiveId);
});

document.getElementById('btn-close-cdialog').addEventListener('click', closeCDialog);
document.getElementById('btn-cancel-cdialog').addEventListener('click', closeCDialog);
document.getElementById('btn-submit-cdialog').addEventListener('click', submitCDialog);

document.querySelectorAll('#contract-dialog .tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { setCTab(btn.dataset.ctab); });
});

document.getElementById('contract-dialog').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) closeCDialog();
});
document.getElementById('contract-dialog').addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeCDialog();
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
loadParties();
loadContracts();
</script>
</body>
</html>`;
