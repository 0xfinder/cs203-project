import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: () => (
    <div style={{ padding: 16 }}>
      <h1>About</h1>
      <Link to="/">Back home</Link>
    </div>
  ),
});
