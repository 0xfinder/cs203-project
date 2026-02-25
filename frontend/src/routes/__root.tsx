import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

export const Route = createRootRoute({
  errorComponent: ({ error }) => (
    <div className="m-8 rounded border border-red-300 bg-red-50 p-6 text-sm">
      <h1 className="text-lg font-bold text-red-700">Something went wrong</h1>
      <pre className="mt-2 whitespace-pre-wrap text-red-600">{error.message}</pre>
      <pre className="mt-2 whitespace-pre-wrap text-xs text-red-400">{error.stack}</pre>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  const { user, signOut } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    age: "",
    gender: "",
    avatar_color: "",
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      if (dark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch {}
  }, [dark]);

  useEffect(() => {
    try {
      if (user) {
        // prefill from available user metadata if present
        const meta: any = (user as any).user_metadata ?? {};
        setProfile({
          name: meta.full_name ?? meta.name ?? "",
          bio: meta.bio ?? "",
          age: meta.age ?? "",
          gender: meta.gender ?? "",
          avatar_color: meta.avatar_color ?? "",
        });
      }
    } catch {}
  }, [user]);

  // build avatarPreview from stored metadata (avatar_path or avatar_url)
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        if (!user) return;
        const meta: any = (user as any).user_metadata ?? {};
        if (meta.avatar_path) {
          // private bucket: create signed URL
          const { data: previewData, error: previewError } = await supabase.storage
            .from("avatars")
            .createSignedUrl(meta.avatar_path, 60 * 60);
          if (!previewError && mounted) setAvatarPreview(previewData?.signedUrl ?? null);
        } else if (meta.avatar_url) {
          // fallback if an explicit URL is stored
          if (mounted) setAvatarPreview(meta.avatar_url);
        } else {
          if (mounted) setAvatarPreview(null);
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Persistently remove avatar metadata (revert to initials + color)
  const handleRemoveAvatarPersist = async () => {
    try {
      setSaveError(null);
      setSaving(true);
      const { data, error } = await supabase.auth.updateUser({
        data: { avatar_url: null, avatar_path: null },
      });
      setSaving(false);
      if (error) {
        setSaveError(error.message || "Failed to remove avatar");
        return;
      }
      // clear preview and file state
      setAvatarPreview(null);
      setAvatarFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaveSuccess("Avatar removed");
      // update local profile metadata
      try {
        const meta: any = (data?.user as any)?.user_metadata ?? {};
        setProfile((p) => ({ ...p, avatar_color: meta.avatar_color ?? p.avatar_color }));
      } catch {}
    } catch (e: any) {
      setSaving(false);
      setSaveError(e?.message ?? String(e));
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex items-center gap-4 border-b px-6 py-3 text-sm">
        <Link to="/" className="hover:underline [&.active]:font-bold">
          Home
        </Link>
        {user && (
          <Link to="/examples" className="hover:underline [&.active]:font-bold">
            Examples
          </Link>
        )}
        <div className="ml-auto flex items-center gap-3 relative">
          <button
            aria-label="Toggle theme"
            onClick={() => setDark((d) => !d)}
            className="al-toggle w-9 h-9 rounded-full bg-white/6 flex items-center justify-center text-sm hover:bg-white/10 transition"
          >
            <span className="sr-only">Toggle theme</span>
            <span className="w-6 h-6 flex items-center justify-center">{dark ? "🌙" : "☀️"}</span>
          </button>
          {user ? (
            <>
              <div className="relative">
                <button
                  aria-label="Open profile"
                  onClick={() => setShowProfile((s) => !s)}
                  className="w-10 h-10 rounded-full bg-white/6 flex items-center justify-center text-sm font-semibold text-foreground hover:bg-white/10 transition overflow-hidden"
                >
                  {/* avatar image -> emoji+color -> initials */}
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="avatar preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (user as any).user_metadata?.avatar_url ? (
                    <img
                      src={(user as any).user_metadata.avatar_url}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span
                      className="w-full h-full flex items-center justify-center text-sm font-semibold text-white"
                      style={{
                        backgroundColor:
                          profile.avatar_color ||
                          (user as any).user_metadata?.avatar_color ||
                          undefined,
                      }}
                    >
                      {((user as any).user_metadata?.full_name || "")
                        .split(" ")
                        .map((n: string) => n[0])
                        .slice(0, 2)
                        .join("") || ""}
                    </span>
                  )}
                </button>

                {showProfile && (
                  <div className="absolute right-0 mt-2 w-80 rounded-3xl border border-black dark:border-white bg-card text-card-foreground backdrop-blur-md p-6 shadow-2xl z-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Profile</h3>
                      <button
                        className="text-sm text-muted-foreground"
                        onClick={() => {
                          setShowProfile(false);
                          setEditing(false);
                        }}
                      >
                        Close
                      </button>
                    </div>

                    {!editing ? (
                      <div className="space-y-3">
                        <div className="space-y-3">
                          {(saveError || saveSuccess) && (
                            <div>
                              {saveError && (
                                <div className="text-sm text-destructive">{saveError}</div>
                              )}
                              {saveSuccess && (
                                <div className="text-sm text-success">{saveSuccess}</div>
                              )}
                            </div>
                          )}
                          <div className="text-lg font-semibold">
                            {profile.name || (user.email ?? "")}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </div>
                        {profile.bio && (
                          <div className="text-sm text-foreground">{profile.bio}</div>
                        )}

                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <div>Age: {profile.age || "—"}</div>
                          <div>Gender: {profile.gender || "—"}</div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <Button size="sm" onClick={() => setEditing(true)}>
                            Edit profile
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => signOut()}>
                            Sign out
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="profile-name">Name</Label>
                          <Input
                            id="profile-name"
                            value={profile.name}
                            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="profile-bio">Bio</Label>
                          <Input
                            id="profile-bio"
                            value={profile.bio}
                            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="profile-age">Age</Label>
                            <Input
                              id="profile-age"
                              type="number"
                              value={profile.age}
                              onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="profile-gender">Gender</Label>
                            <Input
                              id="profile-gender"
                              value={profile.gender}
                              onChange={(e) =>
                                setProfile((p) => ({ ...p, gender: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <Label htmlFor="profile-avatar-color">Avatar color</Label>
                            <input
                              id="profile-avatar-color"
                              type="color"
                              value={profile.avatar_color || "#7c3aed"}
                              onChange={(e) =>
                                setProfile((p) => ({ ...p, avatar_color: e.target.value }))
                              }
                              className="w-12 h-8 p-0 border rounded"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              if (f) {
                                setAvatarFile(f);
                                try {
                                  const url = URL.createObjectURL(f);
                                  setAvatarPreview(url);
                                } catch {}
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Choose avatar
                          </Button>
                          {avatarPreview && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                await handleRemoveAvatarPersist();
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(false);
                            }}
                          >
                            Cancel
                          </Button>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={saving}
                              onClick={async () => {
                                setSaveError(null);
                                setSaveSuccess(null);
                                try {
                                  setSaving(true);

                                  // if user selected a file, upload it first
                                  let avatar_url: string | undefined = undefined;
                                  let path: string | undefined = undefined;
                                  if (avatarFile && user) {
                                    // basic client-side validation
                                    const MAX_MB = 5;
                                    if (avatarFile.size > MAX_MB * 1024 * 1024) {
                                      setSaving(false);
                                      setSaveError(`File too large (max ${MAX_MB}MB)`);
                                      return;
                                    }

                                    const ext = avatarFile.name.split(".").pop();
                                    path = `avatars/${(user as any).id}/avatar.${ext}`;
                                    const { error: uploadError } = await supabase.storage
                                      .from("avatars")
                                      .upload(path, avatarFile, {
                                        upsert: true,
                                        contentType: avatarFile.type,
                                      });
                                    if (uploadError) {
                                      console.error("uploadError", uploadError);
                                      const msg = String(uploadError?.message ?? uploadError);
                                      if (msg.toLowerCase().includes("bucket")) {
                                        setSaveError(
                                          "Storage bucket 'avatars' not found. Profile will be saved without avatar. Create the 'avatars' bucket in Supabase or change the bucket name in code.",
                                        );
                                      } else {
                                        setSaveError(msg || "Failed to upload avatar");
                                      }
                                      // do not abort - continue saving profile without avatar_url
                                    } else {
                                      // For private buckets we store the object path in user metadata
                                      // and generate a signed URL for immediate preview.
                                      try {
                                        const { data: signedData, error: signedError } =
                                          await supabase.storage
                                            .from("avatars")
                                            .createSignedUrl(path, 60 * 60); // 1 hour
                                        if (signedError) throw signedError;
                                        avatar_url = signedData?.signedUrl ?? undefined;
                                        // store the path (not the signed URL) in user metadata so we can
                                        // generate fresh signed URLs later when displaying the avatar
                                        // (signed URLs expire).
                                        // We'll save `avatar_path` in metadata instead of a public URL.
                                        // assign avatar_path into updateData below.
                                        // temporarily reuse avatar_url variable for preview.
                                      } catch (gpe) {
                                        console.error("createSignedUrl error", gpe);
                                      }
                                    }
                                  }

                                  const updateData: any = {
                                    full_name: profile.name,
                                    bio: profile.bio,
                                    age: profile.age,
                                    gender: profile.gender,
                                    avatar_color: profile.avatar_color,
                                  };
                                  if (avatar_url) {
                                    // store preview URL only for immediate UI update
                                    updateData.avatar_url = avatar_url;
                                  }
                                  // always store the object path so we can create signed URLs later
                                  if (path) updateData.avatar_path = path;

                                  const { data, error } = await supabase.auth.updateUser({
                                    data: updateData,
                                  });
                                  setSaving(false);
                                  if (error) {
                                    setSaveError(error.message || "Failed to save profile");
                                    return;
                                  }
                                  setSaveSuccess("Profile saved");
                                  setEditing(false);
                                  // update local profile from returned user metadata if present
                                  try {
                                    const meta: any = (data?.user as any)?.user_metadata ?? {};
                                    setProfile((p) => ({
                                      ...p,
                                      name: meta.full_name ?? meta.name ?? p.name,
                                      bio: meta.bio ?? p.bio,
                                      age: meta.age ?? p.age,
                                      gender: meta.gender ?? p.gender,
                                      avatar_color: meta.avatar_color ?? p.avatar_color,
                                    }));
                                    // if we uploaded, set preview to the public url and clear file state
                                    if (
                                      avatar_url ||
                                      (data?.user as any)?.user_metadata?.avatar_path
                                    ) {
                                      try {
                                        // prefer the immediate signed preview if present
                                        if (avatar_url) {
                                          setAvatarPreview(avatar_url);
                                        } else if (
                                          (data?.user as any)?.user_metadata?.avatar_path
                                        ) {
                                          const savedPath = (data?.user as any)?.user_metadata
                                            ?.avatar_path;
                                          const { data: previewData } = await supabase.storage
                                            .from("avatars")
                                            .createSignedUrl(savedPath, 60 * 60);
                                          setAvatarPreview(previewData?.signedUrl ?? null);
                                        }
                                      } catch {}
                                      setAvatarFile(null);
                                      if (fileInputRef.current) fileInputRef.current.value = "";
                                    }
                                  } catch {}
                                } catch (e: any) {
                                  setSaving(false);
                                  setSaveError(e?.message ?? String(e));
                                }
                              }}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => signOut()}>
                              Sign out
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </nav>
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </div>
  );
}
