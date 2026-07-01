/* =========================================================
   app.js — controller: navigation, render loop, and a single
   delegated click handler for all data-action buttons.
   ========================================================= */
(function () {
  "use strict";

  const TITLES = {
    dashboard: "Dashboard",
    income: "Income",
    expenses: "Expenses",
    debts: "Who Owes Me",
    clients: "Clients",
    invoices: "Invoices",
    notes: "Notes & Reminders"
  };

  const App = {
    current: "dashboard",

    render() {
      const view = Views[this.current];
      document.getElementById("pageTitle").textContent = TITLES[this.current] || "";
      document.getElementById("viewRoot").innerHTML = view ? view() : "";
    },

    go(view) {
      if (!Views[view]) return;
      this.current = view;
      document.querySelectorAll(".nav-item").forEach((b) =>
        b.classList.toggle("active", b.dataset.view === view));
      this.render();
    }
  };

  // Topbar setter used by views
  UI.setTopbar = function (html) {
    document.getElementById("topbarActions").innerHTML = html || "";
  };

  /* ---------------- navigation ---------------- */
  document.querySelector(".nav").addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (btn) App.go(btn.dataset.view);
  });

  /* ---------------- modal close ---------------- */
  document.getElementById("modalClose").addEventListener("click", () => UI.closeModal());
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") UI.closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") UI.closeModal();
  });

  /* ---------------- global action delegation ---------------- */
  document.body.addEventListener("click", (e) => {
    // generic close buttons inside forms
    if (e.target.closest("[data-close]")) { UI.closeModal(); return; }

    const el = e.target.closest("[data-action]");
    if (!el) return;
    const { action, id, type } = el.dataset;

    switch (action) {
      /* transactions */
      case "add-tx": Views.openTxForm(type); break;
      case "edit-tx": Views.openTxForm(type, id); break;
      case "del-tx":
        if (UI.confirm("Delete this transaction?")) { Store.remove("transactions", id); UI.toast("Deleted"); App.render(); }
        break;

      /* clients */
      case "add-client": Views.openClientForm(); break;
      case "edit-client": Views.openClientForm(id); break;
      case "del-client":
        if (UI.confirm("Delete this client? Their invoices and transactions will remain.")) {
          Store.remove("clients", id); UI.toast("Deleted"); App.render();
        }
        break;

      /* invoices */
      case "new-invoice": Views.openInvoiceForm(); break;
      case "edit-invoice": UI.closeModal(); Views.openInvoiceForm(id); break;
      case "view-invoice": Views.viewInvoice(id); break;
      case "invoice-settings": Views.openInvoiceSettings(); break;
      case "del-invoice":
        if (UI.confirm("Delete this invoice?")) { Store.remove("invoices", id); UI.toast("Deleted"); App.render(); }
        break;
      case "mark-paid":
        Store.markInvoicePaid(id); UI.closeModal(); UI.toast("Marked paid — income recorded", "ok"); App.render();
        break;
      case "mark-unpaid":
        Store.markInvoiceUnpaid(id); UI.toast("Marked unpaid"); App.render();
        break;

      /* notes */
      case "add-note": Views.openNoteForm(); break;
      case "edit-note": Views.openNoteForm(id); break;
      case "toggle-note": {
        const n = Store.find("notes", id);
        if (n) { Store.update("notes", id, { done: !n.done }); App.render(); }
        break;
      }
      case "pin-note": {
        const n = Store.find("notes", id);
        if (n) { Store.update("notes", id, { pinned: !n.pinned }); App.render(); }
        break;
      }
      case "del-note":
        if (UI.confirm("Delete this note?")) { Store.remove("notes", id); UI.toast("Deleted"); App.render(); }
        break;
    }
  });

  /* ---------------- backup / restore ---------------- */
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `webbiz-backup-${UI.today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast("Backup downloaded", "ok");
  });
  document.getElementById("importBtn").addEventListener("click", () =>
    document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (!UI.confirm("This will replace all current data with the backup. Continue?")) return;
        Store.importJSON(reader.result);
        UI.toast("Data restored", "ok");
        App.go("dashboard");
      } catch (err) {
        console.error(err);
        UI.toast("Could not read that file", "err");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  /* ---------------- boot ---------------- */
  window.App = App;
  App.render();
})();
