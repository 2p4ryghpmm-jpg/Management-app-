/* =========================================================
   store.js — data layer backed by localStorage
   All app data lives under a single key. Every mutation
   persists immediately so nothing is lost on refresh.
   ========================================================= */
(function () {
  "use strict";

  const KEY = "webbiz.data.v1";

  const DEFAULT_DATA = {
    settings: {
      businessName: "My Web Studio",
      businessEmail: "",
      currency: "$",
      invoicePrefix: "INV",
      nextInvoiceNo: 1,
      taxRate: 0
    },
    clients: [],
    transactions: [], // {id, type:'income'|'expense', amount, category, date, description, clientId}
    invoices: [],     // {id, number, clientId, issueDate, dueDate, items:[{description,qty,rate}], taxRate, notes, status:'unpaid'|'paid', paidDate}
    notes: []         // {id, title, body, pinned, done, dueDate, createdAt}
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const parsed = JSON.parse(raw);
      // merge to be resilient to older/newer shapes
      return {
        ...structuredClone(DEFAULT_DATA),
        ...parsed,
        settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) }
      };
    } catch (e) {
      console.error("Failed to load data, starting fresh", e);
      return structuredClone(DEFAULT_DATA);
    }
  }

  let data = load();

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Persist failed", e);
    }
  }

  const Store = {
    /* ---- raw access ---- */
    get all() { return data; },
    get settings() { return data.settings; },

    updateSettings(patch) {
      Object.assign(data.settings, patch);
      persist();
    },

    /* ---- generic collection helpers ---- */
    _list(coll) { return data[coll]; },

    add(coll, obj) {
      const item = { id: uid(), ...obj };
      data[coll].unshift(item);
      persist();
      return item;
    },
    update(coll, id, patch) {
      const item = data[coll].find((x) => x.id === id);
      if (item) { Object.assign(item, patch); persist(); }
      return item;
    },
    remove(coll, id) {
      data[coll] = data[coll].filter((x) => x.id !== id);
      persist();
    },
    find(coll, id) { return data[coll].find((x) => x.id === id); },

    /* ---- clients ---- */
    clients() { return data.clients; },
    clientName(id) {
      const c = data.clients.find((x) => x.id === id);
      return c ? c.name : "—";
    },

    /* ---- transactions ---- */
    transactions() { return data.transactions.slice().sort((a, b) => (a.date < b.date ? 1 : -1)); },
    income() { return this.transactions().filter((t) => t.type === "income"); },
    expenses() { return this.transactions().filter((t) => t.type === "expense"); },

    totalIncome() { return this.income().reduce((s, t) => s + Number(t.amount || 0), 0); },
    totalExpenses() { return this.expenses().reduce((s, t) => s + Number(t.amount || 0), 0); },
    netProfit() { return this.totalIncome() - this.totalExpenses(); },

    /* ---- invoices ---- */
    invoices() { return data.invoices.slice(); },
    invoiceTotal(inv) {
      const sub = (inv.items || []).reduce((s, it) => s + Number(it.qty || 0) * Number(it.rate || 0), 0);
      const tax = sub * (Number(inv.taxRate || 0) / 100);
      return { subtotal: sub, tax, total: sub + tax };
    },
    outstanding() {
      // money owed to me = unpaid invoices
      return this.invoices()
        .filter((i) => i.status !== "paid")
        .reduce((s, i) => s + this.invoiceTotal(i).total, 0);
    },
    isOverdue(inv) {
      if (inv.status === "paid" || !inv.dueDate) return false;
      return new Date(inv.dueDate) < new Date(new Date().toDateString());
    },
    nextInvoiceNumber() {
      const s = data.settings;
      return `${s.invoicePrefix}-${String(s.nextInvoiceNo).padStart(4, "0")}`;
    },
    bumpInvoiceNumber() {
      data.settings.nextInvoiceNo = Number(data.settings.nextInvoiceNo || 1) + 1;
      persist();
    },
    /* When an invoice is marked paid, record income automatically */
    markInvoicePaid(id) {
      const inv = this.find("invoices", id);
      if (!inv || inv.status === "paid") return;
      inv.status = "paid";
      inv.paidDate = new Date().toISOString().slice(0, 10);
      const { total } = this.invoiceTotal(inv);
      this.add("transactions", {
        type: "income",
        amount: total,
        category: "Invoice payment",
        date: inv.paidDate,
        description: `Payment for ${inv.number} — ${this.clientName(inv.clientId)}`,
        clientId: inv.clientId,
        invoiceId: inv.id
      });
      persist();
    },
    markInvoiceUnpaid(id) {
      const inv = this.find("invoices", id);
      if (!inv) return;
      inv.status = "unpaid";
      inv.paidDate = null;
      // remove the auto-created income record if present
      data.transactions = data.transactions.filter((t) => t.invoiceId !== inv.id);
      persist();
    },

    /* ---- notes ---- */
    notes() {
      return data.notes.slice().sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },

    /* ---- backup / restore ---- */
    exportJSON() { return JSON.stringify(data, null, 2); },
    importJSON(json) {
      const parsed = JSON.parse(json);
      data = { ...structuredClone(DEFAULT_DATA), ...parsed,
        settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) } };
      persist();
    },

    /* ---- monthly aggregation for charts ---- */
    monthlySeries(months = 6) {
      const now = new Date();
      const out = [];
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString("en", { month: "short" });
        let inc = 0, exp = 0;
        for (const t of data.transactions) {
          if ((t.date || "").slice(0, 7) === key) {
            if (t.type === "income") inc += Number(t.amount || 0);
            else exp += Number(t.amount || 0);
          }
        }
        out.push({ key, label, income: inc, expense: exp });
      }
      return out;
    }
  };

  window.Store = Store;
})();
