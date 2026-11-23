import { publicEventPath, REGISTRATION_ROUTES } from "../../registrations";
import { EVENT_ROUTES, publicEventHref } from "../routes";

// The registrations feature links to the public events list and to one event's page ("My
// tickets"). It cannot import this feature (this feature imports it), so it repeats the paths;
// this test keeps the two in step.
describe("the event paths the registrations feature repeats", () => {
  it("has the same events list", () => {
    expect(REGISTRATION_ROUTES.browseEvents).toBe(EVENT_ROUTES.browse);
  });

  it("builds the same public page link", () => {
    expect(publicEventPath("product-summit-2026")).toBe(
      publicEventHref("product-summit-2026"),
    );
  });
});
