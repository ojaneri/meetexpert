/* MeetExpert — balao de status, modal de transcricao e painel flutuante de Live Analysis
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */

const MCG_UI = (() => {
  let host = null;
  let shadow = null;
  let pill = null;
  let livePanel = null;
  let onOpen = null; // callback do botao "Abrir transcricao"
  let onLiveRequest = null; // callback para disparar analise na LLM

  const STATES = {
    waiting: { color: "#9aa0a6", pulse: false, text: "Aguardando legendas\u2026" },
    capturing: { color: "#ea4335", pulse: true, text: "Gravando transcri\u00e7\u00e3o" },
    saving: { color: "#f9ab00", pulse: true, text: "Salvando transcri\u00e7\u00e3o\u2026" },
    saved: { color: "#1e8e3e", pulse: false, text: "Transcri\u00e7\u00e3o salva" },
    error: { color: "#d93025", pulse: false, text: "Falha ao salvar" },
  };

  const liveState = {
    intervalMs: 60000,
    lastUpdate: Date.now(),
    pending: false,
    timer: null,
    history: [],
    isOpen: false,
  };

  const esc = (s) => String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

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

        /* Balao flutuante de gravacao */
        .pill{position:fixed;left:16px;bottom:96px;display:flex;align-items:center;gap:8px;
              background:rgba(26,20,84,.95);color:#fff;padding:8px 14px;border-radius:999px;
              font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.35);
              backdrop-filter:blur(6px);transition:opacity .25s, transform .25s;
              opacity:0;transform:translateY(8px);pointer-events:auto;max-width:440px;}
        .pill.show{opacity:1;transform:translateY(0);}
        .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#9aa0a6;}
        .dot.pulse{animation:p 1.4s ease-in-out infinite;}
        @keyframes p{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(.75);}}
        .label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .count{opacity:.6;font-variant-numeric:tabular-nums;}
        .act{font:inherit;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;
             border:0;background:#392a9c;color:#fff;cursor:pointer;white-space:nowrap;transition:filter .2s;}
        .act:hover{filter:brightness(1.15);}
        .btn-live-toggle{font:inherit;font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;
                         border:0;background:#ff6b57;color:#fff;cursor:pointer;white-space:nowrap;
                         box-shadow:0 2px 8px rgba(255,107,87,.4);transition:filter .2s;}
        .btn-live-toggle:hover{filter:brightness(1.12);}
        .x{cursor:pointer;opacity:.5;padding:0 2px;font-size:15px;line-height:1;}
        .x:hover{opacity:1;}

        /* Painel flutuante de Live Analysis */
        .live-panel{position:fixed;top:72px;right:20px;width:360px;max-height:76vh;min-height:0;
                    display:flex;flex-direction:column;background:rgba(20,16,64,.97);color:#fff;
                    border-radius:14px;box-shadow:0 12px 48px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.14);
                    overflow:hidden;backdrop-filter:blur(10px);pointer-events:auto;z-index:2147483647;}
        .live-panel[hidden]{display:none !important;}
        .lp-hd{display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:move;user-select:none;
               background:rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.1);}
        .lp-dot{width:8px;height:8px;border-radius:50%;background:#2fe08a;box-shadow:0 0 8px #2fe08a;
                animation:pulse 1.6s infinite;flex:0 0 auto;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
        .lp-title{font-size:12.5px;font-weight:700;flex:1;letter-spacing:.02em;}
        .lp-time{font-size:11px;opacity:.6;font-variant-numeric:tabular-nums;}
        .lp-spin{width:11px;height:11px;border:2px solid rgba(255,255,255,.2);border-top-color:#f9ab00;
                 border-radius:50%;animation:sp .7s linear infinite;display:none;flex:0 0 auto;}
        @keyframes sp{to{transform:rotate(360deg);}}
        .live-panel.busy .lp-spin{display:inline-block;}
        .live-panel.busy .lp-dot{opacity:.3;}
        .lp-ctrl{cursor:pointer;opacity:.65;font-size:15px;line-height:1;padding:0 5px;transition:opacity .15s;}
        .lp-ctrl:hover{opacity:1;}

        .lp-bd{padding:12px 14px;overflow-y:auto;font-size:12.5px;line-height:1.55;flex:1;min-height:0;}
        .lp-sec{margin-bottom:12px;}
        .lp-sec:last-child{margin-bottom:0;}
        .lp-sec h4{margin:0 0 5px;font-size:10.5px;text-transform:uppercase;letter-spacing:.8px;opacity:.55;font-weight:700;}
        .lp-summary{color:#e8e8ff;white-space:pre-line;}
        .lp-sugg{background:rgba(47,224,138,.12);border:1px solid rgba(47,224,138,.35);border-radius:9px;
                 padding:8px 11px;color:#dfffe9;font-weight:500;white-space:pre-line;}
        .lp-sugg.empty{opacity:.45;background:none;border-style:dashed;font-weight:normal;}

        .lp-histbtn{cursor:pointer;user-select:none;}
        .lp-histbtn:hover{opacity:1;}
        .lp-hist{max-height:190px;overflow-y:auto;border:1px solid rgba(255,255,255,.1);border-radius:8px;
                 padding:6px 9px;background:rgba(0,0,0,.22);margin-top:5px;}
        .lp-hist[hidden]{display:none;}
        .lp-hi{border-bottom:1px dashed rgba(255,255,255,.12);padding:6px 0;font-size:11.5px;line-height:1.45;}
        .lp-hi:last-child{border-bottom:0;}
        .lp-ht{font-size:10px;opacity:.55;font-variant-numeric:tabular-nums;margin-bottom:2px;}
        .lp-hs{color:#e8e8ff;}
        .lp-hg{color:#bff7d8;margin-top:3px;}

        .lp-ft{padding:8px 12px;border-top:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.22);
               display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .lp-refresh{font:inherit;font-size:12px;font-weight:600;border:0;border-radius:7px;
                    padding:5px 10px;background:#ff6b57;color:#fff;cursor:pointer;white-space:nowrap;}
        .lp-refresh:hover{filter:brightness(1.1);}
        .lp-slider{flex:1;min-width:80px;accent-color:#2fe08a;cursor:pointer;}
        .lp-every{font-size:11px;opacity:.8;white-space:nowrap;}
        .lp-count{font-size:11px;color:#2fe08a;white-space:nowrap;width:100%;text-align:right;}
        .lp-count.upd{color:#f9ab00;}
        .live-panel.min .lp-bd, .live-panel.min .lp-ft{display:none;}

        /* Modal de transcricao */
        .ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;
            align-items:center;justify-content:center;padding:20px;z-index:2147483647;}
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

      <!-- Pill inferior -->
      <div class="pill" part="pill">
        <span class="dot"></span>
        <span class="label"></span>
        <span class="count"></span>
        <button class="act" hidden></button>
        <button class="btn-live-toggle" title="Abrir/Fechar Live Analysis com IA">⚡ Live Analysis</button>
        <span class="x" hidden>&times;</span>
      </div>

      <!-- Painel flutuante de Live Analysis -->
      <div class="live-panel" id="livePanel" hidden>
        <div class="lp-hd">
          <span class="lp-dot"></span>
          <span class="lp-title">MeetExpert · Live Analysis</span>
          <span class="lp-time"></span>
          <span class="lp-spin"></span>
          <span class="lp-ctrl lp-min" title="Minimizar / Expandir">—</span>
          <span class="lp-ctrl lp-close" title="Fechar painel">&times;</span>
        </div>
        <div class="lp-bd">
          <div class="lp-sec">
            <h4>O que está acontecendo</h4>
            <div class="lp-summary">Aguardando falas na reunião para sintetizar...</div>
          </div>
          <div class="lp-sec">
            <h4>Sugestão de fala (1ª pessoa)</h4>
            <div class="lp-sugg empty">Nenhuma sugestão no momento.</div>
          </div>
          <div class="lp-sec" id="lpHistSec">
            <h4 class="lp-histbtn"><span class="lp-htoggle">▸ Histórico</span> <span id="lpHcount" style="opacity:.6;text-transform:none;letter-spacing:0"></span></h4>
            <div class="lp-hist" hidden></div>
          </div>
        </div>
        <div class="lp-ft">
          <button class="lp-refresh">↻ Atualizar</button>
          <input type="range" class="lp-slider" min="15" max="300" step="5" value="60">
          <span class="lp-every">60s</span>
          <span class="lp-count">próxima em 60s</span>
        </div>
      </div>
    `;

    document.documentElement.appendChild(host);

    pill = {
      el: shadow.querySelector(".pill"),
      dot: shadow.querySelector(".dot"),
      label: shadow.querySelector(".label"),
      count: shadow.querySelector(".count"),
      act: shadow.querySelector(".act"),
      btnLive: shadow.querySelector(".btn-live-toggle"),
      x: shadow.querySelector(".x"),
    };

    livePanel = {
      el: shadow.querySelector("#livePanel"),
      hd: shadow.querySelector(".lp-hd"),
      time: shadow.querySelector(".lp-time"),
      spin: shadow.querySelector(".lp-spin"),
      min: shadow.querySelector(".lp-min"),
      close: shadow.querySelector(".lp-close"),
      summary: shadow.querySelector(".lp-summary"),
      sugg: shadow.querySelector(".lp-sugg"),
      histSec: shadow.querySelector("#lpHistSec"),
      histToggle: shadow.querySelector(".lp-htoggle"),
      histCount: shadow.querySelector("#lpHcount"),
      histList: shadow.querySelector(".lp-hist"),
      refresh: shadow.querySelector(".lp-refresh"),
      slider: shadow.querySelector(".lp-slider"),
      every: shadow.querySelector(".lp-every"),
      count: shadow.querySelector(".lp-count"),
    };

    pill.x.onclick = () => pill.el.classList.remove("show");
    pill.act.onclick = () => onOpen && onOpen();
    pill.btnLive.onclick = () => toggleLivePanel();

    setupLivePanelEvents();
  }

  function setupLivePanelEvents() {
    if (!livePanel) return;

    // Fechar e Minimizar
    livePanel.close.onclick = () => toggleLivePanel(false);
    livePanel.min.onclick = () => livePanel.el.classList.toggle("min");

    // Arrastar pelo cabecalho
    let dx = 0, dy = 0, drag = false;
    livePanel.hd.addEventListener("mousedown", (e) => {
      if (e.target.closest(".lp-ctrl")) return;
      drag = true;
      const rect = livePanel.el.getBoundingClientRect();
      dx = e.clientX - rect.left;
      dy = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!drag || !livePanel) return;
      livePanel.el.style.left = `${Math.max(10, e.clientX - dx)}px`;
      livePanel.el.style.top = `${Math.max(10, e.clientY - dy)}px`;
      livePanel.el.style.right = "auto";
    });

    document.addEventListener("mouseup", () => { drag = false; });

    // Slider de intervalo
    livePanel.slider.addEventListener("input", (e) => {
      const v = parseInt(e.target.value, 10);
      liveState.intervalMs = v * 1000;
      livePanel.every.textContent = `${v}s`;
    });

    // Botao atualizar
    livePanel.refresh.addEventListener("click", () => {
      triggerAnalysis(true);
    });

    // Historico expansivel
    livePanel.histSec.querySelector(".lp-histbtn").onclick = () => {
      const isHidden = livePanel.histList.hidden;
      livePanel.histList.hidden = !isHidden;
      livePanel.histToggle.textContent = (!isHidden ? "▸ " : "▾ ") + "Histórico";
    };

    // Timer continuo de contagem regressiva
    if (liveState.timer) clearInterval(liveState.timer);
    liveState.timer = setInterval(() => {
      if (!liveState.isOpen || !livePanel) return;
      if (liveState.pending) {
        livePanel.count.textContent = "processando\u2026";
        livePanel.count.classList.add("upd");
        return;
      }
      const rem = (liveState.lastUpdate + liveState.intervalMs) - Date.now();
      if (rem <= 0) {
        triggerAnalysis(false);
      } else {
        livePanel.count.textContent = `próxima em ${Math.ceil(rem / 1000)}s`;
        livePanel.count.classList.remove("upd");
      }
    }, 400);
  }

  function toggleLivePanel(forceOpen) {
    ensureHost();
    const shouldOpen = forceOpen !== undefined ? forceOpen : livePanel.el.hidden;
    livePanel.el.hidden = !shouldOpen;
    liveState.isOpen = shouldOpen;

    if (shouldOpen) {
      liveState.lastUpdate = Date.now();
      // Se nunca foi atualizado, dispara primeira analise
      if (!liveState.history.length) triggerAnalysis(true);
    }
  }

  function triggerAnalysis(force) {
    if (liveState.pending && !force) return;
    liveState.pending = true;
    setLiveBusy(true);
    if (onLiveRequest) onLiveRequest({ force });
  }

  function setLiveBusy(on) {
    if (!livePanel) return;
    livePanel.el.classList.toggle("busy", on);
    if (on) {
      livePanel.count.textContent = "processando\u2026";
      livePanel.count.classList.add("upd");
    }
  }

  function updateLiveAnalysis({ time, summary, suggestion }) {
    ensureHost();
    liveState.pending = false;
    liveState.lastUpdate = Date.now();
    setLiveBusy(false);

    if (time) livePanel.time.textContent = time;
    if (summary) livePanel.summary.textContent = summary;
    if (suggestion) {
      livePanel.sugg.textContent = suggestion;
      livePanel.sugg.classList.remove("empty");
    } else {
      livePanel.sugg.textContent = "Nenhuma sugestão no momento.";
      livePanel.sugg.classList.add("empty");
    }

    // Salvar no historico
    if (summary) {
      const entry = {
        time: time || new Date().toTimeString().slice(0, 8),
        summary,
        suggestion: suggestion || ""
      };
      liveState.history.push(entry);
      if (liveState.history.length > 50) liveState.history.shift();
      renderHistory();
    }
  }

  function renderHistory() {
    if (!livePanel) return;
    const entries = [...liveState.history].reverse();
    livePanel.histCount.textContent = `(${entries.length})`;

    livePanel.histList.innerHTML = entries.map((e) => `
      <div class="lp-hi">
        <div class="lp-ht">${esc(e.time)}</div>
        <div class="lp-hs">${esc(e.summary)}</div>
        ${e.suggestion ? `<div class="lp-hg">💡 ${esc(e.suggestion)}</div>` : ""}
      </div>
    `).join("") || '<div class="lp-hi" style="opacity:.6">Nenhum registro ainda.</div>';
  }

  function setLiveInterval(sec) {
    if (!sec) return;
    liveState.intervalMs = sec * 1000;
    if (livePanel) {
      livePanel.slider.value = String(sec);
      livePanel.every.textContent = `${sec}s`;
    }
  }

  function setLiveCallback(fn) {
    onLiveRequest = fn;
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

  /* ---------------------- modal de transcricao ---------------------- */
  function showModal(rec, txt, hash, filename, helpers) {
    ensureHost();
    shadow.querySelectorAll(".ov").forEach((n) => n.remove());
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

  return {
    setState,
    hide,
    showModal,
    toggleLivePanel,
    updateLiveAnalysis,
    setLiveBusy,
    setLiveInterval,
    setLiveCallback,
  };
})();
