import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ArrowLeft, Compass, Ellipsis } from "lucide-react";
import {
  type AppNavItem,
  type AppNavPath,
  APP_NAV_ITEMS,
  isAppShellPath,
  isNavItemActive,
  isNavItemPublic,
} from "@/lib/app-nav";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/query-client";
import { optionalCurrentUserViewQueryOptions } from "@/lib/current-user-view";
import Dialog, { DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const showDevtools = import.meta.env.DEV && import.meta.env.VITE_SHOW_DEVTOOLS !== "false";
const MOBILE_PRIMARY_NAV_PATHS: readonly AppNavPath[] = [
  "/lessons",
  "/leaderboard",
  "/dictionary",
  "/forum",
];
const navPriority: Partial<Record<AppNavPath, number>> = {
  "/lessons": 0,
  "/dictionary": 2,
  "/add": 3,
  "/dashboard": 3.5,
  "/review": 4,
};

export const Route = createRootRoute({
  loader: () => queryClient.ensureQueryData(optionalCurrentUserViewQueryOptions()),
  errorComponent: ({ error }) => (
    <div className="m-8 rounded border border-red-300 bg-red-50 p-6 text-sm">
      <h1 className="text-lg font-bold text-red-700">Something went wrong</h1>
      <pre className="mt-2 whitespace-pre-wrap text-red-600">{error.message}</pre>
      <pre className="mt-2 whitespace-pre-wrap text-xs text-red-400">{error.stack}</pre>
    </div>
  ),
  notFoundComponent: GlobalNotFoundPage,
  component: RootComponent,
});

function GlobalNotFoundPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-4rem] top-[10%] h-56 w-56 rounded-full bg-primary/12 blur-3xl sm:h-72 sm:w-72" />
        <div className="absolute right-[-5rem] top-[18%] h-64 w-64 rounded-full bg-chart-3/12 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute bottom-[-4rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-chart-2/10 blur-3xl sm:h-96 sm:w-96" />
      </div>

      <div className="relative flex w-full max-w-2xl flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Compass className="size-3.5" />
          Lost In Translation
        </div>

        <div className="mt-6 space-y-4">
          <p className="text-6xl font-black leading-none tracking-[-0.08em] text-primary sm:text-7xl">
            404
          </p>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              this page is giving nonexistent
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Requested route does not exist.
            </p>
          </div>
        </div>

        <div className="mt-6 w-full rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Requested Path
          </p>
          <p className="mt-1 break-all font-mono text-sm text-foreground">{pathname}</p>
        </div>

        <div className="mt-6 w-full">
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Back To Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function RootComponent() {
  const { profile } = Route.useLoaderData();
  const [pendingAuthNavItem, setPendingAuthNavItem] = useState<AppNavItem | null>(null);
  const [mobileOverflowOpen, setMobileOverflowOpen] = useState(false);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const showAppShell = isAppShellPath(pathname);

  const navItems = [...APP_NAV_ITEMS]
    .filter((item) => {
      if (!item.roles) return true;
      if (!profile) return false;
      return item.roles.includes(profile.role);
    })
    .sort((a, b) => {
      const aOrder = navPriority[a.to];
      const bOrder = navPriority[b.to];

      if (aOrder === undefined && bOrder === undefined) {
        return 0;
      }
      if (aOrder === undefined) {
        return 1;
      }
      if (bOrder === undefined) {
        return -1;
      }

      return aOrder - bOrder;
    });

  const primaryMobileNavItems = navItems.filter((item) =>
    MOBILE_PRIMARY_NAV_PATHS.includes(item.to),
  );
  const overflowMobileNavItems = navItems.filter(
    (item) => !MOBILE_PRIMARY_NAV_PATHS.includes(item.to),
  );
  const shouldUseMobileOverflow = overflowMobileNavItems.length > 1;
  const mobileNavItems = shouldUseMobileOverflow
    ? primaryMobileNavItems
    : [...primaryMobileNavItems, ...overflowMobileNavItems];
  const isMobileOverflowActive = overflowMobileNavItems.some((item) =>
    isNavItemActive(pathname, item.to),
  );

  const buildLoginHref = (item: AppNavItem | null, signup = false) => {
    const params = new URLSearchParams();
    if (item) {
      params.set("redirect", item.to);
    }
    if (signup) {
      params.set("tab", "signup");
    }
    const search = params.toString();
    const hash = signup ? "#signup" : "";
    return `/login${search ? `?${search}` : ""}${hash}`;
  };

  const renderNavItem = (
    item: AppNavItem,
    { mobile = false, onSelect }: { mobile?: boolean; onSelect?: () => void } = {},
  ) => {
    const Icon = item.icon;
    const active = isNavItemActive(pathname, item.to);
    const baseClassName = mobile
      ? cn(
          "mx-1 my-2 flex items-center justify-center rounded-2xl border transition-colors",
          active
            ? "border-primary/25 bg-primary/14 text-foreground shadow-sm"
            : "border-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground",
        )
      : cn(
          "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
          active
            ? "border-primary/25 bg-primary/14 text-foreground shadow-sm"
            : "border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        );

    if (!profile && !isNavItemPublic(item)) {
      return (
        <button
          key={item.to}
          type="button"
          aria-label={item.label}
          onClick={() => {
            onSelect?.();
            setPendingAuthNavItem(item);
          }}
          className={baseClassName}
        >
          <Icon className={mobile ? "h-6 w-6" : "h-5 w-5 shrink-0"} />
          {mobile ? (
            <span className="sr-only">{item.label}</span>
          ) : (
            <span className={cn("font-semibold", active && "font-bold")}>{item.label}</span>
          )}
        </button>
      );
    }

    return (
      <Link
        key={item.to}
        to={item.to}
        aria-label={item.label}
        className={baseClassName}
        onClick={onSelect}
      >
        <Icon className={mobile ? "h-6 w-6" : "h-5 w-5 shrink-0"} />
        {mobile ? (
          <span className="sr-only">{item.label}</span>
        ) : (
          <span className={cn("font-semibold", active && "font-bold")}>{item.label}</span>
        )}
      </Link>
    );
  };

  if (!showAppShell) {
    return (
      <div className="flex min-h-dvh flex-col">
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
        {showDevtools && <TanStackRouterDevtools />}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden h-dvh w-64 shrink-0 border-r bg-card/30 md:sticky md:top-0 md:flex">
        <div className="flex h-full min-h-0 w-full flex-col p-4">
          <div className="px-2 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              AlphaLingo
            </p>
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
            {navItems.map((item) => renderNavItem(item))}
          </nav>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <div
          className="grid h-16"
          style={{
            gridTemplateColumns: `repeat(${mobileNavItems.length + (shouldUseMobileOverflow ? 1 : 0)}, minmax(0, 1fr))`,
          }}
        >
          {mobileNavItems.map((item) => renderNavItem(item, { mobile: true }))}
          {shouldUseMobileOverflow ? (
            <button
              type="button"
              aria-label="More"
              aria-expanded={mobileOverflowOpen}
              onClick={() => setMobileOverflowOpen(true)}
              className={cn(
                "mx-1 my-2 flex items-center justify-center rounded-2xl border transition-colors",
                isMobileOverflowActive
                  ? "border-primary/25 bg-primary/14 text-foreground shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              )}
            >
              <Ellipsis className="h-6 w-6" />
              <span className="sr-only">More</span>
            </button>
          ) : null}
        </div>
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-16 h-px bg-border md:hidden" />
      <Dialog open={mobileOverflowOpen} onOpenChange={setMobileOverflowOpen}>
        <DialogContent
          className="mx-0 w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-border/60 bg-card p-5 shadow-2xl md:hidden"
          title="More"
        >
          <div className="flex flex-col gap-2">
            {overflowMobileNavItems.map((item) =>
              renderNavItem(item, {
                onSelect: () => setMobileOverflowOpen(false),
              }),
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pendingAuthNavItem)} onOpenChange={() => setPendingAuthNavItem(null)}>
        <DialogContent
          className="max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-2xl"
          title="Log in to continue"
          description={
            pendingAuthNavItem
              ? `You need to log in first before opening ${pendingAuthNavItem.label}.`
              : undefined
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/15 bg-primary/6 px-4 py-3 text-sm text-muted-foreground">
              Public pages like <span className="font-semibold text-foreground">Forum</span> and{" "}
              <span className="font-semibold text-foreground">Dictionary</span> stay open to
              everyone. Learning, profile, and progress pages require an account.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="flex-1">
                <a href={buildLoginHref(pendingAuthNavItem)}>Log in</a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a href={buildLoginHref(pendingAuthNavItem, true)}>Sign up</a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {showDevtools && <TanStackRouterDevtools />}
    </div>
  );
}
