/** Google's required notice wherever reCAPTCHA v3 protects a form. */
export function RecaptchaNotice({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      Protected by reCAPTCHA. Google&apos;s{" "}
      <a href="https://policies.google.com/privacy" className="underline" rel="noopener">
        Privacy Policy
      </a>{" "}
      and{" "}
      <a href="https://policies.google.com/terms" className="underline" rel="noopener">
        Terms of Service
      </a>{" "}
      apply.
    </p>
  );
}
