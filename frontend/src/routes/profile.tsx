import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardingCompleted, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/profile")({
  beforeLoad: requireOnboardingCompleted,
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreviewUrl(null);
  };

  const handleUpload = async () => {
    setError(null);
    if (!file) return setError("No file selected");
    if (!user) return setError("Not authenticated");

    setUploading(true);
    try {
      const path = `uploads/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pictures")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      // create a signed URL for preview (private bucket)
      const { data: signedData, error: signedError } = await supabase.storage
        .from("pictures")
        .createSignedUrl(path, 60 * 60); // 1 hour

      if (signedError) throw signedError;

      setPreviewUrl(signedData.signedUrl ?? null);
      setFile(null);
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Profile</CardTitle>
          <CardDescription>Manage your account session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Signed in email</p>
            <p className="mt-1 break-all font-medium">{user?.email ?? "unknown user"}</p>
          </div>
          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">Profile picture</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <div className="flex items-center gap-2">
              <Button onClick={handleUpload} disabled={uploading || !file}>
                {uploading ? "Uploading..." : "Upload"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  setError(null);
                }}
              >
                Clear
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {previewUrl && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">Preview (signed URL)</p>
                <img src={previewUrl} alt="profile preview" className="mt-1 max-h-48 rounded" />
              </div>
            )}
          </div>
          <Button variant="destructive" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
