import { api } from "./api";

export type UserRole = "LEARNER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN";
export type RoleIntent = "LEARNER" | "CONTRIBUTOR";

export interface MeResponse {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  onboardingCompleted: boolean;
}

export interface UpdateMePayload {
  displayName: string;
  roleIntent: RoleIntent;
}

export async function getMe() {
  return api.get("users/me").json<MeResponse>();
}

export async function patchMe(payload: UpdateMePayload) {
  return api.patch("users/me", { json: payload }).json<MeResponse>();
}
