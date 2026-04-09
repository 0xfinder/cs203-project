import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleBadge } from "@/components/role-badge";
import { UserAvatar } from "@/components/user-avatar";
import {
  ensureCurrentUserView,
  resolveAvatarSignedUrl,
  setCurrentUserViewCache,
} from "@/lib/current-user-view";
import { requireAuth, useAuth } from "@/lib/auth";
import { patchMe, type MeResponse, type RoleIntent, type UserRole } from "@/lib/me";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AppPageShell } from "@/components/app-page-shell";

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET?.trim() || "avatars";
const MAX_AVATAR_MB = 5;

interface ProfileState {
  name: string;
  bio: string;
  age: string;
  gender: string;
  avatarColor: string;
}

function toProfileState(me: MeResponse): ProfileState {
  return {
    name: me.displayName ?? "",
    bio: me.bio ?? "",
    age: me.age === null ? "" : String(me.age),
    gender: me.gender ?? "",
    avatarColor: me.avatarColor ?? "",
  };
}

function toRoleIntent(role: UserRole): RoleIntent | undefined {
  if (role === "LEARNER" || role === "CONTRIBUTOR") {
    return role;
  }
  return undefined;
}

async function loadProfilePageData() {
  const data = await ensureCurrentUserView(queryClient);
  if (!data.profile) {
    throw new Error("Could not load current user profile");
  }
  return data;
}

export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuth,
  loader: loadProfilePageData,
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const loaderData = Route.useLoaderData();
  const initialProfile = loaderData.profile;

  if (!initialProfile) {
    throw new Error("Could not load current user profile");
  }

  const [meProfile, setMeProfile] = useState<MeResponse>(initialProfile);
  const [profile, setProfile] = useState<ProfileState>(() => toProfileState(initialProfile));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [meAvatarUrl, setMeAvatarUrl] = useState<string | null>(loaderData.avatarUrl);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(loaderData.avatarUrl);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(initialProfile.role);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dark, setDark] = useState<boolean>(() => getStoredTheme() === "dark");
  const [rolePanelOpen, setRolePanelOpen] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);
  const availableRoles: UserRole[] = ["LEARNER", "CONTRIBUTOR"];

  useEffect(() => {
    applyTheme(dark ? "dark" : "light");
  }, [dark]);

  const resetAvatarInput = () => {
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarRemoved(true);
    resetAvatarInput();
  };

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  const parseAge = (): number | null => {
    const trimmedAge = profile.age.trim();
    if (!trimmedAge) {
      return null;
    }

    const parsedAge = Number.parseInt(trimmedAge, 10);
    if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 130) {
      return Number.NaN;
    }

    return parsedAge;
  };

  const buildPatchPayload = (avatarPath: string | null) => {
    const displayName = profile.name.trim();
    if (displayName.length < 2 || displayName.length > 32) {
      throw new Error("Display name must be 2 to 32 characters");
    }

    const age = parseAge();
    if (Number.isNaN(age)) {
      throw new Error("Age must be a number between 0 and 130");
    }

    return {
      displayName,
      roleIntent: toRoleIntent(meProfile.role),
      bio: profile.bio.trim() || null,
      age,
      gender: profile.gender.trim() || null,
      avatarColor: profile.avatarColor || null,
      avatarPath,
    };
  };

  const handleSave = async () => {
    if (!user) {
      setSaveError("Not authenticated");
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);

    try {
      // reuse avatar upload logic so role changes and saves behave the same
      let avatarPath = avatarRemoved ? null : (meProfile.avatarPath ?? null);
      let nextAvatarUrl = avatarRemoved ? null : meAvatarUrl;

      if (avatarFile) {
        const uploadResult = await uploadAvatarIfNeeded();
        avatarPath = uploadResult.avatarPath;
        nextAvatarUrl = uploadResult.nextAvatarUrl;
      }

      const payload = buildPatchPayload(avatarPath);
      const updated = await patchMe(payload as any);

      if (!updated.avatarPath) {
        nextAvatarUrl = null;
      }

      setMeProfile(updated);
      setUserRole(updated.role);
      setProfile(toProfileState(updated));

      const updateData: Record<string, string | null> = {
        full_name: profile.name,
        bio: profile.bio,
        age: profile.age,
        gender: profile.gender,
        avatar_color: profile.avatarColor || null,
      };

      if (avatarPath) {
        updateData.avatar_path = avatarPath;
      }

      const { error } = await supabase.auth.updateUser({ data: updateData });

      if (error) {
        setSaveError(error.message || "Failed to save profile");
        setSaving(false);
        return;
      }

      setMeAvatarUrl(nextAvatarUrl);
      setAvatarPreview(nextAvatarUrl);
      setCurrentUserViewCache(queryClient, {
        profile: updated,
        avatarUrl: nextAvatarUrl,
      });

      resetAvatarInput();
      setAvatarRemoved(false);
      setEditing(false);
      setSaveSuccess("Profile saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save profile";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatarIfNeeded = async (): Promise<{
    avatarPath: string | null;
    nextAvatarUrl: string | null;
  }> => {
    if (!user) throw new Error("Not authenticated");
    if (!avatarFile) {
      return { avatarPath: meProfile.avatarPath ?? null, nextAvatarUrl: meAvatarUrl };
    }

    if (!avatarFile.type.startsWith("image/")) {
      throw new Error("Please select an image file");
    }

    if (avatarFile.size > MAX_AVATAR_MB * 1024 * 1024) {
      throw new Error(`File too large (max ${MAX_AVATAR_MB}MB)`);
    }

    const ext = avatarFile.name.split(".").pop() || "png";
    const avatarPath = `uploads/${user.id}/${Date.now()}_avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(avatarPath, avatarFile, {
        upsert: true,
        contentType: avatarFile.type,
      });

    if (uploadError) {
      if ((uploadError.message || "").toLowerCase().includes("bucket")) {
        throw new Error(
          `Storage bucket "${AVATAR_BUCKET}" not found. Create it in Supabase Storage or set VITE_SUPABASE_AVATAR_BUCKET.`,
        );
      }
      throw new Error(uploadError.message || "Failed to upload avatar");
    }

    const nextAvatarUrl = await resolveAvatarSignedUrl(avatarPath);
    return { avatarPath, nextAvatarUrl };
  };

  const changeRole = async (r: UserRole) => {
    setSaveError(null);
    setSaveSuccess(null);
    setRoleChanging(true);
    try {
      let avatarPath = avatarRemoved ? null : (meProfile.avatarPath ?? null);
      let nextAvatarUrl = avatarRemoved ? null : meAvatarUrl;

      if (avatarFile) {
        const uploadResult = await uploadAvatarIfNeeded();
        avatarPath = uploadResult.avatarPath;
        nextAvatarUrl = uploadResult.nextAvatarUrl;
      }

      const payload = buildPatchPayload(avatarPath);
      payload.roleIntent = r === "CONTRIBUTOR" ? "CONTRIBUTOR" : "LEARNER";
      const updated = await patchMe(payload as any);
      setMeProfile(updated);
      setUserRole(updated.role);
      setCurrentUserViewCache(queryClient, { profile: updated, avatarUrl: nextAvatarUrl });
      setSaveSuccess(`Role updated to ${updated.role}`);
      setMeAvatarUrl(nextAvatarUrl);
      setAvatarPreview(nextAvatarUrl);
      resetAvatarInput();
      setAvatarRemoved(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(`Failed to set role: ${msg}`);
    } finally {
      setRoleChanging(false);
      setRolePanelOpen(false);
    }
  };

  const displayName = profile.name.trim() || user?.email?.split("@")[0] || "unknown user";

  return (
    <AppPageShell contentClassName="max-w-4xl">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your profile, avatar, and theme preference.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDark((current) => !current)}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{dark ? "Light mode" : "Dark mode"}</span>
          </Button>
        </div>

        {(saveError || saveSuccess) && (
          <div>
            {saveError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                {saveSuccess}
              </p>
            )}
          </div>
        )}

        <Card className="px-4 py-3">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-center">
              <div className="flex items-center gap-4">
                <UserAvatar
                  name={displayName}
                  avatarPath={avatarRemoved ? null : (meProfile.avatarPath ?? null)}
                  avatarColor={profile.avatarColor || null}
                  avatarUrl={avatarPreview}
                  className="h-20 w-20 text-sm font-semibold shadow"
                  fallbackClassName="text-lg"
                />
                <div className="flex h-20 min-w-0 flex-col justify-center gap-1">
                  <p className="text-lg font-semibold">{displayName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email ?? "unknown user"}</p>
                  <RoleBadge role={userRole} className="w-fit" />
                </div>
              </div>

              <div />

              <div className="flex items-center justify-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setAvatarFile(nextFile);
                    if (nextFile) {
                      const localPreview = URL.createObjectURL(nextFile);
                      setAvatarPreview(localPreview);
                      setAvatarRemoved(false);
                    }
                  }}
                />
                {editing ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      <span>Choose avatar</span>
                    </Button>
                    {(avatarPreview || meProfile.avatarPath) && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={saving}
                        onClick={() => void handleRemoveAvatar()}
                      >
                        Remove
                      </Button>
                    )}
                  </>
                ) : (
                  <></>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent>
            {profile.bio && <p className="text-sm text-muted-foreground mb-4">{profile.bio}</p>}

            {editing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="profile-name">Name</Label>
                  <Input
                    id="profile-name"
                    value={profile.name}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="profile-bio">Bio</Label>
                  <Input
                    id="profile-bio"
                    value={profile.bio}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, bio: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="profile-age">Age</Label>
                  <Input
                    id="profile-age"
                    type="number"
                    value={profile.age}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, age: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="profile-gender">Gender</Label>
                  <Input
                    id="profile-gender"
                    value={profile.gender}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, gender: event.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="profile-avatar-color">Avatar color</Label>
                  <Input
                    id="profile-avatar-color"
                    type="color"
                    value={profile.avatarColor || "#475569"}
                    className="h-10 w-16 p-1"
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, avatarColor: event.target.value }))
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Age</p>
                  <p className="mt-1 font-medium">{profile.age || "—"}</p>
                </div>
                <div className="rounded-md bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Gender</p>
                  <p className="mt-1 font-medium">{profile.gender || "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            {!editing ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRolePanelOpen((v) => !v)}
                  >
                    Change role
                  </Button>
                  {rolePanelOpen && (
                    <div className="absolute left-0 z-20 bottom-full mb-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
                      <p className="mb-2 text-sm font-medium">Choose role</p>
                      <div className="grid gap-2">
                        {availableRoles.map((r) => (
                          <Button
                            key={r}
                            type="button"
                            variant={userRole === r ? "secondary" : "outline"}
                            className="h-auto flex-col items-start gap-1 whitespace-normal rounded-lg px-4 py-3 text-left"
                            onClick={() => void changeRole(r)}
                            disabled={roleChanging}
                          >
                            <p className="font-medium">{r[0] + r.slice(1).toLowerCase()}</p>
                            <p className="text-xs text-muted-foreground">
                              {r === "LEARNER"
                                ? "Focus on lessons and review drills"
                                : "Submit and help improve community entries"}
                            </p>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button type="button" onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRolePanelOpen((v) => !v)}
                    >
                      Change role
                    </Button>
                    {rolePanelOpen && (
                      <div className="absolute left-0 z-20 bottom-full mb-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
                        <p className="mb-2 text-sm font-medium">Choose role</p>
                        <div className="grid gap-2">
                          {availableRoles.map((r) => (
                            <Button
                              key={r}
                              type="button"
                              variant={userRole === r ? "secondary" : "outline"}
                              className="h-auto flex-col items-start gap-1 whitespace-normal rounded-lg px-4 py-3 text-left"
                              onClick={() => void changeRole(r)}
                              disabled={roleChanging}
                            >
                              <p className="font-medium">{r[0] + r.slice(1).toLowerCase()}</p>
                              <p className="text-xs text-muted-foreground">
                                {r === "LEARNER"
                                  ? "Focus on lessons and review drills"
                                  : "Submit and help improve community entries"}
                              </p>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setProfile(toProfileState(meProfile));
                      setAvatarPreview(meAvatarUrl);
                      setAvatarRemoved(false);
                      resetAvatarInput();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
                    Sign out
                  </Button>
                </div>
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </AppPageShell>
  );
}
