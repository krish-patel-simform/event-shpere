import "server-only";
import { hash, verify } from "@node-rs/argon2";

// @node-rs/argon2 defaults to argon2id (m=19456, t=2, p=1), the OWASP-recommended setup.
// Keeping the calls in this one file means the algorithm can change without touching callers.
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  return verify(passwordHash, plain);
}
