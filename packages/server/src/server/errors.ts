export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function createErrorBody(code: string, message: string) {
  return {
    error: {
      code,
      message,
    },
  };
}
