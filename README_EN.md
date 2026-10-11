[简体中文](README.md) | English | [文言文](README_Classical-Chinese.md)

# Memorize It!

> An app that helps Chinese high school students study and memorize classical Chinese prose and poetry.

[![Latest Release](https://img.shields.io/github/v/release/HelloZWH-0620/Reciting-us?label=Latest)](https://github.com/HelloZWH-0620/Reciting-us/releases/latest)
[![Pre-Release](https://img.shields.io/github/v/release/HelloZWH-0620/Reciting-us?include_prereleases&label=Test)](https://github.com/HelloZWH-0620/Reciting-us/releases/)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Android-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)

> For release details and app downloads, see [Releases](https://github.com/HelloZWH-0620/Reciting-us/releases/).

---

## Project Introduction

“Memorize It!” helps students learn and memorize classical Chinese prose and poetry through text study, interactive practice, spaced repetition, learning statistics, and optional AI assistance.

The repository contains two app variants. The recommended .NET multiplatform app in `RecitingUsApp/` provides Windows desktop and Android versions. `Memorization UI/` is the retained legacy Web/PowerShell app. The multiplatform app uses web assets from `RecitingUsApp/web/`, packaged by a shared core project; files in the legacy directory are not automatically synchronized with it. App data is stored locally. AI features require users to configure an OpenAI-compatible service.

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
> The project is actively under development, and its structure may change from time to time. The structure below is not final.

```
Reciting-us/
├── README.md / README_EN.md / README_Classical-Chinese.md
├── .github/workflows/build.yml       # Windows and Android release CI
├── Memorization UI/                  # Legacy Web/PowerShell app
└── RecitingUsApp/                    # Current .NET multiplatform app
    ├── RecitingUs.slnx
    ├── Directory.Build.props         # .NET targets and shared build settings
    ├── Directory.Packages.props      # Central NuGet package versions
    ├── src/
    │   ├── RecitingUs.Core/          # APIs, HTTP server, data storage, platform abstractions
    │   ├── RecitingUs.App/           # Avalonia Windows desktop app
    │   ├── RecitingUs.Android/       # Android app and native platform services
    │   ├── RecitingUs.Tests/          # xUnit automated tests
    │   └── _recovered/               # Historical recovery files; not built
    ├── web/                          # Authoritative web assets embedded by Core
    ├── build/                        # Resource processing, publishing, and signing scripts
    ├── installer/                    # Windows installer configuration
    └── BUILD.md                      # Project structure and build guide
```

---

## Download and Run

Download the release for your device platform from [GitHub Releases](https://github.com/HelloZWH-0620/Reciting-us/releases):

- **Windows**: Download `RecitingUs-Setup-<version>.exe` and run the installer. Launch the app from the Start menu or desktop shortcut. The desktop app requires Microsoft Edge WebView2 Runtime. If it is missing, follow the in-app prompt or [these installation instructions](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download).
- **Android**: Download and install `recitingus-<version>.apk`.

The app's main features work offline. AI features require an internet connection and an AI service configured by the user.

### Run the Web App Directly

To run the repository's Web app instead of the Windows/Android multiplatform app:

1. [Fork and clone](https://github.com/HelloZWH-0620/Reciting-us/fork) the repository, or download and extract its ZIP archive.
2. Double-click `Memorization UI/setup.bat`, or run `Memorization UI/setuptools/start.bat` to start the local server and open the browser.
3. To start the server manually, run this command in PowerShell from the repository root:
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File ".\Memorization UI\setuptools\server.ps1" 8000
   ```
   Then visit `http://localhost:8000/app.html`.
4. The root-level `__psserver.ps1` is only for a quick static preview on port 8765; it does not provide any local server APIs.

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
| Multiplatform app | .NET 10, C#, and Avalonia; Windows desktop and Android |
| Frontend | HTML / CSS / JavaScript in `RecitingUsApp/web/`, embedded in the app |
| Shared core | Local HTTP APIs, SQLite, AI proxy, and TTS platform abstractions |
| Legacy Web app | Web app and PowerShell HTTP server in `Memorization UI/` |

---

## Legacy Web App API

The following endpoints are provided only by `Memorization UI/setuptools/server.ps1`; they do not apply to the new desktop and Android apps:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallpapers` | GET | Get the wallpaper file list |
| `/api/upload-wallpaper` | POST | Upload wallpaper image (Base64 format) |
| `/api/wallpapers/{filename}` | DELETE | Delete the specified wallpaper |
| `/api/ai-proxy` | POST | Proxy AI requests to bypass CORS |
| Other paths | GET | Static file service |

---

## Contributing

We recommend joining our QQ group [950739151](https://qun.qq.com/universal-share/share?ac=1&authKey=xb2zqLolbPjWo5ukfQNE4FIXNikYa25bAZdOdhJ9tPwDnyeiGq7FtGe4xflFlxdl&busi_data=eyJncm91cENvZGUiOiI5NTA3MzkxNTEiLCJ0b2tlbiI6IjNsQm1WVlBtdVFPdk5qc1BmT0JHSTZ3cXlIV2wyMnFtdE1nNHhhdXlSWDNkRmFGdjF5MEx3TkFJK09pSGVHajUiLCJ1aW4iOiIyODA5ODc0NjI1In0%3D&data=bsTmftVzmLq9iWmvpCXoInjn7UgcuOhndlMPrXR_DH3JQlDsBTLG-mHm0OcCIdqgqBK-fljO_-w80hYzsr4Ahg&svctype=4&tempid=h5_group_info) for a better collaboration experience.

Report bugs and suggest improvements through [Issues](https://github.com/HelloZWH-0620/Reciting-us/issues), and contribute changes through [Pull Requests](https://github.com/HelloZWH-0620/Reciting-us/pulls). Main contribution areas for the multiplatform app:

- **App logic and platform features**: `RecitingUsApp/src/RecitingUs.Core/`, `RecitingUsApp/src/RecitingUs.App/`, and `RecitingUsApp/src/RecitingUs.Android/`.
- **Frontend, texts, and configuration data**: `RecitingUsApp/web/`. This is the authoritative version used by the multiplatform app; do not treat the legacy files under `Memorization UI/` as a synchronization source.
- **Automated tests**: `RecitingUsApp/src/RecitingUs.Tests/`.
- **Build, packaging, and installer**: `RecitingUsApp/build/` and `RecitingUsApp/installer/`. The .NET version and NuGet package versions are managed in `Directory.Build.props` and `Directory.Packages.props`, respectively.

### Local Development and Verification

The multiplatform app requires the .NET 10 SDK. After cloning the repository, run these commands from its root:

```powershell
dotnet test .\RecitingUsApp\src\RecitingUs.Tests\RecitingUs.Tests.csproj
dotnet build .\RecitingUsApp\src\RecitingUs.App\RecitingUs.App.csproj -c Debug
```

The first command runs the core unit tests; the second builds the Windows desktop app. Android development additionally requires the Android SDK, JDK 21, and the .NET Android workload. See [`RecitingUsApp/BUILD.md`](RecitingUsApp/BUILD.md) for full build, publishing, and environment instructions. Run relevant tests before submitting changes, and do not commit API keys, signing keys, build artifacts, or personal data.

If you are maintaining the legacy Web/PowerShell app, make changes specifically under `Memorization UI/`; its text and configuration data are in that directory's `config/` folder.

---

## License

This project is open source under the [MIT License](https://opensource.org/licenses/MIT).

---

## Acknowledgements

- Thank you to all educators who contribute to classical Chinese and ancient poetry learning
- Thank you to the open-source community for its tools and resources
