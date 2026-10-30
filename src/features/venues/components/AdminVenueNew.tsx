import { Breadcrumb } from "@/src/core/ui";
import { VENUE_ROUTES } from "../routes";
import { CreateVenueForm } from "./CreateVenueForm";

/** The admin's "Add venue" page: the venue and its halls on one form. */
export function AdminVenueNew() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Breadcrumb
        items={[
          { label: "Venues", href: VENUE_ROUTES.list },
          { label: "Add venue" },
        ]}
      />
      <header>
        <h1 className="text-2xl font-semibold">Add venue</h1>
        <p className="max-w-xl text-muted">
          Enter the place and the halls inside it. Organizers can use it for
          their events as soon as it is saved.
        </p>
      </header>
      <CreateVenueForm />
    </div>
  );
}
