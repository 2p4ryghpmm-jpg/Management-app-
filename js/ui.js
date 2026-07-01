/* =========================================================
   ui.js — shared helpers: formatting, modal, toast, escaping
   ========================================================= */
(function () {
  "use strict";

  const UI = {
    /* ---- formatting ---- */
    money(n) {
      const cur = (window.Store && Store.settings.currency) || "$";
      const num = Number(n || 0);
      const s = Math.abs(num).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return (num < 0 ? "-" : "") + cur + s;
    },
    date(d) {
      if (!d) return "—";
      const dt = new Date(d);
      if (isNaN(dt)) return d;
      return dt.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
    },
    today() { return new Date().toISOString().slice(0, 10); },
    addDays(dateStr, days) {
      const d = new Date(dateStr || UI.today());
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    },
    esc(str) {
      return String(str == null ? "" : str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    },

    /* ---- toast ---- */
    toast(msg, kind) {
      const el = document.getElementById("toast");
      el.textContent = msg;
      el.className = "toast" + (kind ? " " + kind : "");
      el.hidden = false;
      clearTimeout(UI._toastT);
      UI._toastT = setTimeout(() => { el.hidden = true; }, 2600);
    },

    /* ---- modal ---- */
    openModal(title, bodyHTML) {
      document.getElementById("modalTitle").textContent = title;
      document.getElementById("modalBody").innerHTML = bodyHTML;
      document.getElementById("modalOverlay").hidden = false;
    },
    closeModal() {
      document.getElementById("modalOverlay").hidden = true;
      document.getElementById("modalBody").innerHTML = "";
    },

    /* ---- confirm ---- */
    confirm(message) { return window.confirm(message); }
  };

  window.UI = UI;
})();
