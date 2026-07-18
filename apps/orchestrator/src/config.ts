import { SafeError } from "./errors.js";
import type { RuntimeConfig } from "./types.js";

const asPositiveInteger = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 2_000 ? parsed : fallback;
};

export const readConfig = (env: NodeJS.ProcessEnv = process.env): RuntimeConfig => {
  const demoMode = env.DEMO_MODE !== "false";
  const config: RuntimeConfig = {
    demoMode,
    traceStepDelayMs: asPositiveInteger(env.TRACE_STEP_DELAY_MS, 225),
    amadeusClientId: env.AMADEUS_CLIENT_ID,
    amadeusClientSecret: env.AMADEUS_CLIENT_SECRET,
    contentstackApiKey: env.CONTENTSTACK_API_KEY,
    contentstackDeliveryToken: env.CONTENTSTACK_DELIVERY_TOKEN,
    contentstackEnvironment: env.CONTENTSTACK_ENVIRONMENT,
    llmBaseUrl: env.LLM_BASE_URL,
    llmApiKey: env.LLM_API_KEY,
    llmModel: env.LLM_MODEL,
    appwriteEndpoint: env.APPWRITE_ENDPOINT,
    appwriteProjectId: env.APPWRITE_PROJECT_ID,
    appwriteApiKey: env.APPWRITE_API_KEY,
  };

  if (demoMode) return config;

  const required: Array<[string, string | undefined]> = [
    ["AMADEUS_CLIENT_ID", config.amadeusClientId],
    ["AMADEUS_CLIENT_SECRET", config.amadeusClientSecret],
    ["CONTENTSTACK_API_KEY", config.contentstackApiKey],
    ["CONTENTSTACK_DELIVERY_TOKEN", config.contentstackDeliveryToken],
    ["CONTENTSTACK_ENVIRONMENT", config.contentstackEnvironment],
    ["LLM_BASE_URL", config.llmBaseUrl],
    ["LLM_API_KEY", config.llmApiKey],
    ["LLM_MODEL", config.llmModel],
    ["APPWRITE_ENDPOINT", config.appwriteEndpoint],
    ["APPWRITE_PROJECT_ID", config.appwriteProjectId],
    ["APPWRITE_API_KEY", config.appwriteApiKey],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new SafeError("CONFIGURATION_REQUIRED", `Real integration mode requires: ${missing.join(", ")}.`, 503, false);
  }
  return config;
};
