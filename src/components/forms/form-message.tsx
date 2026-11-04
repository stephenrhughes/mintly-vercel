import { CircleAlert, CircleCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/auth/errors";

/** The error or confirmation a Server Action returned, if any. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden />
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state.message) {
    return (
      <Alert variant="success">
        <CircleCheck aria-hidden />
        <AlertDescription className="text-secondary-foreground">{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
