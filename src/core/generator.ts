import { createErr, createOk, isErr } from './result.js';
import {
  generateGoldBallNumber,
  getRandomCards,
  getRandomDigits,
  getRandomInt,
  getRandomSample,
} from './random.js';
import type {
  BallLine,
  CardLine,
  DigitLine,
  GameDefinition,
  GameLine,
  GeneratedTicket,
  GenerationOptions,
  LotteryError,
  Result,
} from './types.js';
import { validateGenerationOptions } from './validator.js';

let ticketCounter = 0;

function createTicketId(gameId: string): string {
  ticketCounter += 1;
  const stamp = Date.now().toString(36);
  const counterStr = ticketCounter.toString(36).padStart(4, '0');
  return `ON-${gameId.toUpperCase()}-${stamp}-${counterStr}`;
}

export function generateBallLine(
  game: GameDefinition,
  ballCount: number,
  included: readonly number[],
  excluded: readonly number[]
): Result<BallLine, LotteryError> {
  const excludedSet = new Set<number>(excluded);
  const includedSet = new Set<number>(included);

  const pool: number[] = [];
  for (let n = game.minNumber; n <= game.maxNumber; n++) {
    if (!excludedSet.has(n) && !includedSet.has(n)) {
      pool.push(n);
    }
  }

  const remainingNeeded = ballCount - included.length;
  const sampleResult = getRandomSample(pool, remainingNeeded);
  if (isErr(sampleResult)) {
    return sampleResult;
  }

  const combined = [...included, ...sampleResult.value].sort((a, b) => a - b);

  let grandNumber: number | undefined;
  if (game.id === 'daily-grand') {
    const grandResult = getRandomInt(1, 7);
    if (isErr(grandResult)) {
      return grandResult;
    }
    grandNumber = grandResult.value;
  }

  const line: BallLine = {
    kind: 'balls',
    numbers: combined,
    ...(grandNumber !== undefined ? { grandNumber } : {}),
  };

  return createOk(line);
}

export function generateDigitLine(count: number): Result<DigitLine, LotteryError> {
  const digitsResult = getRandomDigits(count);
  if (isErr(digitsResult)) {
    return digitsResult;
  }
  return createOk({
    kind: 'digits',
    digits: digitsResult.value,
  });
}

export function generateCardLine(count: number): Result<CardLine, LotteryError> {
  const cardsResult = getRandomCards(count);
  if (isErr(cardsResult)) {
    return cardsResult;
  }
  return createOk({
    kind: 'cards',
    cards: cardsResult.value,
  });
}

export function generateTicket(
  game: GameDefinition,
  options?: GenerationOptions
): Result<GeneratedTicket, LotteryError> {
  const validationResult = validateGenerationOptions(game, options);
  if (isErr(validationResult)) {
    return validationResult;
  }

  const opts = validationResult.value;
  const lines: GameLine[] = [];
  const ballCount = game.id === 'daily-keno' ? opts.kenoSpot : game.mainBallCount;

  for (let i = 0; i < opts.lines; i++) {
    if (game.type === 'balls') {
      // First line can include user preferred numbers; subsequent lines in bundle are quick-picks
      const lineIncluded = i === 0 ? opts.includeNumbers : [];
      const lineResult = generateBallLine(game, ballCount, lineIncluded, opts.excludeNumbers);
      if (isErr(lineResult)) {
        return lineResult;
      }
      lines.push(lineResult.value);
    } else if (game.type === 'digits') {
      const lineResult = generateDigitLine(game.mainBallCount);
      if (isErr(lineResult)) {
        return lineResult;
      }
      lines.push(lineResult.value);
    } else if (game.type === 'cards') {
      const lineResult = generateCardLine(game.mainBallCount);
      if (isErr(lineResult)) {
        return lineResult;
      }
      lines.push(lineResult.value);
    } else {
      return createErr({
        code: 'VALIDATION_FAILURE',
        message: `Unsupported game type: '${game.type}'.`,
      });
    }
  }

  let encore: readonly number[] | undefined;
  if (opts.includeEncore) {
    const encoreResult = getRandomDigits(7);
    if (isErr(encoreResult)) {
      return encoreResult;
    }
    encore = encoreResult.value;
  }

  let goldBallNumber: string | undefined;
  if (opts.includeGoldBall) {
    const goldBallResult = generateGoldBallNumber();
    if (isErr(goldBallResult)) {
      return goldBallResult;
    }
    goldBallNumber = goldBallResult.value;
  }

  const ticket: GeneratedTicket = {
    id: createTicketId(game.id),
    gameId: game.id,
    gameName: game.name,
    timestamp: new Date().toISOString(),
    lines,
    ...(encore ? { encore } : {}),
    ...(goldBallNumber ? { goldBallNumber } : {}),
    ...(game.id === 'daily-keno' ? { kenoSpot: opts.kenoSpot } : {}),
  };

  return createOk(ticket);
}
