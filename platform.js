/* MeetExpert — adaptadores de DOM por plataforma
 * Osvaldo Janeri Filho <osvaldo@perito.digital>
 */
/* ============================================================
   platform.js — adaptadores por plataforma
   Toda a fragilidade de DOM esta CONCENTRADA aqui.
   Quando Google/Microsoft/Zoom mudarem o markup, e este o unico
   arquivo que voce precisa tocar.
   ============================================================ */

function mcgCleanTitle(raw, strip) {
  return (raw || "")
    .replace(strip, "")
    .replace(/[|–—]/g, " ")
    .replace(/\(\d+\)/g, "")       // "(3) Teams" -> notificacoes
    .replace(/\s*[-–]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Botao visivel cujo aria-label bate exatamente com o padrao.
function mcgButtonByLabel(re) {
  return [...document.querySelectorAll("button[aria-label], [role='button'][aria-label]")]
    .some((b) => b.getClientRects().length && re.test((b.getAttribute("aria-label") || "").trim()));
}

const MCG_PLATFORMS = {
  /* ------------------------- GOOGLE MEET ------------------------- */
  meet: {
    id: "meet",
    label: "Google Meet",
    match: () => location.hostname === "meet.google.com",

    captionRoot: [
      'div[role="region"][aria-label*="aption" i]',
      'div[role="region"][aria-label*="egenda" i]',
      'div[role="region"][aria-label*="ubtitle" i]',
      'div[jsname="xySENc"]',
      'div[jsname="r4nke"]',
      'div[class*="a4cQT"]',
      'div[class*="iTTPOb"]',
      'div[aria-label*="aption" i]:not([role="button"]):not([role="toolbar"])',
      'div[aria-label*="egenda" i]:not([role="button"]):not([role="toolbar"])',
    ],
    captionBlock: 'div[class*="TBMuR"], div[class*="nMxHGf"], div[class*="bh44bd"], :scope > div',
    speakerSel: '[data-self-name], [class*="zs75Bi"], [class*="name"], span:first-child',
    textSel: '[class*="VbkSUe"], [class*="CNusmb"], [class*="yg7OAc"]',

    // Botao de legendas fica exposto na barra inferior do Meet.
    captionButtonAny: /captions|legendas/i,
    captionButtonOn: /turn on captions|ativar legendas|activate captions|mostrar legendas/i,
    captionButtonOff: /turn off captions|desativar legendas/i,
    captionsInMenu: false,
    captionMenuFlow: null,

    rosterName: "[data-participant-id] [data-self-name], [data-participant-id] div",

    // O Meet mantem o mesmo path na tela "Voce saiu": precisa olhar o texto.
    // Checado com throttle (innerText forca layout).
    leaveScreen: /you left the meeting|voc[eê] saiu|return to home|voltar [aà] tela inicial|reingressar|rejoin/i,
    useLeaveText: true,
    endTicks: 4,        // ticks (500ms) consecutivos "fora da sala" ate encerrar

    // Estamos numa sala? Botao de sair presente = em chamada (no pre-join nao existe).
    inMeeting: () =>
      mcgButtonByLabel(/^(leave call|sair da chamada|salir de la llamada)$/i),

    meetingId: () => location.pathname.replace(/\//g, "") || "meet",
    title: () => mcgCleanTitle(document.title, /google meet|\bmeet\b/gi),
  },

  /* ------------------------ MICROSOFT TEAMS ---------------------- */
  teams: {
    id: "teams",
    label: "Microsoft Teams",
    match: () =>
      /(^|\.)teams\.(microsoft\.com|live\.com|cloud\.microsoft|microsoft\.us)$/.test(location.hostname),

    // Teams marca elementos com data-tid — mais estavel que classe,
    // mas ainda assim sujeito a mudanca entre versoes do cliente web.
    // Os "closed-caption-v2-*" sao do Teams novo (v2); os demais, do classico.
    captionRoot: [
      '[data-tid="closed-caption-v2-virtual-list-content"]',
      '[data-tid="closed-caption-v2-window-wrapper"]',
      '[data-tid="closed-caption-renderer-wrapper"]',
      '[data-tid="closed-captions-renderer"]',
      '[data-tid="closed-caption-container"]',
      '[class*="closedCaption"][class*="ontainer"]',
      '[aria-label*="aption"][role="region"]',
      '[aria-label*="egenda"][role="region"]',
    ],
    // .fui-ChatMessageCompact = item de legenda do Teams v2 (Fluent UI).
    // Nao usar [class*=...]: casaria filhos (fui-ChatMessageCompact__body) e duplicaria texto.
    captionBlock:
      '[data-tid="closed-caption-message"], .fui-ChatMessageCompact, .ui-chat__item, [class*="captionMessage"]',
    speakerSel:
      '[data-tid="author"], .fui-ChatMessageCompact__author, .ui-chat__message__author, [class*="author"]',
    textSel:
      '[data-tid="closed-caption-text"], .fui-ChatMessageCompact__body, .ui-chat__message__content, [class*="captionText"]',

    // No Teams o toggle de legendas fica no menu "Mais acoes" (...), nao na barra.
    // captionMenuFlow leva la: Mais > Idioma e fala > Legendas ao vivo.
    captionButtonAny: /captions|legenda/i,
    captionButtonOn: /turn on live captions|ativar legendas|ativar closed caption/i,
    captionButtonOff: /turn off live captions|desativar legendas|desligar legendas/i,
    captionsInMenu: true,
    captionMenuFlow: [
      {
        sel: [
          'button[data-tid="more-button"]',
          '#callingButtons-showMoreBtn',
          "button[aria-label], [role='button'][aria-label]",
        ],
        re: /^(more|mais)( actions| a[cç][oõ]es| op[cç][oõ]es)?$|more actions|mais a[cç][oõ]es/i,
      },
      {
        sel: ['[role="menuitem"], [role="menuitemcheckbox"], button'],
        re: /language and speech|idioma e fala|linguagem e fala/i,
      },
      {
        sel: ['[role="menuitem"], [role="menuitemcheckbox"], button'],
        re: /live captions|legendas ao vivo|turn on live captions|ativar legendas/i,
      },
    ],

    rosterName:
      '[data-tid="participant-name"], [data-tid="roster-participant"] [class*="name"]',

    // No Teams o fim = botao de desligar sumiu por varios ticks seguidos.
    // NAO olhar texto da pagina: o historico do chat contem "Meeting ended" etc.
    leaveScreen: null,
    useLeaveText: false,
    endTicks: 8,

    // So DOM da chamada. Nada de "meeting" na URL: pre-join, calendario e
    // chat tambem tem isso e davam falso "entrou/saiu".
    inMeeting: () =>
      !!document.querySelector(
        '#hangup-button, [data-tid="hangup-main-btn"], [data-tid="call-hangup"], button[id*="hangup"]'
      ) || mcgButtonByLabel(/^(leave|hang up|sair|desligar)$/i),

    meetingId: () => {
      // Thread id (19:meeting_XXXX) quando a URL expoe; senao vazio (o content.js
      // gera um id pela hora de entrada — o Teams v2 nao poe o id na URL).
      const m = decodeURIComponent(location.href).match(/19[:%]3?a?meeting_([A-Za-z0-9]+)/i);
      return m ? "teams_" + m[1].slice(0, 24) : "";
    },

    title: () => {
      for (const sel of [
        '[data-tid="call-title"]', '[data-tid="meeting-title"]',
        '[data-tid="call-status-title"]', '[data-tid="calling-title"]',
      ]) {
        const t = (document.querySelector(sel)?.innerText || "").trim();
        if (t) return t;
      }
      const t = mcgCleanTitle(document.title, /microsoft teams|\bteams\b/gi);
      // Titulos genericos da navegacao nao dizem nada sobre a reuniao.
      if (/^(chat|calendar|calend[aá]rio|activity|atividade|calls?|chamadas?|teams|communities|comunidades)$/i.test(t)) return "";
      return t;
    },
  },

  /* ----------------------------- ZOOM ---------------------------- */
  // Cliente web (app.zoom.us/wc/<id>/...). A reuniao roda dentro do iframe
  // #webclient, da mesma origem: o manifest injeta com all_frames so no Zoom.
  // A pagina de fora tambem casa, mas nunca tem o botao de sair, entao nao grava.
  zoom: {
    id: "zoom",
    label: "Zoom",
    match: () => /(^|\.)zoom\.us$/.test(location.hostname) && location.pathname.startsWith("/wc/"),

    // Sobreposicao arrastavel que so existe com as legendas ligadas.
    captionRoot: [
      ".live-transcription-subtitle__box",
      ".live-transcription-subtitle__content",
    ],
    // Uma linha por fala. O Zoom repete o id em todas e esconde (display:none)
    // as antigas — por isso [id=...] e nao #id.
    captionBlock: '[id="live-transcription-subtitle"]',
    speakerSel: ".zmu-data-selector-item__icon",
    textSel: ".live-transcription-subtitle__item",
    // A legenda so traz as iniciais do falante; content.js chama isto para trocar pelo nome.
    resolveSpeaker: (initials) => mcgZoomName(initials),

    // A barra tem o botao "Show Captions"/"Hide Captions" (classe new-lt-button);
    // tryEnableDirect liga por ele. Quando a barra e estreita ele cai em
    // Mais (...), e ai o balao pede para ligar.
    captionButtonAny: /captions|legenda/i,
    captionButtonOn: /^(show captions|turn on captions|mostrar legendas|ativar legendas)$/i,
    captionButtonOff: /^(hide captions|turn off captions|ocultar legendas|desativar legendas)$/i,
    captionsInMenu: true,
    captionMenuFlow: null,

    // Galeria (__avatar-name), video em destaque/compartilhamento (span do __avatar-footer)
    // e lista de participantes, quando aberta.
    rosterName:
      ".video-avatar__avatar-name, .video-avatar__avatar-footer > span, .participants-item__display-name",

    leaveScreen: null,
    useLeaveText: false,
    endTicks: 8,

    // Botao de sair no DOM, visivel ou nao: a barra inferior se esconde sozinha
    // quando o mouse para, e isso nao pode encerrar a sessao.
    inMeeting: () =>
      [...document.querySelectorAll("button[aria-label]")].some((b) =>
        /^(leave|leave room|leave meeting|end|sair|sair da sala|sair da reuni[aã]o|encerrar)$/i
          .test((b.getAttribute("aria-label") || "").trim())),

    meetingId: () => {
      const m = location.pathname.match(/\/wc\/(\d+)/);
      return m ? "zoom_" + m[1] : "";
    },
    title: () => mcgCleanTitle(document.title, /zoom( workplace| meetings?)?/gi),
  },
};

/* Zoom: iniciais -> nome. O Zoom monta as iniciais com a 1a letra das duas
   primeiras palavras do nome exibido ("Osvaldo Janeri Filho" -> "OJ"). Os nomes
   so aparecem nos tiles de video e na lista de participantes, que somem conforme
   o layout; por isso ficam guardados enquanto a aba vive. */
const mcgZoomNames = new Map(); // nome -> iniciais
let mcgZoomNamesAt = 0;

function mcgZoomInitials(name) {
  const w = name.split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase();
}

function mcgZoomName(initials) {
  if (Date.now() - mcgZoomNamesAt > 2000) {
    mcgZoomNamesAt = Date.now();
    document.querySelectorAll(MCG_PLATFORMS.zoom.rosterName).forEach((el) => {
      const n = (el.innerText || "").split("\n")[0]
        .replace(/\((host|co-host|me|eu|guest|anfitri[aã]o|coanfitri[aã]o|convidado)\)/gi, "")
        .replace(/\s+/g, " ").trim();
      if (n && n.length < 60) mcgZoomNames.set(n, mcgZoomInitials(n));
    });
  }
  const key = (initials || "").toUpperCase();
  const hits = [...mcgZoomNames].filter(([, i]) => i === key).map(([n]) => n);
  return hits.length === 1 ? hits[0] : initials; // ambiguo ou desconhecido: fica a sigla
}

function mcgDetectPlatform() {
  for (const p of Object.values(MCG_PLATFORMS)) {
    if (p.match()) return p;
  }
  return null;
}
