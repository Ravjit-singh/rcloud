#!/bin/bash

echo "========================================="
echo "☁️  Welcome to the Universal R Cloud Installer ☁️"
echo "========================================="
echo ""

# 1. Detect Operating System and Package Manager
OS="$(uname -s)"
echo "Detecting operating system: $OS"

if [ -n "$PREFIX" ] && [[ "$PREFIX" == *com.termux* ]]; then
    # Termux (Android Native)
    echo "Environment: Termux (Android)"
    echo "[1/4] Updating and installing dependencies..."
    pkg update -y && pkg upgrade -y
    pkg install -y git nodejs ffmpeg python make clang

elif [ "$OS" == "Linux" ]; then
    # Linux distributions (Ubuntu, Debian, Fedora, Arch, VPS)
    echo "Environment: Linux"
    echo "[1/4] Updating and installing dependencies..."
    if command -v apt &> /dev/null; then
        sudo apt update -y
        sudo apt install -y git nodejs npm ffmpeg python3 make build-essential
    elif command -v dnf &> /dev/null; then
        sudo dnf update -y
        sudo dnf install -y git nodejs npm ffmpeg python3 make gcc gcc-c++
    elif command -v pacman &> /dev/null; then
        sudo pacman -Syu --noconfirm git nodejs npm ffmpeg python make gcc
    elif command -v apk &> /dev/null; then
        sudo apk update
        sudo apk add git nodejs npm ffmpeg python3 make g++
    else
        echo "⚠️ Unsupported Linux package manager. Proceeding to clone repository..."
    fi

elif [ "$OS" == "Darwin" ]; then
    # macOS
    echo "Environment: macOS"
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install Homebrew first: https://brew.sh/"
        exit 1
    fi
    echo "[1/4] Updating and installing dependencies..."
    brew update
    brew install git node ffmpeg python make

elif [[ "$OS" == *"MINGW"* ]] || [[ "$OS" == *"MSYS"* ]] || [[ "$OS" == *"CYGWIN"* ]]; then
    # Windows (Git Bash / Cygwin)
    echo "Environment: Windows"
    echo "⚠️ Please ensure you have Git, Node.js, and FFmpeg installed natively on Windows."
    echo "Proceeding with download..."
else
    echo "⚠️ Unknown Operating System. Attempting to proceed anyway..."
fi

echo ""
echo "[2/4] Verifying Core Dependencies..."
for cmd in git node npm ffmpeg; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ Error: $cmd could not be found. Please install it manually and re-run this script."
        exit 1
    fi
done
echo "✅ All dependencies are installed!"

echo ""
echo "[3/4] Cloning the R Cloud repository..."
if [ -d "rcloud" ]; then
    echo "Directory 'rcloud' already exists. Updating with latest changes..."
    cd rcloud
    git pull
else
    git clone https://github.com/Ravjit-singh/rcloud.git
    cd rcloud
fi

echo ""
echo "[4/4] Installing Node.js Server Packages..."
cd server

# Initialize Node modules
if [ -f "package.json" ]; then
    npm install
else
    echo "Initializing new package environment..."
    npm init -y
    npm install express multer cors cookie-parser bcryptjs jsonwebtoken sqlite sqlite3 archiver fluent-ffmpeg
fi

echo ""
echo "========================================="
echo "✅ R Cloud Installation Complete! ✅"
echo "========================================="
echo ""
echo "To start your personal cloud server, run the following commands:"
echo ""
echo "   cd rcloud/server"
echo "   npm start"
echo ""
echo "Then simply open your browser and connect to the IP Address printed on screen!"
echo "========================================="
