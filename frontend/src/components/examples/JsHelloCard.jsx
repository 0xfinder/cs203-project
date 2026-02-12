import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function JsHelloCard() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Hello from JS</CardTitle>
        <CardDescription>This component is plain .jsx — no TypeScript needed.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          You can use shadcn components in JS files exactly the same way. Just import them from{" "}
          <code>@/components/ui/*</code>.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" onClick={() => alert("JS works!")}>
          Click me
        </Button>
      </CardFooter>
    </Card>
  );
}
