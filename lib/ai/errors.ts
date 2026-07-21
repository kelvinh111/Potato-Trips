export type AiProviderErrorCode =
  | "CONFIGURATION_FAILURE"
  | "PROVIDER_REQUEST_FAILURE"
  | "INVALID_STRUCTURED_OUTPUT";

interface AiProviderErrorOptions {
  code: AiProviderErrorCode;
  message: string;
  cause?: unknown;
}

export class AiProviderError extends Error {
  public readonly code: AiProviderErrorCode;

  constructor(options: AiProviderErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "AiProviderError";
    this.code = options.code;
  }
}
