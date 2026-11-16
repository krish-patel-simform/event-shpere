import { formatFileSize } from "../format-file-size";

describe("formatFileSize", () => {
  it("shows bytes under 1 KB", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("shows KB with one decimal under 1 MB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("shows MB with one decimal from 1 MB", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1.8 * 1024 * 1024)).toBe("1.8 MB");
  });
});
