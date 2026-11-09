# MeetExpert 0.8.0

Captura as legendas ao vivo do **Google Meet**, do **Microsoft Teams (web)** e do
**Zoom (web)**, arquiva as transcricoes diarizadas e oferece **Live Analysis em tempo real com IA** (local ou em nuvem). Sem bot na sala, sem gravar audio.

Osvaldo Janeri Filho <osvaldo@perito.digital>

---

## Novidade na v0.8.0: ⚡ Live Analysis com IA

Durante uma reunião, clique no botão **⚡ Live Analysis** no balão flutuante para abrir o painel inteligente com:
- **O que está acontecendo**: resumo contínuo das discussões em 2 a 4 linhas.
- **Sugestão de fala (1ª pessoa)**: frases e momentos oportunos para intervir na conversa, ajustadas ao seu papel (Perito Judicial, Advogado, Líder, Participante).
- **Histórico**: histórico navegável das análises geradas durante a chamada.
- **Controles**: botão `↻ Atualizar`, contagem regressiva e controle deslizante de intervalo (15s a 300s).
- **Painel móvel**: pode ser arrastado, minimizado (`—`) ou fechado (`×`) sem parar a gravação.

### Como configurar a IA:
1. Clique no ícone do MeetExpert na barra de extensões do Chrome.
2. Clique na aba **⚙️ IA**.
3. Escolha o seu provedor:
   - **Local (Ollama)**: 100% privado e gratuito, rodando na sua máquina.
     - Dê duplo-clique no arquivo `instalar-ia-local.bat` na pasta da extensão para instalar o Ollama e baixar o modelo recomendado (**Qwen 2.5 3B** ~1.9 GB).
     - No popup, clique em **Detectar** para listar os modelos locais e em **Testar Conexão**.
   - **Remoto Gratuito (OpenRouter)**: use modelos como `Gemini 2.0 Flash` ou `Llama 3.3 70B` sem consumir recursos do seu PC. Basta colocar a sua chave gratuita do OpenRouter.
   - **Google Gemini API**: coloque a chave de API gratuita do Google AI Studio.
   - **Personalizado**: conecte a qualquer endpoint compatível com OpenAI (LM Studio, vLLM, etc.).

---

## Instalar

1. Abra `chrome://extensions`
2. Ligue o **Modo desenvolvedor** (canto superior direito)
3. **Carregar sem compactacao** → selecione esta pasta
4. Fixe o MeetExpert na barra (icone de quebra-cabeca → alfinete)

## Usar

**Durante a reuniao** — entre no Meet, no Teams web ou no Zoom web. A extensao tenta
ligar as legendas sozinha (no Zoom, ligue voce). Um balao aparece no canto inferior
esquerdo, e o icone ganha o selo vermelho **REC** enquanto qualquer aba estiver
gravando:

| balao | significado |
|---|---|
| cinza | aguardando as legendas (ligue o CC se ele pedir) |
| vermelho pulsante | gravando — mostra a contagem de trechos |
| ambar | salvando, ao detectar o fim |
| verde | salvo, com o botao **Abrir transcricao** |

**Depois** — clique no icone do MeetExpert. O popup lista as reunioes gravadas,
separadas por reuniao (cada entrada e saida vira uma gravacao), com o botao **.txt**
para baixar cada uma; o que esta gravando agora aparece com **REC**. Em **Abrir
arquivo completo** voce busca, le, exporta em **.pdf**, renomeia e apaga.

Se a extensao for recarregada no meio de uma reuniao, ela se injeta de novo nas
abas abertas — nao precisa sair e voltar da reuniao.

Se voce fechar a aba no meio, nada se perde: os trechos sao gravados
continuamente e os metadados a cada 15s. O registro fica marcado como
**parcial**, com duracao e participantes deduzidos dos proprios trechos.

## Requisitos

- As **legendas precisam estar ligadas**. E delas que o texto sai.
- **Teams: so no navegador** (`teams.microsoft.com`). O app de desktop e
  Electron — extensao de Chrome nao alcanca, e nao ha como contornar.
- No Teams o botao de legendas costuma ficar em *Mais acoes → Idioma e fala*.
  Se a extensao nao conseguir ligar, o balao cinza avisa.
- **Zoom: so no navegador** (`app.zoom.us/wc/...`, "Entrar pelo navegador"). O app de
  desktop nao e alcancavel. Ligue as legendas em *Mais (...) → Legendas*; se a opcao
  nao existir, o anfitriao nao habilitou legendas na reuniao.
- No Zoom a legenda mostra so as **iniciais** do falante. A extensao troca pelo nome
  completo quando o ve na tela (tiles de video, video em destaque ou lista de
  participantes). Se dois participantes tiverem as mesmas iniciais, fica a sigla.

## Se parar de funcionar

Google e Microsoft trocam a estrutura interna das paginas sem aviso. Quando isso
acontece, **o ajuste e sempre no `platform.js`** — abra o DevTools na reuniao com
as legendas ligadas, inspecione um bloco de legenda e corrija:

| sintoma | o que ajustar |
|---|---|
| transcricao vazia | `captionRoot`, `captionBlock` |
| falante sempre "Desconhecido" | `speakerSel` |
| texto sujo no Teams | `textSel` |
| nao liga a legenda sozinho | `captionButtonOn` / `captionButtonOff` |
| participantes faltando | `rosterName` |
| nao detecta o fim | `leaveScreen`, `inMeeting` |
| Teams nao captura nada | tente `"all_frames": true` no `manifest.json` |

O restante do codigo nao depende desses seletores.

## Aviso importante

O **SHA-256** que aparece no arquivo e no rodape dos exports confere a
**integridade do texto exportado** — nao a origem dele, nem a fidelidade ao que
foi dito. A transcricao e produzida pelo motor de fala do Google ou da Microsoft,
que voce nao controla nem audita.

Para uso probatorio isso nao basta. O caminho seria bot proprio com STT sob seu
controle e cadeia de custodia desde a captacao.

**LGPD:** avise os participantes antes de transcrever.

## Personalizar

Todas as cores saem das variaveis `:root` no topo do `dashboard.css` — mexer
nelas muda a interface **e** as cores do PDF (via a constante `BRAND` no
`dashboard.js`).

Paleta atual: indigo `#1a1454`, coral `#ff6b57` (e `#bb4f40` quando vira texto,
para passar em 4.5:1 de contraste), violeta `#392a9c`.

## Arquivos

| | |
|---|---|
| `platform.js` | adaptadores de DOM (Meet / Teams) — o unico ponto fragil |
| `content.js` | captura, deduplicacao, metadados, fim de reuniao |
| `ui.js` | balao de status e modal de fim |
| `background.js` | persistencia e abertura do arquivo |
| `dashboard.*` | o arquivo de transcricoes |
| `vendor/` | jsPDF (local: MV3 proibe script remoto) |
| `icons/`, `brand/` | identidade visual |

---

MeetExpert · Osvaldo Janeri Filho <osvaldo@perito.digital>

## Novidades da 0.7.0

- Teams: dominios `teams.cloud.microsoft` e `teams.microsoft.us`; seletores do Teams novo (v2);
  varias reunioes na mesma aba (SPA); fim de reuniao por DOM com tolerancia a re-render;
  liga as legendas pelo menu (Mais > Idioma e fala) e oferece o botao "Ligar legendas" no balao.
- Legendas revisadas pelo ASR substituem o trecho (upsert por id) em vez de duplicar.
- Cada reuniao tem registro proprio (links recorrentes do Meet nao se misturam mais).
- Fila de gravacao no service worker (sem perda de trechos) e selo REC no icone.
- Registros antigos (<0.7) continuam abrindo normalmente.

## IA (0.7.1)

No dashboard, **Copiar prompt IA** copia um prompt pronto (resumo, decisoes, pendencias com
responsavel/prazo/timestamp, termos suspeitos do ASR) com a transcricao dentro. Cole no `claude`
ou use `claude -p`. A transcricao vai marcada como dado (delimitador aleatorio) para que falas
com "instrucoes" nao sejam obedecidas. Prefira rodar sem ferramentas/YOLO.
Privacidade: o texto sai da sua maquina ao colar; `claude-ghost` usa gateway de terceiros.
Renomear: clique no titulo ou em **Renomear**.
