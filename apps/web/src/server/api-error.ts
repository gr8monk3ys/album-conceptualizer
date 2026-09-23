/** An error with the HTTP status, headers and message a route should respond with. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers?: Record<string, string>,
    readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}
