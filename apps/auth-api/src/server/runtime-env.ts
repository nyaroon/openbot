const LOCAL_RUNTIME_KEYS = [
  "AUTH_EXPOSE_DEVELOPMENT_CODE",
  "EMAIL_SMTP_HOST",
  "EMAIL_SMTP_PORT",
  "EMAIL_SMTP_USERNAME",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "EMAIL_SMTP_PASSWORD",
  "REMOTE_TICKET_PRIVATE_JWK",
  "REMOTE_TICKET_PUBLIC_JWKS",
  "REMOTE_TICKET_KEY_ID",
  "REMOTE_SIGNAL_URL",
  "REMOTE_SIGNAL_HOMES",
  "REMOTE_SIGNAL_HOME_LOCATIONS",
  "REMOTE_SIGNAL_HOME_COUNTRIES",
  "REMOTE_AUTH_WEBHOOK_URL",
  "REMOTE_AUTH_WEBHOOK_URLS",
  "REMOTE_AUTH_WEBHOOK_SECRET",
  "SLACK_ROUTE_PRIVATE_JWK",
  "SLACK_ROUTE_KEY_ID",
  "SLACK_CLIENT_ID",
  "SLACK_CLIENT_SECRET",
  "SLACK_STATE_SECRET",
  "SLACK_DEV_PUBLIC_ORIGIN",
  "DISCORD_ROUTE_PRIVATE_JWK",
  "DISCORD_ROUTE_KEY_ID",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_STATE_SECRET",
  "DISCORD_DEV_PUBLIC_ORIGIN",
  "TELEGRAM_BOT_ID",
  "TELEGRAM_BOT_USERNAME",
  "GITHUB_APP_CLIENT_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "FEEDBACK_WITHDRAWN_REPOSITORY",
  "APNS_PRIVATE_KEY",
  "APNS_KEY_ID",
  "APNS_TEAM_ID",
  "APNS_TOPIC",
  "FCM_SERVICE_ACCOUNT",
  "OWNER_WHATSAPP_NUMBERS",
] as const;

const BOOLEAN_RUNTIME_KEYS = new Set<(typeof LOCAL_RUNTIME_KEYS)[number]>(["AUTH_EXPOSE_DEVELOPMENT_CODE"]);

export function readLocalRuntimeVars(environment: NodeJS.ProcessEnv): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of LOCAL_RUNTIME_KEYS) {
    const value = environment[key];
    if (value === undefined || value.startsWith("encrypted:")) continue;
    result[key] = BOOLEAN_RUNTIME_KEYS.has(key) ? (normalizeBooleanFlag(value) ? "true" : "false") : value;
  }
  return result;
}

function normalizeBooleanFlag(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}
