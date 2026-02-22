export const TELEGRAM_BOT_USERNAME =
  (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "taskFlowelite_bot").trim();
export const TELEGRAM_LOGIN_START_PAYLOAD = "login";
export const TELEGRAM_LOGIN_HTTP_URL = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${TELEGRAM_LOGIN_START_PAYLOAD}`;
export const TELEGRAM_LOGIN_DEEP_LINK = `tg://resolve?domain=${TELEGRAM_BOT_USERNAME}&start=${TELEGRAM_LOGIN_START_PAYLOAD}`;
