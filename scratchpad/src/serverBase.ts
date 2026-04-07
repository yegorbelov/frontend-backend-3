export function getServerBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '');
  return 'http://localhost:3001';
}
