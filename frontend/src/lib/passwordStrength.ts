export type PasswordStrengthLabel = "Weak" | "OK" | "Strong";

export type PasswordServerIssueCode =
  | "min_length"
  | "common_password"
  | "numeric_only"
  | "too_similar"
  | "invalid";

export interface PasswordServerIssue {
  code: PasswordServerIssueCode | string;
  message: string;
}

export interface PasswordStrengthResult {
  score: number;
  percent: number;
  label: PasswordStrengthLabel;
  checks: {
    minLength: boolean;
    notNumericOnly: boolean;
    notSimilarToIdentifier: boolean;
    hasLetterAndNumber: boolean;
  };
}

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";
const ALL = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`;

const hasSequence = (value: string): boolean => {
  const lowered = value.toLowerCase();
  const sequences = [
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
    "qwertyuiopasdfghjklzxcvbnm",
  ];
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 4; i += 1) {
      const chunk = seq.slice(i, i + 4);
      const reversed = chunk.split("").reverse().join("");
      if (lowered.includes(chunk) || lowered.includes(reversed)) {
        return true;
      }
    }
  }
  return false;
};

const approxSimilarToIdentifier = (password: string, identifier: string): boolean => {
  const pwd = password.toLowerCase();
  const normalized = (identifier || "").trim().toLowerCase();
  if (!pwd || !normalized) return false;

  const parts = normalized
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

  if (!parts.length) return false;
  return parts.some((part) => pwd.includes(part));
};

const randomInt = (maxExclusive: number): number => {
  if (!globalThis.crypto || typeof globalThis.crypto.getRandomValues !== "function") {
    throw new Error("Web Crypto API is unavailable.");
  }
  const bytes = new Uint32Array(1);
  globalThis.crypto.getRandomValues(bytes);
  return bytes[0] % maxExclusive;
};

const pick = (alphabet: string): string => alphabet[randomInt(alphabet.length)];

const shuffle = (items: string[]): string[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const evaluatePasswordStrength = (password: string, identifier: string): PasswordStrengthResult => {
  const value = password || "";
  const length = value.length;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const uniqueChars = new Set(value).size;
  const isNumericOnly = /^\d+$/.test(value) && value.length > 0;
  const isSimilar = approxSimilarToIdentifier(value, identifier);
  const hasLetterAndNumber = /[A-Za-z]/.test(value) && /\d/.test(value);

  let score = 0;
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (hasLower && hasUpper) score += 1;
  if (hasDigit && hasSymbol) score += 1;
  if ((hasLower || hasUpper) && hasDigit && hasSymbol) score += 1;

  if (/(.)\1{2,}/.test(value)) score -= 1;
  if (hasSequence(value)) score -= 1;
  if (uniqueChars <= Math.max(3, Math.floor(length / 3))) score -= 1;
  if (isNumericOnly) score -= 1;
  if (isSimilar) score -= 1;

  score = Math.max(0, Math.min(4, score));
  const percent = Math.round((score / 4) * 100);
  const label: PasswordStrengthLabel = score >= 4 ? "Strong" : score >= 2 ? "OK" : "Weak";

  return {
    score,
    percent,
    label,
    checks: {
      minLength: length >= 8,
      notNumericOnly: !isNumericOnly,
      notSimilarToIdentifier: !isSimilar,
      hasLetterAndNumber,
    },
  };
};

export const generateStrongPassword = (length = 18): string => {
  const safeLength = Math.max(16, Math.min(20, Math.floor(length)));
  const seed = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (seed.length < safeLength) {
    seed.push(pick(ALL));
  }
  return shuffle(seed).join("");
};
