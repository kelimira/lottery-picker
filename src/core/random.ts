import { createErr, createOk, isErr } from './result.js';
import type { CardRank, CardSuit, LotteryError, PlayingCard, Result } from './types.js';

const SUITS: readonly CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: readonly CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_SYMBOLS: Record<CardSuit, '♠' | '♥' | '♦' | '♣'> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};
const SUIT_COLORS: Record<CardSuit, 'red' | 'black'> = {
  spades: 'black',
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
};

export const STANDARD_DECK: readonly PlayingCard[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => ({
    rank,
    suit,
    symbol: SUIT_SYMBOLS[suit],
    color: SUIT_COLORS[suit],
    code: `${rank}${SUIT_SYMBOLS[suit]}`,
  }))
);

function getCrypto(): Crypto | null {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }
  return null;
}

export function getRandomInt(min: number, max: number): Result<number, LotteryError> {
  if (min > max) {
    return createErr({
      code: 'RNG_FAILURE',
      message: `Invalid range: min (${min}) cannot exceed max (${max}).`,
    });
  }

  const cryptoInstance = getCrypto();
  if (!cryptoInstance) {
    return createErr({
      code: 'RNG_FAILURE',
      message: 'Cryptographic random number generator is unavailable in current runtime.',
    });
  }

  const range = max - min + 1;
  if (range <= 1) {
    return createOk(min);
  }

  // Unbiased rejection sampling for uniform distribution
  const maxUint32 = 0xffffffff;
  const bucketSize = Math.floor(maxUint32 / range);
  const limit = bucketSize * range;

  const buffer = new Uint32Array(1);
  let randomVal = 0;
  do {
    cryptoInstance.getRandomValues(buffer);
    const candidate = buffer[0];
    if (candidate === undefined) {
      return createErr({
        code: 'RNG_FAILURE',
        message: 'Failed to read random buffer.',
      });
    }
    randomVal = candidate;
  } while (randomVal >= limit);

  const offset = Math.floor(randomVal / bucketSize);
  return createOk(min + offset);
}

export function getRandomDigits(count: number): Result<readonly number[], LotteryError> {
  if (count < 0) {
    return createErr({
      code: 'RNG_FAILURE',
      message: `Digit count cannot be negative: ${count}.`,
    });
  }

  const digits: number[] = [];
  for (let i = 0; i < count; i++) {
    const intResult = getRandomInt(0, 9);
    if (isErr(intResult)) {
      return intResult;
    }
    digits.push(intResult.value);
  }
  return createOk(digits);
}

export function getRandomSample(
  pool: readonly number[],
  count: number
): Result<readonly number[], LotteryError> {
  if (count < 0) {
    return createErr({
      code: 'RNG_FAILURE',
      message: `Sample count cannot be negative: ${count}.`,
    });
  }
  if (count > pool.length) {
    return createErr({
      code: 'RNG_FAILURE',
      message: `Requested sample count (${count}) exceeds pool size (${pool.length}).`,
    });
  }

  const working = [...pool];
  const selected: number[] = [];

  for (let i = 0; i < count; i++) {
    const remainingIndexResult = getRandomInt(0, working.length - 1);
    if (isErr(remainingIndexResult)) {
      return remainingIndexResult;
    }
    const idx = remainingIndexResult.value;
    const item = working[idx];
    if (item === undefined) {
      return createErr({
        code: 'RNG_FAILURE',
        message: `Index ${idx} is undefined during sampling.`,
      });
    }
    selected.push(item);
    // Swap and pop for O(1) removal
    const lastItem = working[working.length - 1];
    if (lastItem !== undefined) {
      working[idx] = lastItem;
    }
    working.pop();
  }

  // Sort ascending for user readability
  selected.sort((a, b) => a - b);
  return createOk(selected);
}

export function getRandomCards(count: number): Result<readonly PlayingCard[], LotteryError> {
  if (count < 0 || count > STANDARD_DECK.length) {
    return createErr({
      code: 'RNG_FAILURE',
      message: `Requested card count (${count}) must be between 0 and ${STANDARD_DECK.length}.`,
    });
  }

  const working = [...STANDARD_DECK];
  const chosen: PlayingCard[] = [];

  for (let i = 0; i < count; i++) {
    const idxResult = getRandomInt(0, working.length - 1);
    if (isErr(idxResult)) {
      return idxResult;
    }
    const idx = idxResult.value;
    const card = working[idx];
    if (!card) {
      return createErr({
        code: 'RNG_FAILURE',
        message: `Card at index ${idx} is undefined.`,
      });
    }
    chosen.push(card);
    const lastCard = working[working.length - 1];
    if (lastCard) {
      working[idx] = lastCard;
    }
    working.pop();
  }

  return createOk(chosen);
}

export function generateGoldBallNumber(): Result<string, LotteryError> {
  const mainDigitsResult = getRandomDigits(8);
  if (isErr(mainDigitsResult)) {
    return mainDigitsResult;
  }
  const suffixDigitsResult = getRandomDigits(2);
  if (isErr(suffixDigitsResult)) {
    return suffixDigitsResult;
  }

  const main = mainDigitsResult.value.join('');
  const suffix = suffixDigitsResult.value.join('');
  return createOk(`${main}-${suffix}`);
}
