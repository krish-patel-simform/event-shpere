// Domain errors: services throw these, the route wrapper turns them into HTTP responses.
// This file is the only place where an error is mapped to a status code.

export type ErrorDetails = Record<string, unknown>;

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: ErrorDetails,  
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400: the request params, query or body failed validation. */
export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = "VALIDATION_ERROR";

  constructor(message = "Invalid request", details?: ErrorDetails) {
    super(message, details);
  }
}

/** 401: no valid session. */
export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly code = "UNAUTHENTICATED";

  constructor(message = "Sign in required") {
    super(message);
  }
}

/**
 * 403: not allowed. Default `FORBIDDEN` (missing permission); pass a specific code when the
 * client must react differently, e.g. ACCOUNT_SUSPENDED.
 */
export class ForbiddenError extends AppError {
  readonly status = 403;

  constructor(
    message = "You are not allowed to do this",
    readonly code: string = "FORBIDDEN",
  ) {
    super(message);
  }
}

/** 404: does not exist, or exists but is not the caller's (never reveal which). */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = "NOT_FOUND";

  constructor(message = "Not found") {
    super(message);
  }
}

/** 409: the request conflicts with the current state. `code` names the rule, e.g. EMAIL_TAKEN. */
export class ConflictError extends AppError {
  readonly status = 409;

  constructor(
    readonly code: string,
    message: string,
    details?: ErrorDetails,
  ) {
    super(message, details);
  }
}

/** 503: a service we depend on (e.g. the CMS) is down; trying again later can work. */
export class ServiceUnavailableError extends AppError {
  readonly status = 503;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** 429: too many requests. */
export class RateLimitError extends AppError {
  readonly status = 429;
  readonly code = "RATE_LIMITED";

  constructor(message = "Too many requests, try again later") {
    super(message);
  }
}
