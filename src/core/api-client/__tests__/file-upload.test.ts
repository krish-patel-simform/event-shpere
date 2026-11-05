import { fileUploadRequest } from "../file-upload";

describe("fileUploadRequest", () => {
  const file = new File(["x"], "cover.png", { type: "image/png" });

  it("posts the file in the form field the server reads", () => {
    const request = fileUploadRequest("/events/e1/cover", "files", file);

    expect(request.method).toBe("POST");
    expect(request.url).toBe("/events/e1/cover");
    expect(request.data.get("files")).toBe(file);
  });

  it("sends only that one file", () => {
    const request = fileUploadRequest("/x", "files", file);

    expect([...request.data.keys()]).toEqual(["files"]);
  });

  describe("several files", () => {
    const second = new File(["y"], "second.png", { type: "image/png" });
    const third = new File(["z"], "third.png", { type: "image/png" });

    it("sends each one as its own part of the same field, in the order given", () => {
      const request = fileUploadRequest("/events/e1/gallery", "files", [
        file,
        second,
        third,
      ]);

      expect(request.data.getAll("files")).toEqual([file, second, third]);
      expect([...request.data.keys()]).toEqual(["files", "files", "files"]);
    });

    it("is still ONE request with the same JSON-type override", () => {
      const request = fileUploadRequest("/x", "files", [file, second]);

      expect(request.method).toBe("POST");
      expect(request.headers).toEqual({ "Content-Type": undefined });
    });

    it("sends nothing for an empty list", () => {
      expect([...fileUploadRequest("/x", "files", []).data.keys()]).toEqual([]);
    });
  });

  it("clears the JSON content type, so the browser adds the multipart boundary", () => {
    const request = fileUploadRequest("/x", "files", file);

    expect(request.headers).toEqual({ "Content-Type": undefined });
  });
});
