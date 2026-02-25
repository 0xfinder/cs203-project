import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useAuth } from "@/lib/auth";
import { APP_NAV_ITEMS, isAppShellPath, isNavItemActive } from "@/lib/app-nav";
import { cn } from "@/lib/utils";

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
  const { user } = useAuth();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const showAppShell = isAppShellPath(pathname);

  if (!showAppShell) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
        <TanStackRouterDevtools />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r bg-card/30 md:flex">
        <div className="flex h-full w-full flex-col p-4">
          <div className="px-2 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              AlphaLingo
            </p>
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-1">
            {APP_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="rounded-lg border bg-background/60 p-3">
            <p className="truncate text-xs text-muted-foreground" title={user?.email ?? undefined}>
              {user?.email ?? "signed in"}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="grid h-16 grid-cols-4">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={cn(
                  "flex items-center justify-center transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-16 h-px bg-border md:hidden" />
      <TanStackRouterDevtools />
    </div>
  );
}
