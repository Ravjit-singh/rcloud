#!/bin/bash

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
# UI Components & Dynamic Scaling
# ==========================================
print_card_header() {
    clear
    # 1. Grab dynamic terminal width (default to 80 if undetected)
    local term_width=$(tput cols 2>/dev/null || echo 80)
    
    # 2. Define the exact character width of our ASCII art (39 characters)
    local art_width=39
    
    # 3. Calculate left padding to perfectly center the logo
    local pad_len=$(( (term_width - art_width) / 2 ))     [[$pad_len -lt 0 ]] && pad_len=0
    local pad=$(printf '\%*s' "$pad_len" '')
    
    # 4. Calculate padding for the subtitle text
    local sub_pad_len=$(( (term_width - 26) / 2 ))     [[$sub_pad_len -lt 0 ]] && sub_pad_len=0
    local sub_pad=$(printf '\%*s' "$sub_pad_len" '')

    # 5. Generate a responsive, full-screen-width divider line
    local divider=""
    for (( i=0; i<term_width; i++ )); do
        divider="${divider}─"
    done

    # 6. Render the perfectly centered, color-mapped UI
    echo ""
    echo -e "${pad}${CYAN} _____      ${WHITE} _____ _                 _${NC}"
    echo -e "${pad}${CYAN}  |  __ \\   ${WHITE}  / ____\vert{} \vert{}               \vert{} \vert{}${NC}"
    echo -e "${pad}${CYAN}  | |__) |  ${WHITE}\vert{} \vert{}    \vert{} \vert{} ___  _   _  __\vert{} \vert{}${NC}"
    echo -e "${pad}${CYAN}  \vert{}  _  /${WHITE}| |    | |/ _ \\| | | |/ _\` |${NC}"
    echo -e "${pad}${BLUE}  | | \\ \\   ${DIM}| |____| | (_) | |_| | (_| |${NC}"
    echo -e "${pad}${BLUE}  |_|  \\_\\  ${DIM} \\_____|_|\\___/ \\__,_|\\__,_|${NC}"
    echo ""
    echo -e "${sub_pad}${WHITE}${BOLD}☁️  C L O U D   E N G I N E${NC}"
    echo -e "${DIM}${divider}${NC}"
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
    CMD_INSTALL="pkg install -y curl tar nodejs ffmpeg python make clang binutils ncurses-utils"
elif [ "$OS" == "Linux" ]; then
    ENV_TYPE="Linux Server"
    if command -v apt > /dev/null; then
        CMD_UPDATE="sudo apt update -y -qq"
        CMD_INSTALL="sudo apt install -y -qq curl tar nodejs npm ffmpeg python3 make build-essential"
    elif command -v yum > /dev/null; then
        CMD_UPDATE="sudo yum check-update -q"
        CMD_INSTALL="sudo yum install -y -q curl tar nodejs npm ffmpeg python3 make gcc-c++ ncurses"
    elif command -v pacman > /dev/null; then
        CMD_UPDATE="sudo pacman -Sy --noconfirm"
        CMD_INSTALL="sudo pacman -S --noconfirm curl tar nodejs npm ffmpeg python make gcc ncurses"
    else
        CMD_UPDATE="echo 'Unsupported package manager'"
        CMD_INSTALL="echo 'Please install curl, tar, nodejs, npm, ffmpeg manually'"
    fi
elif [ "$OS" == "Darwin" ]; then
    ENV_TYPE="macOS"
    CMD_UPDATE="brew update"
    CMD_INSTALL="brew install curl tar node ffmpeg python make ncurses"
else
    ENV_TYPE="Unknown ($OS)"
    CMD_UPDATE="echo ''"
    CMD_INSTALL="echo ''"
fi

print_subtext "Detected: $ENV_TYPE"
print_success "Environment mapped"

# --- STEP 2: DEPENDENCIES ---
print_step "Fetching System Engines..."
print_subtext "Terminal output enabled for system downloads..."
echo -e "${DIM}======================================${NC}"
eval $CMD_UPDATE
eval $CMD_INSTALL
echo -e "${DIM}======================================${NC}"
print_success "System engines installed"

# --- STEP 3: CURL SOURCING (ZERO-GIT) ---
print_step "Pulling R Cloud Architecture..."
if [ -d "rcloud" ]; then
    print_subtext "Existing vault found. Wiping for clean install..."
    rm -rf rcloud
fi

mkdir -p rcloud
cd rcloud

print_subtext "Downloading via raw HTTPS stream..."
curl -sL https://github.com/Ravjit-singh/rcloud/archive/refs/heads/main.tar.gz | tar xz --strip-components=1
print_success "Codebase localized & extracted"

# --- STEP 4: HARDWARE-OPTIMIZED NPM INSTALL ---
print_step "Compiling Backend Engine..."
cd server

# CRITICAL FIX FOR TERMUX SQLITE3 C++ COMPILATION
if [ -n "$PREFIX" ] && [[ "$PREFIX" == *com.termux* ]]; then
    export GYP_DEFINES="android_ndk_path=''"
fi

if [ -f "package.json" ]; then
    print_subtext "Bypassing audits for instant module download..."
    npm install --no-audit --no-fund --ignore-scripts
    
    print_subtext "Exterminating heavy dependencies (sharp)..."
    npm uninstall sharp --silent
    
    print_subtext "Rebuilding SQLite Database Connector..."
    npm rebuild sqlite3 --build-from-source
else
    print_subtext "Critical Error: package.json not found in archive."
    exit 1
fi
print_success "Architecture fully compiled"

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
