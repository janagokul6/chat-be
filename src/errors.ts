export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function forbidden(message: string): HttpError {
  return new HttpError(403, message);
}

export function notFound(entity: string): HttpError {
  return new HttpError(404, `${entity} not found`);
}
