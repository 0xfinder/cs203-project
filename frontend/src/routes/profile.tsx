import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, Upload } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAuth, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { applyTheme, getStoredTheme } from "@/lib/theme";

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET?.trim() || "avatars";
const MAX_AVATAR_MB = 5;

interface UserMetadata {
  full_name?: string;
  name?: string;
  bio?: string;
  age?: string | number;
  gender?: string;
  avatar_color?: string;
  avatar_url?: string;
  avatar_path?: string;
}

interface ProfileState {
  name: string;
  bio: string;
  age: string;
  gender: string;
  avatar_color: string;
}

const EMPTY_PROFILE: ProfileState = {
  name: "",
  bio: "",
  age: "",
  gender: "",
  avatar_color: "",
};

export const Route = createFileRoute("/profile")({
  beforeLoad: requireAuth,
  component: ProfilePage,
});

function readMetadata(user: User | null): UserMetadata {
  if (!user || typeof user.user_metadata !== "object" || user.user_metadata === null) {
    return {};
  }
  return user.user_metadata as UserMetadata;
}

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

function toProfileState(metadata: UserMetadata): ProfileState {
  return {
    name: metadata.full_name ?? metadata.name ?? "",
    bio: metadata.bio ?? "",
    age: metadata.age ? String(metadata.age) : "",
    gender: metadata.gender ?? "",
    avatar_color: metadata.avatar_color ?? "",
  };
}

function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const metadata = useMemo(() => readMetadata(user), [user]);
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dark, setDark] = useState<boolean>(() => getStoredTheme() === "dark");

  useEffect(() => {
    applyTheme(dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    setProfile(toProfileState(metadata));
  }, [metadata]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!mounted) return;
      if (metadata.avatar_path) {
        const { data, error } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(metadata.avatar_path, 60 * 60);
        if (!error && mounted) {
          setAvatarPreview(data.signedUrl ?? null);
          return;
        }
      }
      if (mounted) {
        setAvatarPreview(metadata.avatar_url ?? null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [metadata.avatar_path, metadata.avatar_url]);

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

  const handleRemoveAvatar = async () => {
    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: null, avatar_path: null },
      });
      if (error) {
        setSaveError(error.message || "Failed to remove avatar");
        return;
      }
      setAvatarPreview(null);
      resetAvatarInput();
      setSaveSuccess("Avatar removed");
    } finally {
      setSaving(false);
    }
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
      let avatarPath: string | undefined;
      let avatarSignedUrl: string | undefined;

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

        const { data: signedData, error: signedError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(avatarPath, 60 * 60);

        if (signedError) {
          setSaveError(signedError.message || "Failed to preview uploaded avatar");
          return;
        }

        avatarSignedUrl = signedData.signedUrl ?? undefined;
      }

      const updateData: Record<string, string | null> = {
        full_name: profile.name,
        bio: profile.bio,
        age: profile.age,
        gender: profile.gender,
        avatar_color: profile.avatar_color,
      };

      if (avatarPath) {
        updateData.avatar_path = avatarPath;
      }

      if (avatarSignedUrl) {
        updateData.avatar_url = avatarSignedUrl;
      }

      const { data, error } = await supabase.auth.updateUser({ data: updateData });

      if (error) {
        setSaveError(error.message || "Failed to save profile");
        return;
      }

      const updatedMetadata = readMetadata(data.user);
      setProfile(toProfileState(updatedMetadata));

      if (avatarSignedUrl) {
        setAvatarPreview(avatarSignedUrl);
      } else if (updatedMetadata.avatar_path) {
        const { data: previewData, error: previewError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .createSignedUrl(updatedMetadata.avatar_path, 60 * 60);
        if (!previewError) {
          setAvatarPreview(previewData.signedUrl ?? null);
        }
      } else {
        setAvatarPreview(updatedMetadata.avatar_url ?? null);
      }

      resetAvatarInput();
      setEditing(false);
      setSaveSuccess("Profile saved");
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile.name || user?.email || "unknown user";
  const initials = getInitials(displayName);
  const avatarColor = profile.avatar_color || metadata.avatar_color || "#475569";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <Card className="w-full">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl">Profile</CardTitle>
            <CardDescription>Manage your profile, avatar, and theme preference.</CardDescription>
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
        </CardHeader>
        <CardContent className="space-y-6">
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

          <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
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
              </div>
            </div>

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
              {(avatarPreview || metadata.avatar_path || metadata.avatar_url) && (
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
          </div>

          {!editing ? (
            <div className="space-y-4">
              {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md border bg-card p-3">Age: {profile.age || "—"}</div>
                <div className="rounded-md border bg-card p-3">Gender: {profile.gender || "—"}</div>
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
                    value={profile.avatar_color || "#475569"}
                    className="h-10 w-16 p-1"
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, avatar_color: event.target.value }))
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
                    setProfile(toProfileState(metadata));
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
        </CardContent>
      </Card>
    </div>
  );
}
