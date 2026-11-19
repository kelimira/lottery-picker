import type { LotteryError, Result } from './types.js';

export function createOk<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function createErr<E = LotteryError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } {
  return result.ok === false;
}
