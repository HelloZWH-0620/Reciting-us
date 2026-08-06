# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-08-06

### Fixed
- **Critical**: Added 6 missing Store methods (`getStreak`, `updateStreak`, `addStudyTime`, `getStudyTime`, `setLastState`, `getLastState`) that caused runtime crashes in statistics page, study timer, and "continue learning" feature
- **Critical**: Fixed spaced-repetition index bug in wrong-answer notebook - switched from array index to unique UID (`item.uid`) for stable item identification across additions/removals
- Fixed `importData` not merging `dailyStats` - now properly combines daily statistics from imported data with existing data
- Fixed `importData` not handling `situational` practice stats - now merges all 4 practice types
- Fixed `importData` overwriting `streak` data - now keeps the higher streak count

### Added
- **Modular architecture**: Split monolithic `app.html` (5495 lines) into separate CSS, JS, and data files under `src/`
  - `src/css/style.css` - All styles extracted
  - `src/js/app.js` - Main application logic
  - `src/data/` - 5 data modules (articles, authors, jushi, cilei, situational)
- **New entry point**: `index.html` with proper module loading order
- **Vite build tool**: `vite.config.js` and `package.json` for development server and production builds
- **Service Worker** (`sw.js`): Full PWA offline support with cache-first strategy for static assets and network-first for HTML
- **ESLint configuration** (`.eslintrc.json`): Code quality rules for browser ES5 code
- **Unit tests** (`test/store.test.js`): 11 tests covering Store methods (streak, study time, wrong book UID, import/export)
- **SM-2 spaced repetition algorithm**: Upgraded from fixed intervals (1/3/7/14/30 days) to adaptive SuperMemo-2 with dynamic ease factor, automatic interval calculation, and 5-consecutive-correct mastery threshold
- **Article difficulty rating**: `getArticleDifficulty()` now returns star ratings (★☆☆ to ★★★) based on text length, sentence count, and unique character ratio
- **Keyboard shortcuts panel**: Full implementation of `#shortcutBtn` with dynamic panel UI
- **Global keyboard shortcuts**: `←/→` navigation, `Space` play/pause, `/` search focus, `F` flashcard, `T` theme toggle, `Esc` close panels
- **PWA install guidance**: Shortcut panel and proper manifest icons

### Changed
- Mobile responsive breakpoint changed from `max-width:300px` to `max-width:768px` - drawer-style sidebar now activates on actual mobile devices (phones are 360-414px wide)
- Shortcut button no longer hidden on small screens

### Deprecated
- `app.html` is now considered legacy; use `index.html` for new development
- `WR_INTERVAL_LABELS` array is no longer used (SM-2 provides dynamic interval labels)

## [0.1.2] - 2025 (Original Release)

### Features
- 50+ classical Chinese texts and ancient poems
- 18 writer profiles with biographical information
- 4 learning modes: Learn (文), Grammar (法), Practice (练), Vocabulary (词)
- Sentence pattern examples (判断句, 被动句, 倒装句, etc.)
- Word-class flexibility examples (词类活用)
- 50 situational dictation questions
- Fill-in-the-blank, sentence matching, author pairing exercises
- Spaced-repetition wrong-answer notebook (fixed intervals: 1/3/7/14/30 days)
- Statistics dashboard with Canvas charts (accuracy trend, type distribution, error pie, study heatmap)
- Flashcard mode
- TTS text-to-speech reading
- Audio playback with speed control and loop
- Dark/light theme
- Custom wallpaper support
- Data import/export
- Print support
- Mobile responsive design with touch swipe
- PWA manifest (no Service Worker)
