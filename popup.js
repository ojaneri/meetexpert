/* MeetExpert — popup do icone: reunioes gravadas, para baixar
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */
/* Depende de format.js (normalize, fullText, baseName, saveBlob...). */

const $ = (s) => document.querySelector(s);
const LIVE_MS = 30000; // registro aberto com trecho recente = gravando agora

let records = [];

async function loadAll() {
  const data = await chrome.storage.local.get(null);
  records = Object.entries(data)
    .filter(([k]) => k.startsWith("transcript:"))
    .map(([, v]) => v)
    .filter((r) => r && Array.isArray(r.entries))
    .map(normalize);
  render();
}

const stampOf = (r) => r.updatedAt || r.startedAt || "";
const isLive = (r) => !r.finalized && Date.now() - Date.parse(stampOf(r) || 0) < LIVE_MS;

function platformTag(r) {
  const src = r.platform || r.meetingId || "";
  if (/teams/i.test(src)) return { cls: "teams", label: "Teams" };
  if (/zoom/i.test(src)) return { cls: "zoom", label: "Zoom" };
  return { cls: "", label: "Meet" };
}

// Uma reuniao pode ter varias gravacoes (saiu e voltou): agrupa pelo codigo,
// gravacoes em ordem cronologica, reunioes da mais recente para a mais antiga.
function groupByMeeting(list) {
  const groups = new Map();
  for (const r of list) {
    const k = r.meetingId || r.id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const latest = (g) => g.reduce((m, r) => (stampOf(r) > m ? stampOf(r) : m), "");
  return [...groups.values()]
    .map((g) => g.sort((a, b) => (a.startedAt || "").localeCompare(b.startedAt || "")))
    .sort((a, b) => latest(b).localeCompare(latest(a)));
}

function render() {
  const ul = $("#meetings");
  const groups = groupByMeeting(records);
  const trechos = records.reduce((n, r) => n + r.entries.length, 0);
  $("#stat").textContent = groups.length ? `${groups.length} reunião${groups.length > 1 ? "es" : ""} · ${trechos} trechos` : "";

  if (!groups.length) {
    ul.innerHTML = '<li class="none">Nenhuma reunião gravada ainda.<br>Entre no Meet, Teams ou Zoom com as legendas ligadas.</li>';
    return;
  }
  ul.innerHTML = groups.map((g) => {
    const head = g[g.length - 1]; // gravacao mais recente da reuniao da o titulo
    const tag = platformTag(head);
    const live = g.some(isLive);
    return `<li class="meeting ${live ? "live" : ""}">
      <div class="m-head">
        <span class="tag ${tag.cls}">${tag.label}</span>
        <span class="m-title" title="${esc(head.title)}">${esc(head.title)}</span>
        ${live ? '<span class="rec" title="Gravando agora">REC</span>' : ""}
      </div>
      <ul class="sessions">${g.map((r) => `
        <li class="session">
          <span class="s-meta">${fmtDate(r.startedAt)} · ${mmss(r.durationMs)} · ${r.entries.length} trechos</span>
          ${isLive(r) ? "" : r.partial ? '<span class="tag partial" title="A reunião foi encerrada sem fechar o registro">parcial</span>' : ""}
          <button class="dl" data-id="${esc(r.id)}" title="Baixar a transcrição desta gravação">.txt</button>
        </li>`).join("")}
      </ul>
    </li>`;
  }).join("");
}

$("#meetings").addEventListener("click", async (e) => {
  const btn = e.target.closest(".dl");
  if (!btn) return;
  const rec = records.find((r) => r.id === btn.dataset.id);
  if (!rec) return;
  saveBlob(`${baseName(rec)}.txt`, new Blob([await fullText(rec)], { type: "text/plain;charset=utf-8" }));
});

// Arquivo completo numa aba (reutiliza se ja estiver aberta).
$("#openArchive").addEventListener("click", async () => {
  const url = chrome.runtime.getURL("dashboard.html");
  const open = await chrome.tabs.query({ url });
  if (open.length) {
    chrome.tabs.update(open[0].id, { active: true });
    chrome.windows.update(open[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url });
  }
  window.close();
});

// Trechos chegam durante a gravacao: atualiza a lista com o popup aberto.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && Object.keys(changes).some((k) => k.startsWith("transcript:"))) loadAll();
});

loadAll();
