# CÓDIGO GPS Desktop App

## Building from Source

To build the desktop application, you need **Rust**, **Node.js**, and Linux system dependencies for Tauri.

### 1. System Dependencies (Linux)

Install the required libraries (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsoup2.4-dev
```

### 2. Frontend Build

The desktop app embeds the frontend as static files.

```bash
cd ../codigo_gps/frontend
npm install
npm run build
# Output should be in ../codigo_gps/frontend/out
```

### 3. Backend Daemon

Ensure the `codigo-gps` Python package is installed and accessible in your PATH:

```bash
pip install .
```

### 4. Build Desktop App

```bash
cd desktop/codigo-gps-desktop
npm install
npm run tauri build
```

The resulting binary will be in `src-tauri/target/release/bundle/appimage/` or `deb/`.

## Features
- **Auto-Launch Backend**: Starts `codigo-gps daemon` if not running.
- **Embedded Security**: Uses local token (`~/.codigo_gps/config.json`) for API calls.
- **Native Experience**: Standalone window with system integration.
