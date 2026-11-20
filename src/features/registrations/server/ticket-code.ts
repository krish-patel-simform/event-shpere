import "server-only";
import { randomInt } from "node:crypto";

// 32 symbols with no 0/O and no 1/I, so a code read aloud or typed by hand is not mistaken.
// 32^6 is about a billion codes; the check-in lookup is also scoped to one event, so guessing one
// is not realistic.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const PREFIX = "ESEVT";

/**
 * A new ticket code such as EVT-7K3Q9P. It is a credential (it opens the door), so it comes from
 * the crypto random generator, never Math.random. Uniqueness is the table's UNIQUE constraint;
 * the caller retries on the rare collision.
 */
export function generateTicketCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return PREFIX + code;
}
