import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";

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
  const [profile, setProfile] = useState({ name: "", bio: "", age: "", gender: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
        });
      }
    } catch {}
  }, [user]);

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
          {user ? (
            <>
              <div className="relative">
                <button
                  aria-label="Open profile"
                  onClick={() => setShowProfile((s) => !s)}
                  className="w-10 h-10 rounded-full bg-white/6 flex items-center justify-center text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  {/* simple blank pfp placeholder: initials if available */}
                  {((user as any).user_metadata?.full_name || "").split(" ").map((n: string) => n[0]).slice(0, 2).join("") || ""}
                </button>

                {showProfile && (
                  <div className="absolute right-0 mt-2 w-80 rounded-3xl border-2 border-purple-400/30 bg-white/95 dark:bg-slate-900/95 dark:border-purple-700/40 backdrop-blur-md p-6 shadow-2xl z-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium">Profile</h3>
                      <button className="text-sm text-white/60" onClick={() => { setShowProfile(false); setEditing(false); }}>
                        Close
                      </button>
                    </div>

                    {!editing ? (
                      <div className="space-y-3">
                        <div>
                          <div className="text-lg font-semibold">{profile.name || (user.email ?? "")}</div>
                          <div className="text-sm text-white/60">{user.email}</div>
                        </div>
                        {profile.bio && (
                          <div className="text-sm text-white/80">{profile.bio}</div>
                        )}

                        <div className="flex gap-4 text-sm text-white/70">
                          <div>Age: {profile.age || "—"}</div>
                          <div>Gender: {profile.gender || "—"}</div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <Button size="sm" className="al-cta !px-3 !py-2" onClick={() => setEditing(true)}>
                            Edit profile
                          </Button>
                          <Button size="sm" className="al-cta !px-3 !py-2" onClick={() => signOut()}>
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
                              onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
                            />
                          </div>
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
                              className="al-cta !px-3 !py-2"
                              onClick={async () => {
                                  setSaveError(null);
                                  setSaveSuccess(null);
                                  try {
                                    setSaving(true);
                                    const { data, error } = await supabase.auth.updateUser({ data: {
                                      full_name: profile.name,
                                      bio: profile.bio,
                                      age: profile.age,
                                      gender: profile.gender,
                                    } });
                                    setSaving(false);
                                    if (error) {
                                      setSaveError(error.message || 'Failed to save profile');
                                      return;
                                    }
                                    setSaveSuccess('Profile saved');
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
                                      }));
                                    } catch {}
                                  } catch (e: any) {
                                    setSaving(false);
                                    setSaveError(e?.message ?? String(e));
                                  }
                                }}
                            >
                              Save
                            </Button>
                            <Button size="sm" className="al-cta !px-3 !py-2" onClick={() => signOut()}>
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
