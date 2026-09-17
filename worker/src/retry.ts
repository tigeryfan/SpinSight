export interface RetryOpts {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: 'full';
  isRetryable: (err: unknown, res?: Response) => boolean;
  onRetry?: (info: { attempt: number; delayMs: number; reason: string }) => void;
}

export class RetryExhaustedError extends Error {
  constructor(public readonly lastError: unknown) {
    super('Retry attempts exhausted');
    this.name = 'RetryExhaustedError';
  }
}

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Compute exponential backoff with full jitter */
function computeDelay(base: number, attempt: number, max: number): number {
  const exp = base * Math.pow(2, attempt - 1);
  const jitter = Math.random() * exp;
  return Math.min(max, jitter);
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < opts.maxAttempts) {
    try {
      const result = await fn();
      // If fn succeeded and returned a Response, allow caller to provide response for retry logic if needed.
      return result;
    } catch (err) {
      lastError = err;
      // If the error is a Response we can inspect headers
      const response = (err instanceof Error && (err as any).response) as Response | undefined;
      const retryable = opts.isRetryable(err, response);
      if (!retryable) {
        throw err;
      }
    }
    attempt++;
    // Determine delay
    let delayMs: number;
    // If we have a response with Retry-After header, use it
    const response = (lastError instanceof Error && (lastError as any).response) as Response | undefined;
    if (response && response.headers.get('Retry-After')) {
      const header = response.headers.get('Retry-After')!;
      const parsed = parseInt(header, 10) * 1000;
      delayMs = Math.min(opts.maxDelayMs, isNaN(parsed) ? opts.baseDelayMs : parsed);
    } else {
      delayMs = computeDelay(opts.baseDelayMs, attempt, opts.maxDelayMs);
    }
    opts.onRetry?.({ attempt, delayMs, reason: String(lastError) });
    await sleep(delayMs);
  }
  throw new RetryExhaustedError(lastError);
}