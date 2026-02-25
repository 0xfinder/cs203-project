import {
  ClipboardCheck,
  type LucideIcon,
  LayoutDashboard,
  SquarePlus,
  UserRound,
  MessageCircleMore,
} from "lucide-react";

export type AppNavPath = "/dashboard" | "/add" | "/review" | "/profile" | "/forum";

export interface AppNavItem {
  to: AppNavPath;
  label: string;
  icon: LucideIcon;
}

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    to: "/add",
    label: "Add",
    icon: SquarePlus,
  },
  {
    to: "/review",
    label: "Review",
    icon: ClipboardCheck,
  },
  {
    to: "/profile",
    label: "Profile",
    icon: UserRound,
  },
  {
    to: "/forum",
    label: "Forum",
    icon: MessageCircleMore,
  },
] as const;

export function isAppShellPath(pathname: string): boolean {
  if (pathname.startsWith("/forum")) {
    return false;
  }
  return APP_NAV_ITEMS.some((item) => isNavItemActive(pathname, item.to));
}

export function isNavItemActive(pathname: string, to: AppNavPath): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}
