import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Home</h1>
      <p className="text-muted-foreground">
        Welcome to the CS203 frontend. Check out the{" "}
        <Link to="/examples" className="underline">
          Examples page
        </Link>{" "}
        to see how everything fits together.
      </p>
    </div>
  ),
});
