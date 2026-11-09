/* MeetExpert — service worker: persistencia e selo REC
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */
/* Service worker — persistencia + selo REC.
   O clique no icone abre o popup (popup.html), que lista as reunioes gravadas. */

const KEY = (id) => `transcript:${id}`;

// Fila serial: get->set concorrente perdia trechos quando duas legendas
// chegavam juntas (cada uma lia o registro antes da outra gravar).
let chain = Promise.resolve();
const enqueue = (fn) => { chain = chain.then(fn).catch((e) => console.error("[MCG bg]", e)); };

async function load(recId) {
  const k = KEY(recId);
  return (await chrome.storage.local.get(k))[k];
}

// Selo "REC" no icone enquanto QUALQUER aba estiver transcrevendo, seja qual for
// a aba ativa. As abas gravando ficam em storage.session: o service worker pode
// dormir no meio da reuniao e precisa lembrar quem estava gravando.
async function setRecording(tabId, on) {
  const { recTabs = [] } = await chrome.storage.session.get("recTabs");
  const tabs = new Set(recTabs);
  if (on) tabs.add(tabId); else tabs.delete(tabId);
  await chrome.storage.session.set({ recTabs: [...tabs] });
  chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
  chrome.action.setBadgeText({ text: tabs.size ? "REC" : "" });
  chrome.action.setTitle({ title: tabs.size ? "MeetExpert — gravando" : "MeetExpert — reunioes gravadas" });
}
// Extensao instalada/recarregada no meio de uma reuniao: o Chrome nao injeta
// content scripts em abas ja abertas, e a reuniao so seria capturada depois de
// recarregar a aba (sair e voltar). Injeta nelas aqui.
chrome.runtime.onInstalled.addListener(async () => {
  for (const cs of chrome.runtime.getManifest().content_scripts || []) {
    const tabs = await chrome.tabs.query({ url: cs.matches }).catch(() => []);
    for (const t of tabs) {
      chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: !!cs.all_frames }, files: cs.js })
        .catch((e) => console.warn("[MCG bg] reinjecao falhou", t.url, e.message));
    }
  }
});

// Aba fechada no meio da reuniao nao manda STATE: tira o selo aqui.
chrome.tabs.onRemoved.addListener((tabId) => enqueue(() => setRecording(tabId, false)));

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "CAPTION") {
    enqueue(async () => {
      const e = msg.entry;
      const rec = (await load(msg.recId)) ||
        { id: msg.recId, meetingId: msg.meetingId, startedAt: e.ts, entries: [] };
      // upsert por id: legenda revisada substitui o texto em vez de duplicar
      const i = rec.entries.findIndex((x) => x.id === e.id);
      if (i >= 0) rec.entries[i] = e; else rec.entries.push(e);
      rec.updatedAt = e.ts;
      await chrome.storage.local.set({ [KEY(msg.recId)]: rec });
    });
  } else if (msg?.type === "META") {
    // Metadados durante a reuniao: mescla sem tocar nos trechos.
    enqueue(async () => {
      const rec = await load(msg.recId);
      if (!rec) return;
      const keep = rec.titleEdited ? { title: rec.title } : {};
      await chrome.storage.local.set({ [KEY(msg.recId)]: { ...rec, ...msg.meta, ...keep, entries: rec.entries } });
    });
  } else if (msg?.type === "FINALIZE") {
    const r = msg.record;
    enqueue(async () => {
      const cur = await load(r.id);
      const keep = cur?.titleEdited ? { title: cur.title, titleEdited: true } : {};
      await chrome.storage.local.set({
        [KEY(r.id)]: { ...r, ...keep, updatedAt: new Date().toISOString(), finalized: true },
      });
    });
  } else if (msg?.type === "STATE" && sender.tab?.id != null) {
    const tabId = sender.tab.id;
    enqueue(() => setRecording(tabId, !!msg.recording));
  }
  return false;
});
