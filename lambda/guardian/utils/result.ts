/**
 * @file lambda/guardian/utils/result.ts
 * @description Result<T, E> monad for explicit, type-safe error handling.
 *
 * Every fallible operation in the Lambda returns a Result instead of throwing.
 * This eliminates hidden control flow and forces the caller to handle failure.
 *
 * Design decision: using a discriminated union instead of a class hierarchy
 * keeps the code lightweight and avoids instanceof checks.
 */

/** Discriminated union representing success or failure. */
export type Result<T, E extends Error = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Constructs a successful Result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Constructs a failed Result. */
export function err<T = never, E extends Error = Error>(error: E): Result<T, E> {
  return { ok: false, error };
}

/**
 * Transforms the value inside a successful Result.
 * If the Result is an error, passes it through unchanged.
 */
export function mapResult<T, U, E extends Error = Error>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result as Result<U, E>;
}

/**
 * Returns the value if ok, or the provided default if error.
 * Use this for graceful degradation with a known fallback.
 */
export function getOrElse<T>(result: Result<T>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

/**
 * Throws the wrapped error if Result is not ok.
 * Use only at the top-level handler where you want to propagate failures to Lambda.
 */
export function getOrThrow<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw result.error;
}

/**
 * Collects all successful values from an array of Results.
 * Failed results are collected separately so callers can report them.
 */
export function partitionResults<T>(
  results: ReadonlyArray<Result<T>>,
): { successes: T[]; errors: Error[] } {
  const successes: T[] = [];
  const errors: Error[] = [];
  for (const r of results) {
    if (r.ok) successes.push(r.value);
    else errors.push(r.error);
  }
  return { successes, errors };
}

/**
 * Wraps an async operation that might throw in a Result.
 * Used to convert exception-based APIs into Result-based ones.
 */
export async function tryAsync<T>(
  fn: () => Promise<T>,
  errorContext?: string,
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (thrown: unknown) {
    const error =
      thrown instanceof Error ? thrown : new Error(String(thrown));
    if (errorContext) {
      error.message = `[${errorContext}] ${error.message}`;
    }
    return err(error);
  }
}
