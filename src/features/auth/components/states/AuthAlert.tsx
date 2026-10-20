import Link from "next/link";
import type { Ref } from "react";
import type { ApiError } from "@/src/core/api-client/base-api.service";
import { Alert, Button } from "@/src/core/ui";
import { SITE_ROUTES } from "../../routes";
import { getAuthAlert } from "../../utils/auth-error-alerts";

type AuthAlertProps = {
  error: ApiError;
  /** Resubmits the form. Needed for the "Try again" button on retryable failures. */
  onRetry?: () => void;
  /** Lets the form move focus here after a failed submit. */
  ref?: Ref<HTMLDivElement>;
  className?: string;
};

/** The alert at the top of an auth form: turns a failed request into the right message. */
export function AuthAlert({ error, onRetry, ref, className }: AuthAlertProps) {
  const alert = getAuthAlert(error);

  return (
    <Alert ref={ref} tone={alert.tone} title={alert.title} className={className}>
      {alert.message}
      {alert.supportLink && (
        <>
          {" "}
          <Link href={SITE_ROUTES.support} className="font-semibold underline">
            contact support
          </Link>
          .
        </>
      )}
      {alert.retryable && onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      )}
    </Alert>
  );
}
