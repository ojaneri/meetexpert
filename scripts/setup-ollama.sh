#!/usr/bin/env bash
# MeetExpert — Script de instalacao e gerenciamento de IA Local (Ollama)
# Compativel com Linux e macOS

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}       MeetExpert — Instalador e Gerenciador de IA Local    ${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# 1. Verificar se Ollama esta instalado
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}[!] O Ollama nao foi detectado no sistema.${NC}"
    echo "O Ollama e necessario para executar modelos de IA localmente no seu computador."
    echo ""
    read -p "Deseja instalar o Ollama agora automaticamente via curl? (S/n): " installChoice
    installChoice=${installChoice:-S}

    if [[ "$installChoice" =~ ^[sSyY]$ ]]; then
        echo -e "${GREEN}[*] Baixando e instalando Ollama...${NC}"
        curl -fsSL https://ollama.com/install.sh | sh
    else
        echo -e "${RED}Instalacao cancelada. Baixe manualmente em https://ollama.com e execute este script novamente.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}[OK] Ollama detectado com sucesso!${NC}"

# Configurar OLLAMA_ORIGINS=* para permitir que o navegador acesse a API local
export OLLAMA_ORIGINS="*"

# Garantir que o servico Ollama esteja rodando
if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo -e "${CYAN}[*] Iniciando o servico do Ollama em segundo plano...${NC}"
    ollama serve &> /dev/null &
    sleep 3
fi

echo ""
echo "Escolha qual modelo de IA voce deseja baixar para o MeetExpert:"
echo ""
echo -e "  1) ${GREEN}Qwen 2.5 3B  (~1.9 GB) [RECOMENDADO]${NC} - Ultra rapido, excelente em portugues, leve"
echo -e "  2) Llama 3.2 3B (~2.0 GB) - Rapido, compacto da Meta"
echo -e "  3) ${YELLOW}Qwen 2.5 7B  (~4.7 GB)${NC} - Alta capacidade de analise e sintese detalhada"
echo -e "  4) ${YELLOW}Llama 3.1 8B (~4.9 GB)${NC} - Modelo robusto de 8 bilhoes de parametros"
echo -e "  5) ${CYAN}Digitar outro modelo manualmente${NC} (ex: phi3:mini, mistral)"
echo ""

read -p "Digite o numero da opcao desejada (1 a 5) [Padrao: 1]: " choice
choice=${choice:-1}

case "$choice" in
    1) model="qwen2.5:3b" ;;
    2) model="llama3.2:3b" ;;
    3) model="qwen2.5:7b" ;;
    4) model="llama3.1:8b" ;;
    5)
        read -p "Digite o identificador do modelo no Ollama (ex: qwen2.5:3b): " model
        if [ -z "$model" ]; then
            echo -e "${RED}Nome invalido. Cancelado.${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${YELLOW}Opcao invalida, usando recomendacao (Qwen 2.5 3B).${NC}"
        model="qwen2.5:3b"
        ;;
esac

echo ""
echo -e "${CYAN}[*] Baixando o modelo '$model' via Ollama...${NC}"
echo "Isso pode levar de 1 a 5 minutos dependendo da sua conexao."
echo ""

ollama pull "$model"

echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN} [OK] Modelo '$model' baixado e pronto para uso!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Modelos atualmente instalados no seu Ollama:"
ollama list
echo ""
echo -e "${CYAN}Proximo passo:${NC}"
echo "1. Abra o navegador Chrome."
echo "2. Clique no icone do MeetExpert -> icone de Engrenagem (⚙️ IA)."
echo "3. Selecione 'Local (Ollama)' e clique no botao 'Detectar'."
echo "4. Escolha o modelo '$model', clique em 'Testar Conexao' e salve!"
echo ""
