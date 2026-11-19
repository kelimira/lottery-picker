# Ontario Lottery Picker

A fancy, HTML5-based lottery picker and ticket simulator for all 11 lotteries available in Ontario (OLG).

## Features

- **Full Ontario Coverage**: Supports all 11 games:
  - **Lotto Max**: 7/50 balls, $5 bundle (3 lines), Maxmillions support.
  - **Lotto 6/49**: 6/49 balls, Classic jackpot + Gold Ball Draw format.
  - **Daily Grand**: 5/49 balls + Grand Number (1–7), $1,000/day for life.
  - **Ontario 49**: 6/49 balls, Ontario's $2M classic.
  - **Lottario**: 6/45 balls, 2 lines per $1 play, Early Bird support.
  - **Pick-2**: 2 digits (00–99) with twice-daily draws.
  - **Pick-3**: 3 digits (000–999) with twice-daily draws.
  - **Pick-4**: 4 digits (0000–9999) with twice-daily draws.
  - **Daily Keno**: Customizable 2 to 10 spots chosen from 70 balls.
  - **Poker Lotto**: 5 unique playing cards from 52-card standard deck with card suits and rank graphics.
  - **Encore**: 7-digit add-on (0000000–9999999).
- **Cryptographically Secure Randomness**: Uses `globalThis.crypto.getRandomValues()` with unbiased rejection sampling for uniform distribution.
- **Custom Number Filtering**: Include favorite lucky numbers in the primary line or exclude unwanted/cold numbers across all generated lines.
- **Audio Synthesizer**: Web Audio API ball drop pops, click sounds, and jackpot sweeps with zero external sound files.
- **Playslip Formatting & Print Support**: Authentic receipt view matching official terminal slips with full print layout (`@media print`).
- **History & Clipboard**: Copy slips to clipboard with automatic fallback, persistent validated history in localStorage with corruption defense.
- **Mega-Slip Generator**: Generate an all-lottery quick-pick slip in one click with concurrency protection.
- **Official OLG Specifications**: Sourced directly from official regulations at [olg.ca](https://www.olg.ca) and [playsmart.ca](https://www.playsmart.ca). Note that jackpots, odds, and schedules are subject to change by OLG. Always verify official winning numbers and conditions at olg.ca.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Assets
```bash
npm run build
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Run Typecheck
```bash
npm run typecheck
```

### 5. Launch Application
Open `index.html` directly in any web browser, or serve locally:
```bash
npx serve .
```

## Architecture

- `src/core/`: Pure TypeScript engine
  - `types.ts`: Strict data types and error union definitions.
  - `result.ts`: Result monad (`Result<T, E>`) enforcing typed errors.
  - `games.ts`: Authoritative OLG Ontario lottery specifications and schedules.
  - `random.ts`: Cryptographically secure random sampling algorithms.
  - `validator.ts`: Comprehensive input validation.
  - `generator.ts`: Pure ticket generation engine.
  - `stats.ts`: Ticket statistical analysis (odd/even, sums).
- `src/ui/`: Presentation layer
  - `sound.ts`: Zero-dependency Web Audio API synthesizer.
  - `app.ts`: Interactive application controller.
- `index.html`: Responsive styled HTML5 UI with 3D glossy lottery balls.
- `tests/`: Automated unit and integration test suite.
