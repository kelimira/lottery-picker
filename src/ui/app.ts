import { ONTARIO_GAMES, getGameDefinition } from '../core/games.js';
import { generateTicket } from '../core/generator.js';
import { createErr, createOk, isErr, isOk } from '../core/result.js';
import { analyzeLine } from '../core/stats.js';
import type {
  GameLine,
  GeneratedTicket,
  GenerationOptions,
  LotteryError,
  PlayingCard,
  Result,
} from '../core/types.js';
import { MAX_TICKET_LINES } from '../core/validator.js';
import { soundManager } from './sound.js';

export interface AppState {
  selectedGameId: string;
  lineCount: number;
  kenoSpot: number;
  includeEncore: boolean;
  includeGoldBall: boolean;
  animateReveal: boolean;
  includeNumbers: number[];
  excludeNumbers: number[];
  history: GeneratedTicket[];
  isGenerating: boolean;
}

export const STORAGE_KEY = 'ontario_lottery_picker_history_v1';

export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseNumberList(input: string): number[] {
  if (!input || typeof input !== 'string') return [];
  const parts = input.split(/[\s,;]+/);
  const result: number[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const num = Number(trimmed);
    if (!Number.isNaN(num) && Number.isInteger(num)) {
      if (!result.includes(num)) {
        result.push(num);
      }
    }
  }
  return result;
}

export function isValidTicket(obj: unknown): obj is GeneratedTicket {
  if (typeof obj !== 'object' || obj === null) return false;
  const t = obj as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.gameId !== 'string' || typeof t.gameName !== 'string') {
    return false;
  }
  if (typeof t.timestamp !== 'string') {
    return false;
  }
  if (!Array.isArray(t.lines) || t.lines.length === 0) {
    return false;
  }
  for (const line of t.lines) {
    if (typeof line !== 'object' || line === null) return false;
    const l = line as Record<string, unknown>;
    if (l.kind === 'balls') {
      if (!Array.isArray(l.numbers) || !l.numbers.every((n) => typeof n === 'number')) {
        return false;
      }
    } else if (l.kind === 'digits') {
      if (!Array.isArray(l.digits) || !l.digits.every((d) => typeof d === 'number')) {
        return false;
      }
    } else if (l.kind === 'cards') {
      if (!Array.isArray(l.cards)) {
        return false;
      }
    } else {
      return false;
    }
  }
  return true;
}

export class LotteryApp {
  private state: AppState = {
    selectedGameId: 'lotto-max',
    lineCount: 3,
    kenoSpot: 10,
    includeEncore: true,
    includeGoldBall: true,
    animateReveal: true,
    includeNumbers: [],
    excludeNumbers: [],
    history: [],
    isGenerating: false,
  };

  constructor() {
    this.loadHistory();
  }

  public getState(): Readonly<AppState> {
    return { ...this.state };
  }

  public loadHistory(): Result<readonly GeneratedTicket[], LotteryError> {
    if (typeof localStorage === 'undefined') {
      this.state.history = [];
      return createOk([]);
    }
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        this.state.history = [];
        return createOk([]);
      }
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const validTickets = parsed.filter(isValidTicket).slice(0, 20);
        this.state.history = validTickets;
        return createOk(validTickets);
      }
      this.state.history = [];
      return createOk([]);
    } catch {
      this.state.history = [];
      return createOk([]);
    }
  }

  public saveHistory(): Result<boolean, LotteryError> {
    if (typeof localStorage === 'undefined') {
      return createOk(false);
    }
    try {
      const safeTickets = this.state.history.filter(isValidTicket).slice(0, 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeTickets));
      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: err instanceof Error ? err.message : 'Failed to save history to storage',
      });
    }
  }

  public clearHistory(): Result<boolean, LotteryError> {
    this.state.history = [];
    const saveRes = this.saveHistory();
    if (isErr(saveRes)) {
      return saveRes;
    }
    this.renderHistory();
    this.showNotification('History cleared.', 'info');
    soundManager.playClick();
    return createOk(true);
  }

  public init(): Result<boolean, LotteryError> {
    try {
      this.renderGameSelector();
      this.renderCurrentGame();
      this.attachEventListeners();
      this.renderHistory();
      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: err instanceof Error ? err.message : 'Initialization failed',
      });
    }
  }

  public showNotification(
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ): Result<boolean, LotteryError> {
    if (typeof document === 'undefined') {
      return createOk(true);
    }
    try {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast toast-${type} toast-show`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
          if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
          }
        }, 300);
      }, 3500);

      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: err instanceof Error ? err.message : 'Failed to display notification',
      });
    }
  }

  private attachEventListeners(): void {
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        void this.handleGenerate();
      });
    }

    const quickPickAllBtn = document.getElementById('quick-pick-all-btn');
    if (quickPickAllBtn) {
      quickPickAllBtn.addEventListener('click', () => {
        void this.handleQuickPickAll();
      });
    }

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        soundManager.enabled = !soundManager.enabled;
        soundToggle.textContent = soundManager.enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
        soundToggle.setAttribute('aria-pressed', String(soundManager.enabled));
        if (soundManager.enabled) {
          soundManager.playClick();
        }
      });
    }

    const copyBtn = document.getElementById('copy-ticket-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        void this.handleCopyTicket();
      });
    }

    const printBtn = document.getElementById('print-ticket-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        if (typeof window !== 'undefined' && window.print) {
          window.print();
        }
      });
    }

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this.clearHistory();
      });
    }
  }

  public selectGame(gameId: string): Result<boolean, LotteryError> {
    const gameResult = getGameDefinition(gameId);
    if (isErr(gameResult)) {
      return gameResult;
    }

    this.state.selectedGameId = gameId;
    this.state.lineCount = gameResult.value.bundleLines;
    this.state.kenoSpot = 10;
    this.state.includeEncore = gameResult.value.supportsEncore;
    this.state.includeNumbers = [];
    this.state.excludeNumbers = [];

    this.renderGameSelector();
    this.renderCurrentGame();
    soundManager.playClick();
    return createOk(true);
  }

  public setLineCount(count: number): Result<boolean, LotteryError> {
    if (!Number.isInteger(count) || count < 1 || count > MAX_TICKET_LINES) {
      return createErr({
        code: 'INVALID_LINE_COUNT',
        message: `Line count must be between 1 and ${MAX_TICKET_LINES}. Received: ${count}.`,
      });
    }
    this.state.lineCount = count;
    return createOk(true);
  }

  public setKenoSpot(spot: number): Result<boolean, LotteryError> {
    if (!Number.isInteger(spot) || spot < 2 || spot > 10) {
      return createErr({
        code: 'INVALID_KENO_SPOT',
        message: `Keno spot must be between 2 and 10. Received: ${spot}.`,
      });
    }
    this.state.kenoSpot = spot;
    return createOk(true);
  }

  public setIncludedNumbers(numbers: readonly number[]): Result<boolean, LotteryError> {
    this.state.includeNumbers = [...numbers];
    return createOk(true);
  }

  public setExcludedNumbers(numbers: readonly number[]): Result<boolean, LotteryError> {
    this.state.excludeNumbers = [...numbers];
    return createOk(true);
  }

  public renderGameSelector(): Result<boolean, LotteryError> {
    if (typeof document === 'undefined') return createOk(true);
    const container = document.getElementById('game-tabs');
    if (!container) return createOk(true);

    try {
      container.innerHTML = ONTARIO_GAMES.map((game) => {
        const isSelected = game.id === this.state.selectedGameId;
        return `
          <button
            type="button"
            class="game-tab ${isSelected ? 'active' : ''}"
            data-game-id="${escapeHtml(game.id)}"
            style="--brand-color: ${game.theme.primary}; --accent-color: ${game.theme.accent};"
            aria-selected="${isSelected}"
          >
            <span class="game-tab-name">${escapeHtml(game.name)}</span>
            <span class="game-tab-prize">${escapeHtml(game.topPrize)}</span>
          </button>
        `;
      }).join('');

      container.querySelectorAll('.game-tab').forEach((el) => {
        el.addEventListener('click', (e) => {
          const btn = e.currentTarget as HTMLElement;
          const gameId = btn.getAttribute('data-game-id');
          if (gameId) {
            this.selectGame(gameId);
          }
        });
      });

      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: err instanceof Error ? err.message : 'Failed to render game selector',
      });
    }
  }

  public renderCurrentGame(): Result<boolean, LotteryError> {
    if (typeof document === 'undefined') return createOk(true);

    const gameResult = getGameDefinition(this.state.selectedGameId);
    if (isErr(gameResult)) return gameResult;
    const game = gameResult.value;

    try {
      const banner = document.getElementById('game-banner');
      if (banner) {
        banner.style.borderLeftColor = game.theme.primary;
        banner.innerHTML = `
          <div class="banner-header">
            <h2 class="game-title" style="color: ${game.theme.accent || '#fff'}">${escapeHtml(game.name)}</h2>
            <span class="category-badge">${escapeHtml(game.category.toUpperCase())}</span>
          </div>
          <p class="game-tagline">${escapeHtml(game.tagline)}</p>
          <div class="banner-meta">
            <div><strong>Ticket:</strong> ${escapeHtml(game.ticketPrice)}</div>
            <div><strong>Draws:</strong> ${escapeHtml(game.drawDays.join(', '))} @ ${escapeHtml(game.drawTime)}</div>
            <div><strong>Top Prize Odds:</strong> ${escapeHtml(game.odds)}</div>
            <div><strong>Official Source:</strong> <a href="${escapeHtml(game.source)}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-gold); text-decoration: underline;">Verify at olg.ca</a></div>
            ${
              game.specialOption
                ? `<div class="special-feature">★ <strong>${escapeHtml(game.specialOption.name)}:</strong> ${escapeHtml(game.specialOption.description)}</div>`
                : ''
            }
          </div>
        `;
      }

      const optionsContainer = document.getElementById('game-options');
      if (!optionsContainer) return createOk(true);

      let kenoHtml = '';
      if (game.id === 'daily-keno') {
        kenoHtml = `
          <div class="form-group">
            <label for="keno-spot-select">Keno Spot (How many numbers to pick):</label>
            <select id="keno-spot-select" class="form-control">
              ${(game.kenoSpots ?? [2, 3, 4, 5, 6, 7, 8, 9, 10])
                .map(
                  (spot) =>
                    `<option value="${spot}" ${spot === this.state.kenoSpot ? 'selected' : ''}>
                      ${spot} Spot (${spot} numbers)
                    </option>`
                )
                .join('')}
            </select>
          </div>
        `;
      }

      // Include/Exclude number custom UI for ball games
      let customNumbersHtml = '';
      if (game.type === 'balls') {
        customNumbersHtml = `
          <div class="options-grid custom-numbers-grid">
            <div class="form-group">
              <label for="include-numbers-input">Include Numbers (Lucky / Favorite):</label>
              <input
                type="text"
                id="include-numbers-input"
                class="form-control"
                placeholder="e.g. 7, 14, 21"
                value="${escapeHtml(this.state.includeNumbers.join(', '))}"
              />
              <small class="helper-text">Numbers to guarantee in Line 1 (${game.minNumber} to ${game.maxNumber})</small>
            </div>
            <div class="form-group">
              <label for="exclude-numbers-input">Exclude Numbers (Cold / Unwanted):</label>
              <input
                type="text"
                id="exclude-numbers-input"
                class="form-control"
                placeholder="e.g. 13, 44"
                value="${escapeHtml(this.state.excludeNumbers.join(', '))}"
              />
              <small class="helper-text">Numbers to omit from all lines (${game.minNumber} to ${game.maxNumber})</small>
            </div>
          </div>
        `;
      }

      const encoreHtml = game.supportsEncore
        ? `
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" id="encore-toggle" ${this.state.includeEncore ? 'checked' : ''} />
              Add ENCORE (+$1.00 per play) — 22 ways to win $1M
            </label>
          </div>
        `
        : '';

      const goldBallHtml =
        game.id === 'lotto-649'
          ? `
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" id="gold-ball-toggle" ${this.state.includeGoldBall ? 'checked' : ''} />
              Include Gold Ball Draw number
            </label>
          </div>
        `
          : '';

      optionsContainer.innerHTML = `
        <div class="options-grid">
          <div class="form-group">
            <label for="line-count-input">Lines to play (1–${MAX_TICKET_LINES}):</label>
            <input
              type="number"
              id="line-count-input"
              class="form-control"
              min="1"
              max="${MAX_TICKET_LINES}"
              value="${this.state.lineCount}"
            />
            <small class="helper-text">Standard bundle: ${game.bundleLines} line(s)</small>
          </div>
          ${kenoHtml}
        </div>
        ${customNumbersHtml}
        <div class="checkboxes-row">
          ${encoreHtml}
          ${goldBallHtml}
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" id="anim-toggle" ${this.state.animateReveal ? 'checked' : ''} />
              Ball reveal animation
            </label>
          </div>
        </div>
      `;

      // Hook inputs
      const lineInput = document.getElementById('line-count-input') as HTMLInputElement | null;
      if (lineInput) {
        lineInput.addEventListener('change', () => {
          const val = parseInt(lineInput.value, 10);
          if (!isNaN(val) && val >= 1 && val <= MAX_TICKET_LINES) {
            this.state.lineCount = val;
          }
        });
      }

      const kenoSelect = document.getElementById('keno-spot-select') as HTMLSelectElement | null;
      if (kenoSelect) {
        kenoSelect.addEventListener('change', () => {
          this.state.kenoSpot = parseInt(kenoSelect.value, 10) || 10;
        });
      }

      const includeInput = document.getElementById('include-numbers-input') as HTMLInputElement | null;
      if (includeInput) {
        const handleIncludeChange = () => {
          this.state.includeNumbers = parseNumberList(includeInput.value);
        };
        includeInput.addEventListener('change', handleIncludeChange);
        includeInput.addEventListener('input', handleIncludeChange);
      }

      const excludeInput = document.getElementById('exclude-numbers-input') as HTMLInputElement | null;
      if (excludeInput) {
        const handleExcludeChange = () => {
          this.state.excludeNumbers = parseNumberList(excludeInput.value);
        };
        excludeInput.addEventListener('change', handleExcludeChange);
        excludeInput.addEventListener('input', handleExcludeChange);
      }

      const encoreCheckbox = document.getElementById('encore-toggle') as HTMLInputElement | null;
      if (encoreCheckbox) {
        encoreCheckbox.addEventListener('change', () => {
          this.state.includeEncore = encoreCheckbox.checked;
        });
      }

      const goldBallCheckbox = document.getElementById('gold-ball-toggle') as HTMLInputElement | null;
      if (goldBallCheckbox) {
        goldBallCheckbox.addEventListener('change', () => {
          this.state.includeGoldBall = goldBallCheckbox.checked;
        });
      }

      const animCheckbox = document.getElementById('anim-toggle') as HTMLInputElement | null;
      if (animCheckbox) {
        animCheckbox.addEventListener('change', () => {
          this.state.animateReveal = animCheckbox.checked;
        });
      }

      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: err instanceof Error ? err.message : 'Failed to render current game options',
      });
    }
  }

  public async handleGenerate(): Promise<Result<GeneratedTicket, LotteryError>> {
    if (this.state.isGenerating) {
      const err: LotteryError = {
        code: 'VALIDATION_FAILURE',
        message: 'Generation already in progress.',
      };
      this.showNotification(err.message, 'error');
      return createErr(err);
    }

    const gameResult = getGameDefinition(this.state.selectedGameId);
    if (isErr(gameResult)) {
      this.showNotification(gameResult.error.message, 'error');
      return gameResult;
    }
    const game = gameResult.value;

    const options: GenerationOptions = {
      lines: this.state.lineCount,
      includeEncore: this.state.includeEncore,
      kenoSpot: this.state.kenoSpot,
      includeGoldBall: this.state.includeGoldBall,
      includeNumbers: this.state.includeNumbers,
      excludeNumbers: this.state.excludeNumbers,
    };

    const ticketResult = generateTicket(game, options);
    if (isErr(ticketResult)) {
      this.showNotification(`Error: ${ticketResult.error.message}`, 'error');
      return ticketResult;
    }

    const ticket = ticketResult.value;
    this.state.history.unshift(ticket);
    this.saveHistory();
    this.renderHistory();

    await this.displayTicket(ticket, this.state.animateReveal);
    return createOk(ticket);
  }

  public async handleQuickPickAll(): Promise<Result<readonly GeneratedTicket[], LotteryError>> {
    if (this.state.isGenerating) {
      const err: LotteryError = {
        code: 'VALIDATION_FAILURE',
        message: 'Generation already in progress.',
      };
      this.showNotification(err.message, 'error');
      return createErr(err);
    }

    this.state.isGenerating = true;
    try {
      const generated: GeneratedTicket[] = [];
      const container = typeof document !== 'undefined' ? document.getElementById('ticket-display') : null;
      if (container) {
        container.innerHTML = '<div class="loader" style="padding: 32px; text-align: center;">Generating Ontario Lottery Mega-Slip...</div>';
      }

      for (const game of ONTARIO_GAMES) {
        const ticketRes = generateTicket(game, {
          lines: game.bundleLines,
          includeEncore: game.supportsEncore,
          kenoSpot: 10,
          includeGoldBall: game.id === 'lotto-649',
        });
        if (isOk(ticketRes)) {
          generated.push(ticketRes.value);
          this.state.history.unshift(ticketRes.value);
        }
      }

      this.saveHistory();
      this.renderHistory();

      if (container) {
        container.innerHTML = `
          <div class="mega-slip-container">
            <div class="ticket-header" style="text-align: center; margin-bottom: 16px;">
              <h3>Ontario All-Lotteries Mega Slip</h3>
              <p style="font-size: 0.8rem; color: #666;">Generated on ${escapeHtml(new Date().toLocaleString())} — Official OLG Simulation</p>
              <p style="font-size: 0.75rem; color: #888;">Verify official conditions at olg.ca</p>
            </div>
            <div class="mega-slip-grid">
              ${generated
                .map((t) => {
                  const game = ONTARIO_GAMES.find((g) => g.id === t.gameId);
                  const color = game?.theme.primary ?? '#333';
                  return `
                    <div class="mega-ticket-card" style="border-top-color: ${color}">
                      <h4>${escapeHtml(t.gameName)}</h4>
                      <div class="lines-list">
                        ${t.lines.map((l, i) => this.renderLineHtml(l, i + 1, false)).join('')}
                      </div>
                      ${
                        t.goldBallNumber
                          ? `<div class="extra-item gold-ball">Gold Ball: <strong>${escapeHtml(t.goldBallNumber)}</strong></div>`
                          : ''
                      }
                      ${
                        t.encore
                          ? `<div class="extra-item encore">ENCORE: <strong>${escapeHtml(t.encore.join(' '))}</strong></div>`
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      }

      soundManager.playJackpotChime();
      return createOk(generated);
    } catch (err) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: err instanceof Error ? err.message : 'Mega-slip generation failed',
      });
    } finally {
      this.state.isGenerating = false;
    }
  }

  public async displayTicket(ticket: GeneratedTicket, animate: boolean): Promise<Result<boolean, LotteryError>> {
    if (typeof document === 'undefined') {
      return createOk(true);
    }

    const container = document.getElementById('ticket-display');
    if (!container) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: 'Ticket display element not found.',
      });
    }

    this.state.isGenerating = true;

    try {
      container.innerHTML = `
        <div class="ticket-receipt" id="current-receipt">
          <div class="receipt-header">
            <div class="receipt-brand">ONTARIO LOTTERY & GAMING</div>
            <h3 class="receipt-title">${escapeHtml(ticket.gameName.toUpperCase())}</h3>
            <div class="receipt-id">${escapeHtml(ticket.id)}</div>
            <div class="receipt-date">${escapeHtml(new Date(ticket.timestamp).toLocaleString())}</div>
          </div>
          <div class="receipt-lines" id="receipt-lines-container"></div>
          ${
            ticket.goldBallNumber
              ? `
                <div class="receipt-extra gold-ball-box">
                  <span class="extra-label">GOLD BALL DRAW:</span>
                  <span class="extra-value">${escapeHtml(ticket.goldBallNumber)}</span>
                </div>
              `
              : ''
          }
          ${
            ticket.encore
              ? `
                <div class="receipt-extra encore-box">
                  <span class="extra-label">ENCORE:</span>
                  <span class="extra-value">${escapeHtml(ticket.encore.join('  '))}</span>
                </div>
              `
              : ''
          }
          <div class="receipt-footer">
            GOOD LUCK! PLAY RESPONSIBLY. 19+ | VERIFY AT OLG.CA
          </div>
        </div>
      `;

      const linesContainer = document.getElementById('receipt-lines-container');
      if (!linesContainer) {
        return createOk(true);
      }

      if (!animate) {
        linesContainer.innerHTML = ticket.lines
          .map((line, idx) => this.renderLineHtml(line, idx + 1, false))
          .join('');
        soundManager.playJackpotChime();
        return createOk(true);
      }

      // Step-by-step ball drop animation
      let ballStep = 0;
      for (let lIdx = 0; lIdx < ticket.lines.length; lIdx++) {
        const line = ticket.lines[lIdx];
        if (!line) continue;

        const lineEl = document.createElement('div');
        lineEl.className = 'ticket-line animate-in';
        lineEl.innerHTML = this.renderLineHtml(line, lIdx + 1, true);
        linesContainer.appendChild(lineEl);

        const balls = lineEl.querySelectorAll('.ball, .card-chip, .digit-box');
        for (let bIdx = 0; bIdx < balls.length; bIdx++) {
          const ball = balls[bIdx] as HTMLElement;
          await new Promise((r) => setTimeout(r, 65));
          ball.classList.add('revealed');
          soundManager.playBallPop(ballStep++);
        }
      }

      soundManager.playJackpotChime();
      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: err instanceof Error ? err.message : 'Error rendering ticket display',
      });
    } finally {
      this.state.isGenerating = false;
    }
  }

  private renderLineHtml(line: GameLine, lineNum: number, startHidden: boolean): string {
    const hiddenClass = startHidden ? 'hidden-ball' : 'revealed';
    const statsRes = analyzeLine(line);
    const statsHtml =
      isOk(statsRes) && line.kind === 'balls'
        ? `<span class="line-stats">Odd/Even: ${statsRes.value.oddCount}/${statsRes.value.evenCount} | Sum: ${statsRes.value.sumTotal}</span>`
        : '';

    if (line.kind === 'balls') {
      const ballsHtml = line.numbers
        .map(
          (num) =>
            `<span class="ball ${hiddenClass}" data-number="${num}">
              <span class="ball-inner">${escapeHtml(num.toString().padStart(2, '0'))}</span>
            </span>`
        )
        .join('');

      const grandHtml =
        line.grandNumber !== undefined
          ? `<span class="grand-ball ${hiddenClass}" title="Grand Number">
              <span class="ball-inner">★ ${line.grandNumber}</span>
             </span>`
          : '';

      return `
        <div class="line-row">
          <span class="line-index">Line ${lineNum}</span>
          <div class="balls-group">
            ${ballsHtml}
            ${grandHtml}
          </div>
          ${statsHtml}
        </div>
      `;
    }

    if (line.kind === 'digits') {
      const digitsHtml = line.digits
        .map(
          (d) =>
            `<span class="digit-box ${hiddenClass}">
              ${d}
            </span>`
        )
        .join('');

      return `
        <div class="line-row">
          <span class="line-index">Line ${lineNum}</span>
          <div class="digits-group">
            ${digitsHtml}
          </div>
        </div>
      `;
    }

    if (line.kind === 'cards') {
      const cardsHtml = line.cards
        .map((c) => this.renderCardHtml(c, hiddenClass))
        .join('');

      return `
        <div class="line-row cards-row">
          <span class="line-index">Hand ${lineNum}</span>
          <div class="cards-group">
            ${cardsHtml}
          </div>
        </div>
      `;
    }

    return '';
  }

  private renderCardHtml(card: PlayingCard, hiddenClass: string): string {
    const isRed = card.color === 'red';
    return `
      <div class="card-chip ${isRed ? 'card-red' : 'card-black'} ${hiddenClass}">
        <span class="card-rank">${escapeHtml(card.rank)}</span>
        <span class="card-suit">${escapeHtml(card.symbol)}</span>
      </div>
    `;
  }

  public async handleCopyTicket(): Promise<Result<boolean, LotteryError>> {
    if (typeof document === 'undefined') {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: 'Document not available for clipboard copy.',
      });
    }

    const receipt = document.getElementById('current-receipt');
    if (!receipt) {
      const err: LotteryError = {
        code: 'VALIDATION_FAILURE',
        message: 'No ticket available to copy. Please generate a ticket first!',
      };
      this.showNotification(err.message, 'error');
      return createErr(err);
    }

    const text = receipt.innerText || receipt.textContent || '';
    if (!text.trim()) {
      const err: LotteryError = {
        code: 'VALIDATION_FAILURE',
        message: 'Ticket text is empty.',
      };
      this.showNotification(err.message, 'error');
      return createErr(err);
    }

    // Try modern Clipboard API first
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        this.showNotification('Ticket copied to clipboard!', 'success');
        return createOk(true);
      }
    } catch {
      // Fallback
    }

    // Fallback using temporary textarea + document.execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (success) {
        this.showNotification('Ticket copied to clipboard!', 'success');
        return createOk(true);
      }
    } catch {
      // Fallback failed
    }

    const err: LotteryError = {
      code: 'VALIDATION_FAILURE',
      message: 'Unable to copy ticket to clipboard automatically.',
    };
    this.showNotification(err.message, 'error');
    return createErr(err);
  }

  public renderHistory(): Result<boolean, LotteryError> {
    if (typeof document === 'undefined') return createOk(true);

    try {
      const list = document.getElementById('history-list');
      if (!list) return createOk(true);

      if (!Array.isArray(this.state.history) || this.state.history.length === 0) {
        list.innerHTML = '<li class="empty-history">No tickets generated yet.</li>';
        return createOk(true);
      }

      list.innerHTML = this.state.history
        .map((t) => {
          if (!t || !Array.isArray(t.lines) || t.lines.length === 0) {
            return '';
          }
          const time = new Date(t.timestamp).toLocaleTimeString();
          let summary = '';
          const firstLine = t.lines[0];
          if (firstLine?.kind === 'balls' && Array.isArray(firstLine.numbers)) {
            summary = firstLine.numbers.join(', ');
          } else if (firstLine?.kind === 'digits' && Array.isArray(firstLine.digits)) {
            summary = firstLine.digits.join('');
          } else if (firstLine?.kind === 'cards' && Array.isArray(firstLine.cards)) {
            summary = firstLine.cards.map((c: PlayingCard) => c?.code ?? '').join(' ');
          }

          const lineCount = t.lines.length;
          return `
            <li class="history-item">
              <div class="history-item-top">
                <strong>${escapeHtml(t.gameName || 'Lottery Ticket')}</strong>
                <span class="history-time">${escapeHtml(time)}</span>
              </div>
              <div class="history-summary">${escapeHtml(summary)} (${lineCount} line${lineCount > 1 ? 's' : ''})</div>
            </li>
          `;
        })
        .join('');

      return createOk(true);
    } catch (err) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: err instanceof Error ? err.message : 'Error rendering history',
      });
    }
  }
}

// Auto-boot if running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new LotteryApp();
    app.init();
  });
}
