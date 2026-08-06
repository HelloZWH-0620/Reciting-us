# Reciting-us (背书哇！)

An auxiliary tool that helps Chinese high school students recite and learn classical Chinese and ancient poems.

## Features

- **Learning Mode (文)**: Browse 50+ classical texts and poems with original text, translation, annotations, and analysis
- **Grammar Mode (法)**: Study sentence patterns (句式) and word-class flexibility (词类活用) with example sentences
- **Practice Mode (练)**: Fill-in-the-blank dictation, sentence matching, situational dictation, author pairing, and a spaced-repetition wrong-answer notebook
- **Vocabulary Mode (词)**: Baicizhan-style multiple choice for 18 classical Chinese function words (虚词)
- **Cross-mode**: Flashcard mode, dark theme, custom wallpapers, data import/export, TTS reading, audio playback, print support

## Quick Start

### Option 1: Direct Use (Windows)

1. Clone or download this repository
2. Navigate to `Memorization UI/setuptools/`
3. Run `start.bat`
4. The app will open in your default browser at `http://localhost:8000/app.html`

### Option 2: Development Mode (with Vite)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Option 3: Static File Server

Use any static file server to serve the `Memorization UI/` directory:

```bash
cd "Memorization UI"
python -m http.server 8000
# Open http://localhost:8000/index.html
```

## Project Structure

```
Reciting-us/
├── Memorization UI/
│   ├── app.html              # Original monolithic app (legacy, still works)
│   ├── index.html             # New modular entry point
│   ├── sw.js                  # Service Worker for PWA offline
│   ├── manifest.json          # PWA manifest
│   ├── package.ps1            # Windows installer script
│   ├── config/                # Externalized JSON data
│   │   ├── articles.json
│   │   ├── game.json
│   │   ├── poem.json
│   │   ├── writer.json
│   │   └── manifest.json
│   ├── src/                   # Modular source files
│   │   ├── css/style.css       # Extracted styles
│   │   ├── js/app.js          # Main application logic
│   │   └── data/              # Separated data modules
│   │       ├── articles.js
│   │       ├── authors.js
│   │       ├── jushi.js
│   │       ├── ci-lei-huo-yong.js
│   │       └── situational-questions.js
│   ├── resource/              # Fonts, icons, backgrounds, audio
│   └── setuptools/            # Windows setup scripts
├── package.json
├── vite.config.js
├── .eslintrc.json
├── test/
│   └── store.test.js          # Unit tests for Store module
└── README.md
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Navigate articles |
| `Space` | Play/pause audio |
| `/` | Focus search box |
| `F` | Toggle flashcard mode |
| `T` | Toggle dark/light theme |
| `Esc` | Close panels |

## Technology Stack

- **Frontend**: Pure vanilla JavaScript (ES5), no framework dependencies
- **Styling**: CSS with CSS variables, backdrop-filter, responsive design
- **Data**: localStorage with `bsw_` prefix
- **Backend**: PowerShell HttpListener (for wallpaper management only)
- **PWA**: Service Worker with cache-first strategy
- **Build**: Vite (optional, for development optimization)

## Spaced Repetition Algorithm

The wrong-answer notebook uses a **SM-2 (SuperMemo 2)** adaptive algorithm:

- Each wrong answer resets the repetition count
- Correct answers increase the interval based on ease factor (EF)
- EF starts at 2.5 and adjusts based on performance (1.3 ~ 3.0)
- 5 consecutive correct answers = mastered (auto-removed)
- Maximum interval capped at 180 days

## License

MIT License - see [LICENSE](LICENSE)

## Authors

- **@喔糖圆鼠** (HelloZWH-0620) - Lead developer
- **@F15EX** - Co-creator
- **@落星尘** - Co-creator

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request
