// `server-only` throws when imported outside a react-server bundle, and Jest is outside.
// Tests import server code on purpose, so the guard becomes a no-op here.
jest.mock("server-only", () => ({}));

// jsdom has <dialog> but not showModal() / close(): a minimal stand-in so modal components can be
// tested (it opens and closes the dialog and fires "close", but has no focus trap or backdrop).
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
