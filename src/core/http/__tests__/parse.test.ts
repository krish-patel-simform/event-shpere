import { z } from "zod";
import { PayloadTooLargeError, ValidationError } from "../errors";
import { JSON_BODY_MAX_BYTES, parseBody } from "../parse";

const schema = z.object({ note: z.string() });

function jsonRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers,
    body,
  });
}

// A body sent as a stream has no content-length header, like a chunked upload.
function chunkedRequest(...chunks: Uint8Array[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request("http://localhost/api/test", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

// {"note":"xxx…"} with exactly `bytes` bytes (ASCII, so one byte per character).
function jsonOfSize(bytes: number): string {
  const wrapper = JSON.stringify({ note: "" }).length;
  return JSON.stringify({ note: "x".repeat(bytes - wrapper) });
}

describe("parseBody", () => {
  it("returns the validated body", async () => {
    const body = await parseBody(jsonRequest('{"note":"hi"}'), schema);

    expect(body).toEqual({ note: "hi" });
  });

  it("reads multi-byte text correctly", async () => {
    const body = await parseBody(jsonRequest('{"note":"नमस्ते 😀"}'), schema);

    expect(body.note).toBe("नमस्ते 😀");
  });

  it("rejects malformed JSON with a 400", async () => {
    const error = await parseBody(jsonRequest("{not json"), schema).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ status: 400 });
  });

  it("rejects an empty body with a 400", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
    });

    await expect(parseBody(request, schema)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects JSON that fails the schema with a 400", async () => {
    await expect(
      parseBody(jsonRequest('{"note":1}'), schema),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts a body of exactly the limit", async () => {
    const text = jsonOfSize(JSON_BODY_MAX_BYTES);
    expect(new TextEncoder().encode(text).byteLength).toBe(JSON_BODY_MAX_BYTES);

    const body = await parseBody(jsonRequest(text), schema);

    expect(body.note.length).toBeGreaterThan(0);
  });

  it("refuses a body over the limit with a 413", async () => {
    const error = await parseBody(
      jsonRequest(jsonOfSize(JSON_BODY_MAX_BYTES + 1)),
      schema,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(error).toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });

  it("refuses on content-length alone, without reading the body", async () => {
    const request = jsonRequest("{}", {
      "content-length": String(JSON_BODY_MAX_BYTES + 1),
    });

    await expect(parseBody(request, schema)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
    expect(request.bodyUsed).toBe(false);
  });

  it("cuts off a streamed body that has no content-length once it passes the limit", async () => {
    const chunk = new Uint8Array(64 * 1024).fill(0x78);
    const request = chunkedRequest(chunk, chunk, chunk, chunk, chunk);

    expect(request.headers.get("content-length")).toBeNull();
    await expect(parseBody(request, schema)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });

  it("counts bytes, not characters", async () => {
    // 3 bytes per character: far fewer characters than the limit, but over it in bytes.
    const characters = Math.ceil(JSON_BODY_MAX_BYTES / 3) + 1;
    const text = JSON.stringify({ note: "ह".repeat(characters) });

    await expect(parseBody(jsonRequest(text), schema)).rejects.toBeInstanceOf(
      PayloadTooLargeError,
    );
  });
});
