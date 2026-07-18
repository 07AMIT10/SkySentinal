export class SafeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export const isSafeError = (error: unknown): error is SafeError => error instanceof SafeError;

export const toSafeError = (error: unknown): SafeError => {
  if (isSafeError(error)) return error;
  return new SafeError("INTERNAL_ERROR", "The disruption run could not be completed safely.", 500, false);
};
