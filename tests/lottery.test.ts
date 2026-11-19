import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  ONTARIO_GAMES,
  STANDARD_DECK,
  analyzeLine,
  createErr,
  createOk,
  generateGoldBallNumber,
  generateTicket,
  getAllGames,
  getGameDefinition,
  getRandomCards,
  getRandomDigits,
  getRandomInt,
  getRandomSample,
  isErr,
  isOk,
  validateGenerationOptions,
} from '../src/core/index.js';
import type { BallLine, CardLine, DigitLine, LotteryGameId } from '../src/core/types.js';

describe('Result Utilities', () => {
  it('creates ok result with value', () => {
    const res = createOk(42);
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value, 42);
    }
    assert.strictEqual(isErr(res), false);
  });

  it('creates err result with typed error', () => {
    const res = createErr({
      code: 'INVALID_GAME_ID',
      message: 'Not found',
    });
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'INVALID_GAME_ID');
    }
    assert.strictEqual(isOk(res), false);
  });
});

describe('Ontario Games Configuration', () => {
  const expectedIds: readonly LotteryGameId[] = [
    'lotto-max',
    'lotto-649',
    'daily-grand',
    'ontario-49',
    'lottario',
    'pick-2',
    'pick-3',
    'pick-4',
    'daily-keno',
    'poker-lotto',
    'encore',
  ];

  it('includes all 11 Ontario lotteries', () => {
    assert.strictEqual(ONTARIO_GAMES.length, 11);
    const ids = ONTARIO_GAMES.map((g) => g.id);
    for (const expected of expectedIds) {
      assert.ok(ids.includes(expected), `Missing Ontario game: ${expected}`);
    }
  });

  it('retrieves each game by id successfully', () => {
    for (const id of expectedIds) {
      const res = getGameDefinition(id);
      assert.strictEqual(res.ok, true);
      if (isOk(res)) {
        assert.strictEqual(res.value.id, id);
        assert.ok(res.value.name.length > 0);
        assert.ok(res.value.drawDays.length > 0);
        assert.ok(res.value.theme.primary.startsWith('#'));
      }
    }
  });

  it('returns typed error for non-existent game', () => {
    const res = getGameDefinition('mega-millions');
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'INVALID_GAME_ID');
    }
  });

  it('getAllGames returns all definitions', () => {
    const res = getAllGames();
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.length, 11);
    }
  });
});

describe('Cryptographic Randomness Engine', () => {
  it('generates uniform numbers within specified range', () => {
    for (let i = 0; i < 50; i++) {
      const res = getRandomInt(10, 20);
      assert.strictEqual(res.ok, true);
      if (isOk(res)) {
        assert.ok(res.value >= 10 && res.value <= 20);
      }
    }
  });

  it('returns error if min exceeds max in getRandomInt', () => {
    const res = getRandomInt(50, 10);
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'RNG_FAILURE');
    }
  });

  it('generates requested number of digits in 0..9 range', () => {
    const res = getRandomDigits(7);
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.length, 7);
      for (const d of res.value) {
        assert.ok(d >= 0 && d <= 9);
      }
    }
  });

  it('samples distinct sorted numbers from pool', () => {
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const res = getRandomSample(pool, 5);
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.length, 5);
      const unique = new Set(res.value);
      assert.strictEqual(unique.size, 5);
      // Verify ascending order
      for (let i = 1; i < res.value.length; i++) {
        const prev: number | undefined = res.value[i - 1];
        const curr: number | undefined = res.value[i];
        if (prev !== undefined && curr !== undefined) {
          assert.ok(prev < curr);
        }
      }
    }
  });

  it('fails when sampling more elements than pool size', () => {
    const pool = [1, 2, 3];
    const res = getRandomSample(pool, 5);
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'RNG_FAILURE');
    }
  });

  it('samples 5 unique cards from standard 52-card deck', () => {
    assert.strictEqual(STANDARD_DECK.length, 52);
    const res = getRandomCards(5);
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.length, 5);
      const cardCodes = new Set(res.value.map((c) => c.code));
      assert.strictEqual(cardCodes.size, 5);
    }
  });

  it('generates properly formatted Gold Ball draw string', () => {
    const res = generateGoldBallNumber();
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.match(res.value, /^\d{8}-\d{2}$/);
    }
  });
});

describe('Validation Engine', () => {
  const lottoMaxRes = getGameDefinition('lotto-max');
  assert.strictEqual(lottoMaxRes.ok, true);
  const lottoMax = (lottoMaxRes as { ok: true; value: (typeof ONTARIO_GAMES)[0] }).value;

  it('validates standard options for Lotto Max', () => {
    const res = validateGenerationOptions(lottoMax, { lines: 3, includeEncore: true });
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.lines, 3);
      assert.strictEqual(res.value.includeEncore, true);
    }
  });

  it('rejects invalid line counts', () => {
    const zeroRes = validateGenerationOptions(lottoMax, { lines: 0 });
    assert.strictEqual(zeroRes.ok, false);
    if (isErr(zeroRes)) {
      assert.strictEqual(zeroRes.error.code, 'INVALID_LINE_COUNT');
    }

    const overRes = validateGenerationOptions(lottoMax, { lines: 51 });
    assert.strictEqual(overRes.ok, false);
    if (isErr(overRes)) {
      assert.strictEqual(overRes.error.code, 'INVALID_LINE_COUNT');
    }
  });

  it('rejects invalid Daily Keno spots', () => {
    const kenoRes = getGameDefinition('daily-keno');
    assert.strictEqual(kenoRes.ok, true);
    const keno = (kenoRes as { ok: true; value: (typeof ONTARIO_GAMES)[0] }).value;

    const invalidSpotRes = validateGenerationOptions(keno, { kenoSpot: 15 });
    assert.strictEqual(invalidSpotRes.ok, false);
    if (isErr(invalidSpotRes)) {
      assert.strictEqual(invalidSpotRes.error.code, 'INVALID_KENO_SPOT');
    }

    const validSpotRes = validateGenerationOptions(keno, { kenoSpot: 5 });
    assert.strictEqual(validSpotRes.ok, true);
    if (isOk(validSpotRes)) {
      assert.strictEqual(validSpotRes.value.kenoSpot, 5);
    }
  });

  it('validates included and excluded numbers without conflicts', () => {
    const res = validateGenerationOptions(lottoMax, {
      includeNumbers: [7, 14],
      excludeNumbers: [13, 21],
    });
    assert.strictEqual(res.ok, true);
  });

  it('rejects numbers that are both included and excluded', () => {
    const res = validateGenerationOptions(lottoMax, {
      includeNumbers: [7, 14],
      excludeNumbers: [7, 21],
    });
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'CONFLICTING_NUMBERS');
    }
  });

  it('rejects out of range included numbers', () => {
    const res = validateGenerationOptions(lottoMax, {
      includeNumbers: [0, 25],
    });
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'INVALID_INCLUDED_NUMBERS');
    }
  });

  it('rejects excluding too many numbers such that remaining pool is insufficient', () => {
    // Lotto Max needs 7 numbers from 1..50 (50 total). Exclude 45 numbers leaves 5, which is < 7!
    const excessiveExcludes = Array.from({ length: 45 }, (_, i) => i + 1);
    const res = validateGenerationOptions(lottoMax, {
      excludeNumbers: excessiveExcludes,
    });
    assert.strictEqual(res.ok, false);
    if (isErr(res)) {
      assert.strictEqual(res.error.code, 'INVALID_EXCLUDED_NUMBERS');
    }
  });
});

describe('Ticket Generation for All Ontario Lotteries', () => {
  it('generates valid Lotto Max tickets (3 lines, 7 balls 1..50)', () => {
    const game = getGameDefinition('lotto-max');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    const res = generateTicket(game.value, { lines: 3, includeEncore: true });
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.gameId, 'lotto-max');
      assert.strictEqual(res.value.lines.length, 3);
      assert.ok(res.value.encore);
      if (res.value.encore) {
        assert.strictEqual(res.value.encore.length, 7);
      }

      for (const line of res.value.lines) {
        assert.strictEqual(line.kind, 'balls');
        const ballLine = line as BallLine;
        assert.strictEqual(ballLine.numbers.length, 7);
        const unique = new Set(ballLine.numbers);
        assert.strictEqual(unique.size, 7);
        for (const n of ballLine.numbers) {
          assert.ok(n >= 1 && n <= 50);
        }
      }
    }
  });

  it('generates valid Lotto 6/49 tickets with Gold Ball Draw', () => {
    const game = getGameDefinition('lotto-649');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    const res = generateTicket(game.value, { lines: 2, includeGoldBall: true });
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.gameId, 'lotto-649');
      assert.strictEqual(res.value.lines.length, 2);
      assert.ok(res.value.goldBallNumber);
      assert.match(res.value.goldBallNumber, /^\d{8}-\d{2}$/);

      for (const line of res.value.lines) {
        assert.strictEqual(line.kind, 'balls');
        const ballLine = line as BallLine;
        assert.strictEqual(ballLine.numbers.length, 6);
        for (const n of ballLine.numbers) {
          assert.ok(n >= 1 && n <= 49);
        }
      }
    }
  });

  it('generates valid Daily Grand tickets with Grand Number (1..7)', () => {
    const game = getGameDefinition('daily-grand');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    const res = generateTicket(game.value, { lines: 1 });
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      const line = res.value.lines[0] as BallLine;
      assert.strictEqual(line.numbers.length, 5);
      assert.ok(line.grandNumber !== undefined);
      if (line.grandNumber !== undefined) {
        assert.ok(line.grandNumber >= 1 && line.grandNumber <= 7);
      }
    }
  });

  it('generates valid Ontario 49 tickets', () => {
    const game = getGameDefinition('ontario-49');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    const res = generateTicket(game.value, { lines: 1 });
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      const line = res.value.lines[0] as BallLine;
      assert.strictEqual(line.numbers.length, 6);
      for (const n of line.numbers) {
        assert.ok(n >= 1 && n <= 49);
      }
    }
  });

  it('generates valid Lottario tickets (bundle of 2 lines, 6 balls 1..45)', () => {
    const game = getGameDefinition('lottario');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    const res = generateTicket(game.value);
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.lines.length, 2);
      for (const line of res.value.lines) {
        const ballLine = line as BallLine;
        assert.strictEqual(ballLine.numbers.length, 6);
        for (const n of ballLine.numbers) {
          assert.ok(n >= 1 && n <= 45);
        }
      }
    }
  });

  it('generates valid Pick-2, Pick-3, and Pick-4 digit tickets', () => {
    const testCases: readonly [LotteryGameId, number][] = [
      ['pick-2', 2],
      ['pick-3', 3],
      ['pick-4', 4],
    ];

    for (const [id, count] of testCases) {
      const game = getGameDefinition(id);
      assert.strictEqual(game.ok, true);
      if (!isOk(game)) continue;

      const res = generateTicket(game.value, { lines: 1 });
      assert.strictEqual(res.ok, true);
      if (isOk(res)) {
        const line = res.value.lines[0] as DigitLine;
        assert.strictEqual(line.kind, 'digits');
        assert.strictEqual(line.digits.length, count);
        for (const d of line.digits) {
          assert.ok(d >= 0 && d <= 9);
        }
      }
    }
  });

  it('generates valid Daily Keno tickets for custom spot size', () => {
    const game = getGameDefinition('daily-keno');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    for (const spot of [2, 5, 8, 10]) {
      const res = generateTicket(game.value, { lines: 1, kenoSpot: spot });
      assert.strictEqual(res.ok, true);
      if (isOk(res)) {
        assert.strictEqual(res.value.kenoSpot, spot);
        const line = res.value.lines[0] as BallLine;
        assert.strictEqual(line.numbers.length, spot);
        const unique = new Set(line.numbers);
        assert.strictEqual(unique.size, spot);
        for (const n of line.numbers) {
          assert.ok(n >= 1 && n <= 70);
        }
      }
    }
  });

  it('generates valid Poker Lotto tickets (5 distinct playing cards)', () => {
    const game = getGameDefinition('poker-lotto');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    const res = generateTicket(game.value, { lines: 1 });
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      const line = res.value.lines[0] as CardLine;
      assert.strictEqual(line.kind, 'cards');
      assert.strictEqual(line.cards.length, 5);
      const unique = new Set(line.cards.map((c) => c.code));
      assert.strictEqual(unique.size, 5);
    }
  });

  it('generates valid Encore ticket (7 digits)', () => {
    const game = getGameDefinition('encore');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    const res = generateTicket(game.value, { lines: 1 });
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      const line = res.value.lines[0] as DigitLine;
      assert.strictEqual(line.digits.length, 7);
      for (const d of line.digits) {
        assert.ok(d >= 0 && d <= 9);
      }
    }
  });

  it('respects user included and excluded numbers in ticket', () => {
    const game = getGameDefinition('lotto-max');
    assert.strictEqual(game.ok, true);
    if (!isOk(game)) return;

    const res = generateTicket(game.value, {
      lines: 1,
      includeNumbers: [7, 42],
      excludeNumbers: [1, 2, 3, 4, 5],
    });
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      const line = res.value.lines[0] as BallLine;
      assert.ok(line.numbers.includes(7));
      assert.ok(line.numbers.includes(42));
      for (const excluded of [1, 2, 3, 4, 5]) {
        assert.strictEqual(line.numbers.includes(excluded), false);
      }
    }
  });
});

describe('Statistical Analysis Engine', () => {
  it('computes accurate stats for a ball line', () => {
    const line: BallLine = {
      kind: 'balls',
      numbers: [2, 4, 7, 9, 12, 15, 20],
    };

    const res = analyzeLine(line);
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.lineCount, 1);
      assert.strictEqual(res.value.evenCount, 4); // 2, 4, 12, 20
      assert.strictEqual(res.value.oddCount, 3); // 7, 9, 15
      assert.strictEqual(res.value.sumTotal, 2 + 4 + 7 + 9 + 12 + 15 + 20);
      assert.strictEqual(res.value.minNumber, 2);
      assert.strictEqual(res.value.maxNumber, 20);
    }
  });

  it('handles card line without error', () => {
    const cardsRes = getRandomCards(5);
    assert.strictEqual(cardsRes.ok, true);
    if (!isOk(cardsRes)) return;

    const line: CardLine = {
      kind: 'cards',
      cards: cardsRes.value,
    };
    const res = analyzeLine(line);
    assert.strictEqual(res.ok, true);
    if (isOk(res)) {
      assert.strictEqual(res.value.lineCount, 1);
    }
  });
});
