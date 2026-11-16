import { createByteLimit } from "../byte-limit";

async function drain(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
  }
}

describe("createByteLimit", () => {
  it("passes a body under the limit through untouched", async () => {
    const limit = createByteLimit(10);

    const total = await drain(
      new Blob([new Uint8Array(8)]).stream().pipeThrough(limit.stream),
    );

    expect(total).toBe(8);
    expect(limit.exceeded()).toBe(false);
  });

  it("accepts a body of exactly the limit", async () => {
    const limit = createByteLimit(10);

    const total = await drain(
      new Blob([new Uint8Array(10)]).stream().pipeThrough(limit.stream),
    );

    expect(total).toBe(10);
    expect(limit.exceeded()).toBe(false);
  });

  it("cuts the stream off past the limit and says so", async () => {
    const limit = createByteLimit(10);

    await expect(
      drain(new Blob([new Uint8Array(11)]).stream().pipeThrough(limit.stream)),
    ).rejects.toThrow("larger than 10 bytes");
    expect(limit.exceeded()).toBe(true);
  });
});
