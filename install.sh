l#!/bin/bash

# ==========================================
# ANSI Color & Style Definitions
# ==========================================
BOLD='\033[1m'
DIM='\033[2m'
BLUE='\033[1;34m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
RED='\033[1;31m'
WHITE='\033[1;37m'
NC='\033[0m'

# ==========================================
# UI Components
# ==========================================
print_card_header() {
    clear
    echo -e "${CYAN}╭────────────────────────────────────╮${NC}"
    echo -e "${CYAN}│${NC}                                    ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}       ${WHITE}${BOLD}☁️  R CLOUD SETUP${NC}          ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}                                    ${CYAN}│${NC}"
    echo -e "${CYAN}╰────────────────────────────────────╯${NC}"
    echo ""
    sleep 0.5
}

print_step() { echo -e "${BLUE}● ${WHITE}${BOLD}$1${NC}"; sleep 0.3; }
print_subtext() { echo -e "  ${DIM}↳ $1${NC}"; sleep 0.2; }
print_success() { echo -e "  ${GREEN}✔ $1${NC}\n"; sleep 0.5; }

# ==========================================
# Main Execution Flow
# ==========================================
print_card_header

# --- STEP 1: OS DETECTION ---
print_step "Analyzing Environment..."
OS="$(uname -s)"
if [ -n "$PREFIX" ] && [[ "$PREFIX" == *com.termux* ]]; then
    ENV_TYPE="Termux (Android Native)"
    CMD_UPDATE="pkg update -y && pkg upgrade -y"
    # Added binutils for C++ database compilation
    CMD_INSTALL="pkg install -y git nodejs ffmpeg python make clang binutils"
elif [ "$OS" == "Linux" ]; then
    ENV_TYPE="Linux Server"
    if command -v apt &> /dev/null; then
        CMD_UPDATE="sudo apt update -y"
        CMD_INSTALL="sudo apt install -y git nodejs npm ffmpeg python3 make build-essential"
    else
        CMD_UPDATE="echo 'Package manager not apt, skipping update'"
        CMD_INSTALL="echo 'Please install git, node, npm, ffmpeg manually'"
    fi
elif [ "$OS" == "Darwin" ]; then
    ENV_TYPE="macOS"
    CMD_UPDATE="brew update"
    CMD_INSTALL="brew install git node ffmpeg python make"
else
    ENV_TYPE="Unknown ($OS)"
    CMD_UPDATE="echo ''"
    CMD_INSTALL="echo ''"
fi

print_subtext "Detected: $ENV_TYPE"
print_success "Environment mapped"

# --- STEP 2: DEPENDENCIES ---
print_step "Fetching Core Modules..."
print_subtext "Terminal output enabled for system downloads..."
echo -e "${DIM}======================================${NC}"
eval $CMD_UPDATE
eval $CMD_INSTALL
echo -e "${DIM}======================================${NC}"
print_success "Modules installed"

# --- STEP 3: CLONING REPO ---
print_step "Syncing R Cloud Engine..."
if [ -d "rcloud" ]; then
    print_subtext "Existing vault found. Updating..."
    cd rcloud
    git pull origin main > /dev/null 2>&1
else
    print_subtext "Downloading from secure repository..."
    git clone https://github.com/Ravjit-singh/rcloud.git > /dev/null 2>&1
    cd rcloud
fi
print_success "Codebase synchronized"

# --- STEP 4: NPM INSTALL ---
print_step "Building Backend Architecture..."
cd server

# CRITICAL FIX FOR TERMUX SQLITE3 C++ COMPILATION
if [ -n "$PREFIX" ] && [[ "$PREFIX" == *com.termux* ]]; then
    export GYP_DEFINES="android_ndk_path=''"
fi

if [ -f "package.json" ]; then
    print_subtext "Installing NPM dependencies..."
    npm install
else
    print_subtext "Initializing fresh NPM environment..."
    npm init -y
    npm install express multer cors cookie-parser bcryptjs jsonwebtoken sqlite sqlite3 archiver fluent-ffmpeg
fi
print_success "Architecture ready"

# ==========================================
# Final Success Screen
# ==========================================
clear
echo -e "${GREEN}╭────────────────────────────────────╮${NC}"
echo -e "${GREEN}│${NC}                                    ${GREEN}│${NC}"
echo -e "${GREEN}│${NC}      ${WHITE}${BOLD}✅ SETUP COMPLETE${NC}             ${GREEN}│${NC}"
echo -e "${GREEN}│${NC}                                    ${GREEN}│${NC}"
echo -e "${GREEN}╰────────────────────────────────────╯${NC}"
echo ""
echo -e "${WHITE}To boot your personal vault, run:${NC}"
echo ""
echo -e "${CYAN}   cd rcloud/server${NC}"
echo -e "${CYAN}   npm start${NC}"
echo ""
