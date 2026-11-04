// Password policy (AUTH-02): at least 8 characters with lower case, upper
// case, a number and a symbol. Supabase enforces the same rule
// (supabase/config.toml and the hosted project's settings); this gives the
// friendly messages first.

export const PASSWORD_MIN_LENGTH = 8;

const rules: { test: (password: string) => boolean; message: string }[] = [
  {
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
    message: `At least ${PASSWORD_MIN_LENGTH} characters`,
  },
  { test: (p) => /[a-z]/.test(p), message: "Needs a lower case letter" },
  { test: (p) => /[A-Z]/.test(p), message: "Needs an upper case letter" },
  { test: (p) => /[0-9]/.test(p), message: "Needs a number" },
  { test: (p) => /[^A-Za-z0-9]/.test(p), message: "Needs a symbol (e.g. ! @ # $)" },
];

/** The rules a password doesn't meet, as messages. Empty when it's fine. */
export function passwordProblems(password: string): string[] {
  return rules.filter((rule) => !rule.test(password)).map((rule) => rule.message);
}

export const passwordHint =
  "At least 8 characters, with upper and lower case letters, a number and a symbol.";
