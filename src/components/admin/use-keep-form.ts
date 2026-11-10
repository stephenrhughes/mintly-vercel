"use client";

import { type FormEvent, useTransition } from "react";

/**
 * Submits a form to a useActionState dispatcher without React resetting the
 * form afterwards, so a long admin form keeps what was typed when the action
 * reports a problem, and a retry sends the same values (and nonce) again.
 */
export function useKeepForm(dispatch: (formData: FormData) => void) {
  const [pending, startTransition] = useTransition();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
  return { onSubmit, pending };
}
