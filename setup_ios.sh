#!/bin/bash
# DeltaMusic iOS One-Click Start (v2.1.2)
# Run this in a-Shell: curl -L https://raw.githubusercontent.com/nnoverr/DeltaMusic/main/pwa/setup_ios.sh | bash

echo "✦ DeltaMusic: Starting Offline Setup..."

if [ ! -d "DeltaMusic" ]; then
    echo "── Installing..."
    git clone --depth 1 https://github.com/nnoverr/DeltaMusic.git
    cd DeltaMusic/pwa
else
    echo "── Updating..."
    cd DeltaMusic/pwa
    git pull
fi

echo "── Running Local Server (Multithreaded)..."
echo "✦ App is live at: http://localhost:8080"
python3 server.py
