import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { getMe, type MeResponse } from "@/lib/me";
import { supabase } from "@/lib/supabase";

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET?.trim() || "avatars";
const CURRENT_USER_VIEW_KEY = "current-user-view";

export interface CurrentUserViewError {
  status: number | null;
  message: string;
}

export interface CurrentUserView {
  profile: MeResponse | null;
  avatarUrl: string | null;
  profileError?: CurrentUserViewError | null;
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

async function fetchCurrentUserView(): Promise<CurrentUserView> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { profile: null, avatarUrl: null, profileError: null };
  }

  try {
    const profile = await getMe();
    const avatarUrl = await resolveAvatarSignedUrl(profile.avatarPath);
    return { profile, avatarUrl, profileError: null };
  } catch (error) {
    if (error instanceof HTTPError) {
      return {
        profile: null,
        avatarUrl: null,
        profileError: {
          status: error.response.status,
          message: error.message,
        },
      };
    }
    return {
      profile: null,
      avatarUrl: null,
      profileError: {
        status: null,
        message: error instanceof Error ? error.message : "Failed to load current user profile",
      },
    };
  }
}

function sharedCurrentUserViewQueryOptions() {
  return queryOptions({
    queryKey: [CURRENT_USER_VIEW_KEY],
    queryFn: fetchCurrentUserView,
    staleTime: 60_000,
  });
}

export async function ensureCurrentUserView(queryClient: QueryClient) {
  const queryOptions = sharedCurrentUserViewQueryOptions();
  const currentUserView = await queryClient.ensureQueryData(queryOptions);

  // if a signed-out null profile was cached just before login, refetch once
  // so guarded routes do not read that stale "guest" snapshot as fresh data.
  if (!currentUserView.profile && !currentUserView.profileError) {
    return queryClient.fetchQuery(queryOptions);
  }

  return currentUserView;
}

export function requiredCurrentUserViewQueryOptions() {
  return sharedCurrentUserViewQueryOptions();
}

export function optionalCurrentUserViewQueryOptions() {
  return sharedCurrentUserViewQueryOptions();
}

export function setCurrentUserViewCache(queryClient: QueryClient, value: CurrentUserView) {
  queryClient.setQueryData(sharedCurrentUserViewQueryOptions().queryKey, {
    ...value,
    profileError: null,
  } satisfies CurrentUserView);
}
