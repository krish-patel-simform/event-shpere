"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, DialogBody, DialogFooter } from "@/src/core/ui";

type CopyState = "idle" | "copied" | "failed";

/**
 * "Your ticket": the ticket code to show at the entrance, big, with a copy button. Staff type the
 * code in to check the person in (no QR image yet).
 */
export function TicketDialog({
  open,
  onClose,
  eventTitle,
  ticketCode,
}: {
  open: boolean;
  onClose: () => void;
  eventTitle: string;
  ticketCode: string;
}) {
  const [copy, setCopy] = useState<CopyState>("idle");

  function close() {
    setCopy("idle");
    onClose();
  }

  async function copyCode() {
    try {
      // Not every browser allows it (an http page, a denied permission): say so instead.
      await navigator.clipboard.writeText(ticketCode);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Your ticket">
      <DialogBody className="text-center">
        <p className="text-sm text-muted">{eventTitle}</p>
        <p
          aria-label={`Ticket code ${ticketCode}`}
          className="mx-auto inline-block rounded-md border-2 border-dashed border-brand/50 px-5 py-2.5 font-mono text-2xl font-semibold tracking-[0.15em]"
        >
          {ticketCode}
        </p>
        <p className="text-sm text-muted">
          Show this code at the entrance. Staff type it in to check you in. You
          are checked in once per event day.
        </p>
        <p role="status" className="min-h-5 text-sm">
          {copy === "copied" && "Code copied."}
          {copy === "failed" &&
            "Could not copy. Select the code and copy it yourself."}
        </p>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={close}>
          Close
        </Button>
        <Button onClick={() => void copyCode()}>
          <Copy aria-hidden="true" className="size-4" />
          Copy code
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
