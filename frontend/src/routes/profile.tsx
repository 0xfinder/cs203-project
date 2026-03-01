import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleBadge } from "@/components/role-badge";
import { requireAuth, useAuth } from "@/lib/auth";
import { getMe, patchMe, type MeResponse, type RoleIntent, type UserRole } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { applyTheme, getStoredTheme } from "@/lib/theme";

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET?.trim() || "avatars";
const MAX_AVATAR_MB = 5;

interface ProfileState {
  name: string;
  bio: string;
  age: string;
  gender: string;
  avatarColor: string;
}

const EMPTY_PROFILE: ProfileState = {
  name: "",
  bio: "",
  age: "",
  gender: "",
  avatarColor: "",
};

export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuth,
  component: ProfilePage,
});

function getInitials(value: string): string {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
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

async function resolveAvatarPreview(avatarPath: string | null): Promise<string | null> {
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

function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [meProfile, setMeProfile] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dark, setDark] = useState<boolean>(() => getStoredTheme() === "dark");

  useEffect(() => {
    applyTheme(dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    let active = true;

    void getMe()
      .then(async (me) => {
        if (!active) {
          return;
        }

        setMeProfile(me);
        setUserRole(me.role);
        setProfile(toProfileState(me));

        const preview = await resolveAvatarPreview(me.avatarPath);
        if (active) {
          setAvatarPreview(preview);
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setMeProfile(null);
        setUserRole(null);
        setAvatarPreview(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const resetAvatarInput = () => {
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    if (!meProfile) {
      throw new Error("Profile is not loaded");
    }

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

  const handleRemoveAvatar = async () => {
    if (!meProfile) {
      setSaveError("Profile is still loading");
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);

    try {
      const payload = buildPatchPayload(null);
      const updated = await patchMe(payload);

      setMeProfile(updated);
      setUserRole(updated.role);
      setProfile(toProfileState(updated));
      setAvatarPreview(null);
      resetAvatarInput();
      setSaveSuccess("Avatar removed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove avatar";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      setSaveError("Not authenticated");
      return;
    }

    if (!meProfile) {
      setSaveError("Profile is still loading");
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);

    try {
      let avatarPath = meProfile.avatarPath ?? null;
      let avatarSignedUrl: string | null = null;

      if (avatarFile) {
        if (!avatarFile.type.startsWith("image/")) {
          setSaveError("Please select an image file");
          return;
        }

        if (avatarFile.size > MAX_AVATAR_MB * 1024 * 1024) {
          setSaveError(`File too large (max ${MAX_AVATAR_MB}MB)`);
          return;
        }

        const ext = avatarFile.name.split(".").pop() || "png";
        avatarPath = `uploads/${user.id}/${Date.now()}_avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(avatarPath, avatarFile, {
            upsert: true,
            contentType: avatarFile.type,
          });

        if (uploadError) {
          if ((uploadError.message || "").toLowerCase().includes("bucket")) {
            setSaveError(
              `Storage bucket "${AVATAR_BUCKET}" not found. Create it in Supabase Storage or set VITE_SUPABASE_AVATAR_BUCKET.`,
            );
          } else {
            setSaveError(uploadError.message || "Failed to upload avatar");
          }
          return;
        }

        avatarSignedUrl = await resolveAvatarPreview(avatarPath);
      }

      const payload = buildPatchPayload(avatarPath);
      const updated = await patchMe(payload);

      setMeProfile(updated);
      setUserRole(updated.role);
      setProfile(toProfileState(updated));

      if (avatarSignedUrl) {
        setAvatarPreview(avatarSignedUrl);
      } else {
        const refreshedPreview = await resolveAvatarPreview(updated.avatarPath);
        setAvatarPreview(refreshedPreview);
      }

      resetAvatarInput();
      setEditing(false);
      setSaveSuccess("Profile saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save profile";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile.name.trim() || user?.email?.split("@")[0] || "unknown user";
  const initials = getInitials(displayName);
  const avatarColor = profile.avatarColor || "#475569";

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
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

        <div className="flex flex-col gap-4 rounded-lg bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-white">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="avatar preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  style={{ backgroundColor: avatarColor }}
                  className="flex h-full w-full items-center justify-center"
                >
                  {initials}
                </span>
              )}
            </div>
            <div>
              <p className="font-medium">{displayName}</p>
              <p className="text-sm text-muted-foreground">{user?.email ?? "unknown user"}</p>
              <RoleBadge role={userRole} className="mt-1" />
            </div>
          </div>

          {editing && (
            <div className="flex items-center gap-2">
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
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                <span>Choose avatar</span>
              </Button>
              {(avatarPreview || meProfile?.avatarPath) && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => void handleRemoveAvatar()}
                >
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>

        {!editing ? (
          <div className="space-y-4">
            {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-muted/30 p-3">Age: {profile.age || "—"}</div>
              <div className="rounded-md bg-muted/30 p-3">Gender: {profile.gender || "—"}</div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button type="button" onClick={() => setEditing(true)}>
                Edit profile
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  if (meProfile) {
                    setProfile(toProfileState(meProfile));
                    void resolveAvatarPreview(meProfile.avatarPath).then((preview) => {
                      setAvatarPreview(preview);
                    });
                  }
                  resetAvatarInput();
                }}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
