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
import { soundManager } from './sound.js';

interface AppState {
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

const STORAGE_KEY = 'ontario_lottery_picker_history_v1';

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

  private loadHistory(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as GeneratedTicket[];
        if (Array.isArray(parsed)) {
          this.state.history = parsed.slice(0, 20);
        }
      }
    } catch {
      // Ignore corrupt history
    }
  }

  private saveHistory(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.history.slice(0, 20)));
    } catch {
      // Ignore storage errors
    }
  }

  public init(): Result<boolean, LotteryError> {
    this.renderGameSelector();
    this.renderCurrentGame();
    this.attachEventListeners();
    this.renderHistory();
    return createOk(true);
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
        this.handleCopyTicket();
      });
    }

    const printBtn = document.getElementById('print-ticket-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this.state.history = [];
        this.saveHistory();
        this.renderHistory();
        soundManager.playClick();
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
    this.state.includeEncore = gameResult.value.supportsEncore;
    this.state.includeNumbers = [];
    this.state.excludeNumbers = [];

    this.renderGameSelector();
    this.renderCurrentGame();
    soundManager.playClick();
    return createOk(true);
  }

  private renderGameSelector(): void {
    const container = document.getElementById('game-tabs');
    if (!container) return;

    container.innerHTML = ONTARIO_GAMES.map((game) => {
      const isSelected = game.id === this.state.selectedGameId;
      return `
        <button
          type="button"
          class="game-tab ${isSelected ? 'active' : ''}"
          data-game-id="${game.id}"
          style="--brand-color: ${game.theme.primary}; --accent-color: ${game.theme.accent};"
          aria-selected="${isSelected}"
        >
          <span class="game-tab-name">${game.name}</span>
          <span class="game-tab-prize">${game.topPrize}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.game-tab').forEach((el) => {
      el.addEventListener('click', (e) => {
        const btn = (e.currentTarget as HTMLElement);
        const gameId = btn.getAttribute('data-game-id');
        if (gameId) {
          this.selectGame(gameId);
        }
      });
    });
  }

  private renderCurrentGame(): void {
    const gameResult = getGameDefinition(this.state.selectedGameId);
    if (isErr(gameResult)) return;
    const game = gameResult.value;

    const banner = document.getElementById('game-banner');
    if (banner) {
      banner.style.borderLeftColor = game.theme.primary;
      banner.innerHTML = `
        <div class="banner-header">
          <h2 class="game-title" style="color: ${game.theme.accent || '#fff'}">${game.name}</h2>
          <span class="category-badge">${game.category.toUpperCase()}</span>
        </div>
        <p class="game-tagline">${game.tagline}</p>
        <div class="banner-meta">
          <div><strong>Ticket:</strong> ${game.ticketPrice}</div>
          <div><strong>Draws:</strong> ${game.drawDays.join(', ')} @ ${game.drawTime}</div>
          <div><strong>Top Prize Odds:</strong> ${game.odds}</div>
          ${
            game.specialOption
              ? `<div class="special-feature">★ <strong>${game.specialOption.name}:</strong> ${game.specialOption.description}</div>`
              : ''
          }
        </div>
      `;
    }

    const optionsContainer = document.getElementById('game-options');
    if (!optionsContainer) return;

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
          <label for="line-count-input">Lines to play:</label>
          <input
            type="number"
            id="line-count-input"
            class="form-control"
            min="1"
            max="30"
            value="${this.state.lineCount}"
          />
          <small class="helper-text">Standard bundle: ${game.bundleLines} line(s)</small>
        </div>
        ${kenoHtml}
      </div>
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
        if (!isNaN(val) && val >= 1 && val <= 30) {
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
  }

  public async handleGenerate(): Promise<Result<GeneratedTicket, LotteryError>> {
    if (this.state.isGenerating) {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: 'Generation already in progress.',
      });
    }

    const gameResult = getGameDefinition(this.state.selectedGameId);
    if (isErr(gameResult)) {
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
      alert(`Error generating ticket: ${ticketResult.error.message}`);
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
    const generated: GeneratedTicket[] = [];
    const container = document.getElementById('ticket-display');
    if (container) {
      container.innerHTML = '<div class="loader">Generating Ontario Lottery Mega-Slip...</div>';
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
          <div class="ticket-header">
            <h3>Ontario All-Lotteries Mega Slip</h3>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
          <div class="mega-slip-grid">
            ${generated
              .map((t) => {
                const game = ONTARIO_GAMES.find((g) => g.id === t.gameId);
                const color = game?.theme.primary ?? '#333';
                return `
                  <div class="mega-ticket-card" style="border-top-color: ${color}">
                    <h4>${t.gameName}</h4>
                    <div class="lines-list">
                      ${t.lines.map((l, i) => this.renderLineHtml(l, i + 1, false)).join('')}
                    </div>
                    ${
                      t.goldBallNumber
                        ? `<div class="extra-item gold-ball">Gold Ball: <strong>${t.goldBallNumber}</strong></div>`
                        : ''
                    }
                    ${
                      t.encore
                        ? `<div class="extra-item encore">ENCORE: <strong>${t.encore.join(' ')}</strong></div>`
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
  }

  private async displayTicket(ticket: GeneratedTicket, animate: boolean): Promise<void> {
    const container = document.getElementById('ticket-display');
    if (!container) return;

    this.state.isGenerating = true;

    container.innerHTML = `
      <div class="ticket-receipt" id="current-receipt">
        <div class="receipt-header">
          <div class="receipt-brand">ONTARIO LOTTERY & GAMING</div>
          <h3 class="receipt-title">${ticket.gameName.toUpperCase()}</h3>
          <div class="receipt-id">${ticket.id}</div>
          <div class="receipt-date">${new Date(ticket.timestamp).toLocaleString()}</div>
        </div>
        <div class="receipt-lines" id="receipt-lines-container"></div>
        ${
          ticket.goldBallNumber
            ? `
              <div class="receipt-extra gold-ball-box">
                <span class="extra-label">GOLD BALL DRAW:</span>
                <span class="extra-value">${ticket.goldBallNumber}</span>
              </div>
            `
            : ''
        }
        ${
          ticket.encore
            ? `
              <div class="receipt-extra encore-box">
                <span class="extra-label">ENCORE:</span>
                <span class="extra-value">${ticket.encore.join('  ')}</span>
              </div>
            `
            : ''
        }
        <div class="receipt-footer">
          GOOD LUCK! PLAY RESPONSIBLY.
        </div>
      </div>
    `;

    const linesContainer = document.getElementById('receipt-lines-container');
    if (!linesContainer) {
      this.state.isGenerating = false;
      return;
    }

    if (!animate) {
      linesContainer.innerHTML = ticket.lines
        .map((line, idx) => this.renderLineHtml(line, idx + 1, false))
        .join('');
      soundManager.playJackpotChime();
      this.state.isGenerating = false;
      return;
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
    this.state.isGenerating = false;
  }

  private renderLineHtml(line: GameLine, lineNum: number, startHidden: boolean): string {
    const hiddenClass = startHidden ? 'hidden-ball' : 'revealed';
    const statsRes = analyzeLine(line);
    const statsHtml = isOk(statsRes) && line.kind === 'balls'
      ? `<span class="line-stats">Odd/Even: ${statsRes.value.oddCount}/${statsRes.value.evenCount} | Sum: ${statsRes.value.sumTotal}</span>`
      : '';

    if (line.kind === 'balls') {
      const ballsHtml = line.numbers
        .map(
          (num) =>
            `<span class="ball ${hiddenClass}" data-number="${num}">
              <span class="ball-inner">${num.toString().padStart(2, '0')}</span>
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
        <span class="card-rank">${card.rank}</span>
        <span class="card-suit">${card.symbol}</span>
      </div>
    `;
  }

  private handleCopyTicket(): void {
    const receipt = document.getElementById('current-receipt');
    if (!receipt) {
      alert('Generate a ticket first!');
      return;
    }

    const text = receipt.innerText;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Ticket copied to clipboard!');
      }).catch(() => {
        // Fallback
      });
    }
  }

  private renderHistory(): void {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (this.state.history.length === 0) {
      list.innerHTML = '<li class="empty-history">No tickets generated yet.</li>';
      return;
    }

    list.innerHTML = this.state.history
      .map((t) => {
        const time = new Date(t.timestamp).toLocaleTimeString();
        let summary = '';
        const firstLine = t.lines[0];
        if (firstLine?.kind === 'balls') {
          summary = firstLine.numbers.join(', ');
        } else if (firstLine?.kind === 'digits') {
          summary = firstLine.digits.join('');
        } else if (firstLine?.kind === 'cards') {
          summary = firstLine.cards.map((c) => c.code).join(' ');
        }

        return `
          <li class="history-item">
            <div class="history-item-top">
              <strong>${t.gameName}</strong>
              <span class="history-time">${time}</span>
            </div>
            <div class="history-summary">${summary} (${t.lines.length} line${t.lines.length > 1 ? 's' : ''})</div>
          </li>
        `;
      })
      .join('');
  }
}

// Auto-boot if running in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new LotteryApp();
    app.init();
  });
}
