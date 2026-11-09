#!/usr/bin/env bash
# MeetExpert — Script de instalacao e download de IA Local (Ollama) para Linux e macOS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/scripts/setup-ollama.sh"
