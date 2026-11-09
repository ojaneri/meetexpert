/* MeetExpert — service worker: persistencia, selo REC e Live Analysis LLM
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */

const KEY = (id) => `transcript:${id}`;

// Fila serial: get->set concorrente perdia trechos quando duas legendas
// chegavam juntas (cada uma lia o registro antes da outra gravar).
let chain = Promise.resolve();
const enqueue = (fn) => { chain = chain.then(fn).catch((e) => console.error("[MCG bg]", e)); };

async function load(recId) {
  const k = KEY(recId);
  return (await chrome.storage.local.get(k))[k];
}

// Selo "REC" no icone enquanto QUALQUER aba estiver transcrevendo
async function setRecording(tabId, on) {
  const { recTabs = [] } = await chrome.storage.session.get("recTabs");
  const tabs = new Set(recTabs);
  if (on) tabs.add(tabId); else tabs.delete(tabId);
  await chrome.storage.session.set({ recTabs: [...tabs] });
  chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
  chrome.action.setBadgeText({ text: tabs.size ? "REC" : "" });
  chrome.action.setTitle({ title: tabs.size ? "MeetExpert — gravando" : "MeetExpert — reunioes gravadas" });
}

chrome.runtime.onInstalled.addListener(async () => {
  for (const cs of chrome.runtime.getManifest().content_scripts || []) {
    const tabs = await chrome.tabs.query({ url: cs.matches }).catch(() => []);
    for (const t of tabs) {
      chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: !!cs.all_frames }, files: cs.js })
        .catch((e) => console.warn("[MCG bg] reinjecao falhou", t.url, e.message));
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => enqueue(() => setRecording(tabId, false)));

/* -------------------- Integracao LLM para Live Analysis -------------------- */

const ROLES_MAP = {
  participante: "Participante ativo da reunião / Colaborador",
  lider: "Líder / Coordenador da reunião. Foco em direcionamento de pauta, alinhamento e decisões.",
  cliente: "Cliente / Ouvinte. Foco em esclarecer dúvidas e acompanhar entregas."
};

async function getLLMConfig() {
  const { llm_config = {} } = await chrome.storage.local.get("llm_config");
  return {
    provider: "ollama",
    ollamaUrl: "http://localhost:11434",
    ollamaModel: "qwen2.5:3b",
    openrouterKey: "",
    openrouterModel: "google/gemini-2.0-flash-exp:free",
    geminiKey: "",
    geminiModel: "gemini-2.0-flash",
    customUrl: "",
    customKey: "",
    customModel: "",
    userRole: "participante",
    ...llm_config
  };
}

async function callLLMProvider(systemPrompt, userPrompt, config) {
  const prov = config.provider || "ollama";

  if (prov === "ollama") {
    const baseUrl = (config.ollamaUrl || "http://localhost:11434").replace(/\/+$/, "");
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel || "qwen2.5:3b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: false,
        options: { temperature: 0.3 }
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Ollama HTTP ${res.status}: ${txt || res.statusText}`);
    }
    const data = await res.json();
    return data.message?.content || "";
  }

  if (prov === "openrouter") {
    if (!config.openrouterKey) throw new Error("Chave de API do OpenRouter não informada.");
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.openrouterKey}`,
        "HTTP-Referer": "https://meetexpert.app",
        "X-Title": "MeetExpert Live Analysis"
      },
      body: JSON.stringify({
        model: config.openrouterModel || "google/gemini-2.0-flash-exp:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${res.status}: ${txt || res.statusText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  if (prov === "gemini") {
    if (!config.geminiKey) throw new Error("Chave de API do Gemini não informada.");
    const model = config.geminiModel || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] }],
        generationConfig: { temperature: 0.3 }
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Gemini HTTP ${res.status}: ${txt || res.statusText}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (prov === "custom") {
    if (!config.customUrl) throw new Error("Endpoint URL não informada.");
    const headers = { "Content-Type": "application/json" };
    if (config.customKey) headers["Authorization"] = `Bearer ${config.customKey}`;
    const res = await fetch(config.customUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.customModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Custom HTTP ${res.status}: ${txt || res.statusText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  throw new Error(`Provedor desconhecido: ${prov}`);
}

function parseAnalysisOutput(rawText) {
  let cleaned = rawText.trim();
  // Se veio envolto em markdown ```json ... ```
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) cleaned = jsonMatch[1].trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || parsed.resumo || "",
      suggestion: parsed.suggestion || parsed.sugestao || ""
    };
  } catch (_) {
    // Heuristica de fallback caso a LLM retorne texto livre
    const parts = cleaned.split(/sugest[aã]o:?/i);
    if (parts.length > 1) {
      return {
        summary: parts[0].replace(/resumo:?/i, "").trim(),
        suggestion: parts.slice(1).join("").trim()
      };
    }
    return { summary: cleaned, suggestion: "" };
  }
}

/* -------------------- Listener de Mensagens -------------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "CAPTION") {
    enqueue(async () => {
      const e = msg.entry;
      const rec = (await load(msg.recId)) ||
        { id: msg.recId, meetingId: msg.meetingId, startedAt: e.ts, entries: [] };
      const i = rec.entries.findIndex((x) => x.id === e.id);
      if (i >= 0) rec.entries[i] = e; else rec.entries.push(e);
      rec.updatedAt = e.ts;
      await chrome.storage.local.set({ [KEY(msg.recId)]: rec });
    });
    return false;
  }

  if (msg?.type === "META") {
    enqueue(async () => {
      const rec = await load(msg.recId);
      if (!rec) return;
      const keep = rec.titleEdited ? { title: rec.title } : {};
      await chrome.storage.local.set({ [KEY(msg.recId)]: { ...rec, ...msg.meta, ...keep, entries: rec.entries } });
    });
    return false;
  }

  if (msg?.type === "FINALIZE") {
    const r = msg.record;
    enqueue(async () => {
      const cur = await load(r.id);
      const keep = cur?.titleEdited ? { title: cur.title, titleEdited: true } : {};
      await chrome.storage.local.set({
        [KEY(r.id)]: { ...r, ...keep, updatedAt: new Date().toISOString(), finalized: true },
      });
    });
    return false;
  }

  if (msg?.type === "STATE" && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    enqueue(() => setRecording(tabId, !!msg.recording));
    return false;
  }

  // Teste de conectividade com a LLM
  if (msg?.type === "TEST_LLM_CONNECTION") {
    (async () => {
      try {
        const cfg = msg.config || (await getLLMConfig());
        const reply = await callLLMProvider(
          "Você é um validador de teste. Responda apenas com a palavra 'Conectado!' em português.",
          "Teste de conexão MeetExpert",
          cfg
        );
        sendResponse({ ok: true, model: cfg.provider === "ollama" ? cfg.ollamaModel : cfg.provider, sample: reply.trim() });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // resposta assincrona
  }

  // Execucao do Live Analysis
  if (msg?.type === "LIVE_ANALYZE") {
    (async () => {
      try {
        const cfg = await getLLMConfig();
        const entries = msg.entries || [];
        if (!entries.length) {
          sendResponse({ ok: true, summary: "Aguardando mais falas na reunião para sintetizar...", suggestion: "" });
          return;
        }

        const roleDesc = ROLES_MAP[cfg.userRole] || ROLES_MAP.participante;
        const systemPrompt = `Você é o assistente de Live Analysis do MeetExpert em uma reunião em tempo real.
Seu usuário tem o seguinte papel na reunião: "${roleDesc}".

Diretrizes:
1. "summary": Faça um resumo conciso de 2 a 4 linhas em português sobre o que está sendo debatido nos trechos recentes, identificando os pontos-chave e quem está conduzindo.
2. "suggestion": Formule UMA sugestão pontual e pronta para falar em primeira pessoa ("ready-to-say") adequada ao papel do usuário, OU alerte se for um momento oportuno de intervenção (ex: perguntas abertas, discordâncias, pautas importantes). Se não houver necessidade de falar agora, deixe o texto amigável ou vazio.

IMPORTANTE: Responda APENAS em JSON válido no formato:
{
  "summary": "...",
  "suggestion": "..."
}`;

        const transcriptText = entries.map((e) => `[${e.speaker}]: ${e.text}`).join("\n");
        const rawOutput = await callLLMProvider(systemPrompt, `Últimos trechos da reunião:\n\n${transcriptText}`, cfg);
        const parsed = parseAnalysisOutput(rawOutput);
        
        sendResponse({
          ok: true,
          time: new Date().toTimeString().slice(0, 8),
          summary: parsed.summary,
          suggestion: parsed.suggestion
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // resposta assincrona
  }

  return false;
});
