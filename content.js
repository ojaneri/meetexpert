/* MeetExpert — captura de legendas (Meet/Teams/Zoom)
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */
/* ============================================================
   content.js — orquestracao (agnostico de plataforma)
   Depende de platform.js (adaptadores) e ui.js (balao + modal).
   Nada aqui deveria precisar de ajuste quando o DOM mudar.

   Modelo: uma SESSAO por reuniao. O Teams e SPA — a aba nao
   recarrega entre reunioes — entao o estado vive em `S` e e
   criado ao entrar / descartado ao sair, em vez de globais.
   ============================================================ */

const P = mcgDetectPlatform();
if (!P) {
  console.log("[MCG] plataforma nao suportada:", location.hostname);
} else {
  const VERSION = chrome.runtime.getManifest().version;
  const IDLE_MS = 1200;   // legenda parada ha isso = trecho estavel, pode gravar
  const TICK_MS = 500;
  const META_MS = 15000;
  const LEAVE_CHECK_MS = 2000;

  let S = null; // sessao atual (null = fora de reuniao)

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const stamp = (d) => d.toISOString().slice(0, 19).replace(/[-:T]/g, ""); // 20260929T...

  /* -------------------- sessao -------------------- */

  function startSession() {
    const now = new Date();
    // Teams v2 nao poe o id na URL: usa a hora de entrada (a mesma aba pode
    // ter varias reunioes; o id NAO pode ser calculado no load da pagina).
    const meetingId = P.meetingId() || `${P.id}_${stamp(now).slice(0, 13)}`;
    S = {
      meetingId,
      recId: `${meetingId}@${stamp(now)}`, // chave de armazenamento: unica por sessao
      startMs: now.getTime(),
      blocks: new Map(),     // Element -> entrada em construcao
      transcript: [],        // trechos ja enviados (upsert por id)
      speakers: new Set(),
      root: null,
      observer: null,
      sawCaptions: false,
      lastSpeaker: null,
      seq: 0,
      lastMeta: 0,
      outTicks: 0,
      lastLeaveCheck: 0,
      finalizing: false,
      attempted: false,      // ja tentou ligar as legendas pelo menu
    };
    MCG_UI.setState("waiting");
    send({ type: "STATE", recording: true });
    autoEnableLoop(S);
    console.log(`[MeetExpert v${VERSION}] sessao iniciada em ${P.label} — ${S.recId}`);
  }

  function send(msg) {
    try { chrome.runtime.sendMessage(msg).catch(() => {}); } catch (_) {}
  }

  /* -------------------- captura -------------------- */

  function findRoot() {
    let best = null;
    for (const sel of P.captionRoot) {
      try {
        const candidates = document.querySelectorAll(sel);
        for (const el of candidates) {
          // Ignora botoes, barras de ferramentas, tooltips ou menus
          if (el.closest("button, [role='button'], [role='toolbar'], [role='menu']")) continue;
          if (el.getAttribute("role") === "button") continue;
          const txt = (el.innerText || "").trim();
          if (txt.length > 0) return el; // Prioriza o container que ja tem legendas visiveis
          if (!best) best = el;
        }
      } catch (_) {}
    }
    return best;
  }

  function speakerOf(block) {
    const el = block.querySelector(P.speakerSel);
    const n = el && el.innerText.trim();
    // Zoom so mostra as iniciais: o adaptador troca pelo nome quando sabe
    if (n) return P.resolveSpeaker ? P.resolveSpeaker(n) : n;
    // Teams agrupa falas seguidas do mesmo autor: sem cabecalho = mesmo falante.
    return S.lastSpeaker || "Desconhecido";
  }

  function textOf(block) {
    // Se a plataforma tem um no dedicado ao texto, usa ele.
    if (P.textSel) {
      const el = block.querySelector(P.textSel);
      if (el) return (el.innerText || "").replace(/\s+/g, " ").trim();
    }
    const spk = block.querySelector(P.speakerSel);
    let raw = block.innerText || "";
    if (spk && spk.innerText) raw = raw.replace(spk.innerText, "");
    return raw.replace(/\s+/g, " ").trim();
  }

  // Blocos de legenda. Se os seletores de classe quebrarem, cai numa heuristica
  // estrutural: sobe de cada no de texto ate o ancestral que tambem tem o autor.
  function captionBlocks() {
    if (!S.root) return [];
    let found = [...S.root.querySelectorAll(P.captionBlock)];
    found = found.filter((b) => !b.closest("button, [role='button'], [role='toolbar']"));
    if (found.length) return found;
    if (P.textSel) {
      const out = new Set();
      S.root.querySelectorAll(P.textSel).forEach((t) => {
        let el = t.parentElement;
        for (let i = 0; el && el !== S.root && i < 5; i++, el = el.parentElement) {
          if (el.querySelector(P.speakerSel)) { out.add(el); break; }
        }
      });
      if (out.size) return [...out];
    }
    return [...S.root.children].filter((c) => !c.closest("button, [role='button'], [role='toolbar']"));
  }

  // Bloco novo cujo texto ja foi gravado (o Teams recria elementos ao
  // virtualizar a lista): reaproveita o id em vez de duplicar o trecho.
  function adoptRecent(speaker, text) {
    if (text.length < 8) return null;
    const cutoff = Date.now() - S.startMs - 20000;
    for (let i = S.transcript.length - 1; i >= 0 && i >= S.transcript.length - 6; i--) {
      const e = S.transcript[i];
      if (e.tRelMs < cutoff) break;
      if (e.speaker === speaker && (e.text.includes(text) || text.startsWith(e.text))) return e;
    }
    return null;
  }

  function newEntry(speaker, text) {
    const prev = adoptRecent(speaker, text);
    return {
      id: prev ? prev.id : `${S.recId}#${++S.seq}`,
      speaker, text,
      sentText: prev ? prev.text : "",
      startRel: prev ? prev.tRelMs : Date.now() - S.startMs,
      lastUpdate: Date.now(),
    };
  }

  // Legenda muda de tres jeitos: cresce, e corrigida pelo ASR, ou o Meet corta
  // o comeco quando fica longa. Nos dois primeiros o texto novo substitui o
  // velho; no terceiro preservamos o que ja saiu e anexamos o resto.
  function reconcile(block, entry, text) {
    const probe = entry.text.slice(0, 24);
    if (!entry.text || text.startsWith(probe)) {
      entry.text = text;
    } else {
      const i = entry.text.lastIndexOf(text.slice(0, 24));
      if (i > 0) {
        entry.text = entry.text.slice(0, i) + text;
      } else {
        // outra fala no mesmo elemento: fecha a anterior e abre nova
        flush(entry, true);
        entry = newEntry(entry.speaker, text);
        S.blocks.set(block, entry);
        return;
      }
    }
    entry.lastUpdate = Date.now();
  }

  function scanBlocks() {
    if (!S.root || !document.contains(S.root) || S.root.closest("button, [role='button'], [role='toolbar'], [role='menu']")) {
      S.root = null;
    }
    // Se S.root esta vazio e outro candidato tem texto ativo, atualiza
    if (S.root && !(S.root.innerText || "").trim()) {
      const active = findRoot();
      if (active && active !== S.root && (active.innerText || "").trim()) {
        S.root = active;
        attachToRoot();
      }
    }
    if (!S.root) {
      const r = findRoot();
      if (r) {
        S.root = r;
        attachToRoot();
        if (!S.sawCaptions) {
          S.sawCaptions = true;
          MCG_UI.setState("capturing", {
            text: "Legendas ligadas — gravando",
            actionLabel: "Ver transcrição",
            onAction: openLiveModal,
          });
        }
      }
      if (!S.root) return;
    }
    const seen = new Set();
    for (const block of captionBlocks()) {
      seen.add(block);
      const text = textOf(block);
      if (!text) continue;
      const entry = S.blocks.get(block);
      const speaker = speakerOf(block);
      if (!entry) {
        S.blocks.set(block, newEntry(speaker, text));
      } else if (text !== entry.text) {
        entry.speaker = speaker || entry.speaker;
        reconcile(block, entry, text);
      }
      if (speaker !== "Desconhecido") S.lastSpeaker = speaker;
    }
    for (const [block, entry] of S.blocks) {
      if (!seen.has(block)) { flush(entry, true); S.blocks.delete(block); }
    }
  }

  // Grava (upsert) o trecho quando estabiliza. Mesmo id = substitui o texto,
  // o que corrige legendas revisadas em vez de acumular fragmentos.
  function flush(entry, force = false) {
    if (!force && Date.now() - entry.lastUpdate < IDLE_MS) return;
    if (!entry.text || entry.text === entry.sentText) return;
    entry.sentText = entry.text;
    const e = {
      id: entry.id, meetingId: S.meetingId, speaker: entry.speaker,
      text: entry.text, ts: new Date().toISOString(), tRelMs: entry.startRel,
    };
    const i = S.transcript.findIndex((t) => t.id === e.id);
    if (i >= 0) S.transcript[i] = e; else S.transcript.push(e);
    if (entry.speaker && entry.speaker !== "Desconhecido") S.speakers.add(entry.speaker);
    send({ type: "CAPTION", recId: S.recId, meetingId: S.meetingId, entry: e });
    MCG_UI.setState("capturing", {
      count: `${S.transcript.length} trechos`,
      actionLabel: "Ver transcrição",
      onAction: openLiveModal,
    });
  }

  function attachToRoot() {
    if (S.observer) S.observer.disconnect();
    S.observer = new MutationObserver(scanBlocks);
    S.observer.observe(S.root, { childList: true, subtree: true, characterData: true });
  }

  /* -------------------- ligar legendas -------------------- */

  const labelOf = (el) => (el.getAttribute("aria-label") || el.innerText || el.textContent || "").trim();
  const isVisible = (el) => el.getClientRects().length > 0;

  function findControl(selectors, re) {
    for (const sel of selectors) {
      const el = [...document.querySelectorAll(sel)].find((n) => isVisible(n) && re.test(labelOf(n)));
      if (el) return el;
    }
    return null;
  }

  async function waitFor(fn, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(150);
    }
    return null;
  }

  const pressEsc = () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  // Botao direto (Meet, Zoom, e Teams quando a barra o expoe). Procura o rotulo
  // exato de ligar/desligar: o primeiro botao com "caption" no nome pode ser
  // outro (no Zoom, "More options for captions" ou "Caption settings").
  function tryEnableDirect() {
    const nodes = [...document.querySelectorAll('button[aria-label], [role="button"][aria-label], [role="menuitem"][aria-label]')];
    const label = (b) => (b.getAttribute("aria-label") || "").trim();
    if (nodes.some((b) => P.captionButtonOff.test(label(b)))) return true; // ja ligada
    const on = nodes.find((b) => isVisible(b) && P.captionButtonOn.test(label(b)));
    if (on) { on.click(); return true; }
    return false; // nada inequivoco: nao arrisca desligar
  }

  // Teams: Mais acoes > Idioma e fala > Legendas ao vivo (+ dialogo de idioma).
  async function enableViaMenu() {
    if (!P.captionMenuFlow) return false;
    const steps = P.captionMenuFlow;
    for (let i = 0; i < steps.length; i++) {
      const el = await waitFor(() => findControl(steps[i].sel, steps[i].re), 1800);
      if (!el) { pressEsc(); return false; }
      const last = i === steps.length - 1;
      if (last && P.captionButtonOff.test(labelOf(el))) { pressEsc(); return true; } // ja ligada
      el.click();
      await sleep(400);
    }
    // Primeira vez o Teams pergunta o idioma falado: confirma o padrao.
    const ok = await waitFor(
      () => findControl(['[role="dialog"] button'], /^(confirm|confirmar|ok)$/i), 1500);
    if (ok) ok.click();
    return true;
  }

  function autoEnableLoop(sess) {
    let tries = 0;
    const id = setInterval(async () => {
      if (S !== sess || sess.sawCaptions) return clearInterval(id);
      if (tryEnableDirect()) return clearInterval(id);
      tries++;
      // Teams: depois de ~6s sem o botao direto, tenta o menu — uma vez so.
      if (P.captionMenuFlow && tries === 6 && !sess.attempted) {
        sess.attempted = true;
        await enableViaMenu();
        return;
      }
      if (tries > 30) {
        clearInterval(id);
        if (S === sess && !sess.sawCaptions) askUser();
      }
    }, 1000);
  }

  function askUser() {
    MCG_UI.setState("waiting", {
      text: P.captionsInMenu
        ? "Legendas desligadas — ligue para transcrever"
        : "Ligue as legendas (CC) para transcrever",
      actionLabel: P.captionMenuFlow ? "Ligar legendas" : null,
      onAction: P.captionMenuFlow
        ? async () => {
            const ok = await enableViaMenu();
            if (!ok) MCG_UI.setState("waiting", {
              text: "Não achei o menu — use Mais ações › Idioma e fala",
            });
          }
        : null,
    });
  }

  /* -------------------- metadados -------------------- */

  function scrapeRoster() {
    const names = new Set();
    try {
      document.querySelectorAll(P.rosterName).forEach((el) => {
        const n = (el.innerText || "").split("\n")[0].trim();
        if (n && n.length < 60) names.add(n);
      });
    } catch (_) {}
    return names;
  }

  function participantsList() {
    return [...new Set([...S.speakers, ...scrapeRoster()])].sort((a, b) => a.localeCompare(b));
  }

  // Titulo: Teams pode nao ter um; nesse caso um nome legivel, nunca "Calendar".
  function meetingTitle() {
    const t = P.title();
    if (t) return t;
    const d = new Date(S.startMs).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    return `Reunião ${P.label} — ${d}`;
  }

  function metaRecord() {
    return {
      id: S.recId,
      meetingId: S.meetingId,
      platform: P.label,
      title: meetingTitle(),
      participants: participantsList(),
      durationMs: Date.now() - S.startMs,
      startedAt: new Date(S.startMs).toISOString(),
    };
  }

  /* Grava metadados periodicamente. Sem isso, fechar a aba no meio
     deixa o registro sem titulo/participantes/duracao — o beforeunload
     nao e confiavel para trabalho assincrono. */
  function heartbeatMeta() {
    if (!S.transcript.length || Date.now() - S.lastMeta < META_MS) return;
    S.lastMeta = Date.now();
    send({ type: "META", recId: S.recId, meta: metaRecord() });
  }

  /* -------------------- fim de reuniao -------------------- */

  // Fim = "fora da sala" por varios ticks seguidos. Um unico tick ruim
  // (re-render do Teams) nao encerra nada.
  function detectEnd() {
    let out = !P.inMeeting();
    if (P.useLeaveText && !out && Date.now() - S.lastLeaveCheck > LEAVE_CHECK_MS) {
      S.lastLeaveCheck = Date.now();
      S.leaveText = P.leaveScreen.test(document.body?.innerText || "");
    }
    if (P.useLeaveText && S.leaveText) out = true;
    S.outTicks = out ? S.outTicks + 1 : 0;
    if (S.outTicks >= P.endTicks) finalize();
  }

  window.addEventListener("beforeunload", () => {
    if (!S) return;
    for (const entry of S.blocks.values()) flush(entry, true);
  });

  /* -------------------- helpers de formato -------------------- */

  function mmss(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }
  function esc(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  // Junta trechos consecutivos do mesmo falante para leitura.
  function mergeTurns(entries) {
    const out = [];
    for (const e of entries) {
      const last = out[out.length - 1];
      if (last && last.speaker === e.speaker) {
        last.text = (last.text + " " + e.text).replace(/\s+/g, " ").trim();
      } else {
        out.push({ ...e });
      }
    }
    return out;
  }

  function buildBody(rec) {
    return mergeTurns(rec.entries)
      .map((e) => `[${mmss(e.tRelMs)}] ${e.speaker}: ${e.text}`).join("\n");
  }
  function buildTxt(rec, hash) {
    const bar = "=".repeat(56);
    return [
      bar, "TRANSCRICAO DE REUNIAO", bar,
      `Plataforma:    ${rec.platform}`,
      `Titulo:        ${rec.title}`,
      `Codigo:        ${rec.meetingId}`,
      `Data/hora:     ${fmtDate(rec.startedAt)}`,
      `Duracao:       ${mmss(rec.durationMs)}`,
      `Participantes: ${rec.participants.join(", ") || "—"}`,
      `Trechos:       ${rec.entries.length}`,
      `SHA-256 corpo: ${hash}`,
      `Gerado por:    MeetExpert — Osvaldo Janeri Filho <osvaldo@perito.digital>`,
      bar, "",
    ].join("\n") + buildBody(rec);
  }
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function download(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* -------------------- finalizacao -------------------- */

  async function finalize() {
    const sess = S;
    if (!sess || sess.finalizing) return;
    sess.finalizing = true;
    for (const entry of sess.blocks.values()) flush(entry, true);
    if (sess.observer) sess.observer.disconnect();
    S = null; // libera: a proxima reuniao na mesma aba cria sessao nova
    send({ type: "STATE", recording: false });

    if (!sess.transcript.length) { MCG_UI.hide(); return; }

    MCG_UI.setState("saving", { count: `${sess.transcript.length} trechos` });

    // metaRecord() le S; monta a partir da sessao encerrada
    const rec = {
      id: sess.recId,
      meetingId: sess.meetingId,
      platform: P.label,
      title: P.title() || `Reunião ${P.label} — ${fmtDate(new Date(sess.startMs).toISOString())}`,
      participants: [...new Set([...sess.speakers, ...scrapeRoster()])].sort((a, b) => a.localeCompare(b)),
      startedAt: new Date(sess.startMs).toISOString(),
      durationMs: Date.now() - sess.startMs,
      entries: sess.transcript,
    };

    try {
      await chrome.runtime.sendMessage({ type: "FINALIZE", record: rec });
      const hash = await sha256(buildBody(rec));
      const txt = buildTxt(rec, hash);
      const filename = `transcricao_${P.id}_${rec.meetingId}_${rec.startedAt.slice(0, 10)}.txt`;

      MCG_UI.setState("saved", {
        count: `${rec.entries.length} trechos`,
        actionLabel: "Abrir transcrição",
        onAction: () =>
          MCG_UI.showModal(rec, txt, hash, filename, { esc, mmss, fmtDate, download, merge: mergeTurns }),
      });
    } catch (err) {
      console.error("[MCG] falha ao finalizar", err);
      MCG_UI.setState("error", { text: "Falha ao salvar — veja o popup" });
    }
  }

  /* -------------------- ver transcricao ao vivo -------------------- */

  // Abre o modal com tudo que ja foi capturado, sem esperar o fim da reuniao.
  // Chamado pelo botao do balao enquanto o estado e "capturing".
  async function openLiveModal() {
    const sess = S;
    if (!sess || !sess.transcript.length) return;
    // fecha os trechos em construcao para o modal mostrar ate a ultima fala
    for (const entry of sess.blocks.values()) flush(entry, true);
    const rec = {
      id: sess.recId,
      meetingId: sess.meetingId,
      platform: P.label,
      title: meetingTitle(),
      participants: participantsList(),
      startedAt: new Date(sess.startMs).toISOString(),
      durationMs: Date.now() - sess.startMs,
      entries: sess.transcript.slice(),
    };
    const hash = await sha256(buildBody(rec));
    const txt = buildTxt(rec, hash);
    const filename = `transcricao_${P.id}_${rec.meetingId}_${rec.startedAt.slice(0, 10)}_parcial.txt`;
    MCG_UI.showModal(rec, txt, hash, filename, { esc, mmss, fmtDate, download, merge: mergeTurns, live: true });
  }

  /* -------------------- loop e live analysis -------------------- */

  MCG_UI.setLiveCallback(async ({ force }) => {
    if (!S) {
      MCG_UI.updateLiveAnalysis({
        time: new Date().toTimeString().slice(0, 8),
        summary: "Aguardando entrada em uma reunião...",
        suggestion: ""
      });
      return;
    }

    // Varre o DOM e fecha os blocos atuais para incluir a fala mais recente
    scanBlocks();
    for (const entry of S.blocks.values()) flush(entry, true);

    if (!S.transcript.length) {
      MCG_UI.updateLiveAnalysis({
        time: new Date().toTimeString().slice(0, 8),
        summary: "Aguardando as primeiras falas na reunião para sintetizar...",
        suggestion: ""
      });
      return;
    }

    const recent = S.transcript.slice(-30);
    console.log(`[MeetExpert Live AI] Enviando ${recent.length} trechos para análise:`, recent);
    try {
      chrome.runtime.sendMessage({ type: "LIVE_ANALYZE", entries: recent }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) {
          MCG_UI.updateLiveAnalysis({
            time: new Date().toTimeString().slice(0, 8),
            summary: `Erro ao conectar com a IA: ${res?.error || chrome.runtime.lastError?.message || "Sem resposta"}`,
            suggestion: "Verifique se a IA local está rodando ou configure a chave de API no ícone da extensão."
          });
        } else {
          MCG_UI.updateLiveAnalysis({
            time: res.time,
            summary: res.summary,
            suggestion: res.suggestion
          });
        }
      });
    } catch (e) {
      MCG_UI.updateLiveAnalysis({
        time: new Date().toTimeString().slice(0, 8),
        summary: `Falha na requisição: ${e.message}`,
        suggestion: ""
      });
    }
  });

  // Carrega intervalo configurado
  chrome.storage.local.get("llm_config").then(({ llm_config }) => {
    if (llm_config?.intervalSec) MCG_UI.setLiveInterval(llm_config.intervalSec);
  }).catch(() => {});

  function tick() {
    if (!S) {
      if (P.inMeeting()) startSession();
      return;
    }
    scanBlocks();
    for (const entry of S.blocks.values()) flush(entry, false);
    heartbeatMeta();
    detectEnd();
  }

  setInterval(tick, TICK_MS);
  console.log(`[MeetExpert v${VERSION}] ativo em ${P.label}`);
}
