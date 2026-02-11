import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => (
    <div style={{ padding: 16 }}>
      <h1>Home</h1>
      <Link to="/about">Go to About</Link>
    </div>
  ),
});
