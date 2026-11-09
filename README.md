# MeetExpert v0.8.0

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="MeetExpert Logo">
  <br>
  <b>Captura de legendas, diarização criptográfica e Live Analysis com Inteligência Artificial para reuniões online</b>
  <br>
  <i>Compatível com Google Meet, Microsoft Teams e Zoom web</i>
</p>

<p align="center">
  <a href="https://github.com/ojaneri/meetexpert"><img src="https://img.shields.io/badge/GitHub-ojaneri%2Fmeetexpert-blue?logo=github" alt="GitHub Repo"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-success" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Privacidade-100%25%20Local-green" alt="Privacidade Local">
  <img src="https://img.shields.io/badge/IA-Ollama%20%7C%20Gemini%20%7C%20OpenRouter-orange" alt="IA">
  <img src="https://img.shields.io/badge/Licen%C3%A7a-MIT-blue" alt="License">
</p>

---

## 📌 O que é o MeetExpert?

O **MeetExpert** é uma extensão para navegadores Chromium (Google Chrome, Brave, Edge, Opera) que transcreve reuniões em tempo real diretamente das legendas da tela, sem a necessidade de convidar bots invasivos nem gravar o áudio da sala.

Durante a conferência, um assistente de **Live Analysis com IA** monitora a conversa, resume os pontos críticos e fornece **sugestões de fala em primeira pessoa (*ready-to-say*)** adaptadas ao seu papel (participante, líder ou ouvinte) e ao idioma da chamada.

Ao final, todo o histórico é arquivado localmente no seu computador com **assinatura digital SHA-256**, permitindo busca textual e exportação em formato TXT ou relatórios diagramados em **PDF pericial**.

---

## ⚡ Guia Rápido de Instalação (3 Passos)

### Passo 1: Instalar a Extensão no Google Chrome

1. Baixe ou clone este repositório:
   ```bash
   git clone https://github.com/ojaneri/meetexpert.git
   ```
2. Abra o Google Chrome e acesse: `chrome://extensions/`
3. No canto superior direito, ative a chave **"Modo do desenvolvedor"**.
4. No canto superior esquerdo, clique em **"Carregar sem compactação"** (ou *Load unpacked*).
5. Selecione a pasta do projeto `meetexpert` (onde está o arquivo `manifest.json`).
6. **Fixe o ícone**: Clique no botão de quebra-cabeça (Extensões) no Chrome e clique no alfinete 📌 ao lado do MeetExpert.

---

### Passo 2: Instalar a IA Local (1 Clique)

Você pode rodar a IA 100% localmente no seu computador, de forma gratuita, ilimitada e com sigilo total (sem enviar áudio ou texto para terceiros).

#### No Windows:
- Dê um **duplo clique no arquivo `instalar-ia-local.bat`** na pasta do projeto.
- O script verificará se o Ollama está instalado (e instala via `winget` se necessário).
- Escolha a opção recomendada **`1` (Qwen 2.5 3B)** para baixar um modelo ultra rápido e fluente em português.

#### No Linux ou macOS:
- Abra o terminal na pasta do projeto e execute:
  ```bash
  chmod +x instalar-ia-local.sh
  ./instalar-ia-local.sh
  ```

> **Alternativa em nuvem:** Se preferir não rodar IA local, você pode usar chaves gratuitas do **OpenRouter** (`openrouter.ai`) ou **Google Gemini API** (`aistudio.google.com`) configurando-as na aba **⚙️ IA** da extensão.

---

### Passo 3: Ativar no Navegador

1. Clique no ícone do **MeetExpert** na barra de ferramentas do Chrome.
2. Acesse a aba **⚙️ IA**.
3. Em **Provedor**, selecione **Local — Ollama (Privado & Gratuito)**.
4. Clique no botão **Detectar** (ele reconhecerá os modelos instalados no seu Ollama).
5. Clique em **Testar Conexão** e depois em **Salvar**!

---

## 📖 Documentação em HTML Integrada

O MeetExpert conta com um **Manual Completo em HTML** integrado à extensão:

- **Como acessar:** Basta clicar no ícone do MeetExpert no navegador e clicar na aba **📖 Ajuda** ou no botão **"🚀 Abrir Documentação Completa (HTML)"**.
- O manual abrirá diretamente no navegador em uma interface responsiva, com instruções passo a passo, atalhos, guia de segurança, resolução de dúvidas e explicação detalhada dos recursos.

---

## 🎙️ Como Usar Durante as Reuniões

O MeetExpert captura as legendas em tempo real. Portanto, basta **ligar as legendas** na sua chamada:

| Plataforma | Como Ligar as Legendas |
|---|---|
| **Google Meet** | Clique no botão **`CC`** na barra inferior da chamada. |
| **Microsoft Teams** | Clique em **`...` (Mais)** &rarr; **Idioma e fala** &rarr; **Ativar legendas ao vivo**. |
| **Zoom (Web)** | Clique no botão **Mostrar Legendas** na barra inferior. |

### Indicadores na Tela:
- **Balão de Gravação (canto superior esquerdo):** Surge automaticamente mostrando que a reunião está sendo gravada e diarizada.
- **Painel Flutuante Live Analysis (canto direito):**
  - **Síntese:** Resumo dinâmico do bloco de discussão recente.
  - **Pontos Críticos:** Dúvidas em aberto, decisões tomadas ou prazos citados.
  - **Sugestões de Intervenção:** Sugestões prontas de fala elaboradas para o seu perfil e no idioma da reunião.
  - **Atualizar Agora / Pausar:** Controle manual a qualquer momento.

---

## 📑 Histórico, Busca e Exportação (PDF & TXT)

Clique no ícone da extensão &rarr; **"Abrir arquivo completo"** para acessar o painel de transcrições:

- **Busca Global:** Filtre qualquer palavra dita em todas as suas reuniões passadas.
- **Edição de Títulos:** Personalize o nome e as observações de cada reunião.
- **Exportação TXT:** Arquivo de texto puro com oradores e horários.
- **Exportação PDF Pericial:** Documento diagramado profissionalmente, pronto para anexar a relatórios técnicos, atas e processos judiciais, acompanhado do **hash criptográfico SHA-256** para verificação de integridade e não-repúdio.

---

## 📁 Estrutura de Arquivos do Projeto

```text
meetexpert/
├── manifest.json              # Manifesto V3 da extensão Chrome
├── background.js              # Service Worker, mensageria e chamadas de IA
├── content.js                 # Injeção no Meet, Teams e Zoom para captura
├── platform.js                # Normalização e seletores de legendas de cada app
├── ui.js                      # Painel flutuante de Live Analysis e balão de gravação
├── popup.html                 # Interface ao clicar no ícone da extensão
├── popup.js                   # Lógica do popup (reuniões, IA e ajuda)
├── popup.css                  # Estilos do popup
├── docs.html                  # Manual oficial completo em HTML
├── dashboard.html             # Painel completo de consulta, busca e edição
├── dashboard.js               # Gerenciamento de histórico e exportação
├── dashboard.css              # Estilos do painel de transcrições
├── format.js                  # Diarização, formatação e cálculo SHA-256
├── instalar-ia-local.bat      # Instalador de 1 clique para Windows
├── instalar-ia-local.sh       # Instalador para Linux e macOS
├── scripts/
│   ├── setup-ollama.ps1       # Script PowerShell para Windows
│   └── setup-ollama.sh        # Script Bash para Linux/macOS
├── icons/                     # Ícones oficiais da extensão (16, 32, 48, 128px)
└── README.md                  # Este manual rápido
```

---

## 🔒 Segurança, Privacidade e LGPD

- **Zero Captura de Áudio:** O MeetExpert não escuta microfones nem grava saídas de som.
- **Armazenamento 100% Local:** Os dados ficam gravados exclusivamente no banco de dados local do seu navegador (`chrome.storage.local`).
- **Sigilo Profissional:** Com o modo Ollama Local, os dados da reunião nunca trafegam pela internet, sendo ideal para advogados, peritos judiciais, médicos e ambientes corporativos restritos.

---

## 👨‍💻 Autor e Repositório

- **Autor:** Osvaldo Janeri Filho (`osvaldo@perito.digital`)
- **Repositório Oficial:** [github.com/ojaneri/meetexpert](https://github.com/ojaneri/meetexpert)
