// CHANGELOG: [2025-06-04] - Created InsomniaParseError class

/**
 * Custom error class for Insomnia parsing errors
 */
export class InsomniaParseError extends Error {
  public override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'InsomniaParseError';
    this.cause = cause;
  }
}