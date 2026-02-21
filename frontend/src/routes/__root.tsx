import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex items-center gap-4 border-b px-6 py-3 text-sm">
        <Link to="/" className="hover:underline [&.active]:font-bold">
          Home
        </Link>
        {user && (
          <>
            <Link to="/add" className="hover:underline [&.active]:font-bold">
              Add
            </Link>
            <Link to="/review" className="hover:underline [&.active]:font-bold">
              Review
            </Link>
            <Link to="/examples" className="hover:underline [&.active]:font-bold">
              Examples
            </Link>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="text-muted-foreground">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Login</Link>
            </Button>
          )}
        </div>
      </nav>
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </div>
  );
}
