/* MeetExpert — popup do icone: reunioes gravadas e configuracao de Live Analysis com IA
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */
/* Depende de format.js (normalize, fullText, baseName, saveBlob...). */

const $ = (s) => document.querySelector(s);
const LIVE_MS = 30000; // registro aberto com trecho recente = gravando agora

let records = [];

const DEFAULT_CONFIG = {
  provider: "ollama",
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "qwen2.5:3b",
  openrouterKey: "",
  openrouterModel: "google/gemini-2.0-flash-exp:free",
  geminiKey: "",
  geminiModel: "gemini-2.0-flash",
  customUrl: "http://localhost:1234/v1/chat/completions",
  customKey: "",
  customModel: "",
  userRole: "participante",
  intervalSec: 60,
};

/* -------------------- Navegacao de Abas -------------------- */

$("#tabMeetings").onclick = () => switchTab("meetings");
$("#tabSettings").onclick = () => switchTab("settings");

function switchTab(tab) {
  if (tab === "meetings") {
    $("#tabMeetings").classList.add("active");
    $("#tabSettings").classList.remove("active");
    $("#viewMeetings").classList.add("active");
    $("#viewSettings").classList.remove("active");
    $("#headerTitle").textContent = "Reuniões gravadas";
  } else {
    $("#tabSettings").classList.add("active");
    $("#tabMeetings").classList.remove("active");
    $("#viewSettings").classList.add("active");
    $("#viewMeetings").classList.remove("active");
    $("#headerTitle").textContent = "Configurar IA";
    loadConfig();
  }
}

/* -------------------- Reunioes Gravadas -------------------- */

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
    const head = g[g.length - 1];
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

/* -------------------- Configuracao de IA -------------------- */

$("#aiProvider").addEventListener("change", (e) => {
  updateProviderVisibility(e.target.value);
});

$("#ollamaModelSelect").addEventListener("change", (e) => {
  $("#ollamaModelCustom").style.display = e.target.value === "custom" ? "block" : "none";
});

$("#openrouterModelSelect").addEventListener("change", (e) => {
  $("#openrouterModelCustom").style.display = e.target.value === "custom" ? "block" : "none";
});

function updateProviderVisibility(prov) {
  $("#cfgOllama").style.display = prov === "ollama" ? "flex" : "none";
  $("#cfgOpenrouter").style.display = prov === "openrouter" ? "flex" : "none";
  $("#cfgGemini").style.display = prov === "gemini" ? "flex" : "none";
  $("#cfgCustom").style.display = prov === "custom" ? "flex" : "none";
}

async function loadConfig() {
  const { llm_config = {} } = await chrome.storage.local.get("llm_config");
  const cfg = { ...DEFAULT_CONFIG, ...llm_config };

  $("#aiProvider").value = cfg.provider;
  updateProviderVisibility(cfg.provider);

  // Ollama
  $("#ollamaUrl").value = cfg.ollamaUrl || "http://localhost:11434";
  const selOll = $("#ollamaModelSelect");
  const existsOll = [...selOll.options].some((o) => o.value === cfg.ollamaModel);
  if (existsOll) {
    selOll.value = cfg.ollamaModel;
    $("#ollamaModelCustom").style.display = "none";
  } else {
    selOll.value = "custom";
    $("#ollamaModelCustom").style.display = "block";
    $("#ollamaModelCustom").value = cfg.ollamaModel || "";
  }

  // OpenRouter
  $("#openrouterKey").value = cfg.openrouterKey || "";
  const selOr = $("#openrouterModelSelect");
  const existsOr = [...selOr.options].some((o) => o.value === cfg.openrouterModel);
  if (existsOr) {
    selOr.value = cfg.openrouterModel;
    $("#openrouterModelCustom").style.display = "none";
  } else {
    selOr.value = "custom";
    $("#openrouterModelCustom").style.display = "block";
    $("#openrouterModelCustom").value = cfg.openrouterModel || "";
  }

  // Gemini
  $("#geminiKey").value = cfg.geminiKey || "";
  $("#geminiModel").value = cfg.geminiModel || "gemini-2.0-flash";

  // Custom
  $("#customUrl").value = cfg.customUrl || "";
  $("#customKey").value = cfg.customKey || "";
  $("#customModel").value = cfg.customModel || "";

  // Geral
  $("#userRole").value = cfg.userRole || "participante";
  $("#defaultInterval").value = String(cfg.intervalSec || 60);
}

function gatherConfig() {
  const provider = $("#aiProvider").value;
  let ollamaModel = $("#ollamaModelSelect").value;
  if (ollamaModel === "custom") ollamaModel = $("#ollamaModelCustom").value.trim();

  let openrouterModel = $("#openrouterModelSelect").value;
  if (openrouterModel === "custom") openrouterModel = $("#openrouterModelCustom").value.trim();

  return {
    provider,
    ollamaUrl: $("#ollamaUrl").value.trim().replace(/\/+$/, ""),
    ollamaModel,
    openrouterKey: $("#openrouterKey").value.trim(),
    openrouterModel,
    geminiKey: $("#geminiKey").value.trim(),
    geminiModel: $("#geminiModel").value,
    customUrl: $("#customUrl").value.trim(),
    customKey: $("#customKey").value.trim(),
    customModel: $("#customModel").value.trim(),
    userRole: $("#userRole").value,
    intervalSec: parseInt($("#defaultInterval").value, 10) || 60,
  };
}

$("#btnDetectOllama").addEventListener("click", async () => {
  const url = ($("#ollamaUrl").value || "http://localhost:11434").trim().replace(/\/+$/, "");
  setStatus("loading", "Consultando modelos instalados no Ollama...");
  try {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = data.models || [];
    if (!models.length) {
      setStatus("error", "Ollama respondeu, mas nenhum modelo foi baixado ainda. Execute 'instalar-ia-local.bat'.");
      return;
    }
    const sel = $("#ollamaModelSelect");
    sel.innerHTML = models.map((m) => `<option value="${m.name}">${m.name} (${(m.size / 1e9).toFixed(1)} GB)</option>`).join("") + '<option value="custom">Outro...</option>';
    $("#ollamaModelCustom").style.display = "none";
    setStatus("success", `Detectados ${models.length} modelo(s) no seu Ollama!`);
  } catch (err) {
    setStatus("error", `Falha ao conectar ao Ollama em ${url}. Certifique-se de que o Ollama está rodando.`);
  }
});

$("#btnSave").addEventListener("click", async () => {
  const cfg = gatherConfig();
  await chrome.storage.local.set({ llm_config: cfg });
  setStatus("success", "Configurações de IA salvas com sucesso!");
  setTimeout(() => {
    const st = $("#testStatus");
    if (st.classList.contains("success")) st.style.display = "none";
  }, 2500);
});

$("#btnTest").addEventListener("click", async () => {
  const cfg = gatherConfig();
  setStatus("loading", "Testando resposta da IA...");
  try {
    const res = await chrome.runtime.sendMessage({ type: "TEST_LLM_CONNECTION", config: cfg });
    if (res && res.ok) {
      setStatus("success", `Conexão bem sucedida com ${res.model || cfg.provider}! Resposta: "${res.sample}"`);
    } else {
      setStatus("error", `Erro: ${res?.error || "Sem resposta do provedor"}`);
    }
  } catch (err) {
    setStatus("error", `Falha no teste: ${err.message}`);
  }
});

function setStatus(type, msg) {
  const box = $("#testStatus");
  box.className = `status-box ${type}`;
  box.textContent = msg;
  box.style.display = "block";
}

// Ouvir mudancas de armazenamento (para trechos recebidos enquanto o popup esta aberto)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && Object.keys(changes).some((k) => k.startsWith("transcript:"))) loadAll();
});

loadAll();
