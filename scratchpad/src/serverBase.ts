/** Backend base URL: separate port 3001 in dev; same origin when served by Express in production. */
export function getServerBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '');
  return import.meta.env.DEV ? 'http://localhost:3001' : '';
}
