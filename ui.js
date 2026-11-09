/* MeetExpert — balao de status e modal de fim de reuniao
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */
/* ============================================================
   ui.js — balao de status (pill) + modal de transcricao
   Tudo em Shadow DOM: o CSS do Meet/Teams nao afeta o nosso
   e o nosso nao vaza para a pagina.
   ============================================================ */

const MCG_UI = (() => {
  let host = null;
  let shadow = null;
  let pill = null;
  let onOpen = null; // callback do botao "Abrir"

  const STATES = {
    waiting: { color: "#9aa0a6", pulse: false, text: "Aguardando legendas\u2026" },
    capturing: { color: "#ea4335", pulse: true, text: "Gravando transcri\u00e7\u00e3o" },
    saving: { color: "#f9ab00", pulse: true, text: "Salvando transcri\u00e7\u00e3o\u2026" },
    saved: { color: "#1e8e3e", pulse: false, text: "Transcri\u00e7\u00e3o salva" },
    error: { color: "#d93025", pulse: false, text: "Falha ao salvar" },
  };

  function ensureHost() {
    if (host && document.documentElement.contains(host)) return;
    host = document.createElement("div");
    host.id = "mcg-host";
    host.style.cssText = "position:fixed;inset:auto;z-index:2147483647;";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host{all:initial;}
        *{box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}
        .pill{position:fixed;left:16px;bottom:96px;display:flex;align-items:center;gap:9px;
              background:rgba(26,20,84,.95);color:#fff;padding:9px 14px;border-radius:999px;
              font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.35);
              backdrop-filter:blur(6px);transition:opacity .25s, transform .25s;
              opacity:0;transform:translateY(8px);pointer-events:auto;max-width:320px;}
        .pill.show{opacity:1;transform:translateY(0);}
        .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#9aa0a6;}
        .dot.pulse{animation:p 1.4s ease-in-out infinite;}
        @keyframes p{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(.75);}}
        .label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .count{opacity:.6;font-variant-numeric:tabular-nums;}
        .act{font:inherit;font-size:12px;font-weight:600;padding:4px 11px;border-radius:999px;
             border:0;background:#ff6b57;color:#fff;cursor:pointer;white-space:nowrap;}
        .act:hover{filter:brightness(1.08);}
        .x{cursor:pointer;opacity:.5;padding:0 2px;font-size:15px;line-height:1;}
        .x:hover{opacity:1;}

        .ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;
            align-items:center;justify-content:center;padding:20px;}
        .card{background:#fff;color:#1f1f1f;width:min(700px,94vw);max-height:88vh;
              border-radius:14px;overflow:hidden;display:flex;flex-direction:column;
              box-shadow:0 16px 56px rgba(0,0,0,.45);}
        .card header{padding:18px 22px;border-bottom:1px solid #e8eaed;}
        .card h2{margin:0 0 8px;font-size:17px;font-weight:600;}
        .meta{font-size:12px;color:#5f6368;line-height:1.65;}
        .badge{display:inline-block;background:#e8f0fe;color:#1967d2;border-radius:4px;
               padding:1px 7px;font-size:11px;font-weight:600;margin-left:6px;}
        .body{padding:14px 22px;overflow-y:auto;font-size:13px;line-height:1.65;flex:1;}
        .line{margin-bottom:5px;}
        .t{color:#9aa0a6;font-variant-numeric:tabular-nums;font-size:12px;}
        .spk{font-weight:600;color:#1967d2;}
        .card footer{padding:14px 22px;border-top:1px solid #e8eaed;display:flex;gap:8px;
                     justify-content:flex-end;flex-wrap:wrap;}
        .btn{font:inherit;font-size:13px;padding:9px 16px;border-radius:8px;border:1px solid #dadce0;
             background:#fff;color:#1f1f1f;cursor:pointer;}
        .btn:hover{background:#f1f3f4;}
        .btn.primary{background:#1a73e8;color:#fff;border-color:#1a73e8;}
        .btn.primary:hover{filter:brightness(1.07);}
        .hash{font-size:10px;color:#80868b;word-break:break-all;margin-top:7px;}
      </style>
      <div class="pill" part="pill">
        <span class="dot"></span>
        <span class="label"></span>
        <span class="count"></span>
        <button class="act" hidden></button>
        <span class="x" hidden>&times;</span>
      </div>`;
    document.documentElement.appendChild(host);
    pill = {
      el: shadow.querySelector(".pill"),
      dot: shadow.querySelector(".dot"),
      label: shadow.querySelector(".label"),
      count: shadow.querySelector(".count"),
      act: shadow.querySelector(".act"),
      x: shadow.querySelector(".x"),
    };
    pill.x.onclick = () => pill.el.classList.remove("show");
    pill.act.onclick = () => onOpen && onOpen();
  }

  /* estado do balao: 'waiting'|'capturing'|'saving'|'saved'|'error' */
  function setState(state, opts = {}) {
    ensureHost();
    const s = STATES[state] || STATES.waiting;
    pill.dot.style.background = s.color;
    pill.dot.classList.toggle("pulse", s.pulse);
    pill.label.textContent = opts.text || s.text;
    pill.count.textContent = opts.count ? `\u00b7 ${opts.count}` : "";
    const showAct = !!opts.actionLabel;
    pill.act.hidden = !showAct;
    pill.act.textContent = opts.actionLabel || "Abrir";
    pill.x.hidden = !showAct;
    onOpen = opts.onAction || null;
    pill.el.classList.add("show");
    if (opts.autoHideMs) {
      setTimeout(() => pill.el.classList.remove("show"), opts.autoHideMs);
    }
  }

  function hide() {
    if (pill) pill.el.classList.remove("show");
  }

  /* ---------------------- modal ---------------------- */
  function showModal(rec, txt, hash, filename, helpers) {
    ensureHost();
    shadow.querySelectorAll(".ov").forEach((n) => n.remove()); // nunca empilha modal
    const wrap = document.createElement("div");
    wrap.className = "ov";
    wrap.innerHTML = `
      <div class="card">
        <header>
          <h2>${helpers.esc(rec.title)}<span class="badge">${helpers.esc(rec.platform)}</span></h2>
          <div class="meta">
            C\u00f3digo: ${helpers.esc(rec.meetingId)} &nbsp;&middot;&nbsp; ${helpers.fmtDate(rec.startedAt)}
            &nbsp;&middot;&nbsp; Dura\u00e7\u00e3o ${helpers.mmss(rec.durationMs)}${helpers.live ? ' <span class="badge">ao vivo \u00b7 parcial</span>' : ""}<br>
            Participantes: ${helpers.esc(rec.participants.join(", ") || "\u2014")}<br>
            ${rec.entries.length} trechos
            <div class="hash">SHA-256${helpers.live ? " (parcial)" : ""}: ${hash}</div>
          </div>
        </header>
        <div class="body">${(helpers.merge ? helpers.merge(rec.entries) : rec.entries)
          .map(
            (e) =>
              `<div class="line"><span class="t">[${helpers.mmss(e.tRelMs)}]</span> ` +
              `<span class="spk">${helpers.esc(e.speaker)}:</span> ${helpers.esc(e.text)}</div>`
          )
          .join("")}</div>
        <footer>
          <button class="btn" data-a="copy">Copiar</button>
          <button class="btn" data-a="close">Fechar</button>
          <button class="btn primary" data-a="dl">Baixar .txt</button>
        </footer>
      </div>`;
    shadow.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector('[data-a="dl"]').onclick = () => helpers.download(filename, txt);
    wrap.querySelector('[data-a="copy"]').onclick = () => navigator.clipboard.writeText(txt);
    wrap.querySelector('[data-a="close"]').onclick = close;
    wrap.onclick = (ev) => { if (ev.target === wrap) close(); };
  }

  return { setState, hide, showModal };
})();
