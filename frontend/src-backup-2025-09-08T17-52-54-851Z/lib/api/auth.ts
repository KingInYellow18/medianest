export async function getAuthHeaders(): Promise<HeadersInit> {
  // In Next.js with NextAuth, we can get the token from the session
  const response = await fetch('/api/auth/session');
  const session = await response.json();

  return {
    'Content-Type': 'application/json',
    ...(session?.accessToken && { Authorization: `Bearer ${session.accessToken}` }),
  };
}
