import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUnits } from "@/features/lessons/useLessonsApi";

export function LessonForm({ defaultUnitId }: { defaultUnitId?: number } = {}) {
  const { data: units } = useUnits();

  const [tempUnits, setTempUnits] = useState<any[]>([]);

  useEffect(() => {
    const readTempUnits = () => {
      if (typeof window === "undefined") return;
      const items: any[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            items.push({
              id: parsed.id ?? -(Date.now()),
              title: parsed.title ?? "New Section",
              slug: parsed.slug ?? `temp-${key.replace(/^tempUnit:/, "")}`,
              description: parsed.description ?? null,
              orderIndex: parsed.orderIndex ?? 0,
              lessons: parsed.lessons ?? [],
            });
          } catch (e) {
            // ignore malformed
          }
        }
      } catch (e) {
        // ignore storage access
      }
      setTempUnits(items);
    };

    readTempUnits();
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key) {
        readTempUnits();
        return;
      }
      if (ev.key.startsWith("tempUnit:")) readTempUnits();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const allUnits = useMemo(() => {
    const base = Array.isArray(units) ? units.slice() : [];
    // merge tempUnits but avoid duplicates by id
    const existingIds = new Set(base.map((u: any) => u.id));
    for (const tu of tempUnits) {
      if (!existingIds.has(tu.id)) base.push(tu);
    }
    return base;
  }, [units, tempUnits]);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [subunitId, setSubunitId] = useState<number | null>(null);
  const [format, setFormat] = useState<"definition" | "dialogue">("definition");
  const [term, setTerm] = useState("");
  const [defText, setDefText] = useState("");
  const [example, setExample] = useState("");
  const [dialogueText, setDialogueText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (allUnits && allUnits.length > 0 && unitId === null) {
      if (defaultUnitId !== undefined && defaultUnitId !== null) {
        const found = allUnits.find((u: any) => u.id === defaultUnitId);
        setUnitId(found ? defaultUnitId : allUnits[0].id);
      } else {
        setUnitId(allUnits[0].id);
      }
    }
  }, [allUnits, unitId, defaultUnitId]);

  useEffect(() => {
    // when unit changes, set selected subunit to first lesson if available
    if (allUnits && unitId) {
      const unit = allUnits.find((u: any) => u.id === unitId);
      const firstLessonId = unit && Array.isArray(unit.lessons) && unit.lessons.length > 0 ? unit.lessons[0].id : null;
      setSubunitId(firstLessonId);
    } else {
      setSubunitId(null);
    }
  }, [unitId, allUnits]);

  const handleSubmitLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const me = await getMe();
      let stepsPayload: any[] = [];
      if (format === "definition") {
        stepsPayload = [
          {
            orderIndex: 0,
            stepType: "TEACH",
            vocab: {
              term: term.trim(),
              definition: defText.trim(),
              exampleSentence: example.trim() || null,
              partOfSpeech: null,
            },
            dialogueText: null,
            question: null,
            payload: null,
          },
        ];
      } else {
        stepsPayload = [
          {
            orderIndex: 0,
            stepType: "DIALOGUE",
            vocab: null,
            dialogueText: dialogueText.trim(),
            question: null,
            payload: null,
          },
        ];
      }

      const titleVal = format === "definition" ? term.trim() || "Definition" : (dialogueText.trim().split("\n")[0] || "Dialogue");
      const descriptionVal = format === "definition" ? defText.trim() || term.trim() : (dialogueText.trim().split("\n").slice(0,2).join(" ") || "Dialogue example");

      const payload = {
        unitId,
        title: titleVal,
        description: descriptionVal,
        orderIndex: 0,
        steps: stepsPayload,
        submittedBy: me.email ?? null,
      };

      if (subunitId) {
        // Add as a step to an existing lesson (subunit)
        await api.post(`lessons/${subunitId}/steps`, { json: stepsPayload }).json();
      } else {
        await api.post("lessons", { json: payload }).json();
      }
      setSuccess("Lesson submitted — it will appear after review.");
      setTerm("");
      setDefText("");
      setExample("");
      setDialogueText("");
    } catch (err) {
      console.error(err);
      setError("Failed to submit lesson. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmitLesson} className="space-y-4">
      <div className="flex gap-3">
        <button type="button" className={format === "definition" ? "px-3 py-1 rounded bg-primary text-white" : "px-3 py-1 rounded border"} onClick={() => setFormat("definition")}>Definition</button>
        <button type="button" className={format === "dialogue" ? "px-3 py-1 rounded bg-primary text-white" : "px-3 py-1 rounded border"} onClick={() => setFormat("dialogue")}>Dialogue</button>
      </div>

      <div>
        <Label htmlFor="lesson-unit">Unit</Label>
        <select id="lesson-unit" name="unitId" value={unitId ?? ""} onChange={(e) => setUnitId(Number(e.target.value))} className="mt-1 w-full rounded-md border bg-card px-3 py-2">
          {allUnits?.map((u: any) => (
            <option key={u.id} value={u.id}>{u.title}</option>
          ))}
        </select>
      </div>

      {allUnits && unitId !== null && (allUnits.find((u: any) => u.id === unitId)?.lessons ?? []).length > 0 ? (
        <div>
          <Label htmlFor="lesson-subunit">Subunit</Label>
          <select
            id="lesson-subunit"
            name="subunitId"
            value={subunitId ?? ""}
            onChange={(e) => setSubunitId(e.target.value ? Number(e.target.value) : null)}
            className="mt-1 w-full rounded-md border bg-card px-3 py-2"
          >
            {(allUnits.find((u: any) => u.id === unitId)?.lessons ?? []).map((l: any) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>
      ) : null}

      {format === "definition" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="lesson-term">Term</Label>
            <Input id="lesson-term" name="term" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lesson-definition">Definition</Label>
            <textarea id="lesson-definition" name="definition" value={defText} onChange={(e) => setDefText(e.target.value)} className="mt-1 w-full rounded-md border bg-card px-3 py-2" rows={3} />
          </div>
          <div>
            <Label htmlFor="lesson-example">Example (optional)</Label>
            <Input id="lesson-example" name="example" value={example} onChange={(e) => setExample(e.target.value)} />
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor="lesson-dialogue">Dialogue Text</Label>
          <textarea id="lesson-dialogue" name="dialogueText" value={dialogueText} onChange={(e) => setDialogueText(e.target.value)} className="mt-1 w-full rounded-md border bg-card px-3 py-2" rows={6} placeholder={"A: ...\nB: ..."} />
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Lesson"}</Button>
      </div>
    </form>
  );
}

export function QuizForm() {
  const { data: units } = useUnits();
  const [unitId, setUnitId] = useState<number | null>(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [questions, setQuestions] = useState<
    Array<{ prompt: string; questionType: string; choices: Array<{ text: string; isCorrect?: boolean }> }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (units && units.length > 0 && unitId === null) setUnitId(units[0].id);
  }, [units, unitId]);

  const addQuestion = () => setQuestions((q) => [...q, { prompt: "", questionType: "MCQ", choices: [{ text: "", isCorrect: false }] }]);
  const removeQuestion = (idx: number) => setQuestions((q) => q.filter((_, i) => i !== idx));
  const updateQuestion = (idx: number, patch: Partial<any>) => setQuestions((q) => q.map((qq, i) => (i === idx ? { ...qq, ...patch } : qq)));

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const me = await getMe();
      const payload = {
        unitId,
        title: quizTitle.trim(),
        description: quizDescription.trim() || undefined,
        questions: questions.map((q, i) => ({
          orderIndex: i,
          prompt: q.prompt,
          questionType: q.questionType,
          choices: q.choices.map((c, idx) => ({ orderIndex: idx, text: c.text, isCorrect: !!c.isCorrect })),
        })),
        submittedBy: me.email ?? null,
      };

      await api.post("quizzes", { json: payload }).json();
      setSuccess("Quiz submitted — it will appear after review.");
      setQuizTitle("");
      setQuizDescription("");
      setQuestions([]);
    } catch (err) {
      console.error(err);
      setError("Failed to submit quiz. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmitQuiz} className="space-y-4">
      <div>
        <Label htmlFor="quiz-unit">Unit</Label>
        <select id="quiz-unit" name="unitId" value={unitId ?? ""} onChange={(e) => setUnitId(Number(e.target.value))} className="mt-1 w-full rounded-md border bg-card px-3 py-2">
          {units?.map((u: any) => (
            <option key={u.id} value={u.id}>{u.title}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="quiz-title">Quiz Title</Label>
        <Input id="quiz-title" name="quizTitle" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="quiz-description">Description</Label>
        <textarea id="quiz-description" name="quizDescription" value={quizDescription} onChange={(e) => setQuizDescription(e.target.value)} className="mt-1 w-full rounded-md border bg-card px-3 py-2" rows={3} />
      </div>

      <div>
        <Label>Questions</Label>
        <div className="space-y-3 mt-2">
          {questions.map((q, qi) => (
            <div key={qi} className="border p-3 rounded-md bg-background">
              <div className="flex justify-between items-center">
                <strong>Question {qi + 1}</strong>
                <div className="flex gap-2">
                  <select value={q.questionType} onChange={(e) => updateQuestion(qi, { questionType: e.target.value })} className="rounded-md border bg-card px-2">
                    <option value="MCQ">Multiple Choice</option>
                    <option value="SHORT_ANSWER">Short Answer</option>
                  </select>
                  <Button type="button" variant="destructive" onClick={() => removeQuestion(qi)}>Remove</Button>
                </div>
              </div>

              <div className="mt-2">
                <Input id={`quiz-${qi}-prompt`} name={`questions[${qi}].prompt`} value={q.prompt} onChange={(e) => updateQuestion(qi, { prompt: e.target.value })} placeholder="Question prompt" />
              </div>

              {q.questionType === "MCQ" && (
                <div className="mt-2 space-y-2">
                  {q.choices.map((c, ci) => (
                      <div key={ci} className="flex gap-2 items-center">
                        <input id={`quiz-${qi}-choice-${ci}-isCorrect`} name={`questions[${qi}].choices[${ci}].isCorrect`} type="checkbox" checked={!!c.isCorrect} onChange={(e) => updateQuestion(qi, { choices: q.choices.map((cc, idx) => (idx === ci ? { ...cc, isCorrect: e.target.checked } : cc)) })} />
                        <Input id={`quiz-${qi}-choice-${ci}-text`} name={`questions[${qi}].choices[${ci}].text`} value={c.text} onChange={(e) => updateQuestion(qi, { choices: q.choices.map((cc, idx) => (idx === ci ? { ...cc, text: e.target.value } : cc)) })} />
                      </div>
                  ))}
                  <Button type="button" onClick={() => updateQuestion(qi, { choices: [...q.choices, { text: "", isCorrect: false }] })}>Add Choice</Button>
                </div>
              )}
            </div>
          ))}

          <Button type="button" onClick={addQuestion}>Add Question</Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>{loading ? "Submitting…" : "Submit Quiz"}</Button>
      </div>
    </form>
  );
}
