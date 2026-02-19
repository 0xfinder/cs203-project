# Frontend

React SPA built with Vite, TanStack Router, TanStack Query, and shadcn components.

## Getting started

```sh
bun install
bun run dev
```

## Project structure

```
src/
├── assets/              # static assets (images, fonts, etc)
├── components/
│   ├── ui/              # shadcn components (auto-generated, don't edit too much)
│   └── PrimaryButton.tsx  # custom reusable components
├── features/            # feature-specific logic (hooks, types, api calls)
│   └── example/
│       └── useExampleData.ts
├── lib/                 # shared utilities and config
│   ├── api.ts           # ky instance with auth header
│   ├── auth.tsx         # auth provider, useAuth hook, requireAuth guard
│   ├── supabase.ts      # supabase client
│   └── utils.ts         # cn() helper
├── routes/              # file-based routes (TanStack Router)
│   ├── __root.tsx       # root layout (nav bar, outlet)
│   ├── index.tsx        # /
│   ├── login.tsx        # /login
│   └── examples.tsx     # /examples
├── index.css            # tailwind + shadcn theme
├── main.tsx             # app entrypoint
├── router.tsx           # router instance
└── routeTree.gen.ts     # auto-generated route tree (don't edit)
```

## Routes

routes use [TanStack Router file-based routing](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing). to add a new route, create a file in `src/routes/`:

```
src/routes/dashboard.tsx     → /dashboard
src/routes/lessons/index.tsx → /lessons
src/routes/lessons/$id.tsx   → /lessons/:id
```

the route tree (`routeTree.gen.ts`) is auto-generated when the dev server runs — don't edit it manually.

### basic route

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return <div>dashboard</div>;
}
```

### protected routes

add `beforeLoad: requireAuth` to redirect unauthenticated users to `/login`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireAuth,
  component: DashboardPage,
});
```

## Components

### shadcn components

shadcn components live in `src/components/ui/` and are added via CLI:

```sh
bunx shadcn@latest add button
bunx shadcn@latest add card input label
```

these are auto-generated — don't edit them directly. import and style them in your own components:

```tsx
import { Button } from "@/components/ui/button";

function MyComponent() {
  return (
    <Button variant="outline" className="rounded-lg">
      Click me
    </Button>
  );
}
```

### custom components

reusable components go in `src/components/`. wrap shadcn components to apply project-specific defaults:

```tsx
// src/components/PrimaryButton.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PrimaryButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="default" className={cn("rounded-lg font-semibold", className)} {...props} />
  );
}
```

## Features

feature-specific logic (hooks, types, api calls) goes in `src/features/<feature>/`. this keeps route files thin and logic reusable:

```
src/features/
└── lessons/
    ├── useLessons.ts       # TanStack Query hooks
    └── types.ts            # feature-specific types
```

### data fetching pattern

use TanStack Query hooks that call the `api` instance from `src/lib/api.ts`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Lesson {
  id: number;
  title: string;
}

export function useLessons() {
  return useQuery({
    queryKey: ["lessons"],
    queryFn: () => api.get("lessons").json<Lesson[]>(),
  });
}
```

the `api` instance automatically attaches the JWT bearer token to every request.

## Styling

- use [Tailwind CSS](https://tailwindcss.com/) for all styling
- theme variables are defined in `src/index.css` (colors, radius, etc)
- use `cn()` from `@/lib/utils` to merge class names conditionally
- `@` is aliased to `src/` for imports

## Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `bun run dev`       | start dev server                    |
| `bun run build`     | type-check and build for production |
| `bun run lint`      | check for lint errors               |
| `bun run lint:fix`  | auto-fix lint errors                |
| `bun run fmt`       | format code                         |
| `bun run fmt:check` | check formatting                    |

## Environment variables

copy `.env.example` to `.env` and fill in the values:

| Variable                 | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | supabase project URL                                        |
| `VITE_SUPABASE_ANON_KEY` | supabase anon/public key                                    |
| `VITE_API_BASE_URL`      | backend API base URL (default: `http://localhost:8080/api`) |
