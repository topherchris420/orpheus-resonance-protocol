type BoolLike = string | boolean | undefined;

const toBoolean = (value: BoolLike, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const accessPhrase = import.meta.env.VITE_ACCESS_PASSPHRASE?.trim() || "1912";

export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME?.trim() || "Reentry Interface",
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL?.trim() || "support@example.com",
  features: {
    requireAccessGate: toBoolean(import.meta.env.VITE_REQUIRE_ACCESS_GATE, true),
    enableAudioBiofeedback: toBoolean(import.meta.env.VITE_ENABLE_AUDIO_BIOFEEDBACK, true),
  },
  limits: {
    maxIntelFeedItems: clamp(toNumber(import.meta.env.VITE_MAX_INTEL_FEED_ITEMS, 10), 5, 50),
    maxAccessAttempts: clamp(toNumber(import.meta.env.VITE_MAX_ACCESS_ATTEMPTS, 5), 1, 12),
    accessLockoutMs: clamp(toNumber(import.meta.env.VITE_ACCESS_LOCKOUT_MS, 30_000), 5_000, 300_000),
  },
  accessPhrase,
};
