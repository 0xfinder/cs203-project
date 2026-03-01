import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { getMe, type MeResponse } from "@/lib/me";
import { supabase } from "@/lib/supabase";

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET?.trim() || "avatars";
const CURRENT_USER_VIEW_KEY = "current-user-view";

export interface CurrentUserView {
  profile: MeResponse | null;
  avatarUrl: string | null;
}

export async function resolveAvatarSignedUrl(avatarPath: string | null): Promise<string | null> {
  if (!avatarPath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath, 60 * 60);

  if (error) {
    return null;
  }

  return data.signedUrl ?? null;
}

async function fetchCurrentUserView(required: boolean): Promise<CurrentUserView> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    if (required) {
      throw new Error("Not authenticated");
    }
    return { profile: null, avatarUrl: null };
  }

  try {
    const profile = await getMe();
    const avatarUrl = await resolveAvatarSignedUrl(profile.avatarPath);
    return { profile, avatarUrl };
  } catch (error) {
    if (required) {
      throw error;
    }
    return { profile: null, avatarUrl: null };
  }
}

export function requiredCurrentUserViewQueryOptions() {
  return queryOptions({
    queryKey: [CURRENT_USER_VIEW_KEY, "required"],
    queryFn: () => fetchCurrentUserView(true),
    staleTime: 60_000,
  });
}

export function optionalCurrentUserViewQueryOptions() {
  return queryOptions({
    queryKey: [CURRENT_USER_VIEW_KEY, "optional"],
    queryFn: () => fetchCurrentUserView(false),
    staleTime: 60_000,
  });
}

export function setCurrentUserViewCache(queryClient: QueryClient, value: CurrentUserView) {
  queryClient.setQueryData(requiredCurrentUserViewQueryOptions().queryKey, value);
  queryClient.setQueryData(optionalCurrentUserViewQueryOptions().queryKey, value);
}
