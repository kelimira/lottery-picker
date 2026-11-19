import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { ONTARIO_GAMES } from '../src/core/games.js';
import { isErr, isOk } from '../src/core/result.js';
import type { GeneratedTicket } from '../src/core/types.js';
import {
  LotteryApp,
  STORAGE_KEY,
  escapeHtml,
  isValidTicket,
  parseNumberList,
} from '../src/ui/app.js';

// Setup Mock Storage & DOM Environment for Node test runner
class MockLocalStorage {
  private store = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = mockStorage;

describe('UI Helper Utilities', () => {
  it('escapes HTML special characters correctly', () => {
    const raw = '<script>alert("XSS" & \'test\')</script>';
    const safe = escapeHtml(raw);
    assert.strictEqual(
      safe,
      '&lt;script&gt;alert(&quot;XSS&quot; &amp; &#39;test&#39;)&lt;/script&gt;'
    );
  });

  it('handles empty or non-string inputs in escapeHtml', () => {
    assert.strictEqual(escapeHtml(''), '');
    assert.strictEqual(escapeHtml(null as unknown as string), '');
    assert.strictEqual(escapeHtml(undefined as unknown as string), '');
  });

  it('parses number lists delimited by spaces, commas, and semicolons', () => {
    const parsed = parseNumberList('7, 14, 21; 28 35,,  42');
    assert.deepStrictEqual(parsed, [7, 14, 21, 28, 35, 42]);
  });

  it('deduplicates numbers and ignores non-numeric tokens', () => {
    const parsed = parseNumberList('5, 5, abc, 12, --, 24, 12');
    assert.deepStrictEqual(parsed, [5, 12, 24]);
  });

  it('returns empty array for whitespace or empty string in parseNumberList', () => {
    assert.deepStrictEqual(parseNumberList('   '), []);
    assert.deepStrictEqual(parseNumberList(''), []);
  });
});

describe('Ticket Shape Validation for History (isValidTicket)', () => {
  const sampleValidTicket: GeneratedTicket = {
    id: 'ON-LOTTO-MAX-123',
    gameId: 'lotto-max',
    gameName: 'Lotto Max',
    timestamp: new Date().toISOString(),
    lines: [
      {
        kind: 'balls',
        numbers: [3, 12, 19, 24, 31, 44, 49],
      },
    ],
  };

  it('validates a well-formed ball ticket', () => {
    assert.strictEqual(isValidTicket(sampleValidTicket), true);
  });

  it('validates a well-formed digit ticket', () => {
    const digitTicket: GeneratedTicket = {
      id: 'ON-PICK-3-456',
      gameId: 'pick-3',
      gameName: 'Pick-3',
      timestamp: new Date().toISOString(),
      lines: [
        {
          kind: 'digits',
          digits: [7, 2, 9],
        },
      ],
    };
    assert.strictEqual(isValidTicket(digitTicket), true);
  });

  it('validates a well-formed card ticket', () => {
    const cardTicket: GeneratedTicket = {
      id: 'ON-POKER-LOTTO-789',
      gameId: 'poker-lotto',
      gameName: 'Poker Lotto',
      timestamp: new Date().toISOString(),
      lines: [
        {
          kind: 'cards',
          cards: [
            { rank: 'A', suit: 'spades', symbol: '♠', color: 'black', code: 'A♠' },
          ],
        },
      ],
    };
    assert.strictEqual(isValidTicket(cardTicket), true);
  });

  it('rejects null, non-objects, and missing required properties', () => {
    assert.strictEqual(isValidTicket(null), false);
    assert.strictEqual(isValidTicket(undefined), false);
    assert.strictEqual(isValidTicket('not an object'), false);
    assert.strictEqual(isValidTicket({}), false);
    assert.strictEqual(isValidTicket({ id: '1', gameId: 'lotto-max' }), false);
  });

  it('rejects tickets with missing or empty lines array', () => {
    assert.strictEqual(
      isValidTicket({
        id: '1',
        gameId: 'lotto-max',
        gameName: 'Lotto Max',
        timestamp: '2026-11-19T00:00:00.000Z',
      }),
      false
    );
    assert.strictEqual(
      isValidTicket({
        id: '1',
        gameId: 'lotto-max',
        gameName: 'Lotto Max',
        timestamp: '2026-11-19T00:00:00.000Z',
        lines: [],
      }),
      false
    );
  });

  it('rejects tickets with malformed lines', () => {
    assert.strictEqual(
      isValidTicket({
        id: '1',
        gameId: 'lotto-max',
        gameName: 'Lotto Max',
        timestamp: '2026-11-19T00:00:00.000Z',
        lines: [{ kind: 'balls', numbers: 'not-an-array' }],
      }),
      false
    );
    assert.strictEqual(
      isValidTicket({
        id: '1',
        gameId: 'lotto-max',
        gameName: 'Lotto Max',
        timestamp: '2026-11-19T00:00:00.000Z',
        lines: [{ kind: 'invalid-kind' }],
      }),
      false
    );
  });
});

describe('LotteryApp History Management & Crash Prevention', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('loads empty history when storage is empty', () => {
    const app = new LotteryApp();
    const res = app.loadHistory();
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.length, 0);
    }
  });

  it('gracefully filters corrupt/unvalidated localStorage entries without crashing', () => {
    // Put corrupted data in localStorage that caused crash in peer review finding #2:
    // Entry missing `lines`, corrupted object, entry with invalid shape
    const corruptedPayload = [
      { id: 'bad-1', gameName: 'Broken Game' }, // No lines
      null,
      42,
      {
        id: 'valid-1',
        gameId: 'lotto-max',
        gameName: 'Lotto Max',
        timestamp: new Date().toISOString(),
        lines: [{ kind: 'balls', numbers: [1, 2, 3, 4, 5, 6, 7] }],
      },
      { id: 'bad-2', lines: 'string-instead-of-array' },
    ];
    mockStorage.setItem(STORAGE_KEY, JSON.stringify(corruptedPayload));

    const app = new LotteryApp();
    const res = app.loadHistory();
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.length, 1);
      assert.strictEqual(res.value[0]?.id, 'valid-1');
    }
    assert.strictEqual(app.getState().history.length, 1);

    // Verify renderHistory executes cleanly without throwing on the filtered history
    const renderRes = app.renderHistory();
    assert.strictEqual(renderRes.ok, true);
  });

  it('gracefully handles non-array or invalid JSON in storage', () => {
    mockStorage.setItem(STORAGE_KEY, '{"not": "an array"}');
    const app = new LotteryApp();
    assert.strictEqual(app.getState().history.length, 0);

    mockStorage.setItem(STORAGE_KEY, 'invalid JSON {{{');
    const app2 = new LotteryApp();
    assert.strictEqual(app2.getState().history.length, 0);
  });

  it('clears history cleanly', () => {
    const app = new LotteryApp();
    const clearRes = app.clearHistory();
    assert.strictEqual(clearRes.ok, true);
    assert.strictEqual(app.getState().history.length, 0);
  });
});

describe('LotteryApp Game Selection & State Management', () => {
  it('selects valid game and resets kenoSpot, includeNumbers, and excludeNumbers', () => {
    const app = new LotteryApp();
    app.setKenoSpot(5);
    app.setIncludedNumbers([7, 14]);
    app.setExcludedNumbers([13, 26]);

    const res = app.selectGame('lotto-649');
    assert.strictEqual(res.ok, true);

    const state = app.getState();
    assert.strictEqual(state.selectedGameId, 'lotto-649');
    assert.strictEqual(state.lineCount, 1); // Lotto 6/49 default bundle is 1
    assert.strictEqual(state.kenoSpot, 10); // Reset to 10
    assert.deepStrictEqual(state.includeNumbers, []); // Reset to empty
    assert.deepStrictEqual(state.excludeNumbers, []); // Reset to empty
  });

  it('returns typed error when selecting an invalid game', () => {
    const app = new LotteryApp();
    const res = app.selectGame('invalid-game');
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'INVALID_GAME_ID');
    }
  });

  it('validates and updates line counts within limits (1 to 50)', () => {
    const app = new LotteryApp();
    assert.strictEqual(app.setLineCount(10).ok, true);
    assert.strictEqual(app.getState().lineCount, 10);

    assert.strictEqual(app.setLineCount(50).ok, true);
    assert.strictEqual(app.getState().lineCount, 50);

    // Out of bounds
    const tooLow = app.setLineCount(0);
    assert.strictEqual(tooLow.ok, false);
    if (isErr(tooLow)) {
      assert.strictEqual(tooLow.error.code, 'INVALID_LINE_COUNT');
    }

    const tooHigh = app.setLineCount(51);
    assert.strictEqual(tooHigh.ok, false);
    if (isErr(tooHigh)) {
      assert.strictEqual(tooHigh.error.code, 'INVALID_LINE_COUNT');
    }
  });

  it('validates and updates Daily Keno spots (2 to 10)', () => {
    const app = new LotteryApp();
    assert.strictEqual(app.setKenoSpot(7).ok, true);
    assert.strictEqual(app.getState().kenoSpot, 7);

    const invalidSpot = app.setKenoSpot(1);
    assert.strictEqual(invalidSpot.ok, false);
    if (isErr(invalidSpot)) {
      assert.strictEqual(invalidSpot.error.code, 'INVALID_KENO_SPOT');
    }
  });
});

describe('LotteryApp Concurrency & Generation Safety', () => {
  it('prevents concurrent generation while isGenerating is true', async () => {
    const app = new LotteryApp();

    // Manually set isGenerating to simulate active generation/animation
    (app as unknown as { state: { isGenerating: boolean } }).state.isGenerating = true;

    const genRes = await app.handleGenerate();
    assert.strictEqual(genRes.ok, false);
    if (isErr(genRes)) {
      assert.strictEqual(genRes.error.code, 'VALIDATION_FAILURE');
      assert.ok(genRes.error.message.includes('already in progress'));
    }

    const quickPickRes = await app.handleQuickPickAll();
    assert.strictEqual(quickPickRes.ok, false);
    if (isErr(quickPickRes)) {
      assert.strictEqual(quickPickRes.error.code, 'VALIDATION_FAILURE');
      assert.ok(quickPickRes.error.message.includes('already in progress'));
    }

    // Reset flag
    (app as unknown as { state: { isGenerating: boolean } }).state.isGenerating = false;
  });

  it('handleGenerate generates valid ticket and prepends to history', async () => {
    const app = new LotteryApp();
    app.selectGame('lotto-max');

    const res = await app.handleGenerate();
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.gameId, 'lotto-max');
      assert.strictEqual(res.value.lines.length, 3);
    }

    const state = app.getState();
    assert.strictEqual(state.history.length, 1);
    assert.strictEqual(state.isGenerating, false); // isGenerating must be reset to false
  });

  it('handleGenerate respects included and excluded numbers', async () => {
    const app = new LotteryApp();
    app.selectGame('ontario-49');
    app.setIncludedNumbers([7, 14, 21]);
    app.setExcludedNumbers([13, 30]);

    const res = await app.handleGenerate();
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      const line = res.value.lines[0];
      if (line && line.kind === 'balls') {
        assert.ok(line.numbers.includes(7));
        assert.ok(line.numbers.includes(14));
        assert.ok(line.numbers.includes(21));
        assert.ok(!line.numbers.includes(13));
        assert.ok(!line.numbers.includes(30));
      }
    }
  });

  it('handleQuickPickAll generates tickets for all 11 Ontario games', async () => {
    const app = new LotteryApp();
    const res = await app.handleQuickPickAll();
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.length, ONTARIO_GAMES.length);
      const generatedGameIds = res.value.map((t) => t.gameId);
      for (const game of ONTARIO_GAMES) {
        assert.ok(generatedGameIds.includes(game.id));
      }
    }

    assert.strictEqual(app.getState().isGenerating, false);
  });
});

describe('LotteryApp Clipboard Handling', () => {
  it('returns typed error when document is not available or receipt is missing', async () => {
    const app = new LotteryApp();
    // In node environment without DOM, handleCopyTicket returns typed error
    const res = await app.handleCopyTicket();
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'VALIDATION_FAILURE');
    }
  });

  it('succeeds when mock DOM and navigator.clipboard are present', async () => {
    let copiedText = '';
    const mockClipboard = {
      writeText: async (text: string) => {
        copiedText = text;
      },
    };

    try {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: mockClipboard,
        configurable: true,
        writable: true,
      });
    } catch {
      // If navigator itself is configurable
      try {
        Object.defineProperty(globalThis, 'navigator', {
          value: { clipboard: mockClipboard },
          configurable: true,
          writable: true,
        });
      } catch {
        // ignore
      }
    }

    const mockReceipt = {
      innerText: 'ONTARIO LOTTERY & GAMING - TICKET 12345',
      textContent: 'ONTARIO LOTTERY & GAMING - TICKET 12345',
    };

    (globalThis as unknown as { document: { getElementById: (id: string) => unknown; createElement: (tag: string) => unknown; body: { appendChild: () => void; removeChild: () => void } } }).document = {
      getElementById: (id: string) => {
        if (id === 'current-receipt') return mockReceipt;
        return null;
      },
      createElement: () => ({
        style: {},
        setAttribute: () => {},
        select: () => {},
        focus: () => {},
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    };

    const app = new LotteryApp();
    const res = await app.handleCopyTicket();
    assert.strictEqual(res.ok, true);
    assert.strictEqual(copiedText, 'ONTARIO LOTTERY & GAMING - TICKET 12345');
  });
});
