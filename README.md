# 🪄 CodeWhisper

> AI-powered coding assistant desktop app — understand any codebase instantly.

![CodeWhisper](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Mac%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- 📂 **Open any project** — explore files like VS Code
- 🔍 **Project Analyzer** — detect project type, structure, dependencies
- ✏️ **Built-in Code Editor** — edit files with syntax highlighting
- 👁 **Live Preview** — real-time HTML/CSS/Markdown rendering
- 🤖 **AI Chat** — ask questions about your code (OpenAI or local Ollama)
- 🔧 **Auto Fix Errors** — AI detects and fixes bugs automatically
- 🐛 **Bug Risk Detector** — static + AI-powered code analysis
- 🗺 **Project Map** — visual D3 dependency graph
- 📝 **Smart Notepad** — link notes to files, AI explanations
- 🔒 **Local/Private Mode** — run AI 100% offline with Ollama
- 🔴 **Live File Watcher** — auto-reload on external changes

## 📥 Download

Go to the [**Releases**](../../releases) page and download the installer for your OS:

| Platform | File |
|----------|------|
| Windows  | `CodeWhisper Setup x.x.x.exe` |
| macOS    | `CodeWhisper-x.x.x.dmg` |
| Linux    | `CodeWhisper-x.x.x.AppImage` |

## 🚀 Quick Start

1. Download and install the app
2. Click **Open Project** and select any code folder
3. Click **🔍 Analyze** to understand the project
4. Click the **⚙️ AI Settings** button to add your OpenAI key
   - Or use **🔒 Local AI** (Ollama) for 100% private mode
5. Ask questions in the chat panel

## 🔒 Local AI (Private Mode)

Run AI completely offline — no data ever leaves your machine:

```bash
# 1. Install Ollama
# https://ollama.com/download

# 2. Start the server
ollama serve

# 3. Download a model
ollama pull codellama

# 4. In CodeWhisper: click AI Settings → switch to Local AI
```

## 🛠 Build from Source

```bash
git clone https://github.com/YOUR_USERNAME/CodeWhisper.git
cd CodeWhisper
npm install
npm install --prefix renderer
npm start
```

## 📦 Build Installer

```bash
npm run build --prefix renderer
npm run build
# Output: dist/CodeWhisper Setup 1.0.0.exe
```

## 📄 License

MIT — free to use, modify, and distribute.
