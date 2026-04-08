import {
  ClipboardCheck,
  BookOpen,
  type LucideIcon,
  House,
  SquarePlus,
  UserRound,
  MessageCircleMore,
  RotateCcw,
  BarChart3,
  Trophy,
} from "lucide-react";
import type { UserRole } from "./me";

export type AppNavPath =
  | "/lessons"
  | "/revise"
  | "/add"
  | "/dictionary"
  | "/review"
  | "/profile"
  | "/forum"
  | "/leaderboard"
  | "/dashboard";

export interface AppNavItem {
  to: AppNavPath;
  label: string;
  icon: LucideIcon;
  access: "public" | "authenticated";
  roles?: UserRole[];
}

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    to: "/lessons",
    label: "Learn",
    icon: House,
    access: "authenticated",
  },
  {
    to: "/revise",
    label: "Revise",
    icon: RotateCcw,
    access: "authenticated",
  },
  {
    to: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    access: "authenticated",
  },
  {
    to: "/add",
    label: "Add",
    icon: SquarePlus,
    access: "authenticated",
    roles: ["CONTRIBUTOR", "MODERATOR", "ADMIN"],
  },
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
    access: "authenticated",
    roles: ["CONTRIBUTOR", "MODERATOR", "ADMIN"],
  },
  {
    to: "/dictionary",
    label: "Dictionary",
    icon: BookOpen,
    access: "public",
  },
  {
    to: "/review",
    label: "Review",
    icon: ClipboardCheck,
    access: "authenticated",
    roles: ["MODERATOR", "ADMIN"],
  },
  {
    to: "/forum",
    label: "Forum",
    icon: MessageCircleMore,
    access: "public",
  },
  {
    to: "/profile",
    label: "Profile",
    icon: UserRound,
    access: "authenticated",
  },
] as const;

function isPathSegmentMatch(pathname: string, to: string): boolean {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const normalizedTo = to.replace(/\/+$/, "") || "/";
  const escapedTarget = normalizedTo.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|/)${escapedTarget}(?:/|$)`);
  return pattern.test(normalizedPathname);
}

export function isAppShellPath(pathname: string): boolean {
  return APP_NAV_ITEMS.some((item) => isPathSegmentMatch(pathname, item.to));
}

export function isNavItemActive(pathname: string, to: AppNavPath): boolean {
  return isPathSegmentMatch(pathname, to);
}

export function isNavItemPublic(item: AppNavItem): boolean {
  return item.access === "public";
}

export function isAppNavPath(value: string): value is AppNavPath {
  return APP_NAV_ITEMS.some((item) => item.to === value);
}
