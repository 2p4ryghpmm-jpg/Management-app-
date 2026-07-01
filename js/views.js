/* =========================================================
   views.js — renders each screen and wires its actions.
   Each view returns HTML into #viewRoot and sets topbar
   action buttons. Invoices live in invoice.js.
   ========================================================= */
(function () {
  "use strict";

  const Views = {};

  /* ================= DASHBOARD ================= */
  Views.dashboard = function () {
    const inc = Store.totalIncome();
    const exp = Store.totalExpenses();
    const net = Store.netProfit();
    const owed = Store.outstanding();
    const overdueCount = Store.invoices().filter((i) => Store.isOverdue(i)).length;
    const recent = Store.transactions().slice(0, 6);
    const series = Store.monthlySeries(6);
    const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));

    const dueReminders = Store.notes()
      .filter((n) => !n.done && n.dueDate)
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
      .slice(0, 5);

    UI.setTopbar("");

    const bars = series.map((s) => `
      <div class="col">
        <div class="bars">
          <div class="bar inc" style="height:${(s.income / max) * 100}%" title="Income: ${UI.money(s.income)}"></div>
          <div class="bar exp" style="height:${(s.expense / max) * 100}%" title="Expenses: ${UI.money(s.expense)}"></div>
        </div>
        <div class="lbl">${s.label}</div>
      </div>`).join("");

    const recentRows = recent.length ? recent.map((t) => `
      <tr>
        <td>${UI.date(t.date)}</td>
        <td>${UI.esc(t.description || t.category || "—")}</td>
        <td><span class="badge ${t.type}">${t.type}</span></td>
        <td class="num ${t.type === "income" ? "pos" : "neg"}">${t.type === "income" ? "+" : "-"}${UI.money(t.amount)}</td>
      </tr>`).join("") : `<tr><td colspan="4" class="empty" style="border:none">No transactions yet — add income or expenses to get started.</td></tr>`;

    const remindersHTML = dueReminders.length ? dueReminders.map((n) => {
      const overdue = n.dueDate < UI.today();
      return `<div class="note-meta" style="padding:10px 0;border-bottom:1px solid rgba(44,51,88,0.5)">
        <span>${UI.esc(n.title)}</span>
        <span class="chip ${overdue ? "overdue" : "due"}">${overdue ? "Overdue " : "Due "}${UI.date(n.dueDate)}</span>
      </div>`;
    }).join("") : `<p class="hint">No upcoming reminders. Add some in Notes &amp; Reminders.</p>`;

    return `
      <div class="stat-grid">
        <div class="stat-card green">
          <div class="label">Total Income</div>
          <div class="value">${UI.money(inc)}</div>
          <div class="sub">${Store.income().length} payment(s) recorded</div>
        </div>
        <div class="stat-card red">
          <div class="label">Total Expenses</div>
          <div class="value">${UI.money(exp)}</div>
          <div class="sub">${Store.expenses().length} expense(s) recorded</div>
        </div>
        <div class="stat-card ${net >= 0 ? "green" : "red"}">
          <div class="label">Net Profit</div>
          <div class="value">${UI.money(net)}</div>
          <div class="sub">Income minus expenses</div>
        </div>
        <div class="stat-card amber">
          <div class="label">Owed To You</div>
          <div class="value">${UI.money(owed)}</div>
          <div class="sub">${overdueCount ? overdueCount + " overdue" : "Unpaid invoices"}</div>
        </div>
      </div>

      <div class="two-col">
        <div class="panel">
          <div class="panel-head"><h3>Income vs Expenses</h3><span class="hint">Last 6 months</span></div>
          <div class="chart">${bars}</div>
          <div class="legend">
            <span><i class="dot inc"></i> Income</span>
            <span><i class="dot exp"></i> Expenses</span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Upcoming Reminders</h3><span class="hint">${dueReminders.length} item(s)</span></div>
          ${remindersHTML}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Recent Activity</h3><span class="hint">Latest transactions</span></div>
        <table class="table">
          <thead><tr><th>Date</th><th>Description</th><th>Type</th><th class="num">Amount</th></tr></thead>
          <tbody>${recentRows}</tbody>
        </table>
      </div>
    `;
  };

  /* ================= TRANSACTIONS (income / expenses) ================= */
  function transactionView(type) {
    const list = type === "income" ? Store.income() : Store.expenses();
    const total = list.reduce((s, t) => s + Number(t.amount || 0), 0);
    const label = type === "income" ? "Income" : "Expense";

    UI.setTopbar(`<button class="btn" data-action="add-tx" data-type="${type}">＋ Add ${label}</button>`);

    const rows = list.length ? list.map((t) => `
      <tr>
        <td>${UI.date(t.date)}</td>
        <td>${UI.esc(t.description || "—")}</td>
        <td>${UI.esc(t.category || "—")}</td>
        <td>${t.clientId ? UI.esc(Store.clientName(t.clientId)) : "—"}</td>
        <td class="num ${type === "income" ? "pos" : "neg"}">${UI.money(t.amount)}</td>
        <td class="num">
          <div class="row-actions">
            <button class="icon-btn" data-action="edit-tx" data-id="${t.id}" data-type="${type}" title="Edit">✎</button>
            <button class="icon-btn" data-action="del-tx" data-id="${t.id}" title="Delete">🗑</button>
          </div>
        </td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty" style="border:none"><span class="big">${type === "income" ? "↑" : "↓"}</span>No ${type} recorded yet. Click "Add ${label}" to start.</td></tr>`;

    return `
      <div class="stat-grid">
        <div class="stat-card ${type === "income" ? "green" : "red"}">
          <div class="label">Total ${label}</div>
          <div class="value">${UI.money(total)}</div>
          <div class="sub">${list.length} entr${list.length === 1 ? "y" : "ies"}</div>
        </div>
      </div>
      <div class="panel">
        <table class="table">
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Client</th><th class="num">Amount</th><th class="num">Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }
  Views.income = () => transactionView("income");
  Views.expenses = () => transactionView("expense");

  function txForm(type, tx) {
    const clientOpts = ['<option value="">— None —</option>']
      .concat(Store.clients().map((c) => `<option value="${c.id}" ${tx && tx.clientId === c.id ? "selected" : ""}>${UI.esc(c.name)}</option>`))
      .join("");
    const categories = type === "income"
      ? ["Website build", "Retainer", "Maintenance", "Hosting", "Consulting", "Invoice payment", "Other"]
      : ["Software / SaaS", "Hosting / Domains", "Advertising", "Contractors", "Hardware", "Fees", "Other"];
    const catOpts = categories.map((c) => `<option ${tx && tx.category === c ? "selected" : ""}>${c}</option>`).join("");
    return `
      <form id="txForm" class="form-grid">
        <div class="field">
          <label>Amount (${Store.settings.currency})</label>
          <input name="amount" type="number" step="0.01" min="0" required value="${tx ? tx.amount : ""}" placeholder="0.00" />
        </div>
        <div class="field">
          <label>Date</label>
          <input name="date" type="date" required value="${tx ? tx.date : UI.today()}" />
        </div>
        <div class="field">
          <label>Category</label>
          <select name="category">${catOpts}</select>
        </div>
        <div class="field">
          <label>Client (optional)</label>
          <select name="clientId">${clientOpts}</select>
        </div>
        <div class="field full">
          <label>Description</label>
          <input name="description" value="${tx ? UI.esc(tx.description) : ""}" placeholder="What was this for?" />
        </div>
        <div class="form-actions full">
          <button type="button" class="btn secondary" data-close>Cancel</button>
          <button type="submit" class="btn">${tx ? "Save changes" : "Add " + (type === "income" ? "income" : "expense")}</button>
        </div>
      </form>`;
  }
  Views.openTxForm = function (type, id) {
    const tx = id ? Store.find("transactions", id) : null;
    const title = (tx ? "Edit " : "Add ") + (type === "income" ? "Income" : "Expense");
    UI.openModal(title, txForm(type, tx));
    document.getElementById("txForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = {
        type,
        amount: parseFloat(f.amount.value) || 0,
        date: f.date.value,
        category: f.category.value,
        clientId: f.clientId.value || null,
        description: f.description.value.trim()
      };
      if (tx) Store.update("transactions", id, payload);
      else Store.add("transactions", payload);
      UI.closeModal();
      UI.toast(tx ? "Updated" : "Added", "ok");
      App.render();
    });
  };

  /* ================= WHO OWES ME ================= */
  Views.debts = function () {
    const unpaid = Store.invoices().filter((i) => i.status !== "paid");
    const owed = Store.outstanding();
    // group by client
    const byClient = {};
    for (const inv of unpaid) {
      const key = inv.clientId || "none";
      byClient[key] = byClient[key] || { name: Store.clientName(inv.clientId), total: 0, invoices: [] };
      byClient[key].total += Store.invoiceTotal(inv).total;
      byClient[key].invoices.push(inv);
    }
    const groups = Object.values(byClient).sort((a, b) => b.total - a.total);

    UI.setTopbar(`<button class="btn" data-action="new-invoice">＋ New Invoice</button>`);

    if (!unpaid.length) {
      return `<div class="empty"><span class="big">✓</span>Nobody owes you money right now. Any unpaid invoices will show up here.</div>`;
    }

    const rows = unpaid.sort((a, b) => (a.dueDate || "") < (b.dueDate || "") ? -1 : 1).map((inv) => {
      const overdue = Store.isOverdue(inv);
      return `<tr>
        <td>${UI.esc(inv.number)}</td>
        <td>${UI.esc(Store.clientName(inv.clientId))}</td>
        <td>${UI.date(inv.dueDate)}</td>
        <td><span class="badge ${overdue ? "overdue" : "unpaid"}">${overdue ? "overdue" : "unpaid"}</span></td>
        <td class="num">${UI.money(Store.invoiceTotal(inv).total)}</td>
        <td class="num"><div class="row-actions">
          <button class="btn small" data-action="mark-paid" data-id="${inv.id}">Mark paid</button>
          <button class="icon-btn" data-action="view-invoice" data-id="${inv.id}" title="View">👁</button>
        </div></td>
      </tr>`;
    }).join("");

    const summary = groups.map((g) => `
      <div class="note-meta" style="padding:12px 0;border-bottom:1px solid rgba(44,51,88,0.5)">
        <span><strong>${UI.esc(g.name)}</strong> · ${g.invoices.length} invoice(s)</span>
        <span class="neg" style="font-weight:700">${UI.money(g.total)}</span>
      </div>`).join("");

    return `
      <div class="stat-grid">
        <div class="stat-card amber">
          <div class="label">Total Outstanding</div>
          <div class="value">${UI.money(owed)}</div>
          <div class="sub">${unpaid.length} unpaid invoice(s)</div>
        </div>
      </div>
      <div class="two-col">
        <div class="panel">
          <div class="panel-head"><h3>Unpaid Invoices</h3></div>
          <table class="table">
            <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th>Status</th><th class="num">Amount</th><th class="num">Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>By Client</h3></div>
          ${summary}
        </div>
      </div>`;
  };

  /* ================= CLIENTS ================= */
  Views.clients = function () {
    const clients = Store.clients();
    UI.setTopbar(`<button class="btn" data-action="add-client">＋ Add Client</button>`);

    if (!clients.length) {
      return `<div class="empty"><span class="big">☺</span>No clients yet. Add the people and companies you work with.</div>`;
    }
    const rows = clients.map((c) => {
      const paid = Store.invoices().filter((i) => i.clientId === c.id && i.status === "paid")
        .reduce((s, i) => s + Store.invoiceTotal(i).total, 0);
      const owes = Store.invoices().filter((i) => i.clientId === c.id && i.status !== "paid")
        .reduce((s, i) => s + Store.invoiceTotal(i).total, 0);
      return `<tr>
        <td><strong>${UI.esc(c.name)}</strong>${c.company ? `<div class="hint">${UI.esc(c.company)}</div>` : ""}</td>
        <td>${UI.esc(c.email || "—")}</td>
        <td>${UI.esc(c.phone || "—")}</td>
        <td class="num pos">${UI.money(paid)}</td>
        <td class="num ${owes ? "neg" : ""}">${UI.money(owes)}</td>
        <td class="num"><div class="row-actions">
          <button class="icon-btn" data-action="edit-client" data-id="${c.id}" title="Edit">✎</button>
          <button class="icon-btn" data-action="del-client" data-id="${c.id}" title="Delete">🗑</button>
        </div></td>
      </tr>`;
    }).join("");
    return `<div class="panel">
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th class="num">Paid</th><th class="num">Owes</th><th class="num">Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  };
  Views.openClientForm = function (id) {
    const c = id ? Store.find("clients", id) : null;
    UI.openModal((c ? "Edit" : "Add") + " Client", `
      <form id="clientForm" class="form-grid">
        <div class="field full"><label>Name *</label><input name="name" required value="${c ? UI.esc(c.name) : ""}" placeholder="Jane Doe" /></div>
        <div class="field"><label>Company</label><input name="company" value="${c ? UI.esc(c.company) : ""}" placeholder="Acme Inc." /></div>
        <div class="field"><label>Phone</label><input name="phone" value="${c ? UI.esc(c.phone) : ""}" placeholder="+1 555 000 0000" /></div>
        <div class="field full"><label>Email</label><input name="email" type="email" value="${c ? UI.esc(c.email) : ""}" placeholder="jane@acme.com" /></div>
        <div class="field full"><label>Address</label><textarea name="address" placeholder="Billing address (appears on invoices)">${c ? UI.esc(c.address) : ""}</textarea></div>
        <div class="form-actions full">
          <button type="button" class="btn secondary" data-close>Cancel</button>
          <button type="submit" class="btn">${c ? "Save changes" : "Add client"}</button>
        </div>
      </form>`);
    document.getElementById("clientForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = {
        name: f.name.value.trim(), company: f.company.value.trim(),
        phone: f.phone.value.trim(), email: f.email.value.trim(), address: f.address.value.trim()
      };
      if (c) Store.update("clients", id, payload); else Store.add("clients", payload);
      UI.closeModal(); UI.toast("Saved", "ok"); App.render();
    });
  };

  /* ================= NOTES & REMINDERS ================= */
  Views.notes = function () {
    const notes = Store.notes();
    UI.setTopbar(`<button class="btn" data-action="add-note">＋ New Note</button>`);

    if (!notes.length) {
      return `<div class="help-note">Jot down anything you're working on, need to follow up on, or want to remember. Add a due date to turn a note into a reminder — it'll show on your dashboard.</div>
        <div class="empty"><span class="big">✎</span>No notes yet. Click "New Note" to capture your first idea or task.</div>`;
    }

    const cards = notes.map((n) => {
      const overdue = n.dueDate && !n.done && n.dueDate < UI.today();
      const dueChip = n.dueDate
        ? `<span class="chip ${overdue ? "overdue" : "due"}">${overdue ? "Overdue " : "Due "}${UI.date(n.dueDate)}</span>`
        : "";
      return `<div class="note-card ${n.pinned ? "pinned" : ""} ${n.done ? "done" : ""}">
        <h4 class="${n.done ? "struck" : ""}">${n.pinned ? "📌 " : ""}${UI.esc(n.title)}</h4>
        ${n.body ? `<p>${UI.esc(n.body)}</p>` : ""}
        <div class="note-meta">
          ${dueChip || `<span class="chip">${UI.date(new Date(n.createdAt).toISOString())}</span>`}
          <div class="note-actions">
            <button class="icon-btn" data-action="toggle-note" data-id="${n.id}" title="${n.done ? "Mark active" : "Mark done"}">${n.done ? "↺" : "✓"}</button>
            <button class="icon-btn" data-action="pin-note" data-id="${n.id}" title="Pin">📌</button>
            <button class="icon-btn" data-action="edit-note" data-id="${n.id}" title="Edit">✎</button>
            <button class="icon-btn" data-action="del-note" data-id="${n.id}" title="Delete">🗑</button>
          </div>
        </div>
      </div>`;
    }).join("");
    return `<div class="notes-grid">${cards}</div>`;
  };
  Views.openNoteForm = function (id) {
    const n = id ? Store.find("notes", id) : null;
    UI.openModal((n ? "Edit" : "New") + " Note", `
      <form id="noteForm" class="form-grid">
        <div class="field full"><label>Title *</label><input name="title" required value="${n ? UI.esc(n.title) : ""}" placeholder="e.g. Finish homepage for Acme" /></div>
        <div class="field full"><label>Details</label><textarea name="body" placeholder="Anything you want to remember...">${n ? UI.esc(n.body) : ""}</textarea></div>
        <div class="field"><label>Reminder date (optional)</label><input name="dueDate" type="date" value="${n && n.dueDate ? n.dueDate : ""}" /></div>
        <div class="field"><label>&nbsp;</label><label style="flex-direction:row;display:flex;align-items:center;gap:8px;color:var(--text)"><input type="checkbox" name="pinned" ${n && n.pinned ? "checked" : ""} style="width:auto"/> Pin to top</label></div>
        <div class="form-actions full">
          <button type="button" class="btn secondary" data-close>Cancel</button>
          <button type="submit" class="btn">${n ? "Save changes" : "Add note"}</button>
        </div>
      </form>`);
    document.getElementById("noteForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const payload = {
        title: f.title.value.trim(), body: f.body.value.trim(),
        dueDate: f.dueDate.value || null, pinned: f.pinned.checked
      };
      if (n) Store.update("notes", id, payload);
      else Store.add("notes", { ...payload, done: false, createdAt: Date.now() });
      UI.closeModal(); UI.toast("Saved", "ok"); App.render();
    });
  };

  window.Views = Views;
})();
