import { useMemo, useState } from "react";
import { BookOpenText, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type UnitData,
  useCreateUnit,
  useDeleteUnit,
  useUpdateUnit,
} from "@/features/lessons/useLessonsApi";

export function AdminUnitsPanel({ units }: { units: UnitData[] }) {
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const deleteUnit = useDeleteUnit();

  const orderedUnits = useMemo(
    () => [...units].sort((left, right) => left.orderIndex - right.orderIndex),
    [units],
  );

  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const busy = createUnit.isPending || updateUnit.isPending || deleteUnit.isPending;

  const resetForm = () => {
    setEditingUnitId(null);
    setTitle("");
    setDescription("");
  };

  const loadUnit = (unit: UnitData) => {
    setEditingUnitId(unit.id);
    setTitle(unit.title);
    setDescription(unit.description ?? "");
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Unit title is required.");
      return;
    }

    try {
      if (editingUnitId != null) {
        await updateUnit.mutateAsync({
          unitId: editingUnitId,
          body: {
            title: title.trim(),
            description: description.trim() || null,
          },
        });
        setSuccess("Unit updated.");
      } else {
        await createUnit.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
        });
        setSuccess("Unit created.");
      }
      resetForm();
    } catch (err: any) {
      const message =
        err?.response?.status === 400
          ? "Could not save unit. Check for duplicate names."
          : err?.message || "Could not save unit.";
      setError(message);
    }
  };

  const handleDelete = async (unit: UnitData) => {
    setError(null);
    setSuccess(null);
    if (unit.lessons.length > 0) {
      setError("Only empty units can be deleted.");
      return;
    }
    if (!window.confirm(`Delete "${unit.title}"?`)) return;

    try {
      await deleteUnit.mutateAsync(unit.id);
      if (editingUnitId === unit.id) {
        resetForm();
      }
      setSuccess("Unit deleted.");
    } catch (err: any) {
      setError(err?.message || "Could not delete unit.");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-chart-3/25 bg-gradient-to-br from-chart-3/12 via-background to-chart-5/8">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                admin units
              </p>
              <CardTitle className="mt-2 text-2xl">Manage curriculum containers</CardTitle>
            </div>
            <Badge variant="outline" className="border-chart-3/30 bg-background/80 px-3 py-1">
              {orderedUnits.length} unit{orderedUnits.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Units are the top-level curriculum structure. Contributors add lessons inside them.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="unit-title">Unit title</Label>
                <Input
                  id="unit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Status, Tone, and Internet Gravity"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="unit-description">Description</Label>
                <textarea
                  id="unit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border bg-card px-3 py-2"
                  placeholder="What this unit covers and why it belongs in the roadmap."
                />
              </div>
            </div>

            <div className="flex flex-col justify-end gap-2">
              <Button type="submit" size="lg" disabled={busy}>
                {editingUnitId != null ? (
                  <>
                    <Pencil />
                    Save unit
                  </>
                ) : (
                  <>
                    <Plus />
                    Create unit
                  </>
                )}
              </Button>
              {editingUnitId != null ? (
                <Button type="button" variant="ghost" onClick={resetForm} disabled={busy}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>

          {success ? <p className="mt-4 text-sm text-success">{success}</p> : null}
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {orderedUnits.map((unit) => {
          const lessonCount = Array.isArray(unit.lessons) ? unit.lessons.length : 0;
          return (
            <Card key={unit.id} className="border-border/70 bg-card/80 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">{unit.title}</p>
                    <Badge variant="secondary">#{unit.orderIndex}</Badge>
                    <Badge variant="outline">
                      {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {unit.description || "No description yet."}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => loadUnit(unit)}>
                    <Pencil />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleDelete(unit)}
                    disabled={busy || lessonCount > 0}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {orderedUnits.length === 0 ? (
          <Card className="border-dashed border-border/70 bg-background/60">
            <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <BookOpenText className="size-4 text-chart-4" />
              Create the first unit to unlock lesson authoring.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
