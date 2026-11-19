import { createErr, createOk } from './result.js';
import type { GameLine, LotteryError, Result, TicketStats } from './types.js';

export function analyzeLine(line: GameLine): Result<TicketStats, LotteryError> {
  let numbers: readonly number[] = [];

  if (line.kind === 'balls') {
    numbers = line.numbers;
  } else if (line.kind === 'digits') {
    numbers = line.digits;
  } else if (line.kind === 'cards') {
    // Card representation does not map directly to pure integer distribution
    return createOk({
      lineCount: 1,
      oddCount: 0,
      evenCount: 0,
      sumTotal: 0,
      minNumber: 0,
      maxNumber: 0,
    });
  } else {
    return createErr({
      code: 'VALIDATION_FAILURE',
      message: 'Unknown line type for statistical analysis.',
    });
  }

  if (numbers.length === 0) {
    return createErr({
      code: 'VALIDATION_FAILURE',
      message: 'Line contains zero numbers to analyze.',
    });
  }

  let oddCount = 0;
  let evenCount = 0;
  let sumTotal = 0;
  let minNumber = Number.POSITIVE_INFINITY;
  let maxNumber = Number.NEGATIVE_INFINITY;

  for (const n of numbers) {
    sumTotal += n;
    if (n % 2 === 0) {
      evenCount += 1;
    } else {
      oddCount += 1;
    }
    if (n < minNumber) minNumber = n;
    if (n > maxNumber) maxNumber = n;
  }

  return createOk({
    lineCount: 1,
    oddCount,
    evenCount,
    sumTotal,
    minNumber,
    maxNumber,
  });
}
