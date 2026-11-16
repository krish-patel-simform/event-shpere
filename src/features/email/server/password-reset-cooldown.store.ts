import "server-only";
import { getRedis } from "../../../core/redis/redis";
import { PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS } from "../constants";

// One key per (lowercase) email, so each address has its own cooldown.
const cooldownKey = (email: string) => `password-reset:cooldown:${email}`;

/** Redis access for the "forgot password" cooldown. Holds no secret: only a flag with an expiry. */
export const passwordResetCooldownStore = {
  /**
   * Asks to handle a "forgot password" request now. True = go ahead, and the cooldown starts;
   * false = one was accepted less than PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS ago. SET ... NX
   * only writes when the key does not exist, in one step, so two requests at the same moment
   * cannot both get true. Redis deletes the key at the end of the cooldown.
   */
  async claim(email: string): Promise<boolean> {
    const set = await getRedis().set(
      cooldownKey(email),
      "1",
      "EX",
      PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS,
      "NX",
    );
    return set === "OK";
  },
};

export type PasswordResetCooldownStore = typeof passwordResetCooldownStore;
