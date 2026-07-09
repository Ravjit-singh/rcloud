#!/bin/bash

echo "========================================="
echo "☁️  Welcome to the R Cloud Installer ☁️"
echo "========================================="
echo ""

echo "[1/4] Updating system packages..."
pkg update -y && pkg upgrade -y

echo ""
echo "[2/4] Installing Core Dependencies..."
echo "(This might take a minute. Installing Git, Node.js, FFmpeg, and Build Tools)"
pkg install -y git nodejs ffmpeg python make clang

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

# We run npm install, but also specifically install the required packages 
# just in case the package.json gets messed up or is missing on the user's end.
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
