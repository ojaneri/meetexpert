# MeetExpert — Script de instalacao e download de IA Local (Ollama)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "MeetExpert — Configuracao de IA Local"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       MeetExpert — Instalador e Gerenciador de IA Local    " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar se o Ollama esta instalado
$ollamaCmd = Get-Command "ollama" -ErrorAction SilentlyContinue

if (-not $ollamaCmd) {
    # Tentar caminhos padrao do Windows
    $defaultPaths = @(
        "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
        "$env:ProgramFiles\Ollama\ollama.exe"
    )
    foreach ($p in $defaultPaths) {
        if (Test-Path $p) {
            $env:PATH += ";$(Split-Path $p)"
            $ollamaCmd = Get-Command "ollama" -ErrorAction SilentlyContinue
            break
        }
    }
}

if (-not $ollamaCmd) {
    Write-Host "[!] O Ollama nao foi detectado no sistema." -ForegroundColor Yellow
    Write-Host "O Ollama e necessario para executar modelos de IA localmente no seu computador."
    Write-Host ""
    $installChoice = Read-Host "Deseja instalar o Ollama agora automaticamente via winget? (S/n)"
    if ($installChoice -eq "" -or $installChoice -match "^[sSyY]") {
        Write-Host ""
        Write-Host "[*] Baixando e instalando Ollama..." -ForegroundColor Green
        winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
        
        # Atualizar PATH na sessao atual
        $env:PATH = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        $ollamaCmd = Get-Command "ollama" -ErrorAction SilentlyContinue
        
        if (-not $ollamaCmd) {
            Write-Host ""
            Write-Host "[!] Instalacao concluida! Por favor, reinicie este script ou seu terminal para reconhecer o comando 'ollama'." -ForegroundColor Yellow
            pause
            exit
        }
    } else {
        Write-Host "Instalacao cancelada. Baixe manualmente em https://ollama.com e execute este script novamente." -ForegroundColor Red
        pause
        exit
    }
}

Write-Host "[OK] Ollama detectado com sucesso!" -ForegroundColor Green
Write-Host ""

# 2. Menu de escolha de modelo
Write-Host "Escolha qual modelo de IA voce deseja baixar para o MeetExpert:" -ForegroundColor White
Write-Host ""
Write-Host "  1) Qwen 2.5 3B  (~1.9 GB) [RECOMENDADO] - Ultra rapido, excelente em portugues, leve" -ForegroundColor Green
Write-Host "  2) Llama 3.2 3B (~2.0 GB) - Rapido, compacto da Meta" -ForegroundColor White
Write-Host "  3) Qwen 2.5 7B  (~4.7 GB) - Alta capacidade de analise e sintese detalhada" -ForegroundColor Yellow
Write-Host "  4) Llama 3.1 8B (~4.9 GB) - Modelo robusto de 8 bilhoes de parametros" -ForegroundColor Yellow
Write-Host "  5) Digitar outro modelo manualmente (ex: phi3:mini, mistral)" -ForegroundColor Cyan
Write-Host ""

$choice = Read-Host "Digite o numero da opcao desejada (1 a 5) [Padrao: 1]"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

$model = ""
switch ($choice) {
    "1" { $model = "qwen2.5:3b" }
    "2" { $model = "llama3.2:3b" }
    "3" { $model = "qwen2.5:7b" }
    "4" { $model = "llama3.1:8b" }
    "5" { 
        $model = Read-Host "Digite o identificador do modelo no Ollama (ex: qwen2.5:3b)"
        if ([string]::IsNullOrWhiteSpace($model)) {
            Write-Host "Nome invalido. Cancelado." -ForegroundColor Red
            exit
        }
    }
    default {
        Write-Host "Opcao invalida, usando recomendacao (Qwen 2.5 3B)." -ForegroundColor Yellow
        $model = "qwen2.5:3b"
    }
}

Write-Host ""
Write-Host "[*] Baixando o modelo '$model' via Ollama..." -ForegroundColor Cyan
Write-Host "Isso pode levar de 1 a 5 minutos dependendo da sua conexao." -ForegroundColor Gray
Write-Host ""

& ollama pull $model

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " [OK] Modelo '$model' baixado e pronto para uso!" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Modelos atualmente instalados no seu Ollama:" -ForegroundColor White
    & ollama list
    Write-Host ""
    Write-Host "Proximo passo:" -ForegroundColor Cyan
    Write-Host "1. Abra o navegador Chrome."
    Write-Host "2. Clique no icone do MeetExpert -> icone de Engrenagem (Configuracoes)."
    Write-Host "3. Selecione 'Local (Ollama)' e confirme o modelo '$model'."
    Write-Host "4. Clique em 'Testar Conexao' e salve!"
    Write-Host ""
} else {
    Write-Host "[!] Ocorreu um erro ao baixar o modelo. Verifique se o servico do Ollama esta em execucao." -ForegroundColor Red
}

Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
