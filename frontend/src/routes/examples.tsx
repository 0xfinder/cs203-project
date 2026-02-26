import { createFileRoute } from "@tanstack/react-router";
import { JsHelloCard } from "@/components/examples/JsHelloCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useExamples } from "@/features/example/useExampleData";
import { requireOnboardingCompleted } from "@/lib/auth";

function ExampleDataList() {
  const { data, isLoading, error } = useExamples();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">Error: {error.message}</p>;

  return (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {data?.map((item) => (
        <li key={item.id}>{item.title}</li>
      ))}
    </ul>
  );
}

export const Route = createFileRoute("/examples")({
  beforeLoad: requireOnboardingCompleted,
  component: ExamplesPage,
});

function ExamplesPage() {
  return (
    <div className="flex min-h-screen w-full justify-center">
      <div className="max-w-2xl space-y-8 p-8">
        <h1 className="text-2xl font-bold">Examples</h1>
        <p className="text-muted-foreground">
          This page shows the patterns we use in this project.
        </p>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">JS Component (JsHelloCard.jsx)</h2>
          <JsHelloCard />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Wrapper Component (PrimaryButton)</h2>
          <PrimaryButton onClick={() => alert("PrimaryButton wraps shadcn Button")}>
            Primary Action
          </PrimaryButton>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">TanStack Query (useExampleData)</h2>
          <ExampleDataList />
        </section>
      </div>
    </div>
  );
}
