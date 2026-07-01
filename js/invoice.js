/* =========================================================
   invoice.js — invoice list, builder, preview and print/PDF.
   Invoice numbers auto-increment. Line-item totals + tax are
   computed live. "Print / Save as PDF" uses the browser's
   print dialog (works fully offline).
   ========================================================= */
(function () {
  "use strict";

  const Views = window.Views;

  /* ---------------- list view ---------------- */
  Views.invoices = function () {
    const invoices = Store.invoices().sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
    UI.setTopbar(`
      <button class="btn secondary" data-action="invoice-settings">⚙ Settings</button>
      <button class="btn" data-action="new-invoice">＋ New Invoice</button>`);

    if (!invoices.length) {
      return `<div class="help-note">Create professional invoices in seconds. The number is generated automatically, totals and tax are calculated for you, and you can print or save any invoice as a PDF. Marking an invoice paid records the income on your dashboard automatically.</div>
        <div class="empty"><span class="big">▤</span>No invoices yet. Click "New Invoice" to create your first one.</div>`;
    }

    const paidTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Store.invoiceTotal(i).total, 0);
    const rows = invoices.map((inv) => {
      const overdue = Store.isOverdue(inv);
      const status = inv.status === "paid" ? "paid" : (overdue ? "overdue" : "unpaid");
      return `<tr>
        <td><strong>${UI.esc(inv.number)}</strong></td>
        <td>${UI.esc(Store.clientName(inv.clientId))}</td>
        <td>${UI.date(inv.issueDate)}</td>
        <td>${UI.date(inv.dueDate)}</td>
        <td><span class="badge ${status}">${status}</span></td>
        <td class="num">${UI.money(Store.invoiceTotal(inv).total)}</td>
        <td class="num"><div class="row-actions">
          <button class="icon-btn" data-action="view-invoice" data-id="${inv.id}" title="View / Print">👁</button>
          ${inv.status === "paid"
            ? `<button class="btn small secondary" data-action="mark-unpaid" data-id="${inv.id}">Unmark</button>`
            : `<button class="btn small" data-action="mark-paid" data-id="${inv.id}">Mark paid</button>`}
          <button class="icon-btn" data-action="edit-invoice" data-id="${inv.id}" title="Edit">✎</button>
          <button class="icon-btn" data-action="del-invoice" data-id="${inv.id}" title="Delete">🗑</button>
        </div></td>
      </tr>`;
    }).join("");

    return `
      <div class="stat-grid">
        <div class="stat-card accent"><div class="label">Total Invoices</div><div class="value">${invoices.length}</div></div>
        <div class="stat-card green"><div class="label">Collected</div><div class="value">${UI.money(paidTotal)}</div></div>
        <div class="stat-card amber"><div class="label">Outstanding</div><div class="value">${UI.money(Store.outstanding())}</div></div>
      </div>
      <div class="panel">
        <table class="table">
          <thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Due</th><th>Status</th><th class="num">Total</th><th class="num">Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  /* ---------------- builder ---------------- */
  function itemRow(item) {
    item = item || { description: "", qty: 1, rate: 0 };
    return `<div class="line-item-row">
      <input class="li-desc" placeholder="Description of work" value="${UI.esc(item.description)}" />
      <input class="li-qty" type="number" step="0.01" min="0" placeholder="Qty" value="${item.qty}" />
      <input class="li-rate" type="number" step="0.01" min="0" placeholder="Rate" value="${item.rate}" />
      <button type="button" class="icon-btn" data-remove-item title="Remove">✕</button>
    </div>`;
  }

  Views.openInvoiceForm = function (id) {
    const inv = id ? Store.find("invoices", id) : null;
    const clients = Store.clients();
    if (!clients.length) {
      UI.openModal("Add a client first", `
        <p class="hint" style="margin-bottom:16px">You need at least one client before creating an invoice.</p>
        <div class="form-actions"><button class="btn" data-action="add-client">＋ Add Client</button></div>`);
      return;
    }
    const clientOpts = clients.map((c) => `<option value="${c.id}" ${inv && inv.clientId === c.id ? "selected" : ""}>${UI.esc(c.name)}</option>`).join("");
    const items = inv ? inv.items : [{ description: "", qty: 1, rate: 0 }];
    const number = inv ? inv.number : Store.nextInvoiceNumber();

    UI.openModal((inv ? "Edit" : "New") + " Invoice", `
      <form id="invForm">
        <div class="form-grid">
          <div class="field"><label>Invoice number</label><input name="number" value="${UI.esc(number)}" ${inv ? "" : "readonly"} /></div>
          <div class="field"><label>Client</label><select name="clientId">${clientOpts}</select></div>
          <div class="field"><label>Issue date</label><input name="issueDate" type="date" value="${inv ? inv.issueDate : UI.today()}" /></div>
          <div class="field"><label>Due date</label><input name="dueDate" type="date" value="${inv ? inv.dueDate : UI.addDays(UI.today(), 14)}" /></div>
        </div>

        <div class="panel-head" style="margin:20px 0 10px"><h3 style="font-size:14px">Line items</h3></div>
        <div id="lineItems">${items.map(itemRow).join("")}</div>
        <button type="button" class="btn secondary small" id="addItemBtn" style="margin-top:6px">＋ Add line</button>

        <div class="form-grid" style="margin-top:18px">
          <div class="field"><label>Tax rate (%)</label><input name="taxRate" type="number" step="0.01" min="0" value="${inv ? inv.taxRate : Store.settings.taxRate}" /></div>
          <div class="field"><label>Total preview</label><input id="totalPreview" readonly value="" style="font-weight:700" /></div>
          <div class="field full"><label>Notes / payment terms</label><textarea name="notes" placeholder="Thank you for your business! Payment due within 14 days...">${inv ? UI.esc(inv.notes) : "Thank you for your business!"}</textarea></div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn secondary" data-close>Cancel</button>
          <button type="submit" class="btn">${inv ? "Save invoice" : "Create invoice"}</button>
        </div>
      </form>`);

    const form = document.getElementById("invForm");
    const itemsBox = document.getElementById("lineItems");

    function recalc() {
      let sub = 0;
      itemsBox.querySelectorAll(".line-item-row").forEach((row) => {
        const q = parseFloat(row.querySelector(".li-qty").value) || 0;
        const r = parseFloat(row.querySelector(".li-rate").value) || 0;
        sub += q * r;
      });
      const taxRate = parseFloat(form.taxRate.value) || 0;
      const total = sub + sub * (taxRate / 100);
      document.getElementById("totalPreview").value = UI.money(total);
    }

    document.getElementById("addItemBtn").addEventListener("click", () => {
      itemsBox.insertAdjacentHTML("beforeend", itemRow());
      recalc();
    });
    itemsBox.addEventListener("click", (e) => {
      if (e.target.closest("[data-remove-item]")) {
        if (itemsBox.querySelectorAll(".line-item-row").length > 1) e.target.closest(".line-item-row").remove();
        recalc();
      }
    });
    form.addEventListener("input", recalc);
    recalc();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const itemData = [];
      itemsBox.querySelectorAll(".line-item-row").forEach((row) => {
        const description = row.querySelector(".li-desc").value.trim();
        const qty = parseFloat(row.querySelector(".li-qty").value) || 0;
        const rate = parseFloat(row.querySelector(".li-rate").value) || 0;
        if (description || qty || rate) itemData.push({ description, qty, rate });
      });
      if (!itemData.length) { UI.toast("Add at least one line item", "err"); return; }

      const payload = {
        number: form.number.value.trim(),
        clientId: form.clientId.value,
        issueDate: form.issueDate.value,
        dueDate: form.dueDate.value,
        items: itemData,
        taxRate: parseFloat(form.taxRate.value) || 0,
        notes: form.notes.value.trim()
      };
      if (inv) {
        Store.update("invoices", id, payload);
      } else {
        Store.add("invoices", { ...payload, status: "unpaid", paidDate: null });
        Store.bumpInvoiceNumber();
      }
      UI.closeModal();
      UI.toast(inv ? "Invoice saved" : "Invoice created", "ok");
      App.render();
    });
  };

  /* ---------------- preview / print ---------------- */
  Views.viewInvoice = function (id) {
    const inv = Store.find("invoices", id);
    if (!inv) return;
    const client = Store.find("clients", inv.clientId) || {};
    const s = Store.settings;
    const { subtotal, tax, total } = Store.invoiceTotal(inv);
    const overdue = Store.isOverdue(inv);
    const status = inv.status === "paid" ? "PAID" : (overdue ? "OVERDUE" : "DUE");

    const rows = inv.items.map((it) => `
      <tr>
        <td>${UI.esc(it.description)}</td>
        <td class="r">${it.qty}</td>
        <td class="r">${UI.money(it.rate)}</td>
        <td class="r">${UI.money(Number(it.qty) * Number(it.rate))}</td>
      </tr>`).join("");

    UI.openModal("Invoice " + inv.number, `
      <div class="no-print" style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:16px">
        ${inv.status === "paid" ? "" : `<button class="btn secondary small" data-action="mark-paid" data-id="${inv.id}">Mark paid</button>`}
        <button class="btn secondary small" data-action="edit-invoice" data-id="${inv.id}">Edit</button>
        <button class="btn small" onclick="window.print()">🖶 Print / Save as PDF</button>
      </div>
      <div class="invoice-doc" id="invoiceDoc">
        <div class="inv-top">
          <div>
            <h2>INVOICE</h2>
            <div class="muted2">${UI.esc(s.businessName)}</div>
            ${s.businessEmail ? `<div class="muted2">${UI.esc(s.businessEmail)}</div>` : ""}
          </div>
          <div class="inv-meta">
            <div style="font-size:18px;font-weight:800;color:#2b2f77">${UI.esc(inv.number)}</div>
            <div class="muted2">Issued: ${UI.date(inv.issueDate)}</div>
            <div class="muted2">Due: ${UI.date(inv.dueDate)}</div>
            <div style="margin-top:6px;font-weight:800;color:${inv.status === "paid" ? "#1f9c74" : (overdue ? "#c34452" : "#b8860b")}">${status}</div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <div>
            <div class="muted2" style="text-transform:uppercase;letter-spacing:1px;font-size:11px">Bill to</div>
            <div style="font-weight:700">${UI.esc(client.name || "—")}</div>
            ${client.company ? `<div class="muted2">${UI.esc(client.company)}</div>` : ""}
            ${client.email ? `<div class="muted2">${UI.esc(client.email)}</div>` : ""}
            ${client.address ? `<div class="muted2" style="white-space:pre-wrap">${UI.esc(client.address)}</div>` : ""}
          </div>
        </div>

        <table>
          <thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totals">
          <div class="row"><span>Subtotal</span><span>${UI.money(subtotal)}</span></div>
          ${inv.taxRate ? `<div class="row"><span>Tax (${inv.taxRate}%)</span><span>${UI.money(tax)}</span></div>` : ""}
          <div class="row grand"><span>Total</span><span>${UI.money(total)}</span></div>
        </div>

        ${inv.notes ? `<div class="inv-note">${UI.esc(inv.notes)}</div>` : ""}
      </div>`);
  };

  /* ---------------- invoice settings ---------------- */
  Views.openInvoiceSettings = function () {
    const s = Store.settings;
    UI.openModal("Invoice & Business Settings", `
      <form id="setForm" class="form-grid">
        <div class="field full"><label>Business name</label><input name="businessName" value="${UI.esc(s.businessName)}" /></div>
        <div class="field"><label>Business email</label><input name="businessEmail" value="${UI.esc(s.businessEmail)}" /></div>
        <div class="field"><label>Currency symbol</label><input name="currency" value="${UI.esc(s.currency)}" maxlength="3" /></div>
        <div class="field"><label>Invoice prefix</label><input name="invoicePrefix" value="${UI.esc(s.invoicePrefix)}" /></div>
        <div class="field"><label>Next invoice #</label><input name="nextInvoiceNo" type="number" min="1" value="${s.nextInvoiceNo}" /></div>
        <div class="field"><label>Default tax rate (%)</label><input name="taxRate" type="number" step="0.01" min="0" value="${s.taxRate}" /></div>
        <div class="form-actions full">
          <button type="button" class="btn secondary" data-close>Cancel</button>
          <button type="submit" class="btn">Save settings</button>
        </div>
      </form>`);
    document.getElementById("setForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      Store.updateSettings({
        businessName: f.businessName.value.trim() || "My Web Studio",
        businessEmail: f.businessEmail.value.trim(),
        currency: f.currency.value.trim() || "$",
        invoicePrefix: f.invoicePrefix.value.trim() || "INV",
        nextInvoiceNo: parseInt(f.nextInvoiceNo.value) || 1,
        taxRate: parseFloat(f.taxRate.value) || 0
      });
      UI.closeModal(); UI.toast("Settings saved", "ok"); App.render();
    });
  };
})();
