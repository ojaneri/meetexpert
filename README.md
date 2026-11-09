# MeetExpert v0.8.0

**Captura de legendas e Live Analysis inteligente para reuniões online (Google Meet, Microsoft Teams e Zoom web)**

O **MeetExpert** transcreve reuniões em tempo real diretamente das legendas do navegador, com separação de participantes (diarização), timestamps e integridade criptográfica SHA-256. Além disso, conta com um assistente de **Live Analysis com IA** que resume o andamento da reunião e fornece sugestões de intervenção em primeira pessoa (*ready-to-say*), funcionando tanto com **IA Local 100% privada** quanto com **APIs gratuitas em nuvem**.

> **Privacidade por design:** Sem bot na sala, sem gravação de áudio e sem envio desnecessário de dados.

Desenvolvido por: **Osvaldo Janeri Filho** `<osvaldo@perito.digital>`

---

## Índice

1. [Instalação da Extensão no Google Chrome](#1-instalação-da-extensão-no-google-chrome)
2. [Configuração da Inteligência Artificial](#2-configuração-da-inteligência-artificial)
   - [Opção A: IA Local 100% Privada e Gratuita (Ollama)](#opção-a-ia-local-100-privada-e-gratuita-ollama)
   - [Opção B: IA Remota Gratuita via OpenRouter](#opção-b-ia-remota-gratuita-via-openrouter)
   - [Opção C: IA Remota Gratuita via Google Gemini API](#opção-c-ia-remota-gratuita-via-google-gemini-api)
   - [Opção D: Provedor Personalizado (OpenAI Compatível)](#opção-d-provedor-personalizado-openai-compatível)
3. [Como Usar Durante a Reunião](#3-como-usar-durante-a-reunião)
   - [Ligar Legendas nas Plataformas](#ligar-legendas-nas-plataformas)
   - [Balão de Gravação](#balão-de-gravação)
   - [Painel Flutuante de Live Analysis](#painel-flutuante-de-live-analysis)
4. [Consulta de Histórico e Exportação (TXT e PDF)](#4-consulta-de-histórico-e-exportação-txt-e-pdf)
5. [Controle de Versão e Rollback (Git)](#5-controle-de-versão-e-rollback-git)
6. [Resolução de Problemas (Troubleshooting)](#6-resolução-de-problemas-troubleshooting)

---

## 1. Instalação da Extensão no Google Chrome

A instalação é feita em menos de 1 minuto em modo desenvolvedor:

1. Abra o navegador **Google Chrome**.
2. Digite na barra de endereços: `chrome://extensions/` e pressione **Enter**.
3. No canto superior direito, ative a chave **Modo do desenvolvedor**.
4. No canto superior esquerdo, clique no botão **Carregar sem compactação** (ou *Load unpacked*).
5. Selecione a pasta do projeto: `D:\MeetExpert` (a pasta que contém o arquivo `manifest.json`).
6. **Fixe a extensão na barra do navegador**:
   - Clique no ícone de quebra-cabeça (Extensões) ao lado da barra de endereços do Chrome.
   - Localize o **MeetExpert** e clique no ícone de **alfinete** para deixá-lo sempre visível.

> **Dica:** Sempre que fizer alterações no código da extensão, basta abrir `chrome://extensions/` e clicar no botão circular de **Recarregar** (🔄) no card do MeetExpert.

---

## 2. Configuração da Inteligência Artificial

O MeetExpert permite que você escolha entre executar a IA **localmente no seu computador** (com total privacidade e conformidade com LGPD) ou através de **APIs gratuitas em nuvem**.

Para acessar as configurações:
1. Clique no ícone do **MeetExpert** na barra de ferramentas do Chrome.
2. No topo do popup, clique no botão **⚙️ IA**.

---

### Opção A: IA Local 100% Privada e Gratuita (Ollama)

Ideal para sigilo profissional absoluto (perícias, audiências, reuniões jurídicas ou corporativas confidenciais). Nenhum texto sai do seu computador.

#### 1. Instalar o Ollama e Baixar o Modelo
Criamos um instalador automático em lote para facilitar:
1. Abra a pasta `D:\MeetExpert` no Windows Explorer.
2. Dê **duplo-clique no arquivo `instalar-ia-local.bat`**.
3. O script verificará se o Ollama está instalado:
   - Se não estiver, solicitará autorização para instalar automaticamente via `winget`.
4. Um menu interativo será exibido com as opções de modelos:
   - **`1) Qwen 2.5 3B` (~1.9 GB) [RECOMENDADO]**: Ultra rápido, consome apenas ~2 GB de memória gráfica/RAM e tem excelente domínio da língua portuguesa.
   - **`2) Llama 3.2 3B` (~2.0 GB)**: Rápido e leve, desenvolvido pela Meta.
   - **`3) Qwen 2.5 7B` (~4.7 GB)**: Maior capacidade analítica para sínteses detalhadas e termos técnicos.
   - **`4) Llama 3.1 8B` (~4.9 GB)**: Modelo robusto de 8 bilhões de parâmetros.
5. Digite `1` e pressione **Enter**. O download iniciará e o modelo será registrado automaticamente no seu computador.

#### 2. Ativar no MeetExpert
1. No popup da extensão, na aba **⚙️ IA**, selecione o provedor: **Local — Ollama**.
2. Clique no botão **Detectar** para carregar os modelos instalados no seu Ollama.
3. Selecione o modelo baixado (ex: `qwen2.5:3b`).
4. Clique em **Testar Conexão** (deve retornar `Conectado!`).
5. Clique em **Salvar**.

---

### Opção B: IA Remota Gratuita via OpenRouter

Ideal caso você prefira não ocupar espaço em disco ou rodar em computadores sem placa de vídeo dedicada.

1. Acesse [openrouter.ai/keys](https://openrouter.ai/keys) e crie uma conta gratuita.
2. Crie uma nova API Key (chave gratuita) e copie o código `sk-or-v1-...`.
3. No popup do MeetExpert (**⚙️ IA**), selecione: **Remoto — OpenRouter (Modelos Free)**.
4. Cole a sua chave no campo **API Key do OpenRouter**.
5. Escolha o modelo gratuito desejado:
   - `Google Gemini 2.0 Flash (Free)` &rarr; Respostas quase instantâneas.
   - `Meta Llama 3.3 70B (Free)` &rarr; Altíssima inteligência e síntese profunda.
   - `Qwen 2.5 72B (Free)` &rarr; Excelente para raciocínio complexo.
6. Clique em **Testar Conexão** e depois em **Salvar**.

---

### Opção C: IA Remota Gratuita via Google Gemini API

1. Acesse [aistudio.google.com](https://aistudio.google.com) e entre com sua conta Google.
2. Clique em **Get API key** e copie a sua chave (`AIzaSy...`).
3. No popup do MeetExpert (**⚙️ IA**), selecione: **Remoto — Google Gemini API (Gratuito)**.
4. Cole a sua chave, selecione `Gemini 2.0 Flash`, teste a conexão e clique em **Salvar**.

---

### Opção D: Provedor Personalizado (OpenAI Compatível)

Se você já utiliza ferramentas como **LM Studio**, **Jan**, **LocalAI** ou um servidor interno na sua rede:
1. Selecione **Personalizado (OpenAI Compatível)**.
2. Informe o endpoint completo (ex: `http://localhost:1234/v1/chat/completions`).
3. Informe a API Key (se aplicável) e o nome do modelo carregado.
4. Teste a conexão e salve.

---

### Personalização do Papel na Reunião
Na seção **Preferências de Análise**, você pode indicar seu papel principal:
- *Participante geral / Colaborador*
- *Perito Judicial / Assistente Técnico especialista* (foco em provas, prazos e teses técnicas)
- *Advogado / Jurídico* (foco em termos legais e acordos)
- *Líder / Coordenador da reunião* (foco em encaminhamentos e decisões)

A IA personalizará o vocabulário e o estilo das sugestões de fala para a função escolhida.

---

## 3. Como Usar Durante a Reunião

### Ligar Legendas nas Plataformas

O MeetExpert lê o texto gerado pelas próprias plataformas de videoconferência. Portanto, **as legendas precisam estar ligadas**:

* **Google Meet**: Clique no botão **CC** na barra inferior (ou pressione a tecla `C`).
* **Microsoft Teams (apenas versão Web)**:
  - Acesse pelo navegador em `teams.microsoft.com`.
  - Na barra de controles da chamada, clique em **Mais (...)** &rarr; **Idioma e fala** &rarr; **Ativar legendas ao vivo**.
* **Zoom (apenas versão Web)**:
  - Acesse pelo navegador através do link `app.zoom.us/wc/...` ("Entrar pelo navegador").
  - Clique em **Mais (...)** &rarr; **Legendas**.

---

### Balão de Gravação

Assim que você entra na chamada e as legendas começam a ser geradas, um balão flutuante estilizado aparece no canto inferior esquerdo:

| Cor / Estado do Balão | Significado |
|---|---|
| **Cinza** | Aguardando detecção das legendas (ligue o CC se solicitado). |
| **Vermelho pulsante** | **Gravando** — exibe a contagem de trechos capturados em tempo real. |
| **Ambar** | Finalizando e salvando transcrição ao término da reunião. |
| **Verde** | Salvo com sucesso. Oferece o botão para abrir a transcrição. |

O balão conta com botões rápidos:
- **Ver transcrição**: Abre a modal com a íntegra dos trechos falados até o momento.
- **`⚡ Live Analysis`**: Abre ou fecha o painel inteligente de IA.

---

### Painel Flutuante de Live Analysis

Ao clicar em **`⚡ Live Analysis`**, abre-se o painel flutuante no canto superior direito da reunião:

1. **O que está acontecendo**:
   - Resumo dinâmico de 2 a 4 linhas sobre o tópico debatido recentemente, apontando quem está com a palavra e quais são os pontos-chave.
2. **Sugestão de fala (1ª pessoa)**:
   - Sugestões acionáveis e pontuais para você participar da reunião (ex: *"Gostaria de solicitar que conste em ata o prazo para entrega do laudo complementar..."*).
   - Destaque em verde claro quando há um momento oportuno de fala (perguntas abertas, solicitações de esclarecimento).
3. **Histórico Expansível**:
   - Clique em **`▸ Histórico`** para ver todas as sínteses geradas ao longo da chamada, ordenadas por horário.
4. **Controles Inferiores**:
   - **`↻ Atualizar`**: Força uma análise imediata da conversa atual.
   - **Controle deslizante de intervalo**: Ajuste o intervalo de atualização automática entre 15 e 300 segundos (padrão: 60 segundos).
   - **Contagem regressiva**: Mostra quanto tempo falta para a próxima análise automática ou o aviso *"processando..."*.
5. **Movimentação e Ajuste**:
   - **Arrastar**: Clique e segure no cabeçalho para posicionar o painel onde preferir na tela.
   - **Minimizar (`—`)**: Recolhe o corpo do painel, mantendo apenas a barra de status visível.
   - **Fechar (`×`)**: Fecha o painel de análise sem interromper a gravação da transcrição.

---

## 4. Consulta de Histórico e Exportação (TXT e PDF)

### Popup Rápido
Ao clicar no ícone do MeetExpert na barra de extensões:
- A aba **Reuniões** lista todas as reuniões já gravadas, agrupadas cronologicamente.
- Reuniões em andamento recebem o selo vermelho **REC**.
- Cada gravação possui o botão **`.txt`** para download direto da transcrição limpa com falantes e timestamps.

### Arquivo Completo e Exportação em PDF
Clique no link **Abrir arquivo completo** no rodapé do popup para abrir o dashboard (`dashboard.html`):
- **Busca textual**: Pesquise palavras-chave em todas as gravações simultaneamente.
- **Edição de títulos**: Renomeie reuniões para fácil organização.
- **Exportação em PDF**: Gera relatórios profissionais prontos para impressão ou arquivamento, formatados com metadados completos e o hash criptográfico **SHA-256**.
- **Copiar Prompt IA**: Gera um prompt formatado com a transcrição completa para levar a qualquer assistente externo.

---

## 5. Controle de Versão e Rollback (Git)

O código-fonte do projeto está versionado com Git para total segurança e flexibilidade:

* **Versão 0.8.0 com Live Analysis**: Branch `feature/live-analysis`.
* **Versão 0.7.3 Baseline Original**: Branch `master` e tag `v0.7.3-baseline`.

### Como alternar entre versões ou fazer rollback:

Abra o terminal PowerShell na pasta `D:\MeetExpert`:

```powershell
# Para retornar à versão original v0.7.3 (sem a IA integrada):
git checkout v0.7.3-baseline

# Para voltar para a versão mais recente v0.8.0 (com Live Analysis):
git checkout feature/live-analysis
```

Após trocar de branch no Git, abra `chrome://extensions/` e clique em **Recarregar** (🔄) na extensão.

---

## 6. Resolução de Problemas (Troubleshooting)

### A IA informa "Falha ao conectar ao Ollama":
1. Verifique se o aplicativo do Ollama está em execução (ícone de lhama na barra de tarefas do Windows perto do relógio).
2. Abra o terminal e teste digitando `ollama list`. Se responder normalmente, teste a conexão no popup da extensão.
3. Se necessário, execute novamente `instalar-ia-local.bat`.

### O balão flutuante não aparece na reunião:
1. Certifique-se de que a reunião está aberta no navegador Chrome (e não no aplicativo de desktop do Teams ou Zoom).
2. Verifique se as **legendas ao vivo** foram ativadas no Meet, Teams ou Zoom.
3. Recarregue a página da reunião (`F5`). A extensão se conectará automaticamente.

### As legendas mudaram de formato ou a fala ficou sem nome no Zoom:
- No Zoom web, a legenda costuma mostrar apenas as iniciais do participante. O MeetExpert cruza automaticamente as iniciais com a lista de participantes da tela para deduzir o nome completo.
- Se houver duas pessoas com as mesmas iniciais, a sigla será mantida para evitar atribuições incorretas.

---

## Licença e Aviso Legal

* **Integridade SHA-256:** O hash presente nas exportações atesta a integridade do texto registrado localmente pela extensão, não constituindo perícia forense sobre o sinal acústico da chamada.
* **LGPD e Privacidade:** Recomenda-se cientificar previamente os demais participantes sobre a realização da transcrição da reunião.

MeetExpert · **Osvaldo Janeri Filho** `<osvaldo@perito.digital>`
