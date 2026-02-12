import { Link, Outlet, createRootRoute, ErrorComponent } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  errorComponent: ({ error }) => (
    <div className="m-8 rounded border border-red-300 bg-red-50 p-6 text-sm">
      <h1 className="text-lg font-bold text-red-700">Something went wrong</h1>
      <pre className="mt-2 whitespace-pre-wrap text-red-600">{error.message}</pre>
      <pre className="mt-2 whitespace-pre-wrap text-xs text-red-400">{error.stack}</pre>
    </div>
  ),
  component: () => (
    <>
      <nav className="flex gap-4 border-b px-6 py-3 text-sm">
        <Link to="/" className="hover:underline [&.active]:font-bold">
          Home
        </Link>
        <Link to="/examples" className="hover:underline [&.active]:font-bold">
          Examples
        </Link>
      </nav>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});
