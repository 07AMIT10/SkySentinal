import { SafeError } from "./errors.js";

const forbiddenFieldFragments = [
  "name",
  "email",
  "phone",
  "mobile",
  "contact",
  "passport",
  "payment",
  "card",
  "booking",
  "pnr",
  "address",
];
const emailAddress = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const paymentNumber = /\b(?:\d[ -]*?){13,19}\b/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Rejects values that would put raw passenger identity or payment data across a public/LLM boundary. */
export const assertNoPii = (value: unknown, path = "payload"): void => {
  if (typeof value === "string") {
    if (emailAddress.test(value) || paymentNumber.test(value)) {
      throw new SafeError("PII_BLOCKED", `Unsafe value blocked at ${path}.`, 400, false);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPii(item, `${path}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const normalizedKey = key.replace(/[^a-z]/gi, "").toLowerCase();
      if (forbiddenFieldFragments.some((fragment) => normalizedKey.includes(fragment))) {
        throw new SafeError("PII_BLOCKED", `Unsafe field blocked at ${path}.${key}.`, 400, false);
      }
      assertNoPii(nested, `${path}.${key}`);
    }
  }
};

export const safePrompt = (context: Record<string, unknown>): string => {
  assertNoPii(context, "llmContext");
  return JSON.stringify(context);
};
