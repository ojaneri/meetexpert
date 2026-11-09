/* MeetExpert — formato das transcricoes (compartilhado)
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */
/* Usado pelo arquivo (dashboard.js) e pelo popup do icone (popup.js):
   o .txt baixado pelos dois sai identico, com o mesmo hash. */

/* ---------------- formato ---------------- */

function mmss(ms) {
  const s = Math.floor((ms || 0) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}
function fmtDate(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function slug(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 48) || "transcricao";
}

/* Junta trechos consecutivos do mesmo falante (o commit por delta
   gera fragmentos; aqui remontamos o turno para leitura). */
function mergeTurns(entries) {
  const out = [];
  for (const e of entries || []) {
    const last = out[out.length - 1];
    if (last && last.speaker === e.speaker) {
      last.text = (last.text + " " + e.text).replace(/\s+/g, " ").trim();
    } else out.push({ ...e });
  }
  return out;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bodyText(rec) {
  return mergeTurns(rec.entries)
    .map((e) => `[${mmss(e.tRelMs)}] ${e.speaker}: ${e.text}`).join("\n");
}

function headerLines(rec) {
  return [
    `Plataforma:    ${rec.platform || "\u2014"}`,
    `Titulo:        ${rec.title || rec.meetingId}`,
    `Codigo:        ${rec.meetingId}`,
    `Data/hora:     ${fmtDate(rec.startedAt)}`,
    `Duracao:       ${mmss(rec.durationMs)}`,
    `Participantes: ${(rec.participants || []).join(", ") || "\u2014"}`,
    `Trechos:       ${(rec.entries || []).length}`,
  ];
}

async function fullText(rec) {
  const bar = "=".repeat(56);
  const hash = await sha256(bodyText(rec));
  return [bar, "TRANSCRICAO DE REUNIAO", bar, ...headerLines(rec),
    `SHA-256 corpo: ${hash}`, `Gerado por:    MeetExpert \u2014 Osvaldo Janeri Filho <osvaldo@perito.digital>`, bar, ""].join("\n") + bodyText(rec);
}


/* Registros nao finalizados (aba fechada no meio) chegam sem titulo,
   duracao ou participantes. Deriva o que der a partir dos proprios
   trechos, em vez de mostrar "00:00" e travessao. */
function normalize(rec) {
  const entries = rec.entries || [];
  const last = entries[entries.length - 1];
  const spk = [...new Set(entries.map((e) => e.speaker)
    .filter((s) => s && s !== "Desconhecido"))].sort((a, b) => a.localeCompare(b));
  const isTeams = /^teams_/i.test(rec.meetingId || "");
  const isZoom = /^zoom_/i.test(rec.meetingId || "");
  return {
    ...rec,
    id: rec.id || rec.meetingId, // registros antigos (<0.7) usam o codigo como chave
    platform: rec.platform || (isTeams ? "Microsoft Teams" : isZoom ? "Zoom" : "Google Meet"),
    title: rec.title || rec.meetingId,
    durationMs: rec.durationMs || (last ? last.tRelMs : 0),
    participants: (rec.participants && rec.participants.length) ? rec.participants : spk,
    partial: !rec.finalized,
  };
}

/* ---------------- exportacao ---------------- */

function saveBlob(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function baseName(rec) {
  return `meetexpert_${slug(rec.title || rec.meetingId)}_${(rec.startedAt || "").slice(0, 10)}`;
}
