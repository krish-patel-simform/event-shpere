/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoadingImage } from "../LoadingImage";

const box = (container: HTMLElement) =>
  container.querySelector("[data-state]") as HTMLElement;

describe("LoadingImage", () => {
  it("shows a skeleton, and keeps the picture invisible, until the picture has loaded", () => {
    const { container } = render(
      <LoadingImage src="https://cms.example.com/a.jpg" alt="Stage" />,
    );

    expect(box(container)).toHaveAttribute("data-state", "loading");
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Stage" })).toHaveClass("opacity-0");
  });

  it("fades the picture in and takes the skeleton away once it has loaded", () => {
    const { container } = render(
      <LoadingImage src="https://cms.example.com/a.jpg" alt="Stage" />,
    );

    fireEvent.load(screen.getByRole("img", { name: "Stage" }));

    expect(box(container)).toHaveAttribute("data-state", "loaded");
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Stage" })).toHaveClass(
      "opacity-100",
    );
  });

  it("says the picture is not available when it can not be loaded, still named by its alt text", () => {
    const { container } = render(
      <LoadingImage src="https://cms.example.com/gone.jpg" alt="Stage" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Stage" }));

    expect(box(container)).toHaveAttribute("data-state", "failed");
    expect(screen.getByText("Image not available")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Stage" }).tagName).toBe("DIV");
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });

  it("starts loading again when the picture is replaced", () => {
    const { container, rerender } = render(
      <LoadingImage src="https://cms.example.com/a.jpg" alt="Stage" />,
    );
    fireEvent.load(screen.getByRole("img", { name: "Stage" }));
    expect(box(container)).toHaveAttribute("data-state", "loaded");

    rerender(<LoadingImage src="https://cms.example.com/b.jpg" alt="Stage" />);

    expect(box(container)).toHaveAttribute("data-state", "loading");
  });

  it("passes the lazy-loading hint and extra classes to the picture", () => {
    render(
      <LoadingImage
        src="https://cms.example.com/a.jpg"
        alt="Stage"
        loading="lazy"
        className="rounded-md"
      />,
    );

    const image = screen.getByRole("img", { name: "Stage" });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveClass("rounded-md");
  });
});
