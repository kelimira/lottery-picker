import { createErr, createOk } from './result.js';
import type { GameDefinition, GenerationOptions, LotteryError, Result } from './types.js';

export const MAX_TICKET_LINES = 50;

export interface ValidatedOptions {
  readonly lines: number;
  readonly includeEncore: boolean;
  readonly kenoSpot: number;
  readonly includeNumbers: readonly number[];
  readonly excludeNumbers: readonly number[];
  readonly includeGoldBall: boolean;
}

export function validateGenerationOptions(
  game: GameDefinition,
  options?: GenerationOptions
): Result<ValidatedOptions, LotteryError> {
  const lineCount = options?.lines ?? game.bundleLines;

  if (!Number.isInteger(lineCount) || lineCount <= 0) {
    return createErr({
      code: 'INVALID_LINE_COUNT',
      message: `Line count must be a positive integer. Received: ${lineCount}.`,
      details: { lineCount },
    });
  }

  if (lineCount > MAX_TICKET_LINES) {
    return createErr({
      code: 'INVALID_LINE_COUNT',
      message: `Line count cannot exceed ${MAX_TICKET_LINES} per ticket generation. Received: ${lineCount}.`,
      details: { lineCount, maxAllowed: MAX_TICKET_LINES },
    });
  }

  let kenoSpot = 10;
  if (game.id === 'daily-keno') {
    kenoSpot = options?.kenoSpot ?? 10;
    const allowed = game.kenoSpots ?? [2, 3, 4, 5, 6, 7, 8, 9, 10];
    if (!allowed.includes(kenoSpot)) {
      return createErr({
        code: 'INVALID_KENO_SPOT',
        message: `Invalid Daily Keno spot size: ${kenoSpot}. Allowed spots: ${allowed.join(', ')}.`,
        details: { kenoSpot, allowed },
      });
    }
  }

  const effectiveBallCount = game.id === 'daily-keno' ? kenoSpot : game.mainBallCount;
  const includeNumbers = options?.includeNumbers ?? [];
  const excludeNumbers = options?.excludeNumbers ?? [];

  if (game.type === 'balls') {
    // Validate included numbers
    const includeSet = new Set<number>();
    for (const num of includeNumbers) {
      if (!Number.isInteger(num) || num < game.minNumber || num > game.maxNumber) {
        return createErr({
          code: 'INVALID_INCLUDED_NUMBERS',
          message: `Included number ${num} is out of range [${game.minNumber}, ${game.maxNumber}].`,
          details: { num, min: game.minNumber, max: game.maxNumber },
        });
      }
      if (includeSet.has(num)) {
        return createErr({
          code: 'INVALID_INCLUDED_NUMBERS',
          message: `Duplicate included number: ${num}.`,
          details: { num },
        });
      }
      includeSet.add(num);
    }

    if (includeSet.size > effectiveBallCount) {
      return createErr({
        code: 'INVALID_INCLUDED_NUMBERS',
        message: `Too many included numbers (${includeSet.size}). Game '${game.name}' requires ${effectiveBallCount} numbers.`,
        details: { count: includeSet.size, maxNeeded: effectiveBallCount },
      });
    }

    // Validate excluded numbers
    const excludeSet = new Set<number>();
    for (const num of excludeNumbers) {
      if (!Number.isInteger(num) || num < game.minNumber || num > game.maxNumber) {
        return createErr({
          code: 'INVALID_EXCLUDED_NUMBERS',
          message: `Excluded number ${num} is out of range [${game.minNumber}, ${game.maxNumber}].`,
          details: { num, min: game.minNumber, max: game.maxNumber },
        });
      }
      if (excludeSet.has(num)) {
        return createErr({
          code: 'INVALID_EXCLUDED_NUMBERS',
          message: `Duplicate excluded number: ${num}.`,
          details: { num },
        });
      }
      if (includeSet.has(num)) {
        return createErr({
          code: 'CONFLICTING_NUMBERS',
          message: `Number ${num} cannot be simultaneously included and excluded.`,
          details: { num },
        });
      }
      excludeSet.add(num);
    }

    const totalAvailable = game.maxNumber - game.minNumber + 1;
    const remainingPoolSize = totalAvailable - excludeSet.size;
    if (remainingPoolSize < effectiveBallCount) {
      return createErr({
        code: 'INVALID_EXCLUDED_NUMBERS',
        message: `Excluded too many numbers (${excludeSet.size}). Remaining pool (${remainingPoolSize}) is less than ${effectiveBallCount}.`,
        details: { totalAvailable, excluded: excludeSet.size, needed: effectiveBallCount },
      });
    }
  }

  const includeEncore = (options?.includeEncore ?? false) && game.supportsEncore;
  const includeGoldBall = (options?.includeGoldBall ?? true) && game.id === 'lotto-649';

  return createOk({
    lines: lineCount,
    includeEncore,
    kenoSpot,
    includeNumbers,
    excludeNumbers,
    includeGoldBall,
  });
}
