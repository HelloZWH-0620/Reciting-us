[简体中文](README.md) | English | [文言文](README_Classical-Chinese.md)

# Memorize It!

> A local web app designed to help Chinese high school students memorize and study classical Chinese prose and poems.

[![Latest Release](https://img.shields.io/github/v/release/HelloZWH-0620/Reciting-us?label=Latest)](https://github.com/HelloZWH-0620/Reciting-us/releases/latest)
[![Pre-Release](https://img.shields.io/github/v/release/HelloZWH-0620/Reciting-us?include_prereleases&label=Test)](https://github.com/HelloZWH-0620/Reciting-us/releases/)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-MIT-green)

> For details about each version, see [Memorization UI/config/version.json](Memorization UI/config/version.json) or [Releases](https://github.com/HelloZWH-0620/Reciting-us/releases/).

---

## Project Introduction

“Memorize It!” is a local web application specifically designed for high school students to memorize classical Chinese prose and ancient poetry. It integrates textbook learning, multiple practice modes, AI-assisted question generation, spaced repetition, and learning statistics into one tool to help students efficiently master required memorization texts.

The project uses a pure front-end single-page application architecture. It does not require Node.js or other dependencies; it only needs Windows PowerShell to run a local server. All data is stored in the browser’s localStorage, ensuring privacy and security without requiring a user account.

### Core Features

- 📚 **Rich Text Library** — Includes high school required classical Chinese passages and poems, each with original text, translations, annotations, and appreciation notes
- ✍️ **Multiple Practice Modes** — Fill-in-the-blank dictation, sentence pairing, contextual dictation, function word challenges, vocabulary challenges, and word-class usage practice
- 🤖 **AI Assistance** — Supports AI grammar checking and AI-generated questions (requires an external AI API)
- 🔄 **Spaced Repetition** — Flashcard review based on the Ebbinghaus forgetting curve and a mistake review system
- 📊 **Learning Statistics** — Visualized line charts, bar charts, pie charts, and heatmaps for learning data
- 🎨 **Personalized Wallpapers** — Supports custom background uploads, management, and scheduled switching
- 💾 **Data Management** — Supports exporting and importing learning progress for easier multi-device syncing

---

## Feature Overview

### 1. Text Learning

The application contains two major categories of learning content:

| Category | Description |
|----------|-------------|
| **Classical Chinese** | Classic passages such as “Analects of Confucius: Twelve Chapters,” “Encouraging Learning,” “Biography of Qu Yuan,” “Ten Reflections on Advising the Emperor,” “On Teachers,” “The Story of the Palace of Xiangyang,” and “On Six States” |
| **Poetry** | Required memorization poems such as “Moon Over the Spring River,” “Short Song,” and “Nian Nujiao·Remembering the Red Cliff” |

Each passage provides the following study modes:

- **Display Mode** — Full view of the original text, translation, annotations, and appreciation notes
- **Memorization Mode** — Sentence-by-sentence or paragraph-by-paragraph memorization practice with partial content hidden to aid recall
- **Practice Mode** — Generates exercise questions based on the current text
- **Vocabulary Mode** — Explanations of key words and analysis of word-class usage

### 2. Interactive Practice

Multiple exercise types are provided to cover key high school classical Chinese examination points:

| Exercise Type | Description |
|---------------|-------------|
| **Fill-in-the-Blank Dictation** | Fill in missing sentences based on context to train memory of famous lines |
| **Sentence Pairing** | Given the upper or lower sentence, match the corresponding counterpart |
| **Contextual Dictation** | Simulate exam scenarios and write related famous lines based on prompts |
| **Function Word Challenge** | Practice selecting and distinguishing common classical Chinese particles (e.g., 而, 何, 乎, 乃, 其, 且, 若, 所, 为, 焉, 也, 以) |
| **Vocabulary Challenge** | Practice meanings and usage of key words |
| **Word-Class Usage** | Distinguish word-class transformations (e.g., noun used adverbially, causative usage, stative usage) |

The question bank contains 72 preset questions covering three types:
- **Function Word Distinction** (18 questions): Multiple-choice questions testing the use of particles in specific contexts
- **Fill-in-the-Blank Dictation** (36 questions): Complete famous lines based on prompts
- **Example Matching** (18 questions): Match the correct example sentence to the corresponding word meaning

In addition, when AI is enabled, the system can dynamically generate more practice questions.

### 3. AI-Assisted Features

The application includes an AI agent that forwards requests through the local server, supporting the following AI functions:

- ✨ **AI Grammar Checking** — Analyzes user-entered classical Chinese sentences for grammar and structure
- ✨ **AI Function Word Question Generation** — Uses AI to generate vocabulary practice questions for all common classical particles
- ✨ **AI Contextual Dictation Generation** — Generates contextual dictation exercises based on passage content

> **Note**: AI functionality requires an external AI API (such as an OpenAI-compatible interface). You must fill in the API address and key in the app settings.

### 4. Memory and Review

- **Flashcard System** — Supports review based on a spaced repetition algorithm to schedule revision efficiently
- **Mistake Book** — Automatically records incorrect answers and supports dedicated mistake review modes
- **Memorization Progress Tracking** — Marks each passage as mastered or not yet mastered and displays progress in real time
- **Daily Review Reminders** — Calculates the next review time based on the forgetting curve

### 5. Learning Statistics

The application includes a built-in data visualization module with the following chart types:

- 📈 **Line Charts** — Show daily practice volume trends
- 📊 **Bar Charts** — Compare accuracy across different exercise categories
- 🥧 **Pie Charts** — Display proportion of exercise types
- 🗺️ **Heatmaps** — Show learning activity by calendar day

### 6. Authors and Dynasties

- **Author Details** — Includes profiles of 18 classic authors (Confucius, Xunzi, Sima Qian, Han Yu, Su Shi, etc.) with their dynasties and brief biographies
- **Dynasty Cards** — Browse related authors and works by historical dynasty
- **Online Lookup** — Jump to external resources for further study

### 7. Personalization Settings

- 🖼️ **Custom Wallpapers** — Upload local images as the app background, supporting PNG/JPG/GIF/WebP/BMP formats
- ⏰ **Wallpaper Rotation** — Automatically switch wallpapers on a schedule
- 🔤 **Custom Fonts** — Includes the Regular.ttf font; installing it provides a better reading experience
- 📝 **Notes and Annotations** — Add personal notes to passages
- 📏 **Font Size Adjustment** — Adjust the main text size

### 8. Data Management

- 📤 **Data Export** — Export learning progress, wrong-answer records, and other data to a file
- 📥 **Data Import** — Import learning data from a file to restore progress
- 🗑️ **Data Reset** — Clear all local data with one click

---

## Project Structure

> [!IMPORTANT]
> The project is under active development, and its structure may change from time to time. The structure shown here is for reference only and does not represent the final structure.

```
Reciting-us/
├── README.md                          # Documentation (Simplified Chinese)
├── README_EN.md                       # Documentation (English)
├── README_Classical Chinese.md        # Documentation (Classical Chinese)
├── LICENSE                            # MIT License
├── PROVENANCE.md                      # Provenance & license notes
├── __psserver.ps1                     # Simple PowerShell test server for development
└── Memorization UI/
    ├── app.html                       # Main application (single-page app with all front-end logic)
    ├── war4.html                      # Legacy / fallback page
    ├── setup.bat                      # One-click installation script (installs fonts + launches the server)
    ├── uninstall.bat                  # Uninstall script (invokes uninstall.ps1)
    ├── package.ps1                    # Installation bootstrap script (creates desktop/start menu shortcuts)
    ├── uninstall.ps1                  # Uninstall logic
    ├── config/
    │   ├── manifest.json              # PWA manifest (app name, icons, etc.)
    │   ├── articles.json              # Text content (classical Chinese, including original text, translations, annotations, appreciation)
    │   ├── poem.json                  # Poetry dataset (independent poetry collection)
    │   ├── game.json                  # Exercise question bank (72 questions: function-word / dictation / example matching)
    │   ├── writer.json                # Author information (18 authors with dynasties and biographies)
    │   ├── version.json               # Version info (current v0.3.1; see notes field)
    │   └── bundled.js                 # Inlined fallback data (used by app.html under file://)
    ├── resource/
    │   ├── OOBE/                      # First-run onboarding images (page1.png ~ page3.png)
    │   ├── background/                # Wallpaper directory (default: background.png; user wallpapers not tracked)
    │   ├── icon/                      # UI icons (*.svg, adaptive to light/dark themes)
    │   ├── wordtype/                  # Font files (Regular.ttf)
    │   └── audio/                     # Recitation audio (optional)
    ├── userdata/                      # User runtime data (git-ignored)
    └── setuptools/
        ├── server.ps1                 # Local PowerShell HTTP server (provides static files + API)
        ├── start.bat                  # Startup script (starts the server + opens the browser)
        ├── ai-hosts.txt               # Allow-list of upstream hosts reachable by the AI proxy
        ├── config.json                # Auto-generated configuration file after installation (records project path)
        ├── Setup.png                  # Installation guide image
        └── logoblack.ico              # Application icon
```

---

## How to Use

### System Requirements

- **Operating System**: Windows 7 and above
- **Runtime**: Windows PowerShell (included with the system)
- **Browser**: Chrome, Edge, Firefox, or other modern browsers (Chrome or Edge recommended)
- **Network**: Offline usage is supported; AI features require internet access

### Method 1: One-Click Installation (Recommended)

1. **Download the project**
   ```bash
   git clone https://github.com/HelloZWH-0620/Reciting-us.git
   ```

2. **Run the installation script**

   Double-click `Memorization UI/setup.bat`. The script will automatically perform the following actions:
   - Install the custom font (`Regular.ttf`)
   - Create a desktop shortcut called “Memorize It!”
   - Create a Start menu shortcut called “Memorize It!”
   - Display the installation guide in the center of the screen

3. **Launch the application**

   After installation, double-click the desktop or Start menu shortcut to launch the app. It will automatically:
   - Start the local HTTP server on port 8000
   - Open the browser to visit `http://localhost:8000/app.html`

### Method 2: Manual Startup

If you do not want to create shortcuts, you can start it manually:

1. Open PowerShell and enter the `Memorization UI/setuptools` directory:
   ```powershell
   cd "Memorization UI/setuptools"
   ```

2. Run the startup script:
   ```powershell
   .\start.bat
   ```

   This script will:
   - Write the parent directory path to `config.json`
   - Start the PowerShell server (default port 8000)
   - Wait 2 seconds and then automatically open the browser

3. Alternatively, start the server directly in PowerShell (custom port is supported):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "Memorization UI/setuptools/server.ps1" [port]
   ```

   Then open the browser and visit `http://localhost:port/app.html`.

### Method 3: Development Mode

There is a simple PowerShell server at the project root, `__psserver.ps1`, for quick testing:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File __psserver.ps1
```

> This script listens on port 8765 and only provides static file service; it does not support wallpaper upload or API features.

---

## Uninstall

To uninstall "Memorize It!", follow these steps:

1. Double-click `Memorization UI/uninstall.bat` (the one whose icon is a black gear);
2. Delete the `config` **file** under the `setuptools` folder (note: it is a file, not a folder!);
3. If you do not need to keep using the app on another device, delete all files under `userdata`. Otherwise, copy the files you need to the new device to continue your progress.

> Note: Step 2 removes the `setuptools/config` file generated at install time (it records the project path) and does not affect your lesson data; your learning records live in `userdata/`.

## First-Time Guide

1. **OOBE (Out-of-the-box Experience)** — On first launch, the app enters a guided setup flow to introduce major features
2. **Browse Texts** — In the sidebar, select a text category (classical Chinese / poetry) and click a title to enter learning
3. **Switch Learning Modes** — At the top of the text page, switch between “Display / Memorization / Practice / Vocabulary” modes
4. **Start Practice** — Go to the “Interactive Practice” page and choose a question type to begin
5. **View Statistics** — Check your learning data and charts on the statistics page
6. **Customize Wallpapers** — Upload favorite images as the app background in settings

---

## Configure AI Features

AI features are proxied through the local server to bypass browser CORS restrictions. Configuration steps:

1. Find the AI configuration options in the application settings page
2. Enter the AI API address you are using (OpenAI-compatible interface format)
3. Enter the API key
4. Select the model name
5. After saving the configuration, you can use AI-generated questions and grammar checking features

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Pure HTML/CSS/JavaScript (single-file application) |
| Backend | PowerShell HTTP server (`System.Net.HttpListener`) |
| Data Storage | JSON configuration files + browser `localStorage` |
| Charts | Canvas 2D (custom drawing, no third-party dependencies) |
| PWA | Web App Manifest (supports adding to home screen) |

---

## Local Server API

`setuptools/server.ps1` provides the following API endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallpapers` | GET | Get the wallpaper file list |
| `/api/upload-wallpaper` | POST | Upload wallpaper image (Base64 format) |
| `/api/wallpapers/{filename}` | DELETE | Delete the specified wallpaper |
| `/api/ai-proxy` | POST | Proxy AI requests to bypass CORS |
| Other paths | GET | Static file service |

---

## Contribution Guide

We recommend joining our QQ group [950739151](https://qun.qq.com/universal-share/share?ac=1&authKey=xb2zqLolbPjWo5ukfQNE4FIXNikYa25bAZdOdhJ9tPwDnyeiGq7FtGe4xflFlxdl&busi_data=eyJncm91cENvZGUiOiI5NTA3MzkxNTEiLCJ0b2tlbiI6IjNsQm1WVlBtdVFPdk5qc1BmT0JHSTZ3cXlIV2wyMnFtdE1nNHhhdXlSWDNkRmFGdjF5MEx3TkFJK09pSGVHajUiLCJ1aW4iOiIyODA5ODc0NjI1In0%3D&data=bsTmftVzmLq9iWmvpCXoInjn7UgcuOhndlMPrXR_DH3JQlDsBTLG-mHm0OcCIdqgqBK-fljO_-w80hYzsr4Ahg&svctype=4&tempid=h5_group_info) for a better collaboration experience.

We welcome anyone who would like to implement new features or improvements for this application to submit a [Pull Request](https://github.com/HelloZWH-0620/Reciting-us/pulls).


Here are some suggested areas to explore:

1. **Add Text Content** — Add new passages in `config/articles.json` or `config/poem.json`
2. **Add Practice Questions** — Add new questions in `config/game.json`
3. **Improve Author Information** — Supplement or correct author profiles in `config/writer.json`
4. **Submit an Issue** — Report bugs or suggest new features
5. **Submit a Pull Request** — Fix issues or develop new features

### Adding a Passage Format

Add a new object to the `articles` array in `config/articles.json`:

```json
{
  "id": "unique identifier",
  "title": "text title",
  "author": "author",
  "authorId": "matching id in writer.json",
  "cat": "wenyanwen or gushici",
  "audio": "",
  "text": "original text (separate paragraphs with \n\n)"
}
```

---

## License

This project is open source under the [MIT License](https://opensource.org/licenses/MIT).

---

## Acknowledgements

- Thank you to all educators who contribute to classical Chinese and ancient poetry learning
- Thank you to the open-source community for its tools and resources
