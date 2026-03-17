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
} from "lucide-react";

export type AppNavPath =
  | "/lessons"
  | "/revise"
  | "/add"
  | "/dictionary"
  | "/review"
  | "/profile"
  | "/forum"
  | "/dashboard";

export interface AppNavItem {
  to: AppNavPath;
  label: string;
  icon: LucideIcon;
}

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    to: "/lessons",
    label: "Learn",
    icon: House,
  },
  {
    to: "/revise",
    label: "Revise",
    icon: RotateCcw,
  },
  {
    to: "/add",
    label: "Add",
    icon: SquarePlus,
  },
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: BarChart3,
  },
  {
    to: "/dictionary",
    label: "Dictionary",
    icon: BookOpen,
  },
  {
    to: "/review",
    label: "Review",
    icon: ClipboardCheck,
  },
  {
    to: "/forum",
    label: "Forum",
    icon: MessageCircleMore,
  },
  {
    to: "/profile",
    label: "Profile",
    icon: UserRound,
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
