import { supabase } from "./supabase";

const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 60;

export async function getValidAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const currentToken = session.access_token;
  if (!currentToken) {
    return null;
  }

  const expiresAt = session.expires_at ?? 0;
  const now = Math.floor(Date.now() / 1000);

  if (expiresAt === 0 || expiresAt - now > ACCESS_TOKEN_REFRESH_BUFFER_SECONDS) {
    return currentToken;
  }

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) {
    return expiresAt > now ? currentToken : null;
  }

  return data.session.access_token;
}
