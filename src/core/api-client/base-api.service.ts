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
  // Response interceptor (401 → POST /auth/refresh → retry) comes with the refresh route.
  return config;
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
    return new ApiError(error.response.status, "UNKNOWN", "Something went wrong");
  }
  const { code, message, details } = parsed.data.error;
  return new ApiError(error.response.status, code, message, details?.fieldErrors ?? {});
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
