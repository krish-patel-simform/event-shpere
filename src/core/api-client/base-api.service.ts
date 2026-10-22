// The browser's only HTTP client for our API. Feature api services build on apiRequest;
// React Query hooks call those services; components only use the hooks.
import axios, { isAxiosError, type AxiosRequestConfig } from "axios";
import { z } from "zod";

/** One axios instance for the whole app: interceptors attach here. */
export const baseApiService = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  // Same-origin requests send cookies anyway; this keeps it explicit for the
  // httpOnly access/refresh token cookies set by /api/auth/login.
  withCredentials: true,
});

// Request interceptor: runs before every request.
baseApiService.interceptors.request.use((config) => {
  // No Authorization header: the access token lives in an httpOnly cookie (JavaScript
  // cannot read it, by design) and the browser attaches it automatically.
  return config;
});

declare module "axios" {
  interface AxiosRequestConfig {
    /** Set when a request is re-sent after a token refresh, so a second 401 never loops. */
    _retriedAfterRefresh?: boolean;
  }
}

const REFRESH_URL = "/auth/refresh";
// A 401 from these is final: wrong login details, or the refresh itself failing (no loop).
const NO_REFRESH_URLS: readonly string[] = ["/auth/login", REFRESH_URL];

// One refresh at a time: when several requests fail with 401 together (e.g. a page loading
// three queries), they all wait for the same POST /auth/refresh. Refresh tokens rotate, so a
// second parallel refresh would use an already-used token and fail.
let refreshInFlight: Promise<void> | null = null;

function refreshSession(): Promise<void> {
  refreshInFlight ??= baseApiService
    .post(REFRESH_URL)
    .then(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// Response interceptor: the access token lives 15 minutes. On a 401, trade the refresh cookie
// for new tokens (the server sets the new cookies) and send the original request once more.
// If the refresh fails, the original 401 is passed on, so the caller treats it as "signed out".
baseApiService.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
    throw error;
  }
  const { config } = error;
  if (
    config._retriedAfterRefresh ||
    NO_REFRESH_URLS.includes(config.url ?? "")
  ) {
    throw error;
  }

  try {
    await refreshSession();
  } catch {
    throw error;
  }
  return baseApiService.request({ ...config, _retriedAfterRefresh: true });
});

/** Every failure from the API, typed. `code` comes from the server (e.g. EMAIL_TAKEN). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// The failure envelope every route returns (core/http/route-handler).
const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .object({
        fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
      })
      .optional(),
  }),
});

function toApiError(error: unknown): ApiError {
  if (!isAxiosError<unknown>(error)) {
    return new ApiError(0, "UNKNOWN", "Something went wrong");
  }
  if (!error.response) {
    // Timeout, offline, DNS: the request never got an answer.
    return new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again.",
    );
  }
  const parsed = errorEnvelopeSchema.safeParse(error.response.data);
  if (!parsed.success) {
    return new ApiError(
      error.response.status,
      "UNKNOWN",
      "Something went wrong",
    );
  }
  const { code, message, details } = parsed.data.error;
  return new ApiError(
    error.response.status,
    code,
    message,
    details?.fieldErrors ?? {},
  );
}

/** Calls the API and returns the parsed `data` of the `{ data }` envelope. */
export async function apiRequest<S extends z.ZodType>(
  config: AxiosRequestConfig,
  dataSchema: S,
): Promise<z.infer<S>>;
/** For 204 responses: no body to parse. */
export async function apiRequest(config: AxiosRequestConfig): Promise<void>;
export async function apiRequest(
  config: AxiosRequestConfig,
  dataSchema?: z.ZodType,
): Promise<unknown> {
  let body: unknown;
  try {
    ({ data: body } = await baseApiService.request<unknown>(config));
  } catch (error) {
    throw toApiError(error);
  }

  if (!dataSchema) return undefined;

  // Never trust the shape: parse `data` with the same schema the server responds with.
  const parsed = z.object({ data: dataSchema }).safeParse(body);
  if (!parsed.success) {
    throw new ApiError(200, "INVALID_RESPONSE", "Unexpected server response");
  }
  return parsed.data.data;
}
