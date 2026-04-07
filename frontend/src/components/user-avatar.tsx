import { useEffect, useState } from "react";
import { resolveAvatarSignedUrl } from "@/lib/current-user-view";
import { cn } from "@/lib/utils";

const AVATAR_HEX = ["#60A5FA", "#34D399", "#F472B6", "#F59E0B", "#A78BFA", "#475569"];
const signedAvatarUrlCache = new Map<string, string | null>();

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  );
}

function avatarHex(name: string) {
  const s = (name ?? "?").trim();
  if (!s) return AVATAR_HEX[0];
  const code = s.charCodeAt(0);
  return AVATAR_HEX[code % AVATAR_HEX.length];
}

interface UserAvatarProps {
  name: string;
  avatarPath?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  name,
  avatarPath,
  avatarColor,
  avatarUrl,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const [url, setUrl] = useState<string | null>(() => {
    if (avatarUrl !== undefined) {
      return avatarUrl;
    }
    if (!avatarPath) {
      return null;
    }
    return signedAvatarUrlCache.get(avatarPath) ?? null;
  });
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setImageFailed(false);

    if (avatarUrl !== undefined) {
      setUrl(avatarUrl);
      if (avatarPath) {
        signedAvatarUrlCache.set(avatarPath, avatarUrl);
      }
      return () => {
        active = false;
      };
    }

    if (!avatarPath) {
      setUrl(null);
      return () => {
        active = false;
      };
    }

    const cachedUrl = signedAvatarUrlCache.get(avatarPath);
    if (cachedUrl !== undefined) {
      setUrl(cachedUrl);
      return () => {
        active = false;
      };
    }

    void resolveAvatarSignedUrl(avatarPath).then((nextUrl) => {
      if (active) {
        signedAvatarUrlCache.set(avatarPath, nextUrl);
        setUrl(nextUrl);
      }
    });

    return () => {
      active = false;
    };
  }, [avatarPath, avatarUrl]);

  const showImage = !!url && !imageFailed;
  const fallbackColor = avatarColor ?? avatarHex(name);

  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt={`${name} avatar`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <span
        className={cn(
          "items-center justify-center text-xs font-bold text-white",
          showImage ? "hidden h-full w-full" : "inline-flex h-full w-full",
          fallbackClassName,
        )}
        style={{ backgroundColor: fallbackColor }}
      >
        {getInitials(name)}
      </span>
    </span>
  );
}
