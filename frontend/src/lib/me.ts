import { api } from "./api";

export type UserRole = "LEARNER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN";
export type RoleIntent = "LEARNER" | "CONTRIBUTOR";

export interface MeResponse {
  id: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  age: number | null;
  gender: string | null;
  avatarColor: string | null;
  avatarPath: string | null;
  role: UserRole;
  onboardingCompleted: boolean;
}

export interface UpdateMePayload {
  displayName: string;
  roleIntent?: RoleIntent;
  bio?: string | null;
  age?: number | null;
  gender?: string | null;
  avatarColor?: string | null;
  avatarPath?: string | null;
}

export async function getMe() {
  return api.get("users/me").json<MeResponse>();
}

export async function patchMe(payload: UpdateMePayload) {
  return api.patch("users/me", { json: payload }).json<MeResponse>();
}
