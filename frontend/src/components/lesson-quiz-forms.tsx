import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getMe } from "@/lib/me";
import { getValidAccessToken } from "@/lib/session";
import { useSubmitContent } from "@/features/content/useContentData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUnits } from "@/features/lessons/useLessonsApi";

export function LessonForm({ defaultUnitId, setTempRefresh }: { defaultUnitId?: number; setTempRefresh?: (fn: (v: number) => number) => void } = {}) {
  const { data: units } = useUnits();

  const [tempUnits, setTempUnits] = useState<any[]>([]);

  useEffect(() => {
    const readTempUnits = () => {
      if (typeof window === "undefined") return;
      const items: any[] = [];
      const placeholdersByParentId: { [key: number]: any[] } = {};
      try {
        // First pass: read tempPlaceholderUnit:* entries and group by parent unit ID
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempPlaceholderUnit:")) continue;
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const parentUnitId = parsed.originalUnitId;
            if (parentUnitId) {
              if (!placeholdersByParentId[parentUnitId]) {
                placeholdersByParentId[parentUnitId] = [];
              }
              placeholdersByParentId[parentUnitId].push(parsed);
            }
          } catch (e) {
            // ignore malformed
          }
        }

        // Second pass: read tempUnit:* entries and merge placeholders into their lessons
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (!key.startsWith("tempUnit:")) continue;
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            // Filter out temp units that only contain placeholder lessons so
            // stale client-side units (e.g. deleted on server) don't persist
            // in the Unit dropdown.
            const rawLessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
            const isPlaceholderLesson = (l: any) => {
              if (!l) return false;
              const t = String(l.title ?? "");
              const s = String(l.slug ?? "");
              return t.startsWith("Placeholder Lesson") || s.startsWith("placeholder-") || t === "Coming soon" || !!l.__placeholder;
            };
            const meaningfulLessons = rawLessons.filter((l: any) => !isPlaceholderLesson(l));
            
            const unitId = parsed.id ?? -(Date.now());
            const lessons = [...(meaningfulLessons.length > 0 ? meaningfulLessons : [])];
            
            // Add any placeholder subunits for this unit
            if (placeholdersByParentId[unitId]) {
              lessons.push(...placeholdersByParentId[unitId]);
            }
            
            // Skip only if original lessons exist but all are placeholders (stale unit).
            // Include newly-created empty units (rawLessons.length === 0)
            if (rawLessons.length > 0 && meaningfulLessons.length === 0) continue;

            const tempKey = key.replace(/^tempUnit:/, "");
            items.push({
              id: unitId,
              title: parsed.title ?? "New Section",
              slug: parsed.slug ?? `temp-${tempKey}`,
              description: parsed.description ?? null,
              orderIndex: parsed.orderIndex ?? 0,
              lessons: lessons,
              tempKey: tempKey,
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
      if (ev.key.startsWith("tempUnit:") || ev.key.startsWith("tempPlaceholderUnit:")) readTempUnits();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const allUnits = useMemo(() => {
    const base = Array.isArray(units) ? units.slice() : [];
    // Filter out test/temporary units (e.g., "Ultimate Slang (test)")
    const filtered = base.filter((u: any) => !String(u.title).includes("(test)"));
    // merge tempUnits but avoid duplicates by id
    const existingIds = new Set(filtered.map((u: any) => u.id));
    for (const tu of tempUnits) {
      if (!existingIds.has(tu.id)) filtered.push(tu);
    }
    return filtered;
  }, [units, tempUnits]);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [subunitId, setSubunitId] = useState<number | null>(null);
  const [format, setFormat] = useState<"definition" | "dialogue" | "question">("definition");
  const [term, setTerm] = useState("");
  const [defText, setDefText] = useState("");
  const [example, setExample] = useState("");
  const [dialogueText, setDialogueText] = useState("");
  // Question state
  const [questionType, setQuestionType] = useState<"SHORT_ANSWER" | "MCQ">("SHORT_ANSWER");
  const [qPrompt, setQPrompt] = useState("");
  const [qAcceptedAnswers, setQAcceptedAnswers] = useState("");
  const [qChoices, setQChoices] = useState<Array<{ id: number; text: string; isCorrect?: boolean }>>([
    { id: Date.now(), text: "", isCorrect: false },
  ]);
  const [qAllowMultiple, setQAllowMultiple] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submitContent = useSubmitContent();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  

  useEffect(() => {
    if (allUnits && allUnits.length > 0 && unitId === null) {
      let targetId: number | null = null;
      
      // First check if there's a unit ID in sessionStorage (set by "Add Content" button)
      try {
        const stored = sessionStorage.getItem("contentFormUnitId");
        if (stored) {
          targetId = Number(stored);
          sessionStorage.removeItem("contentFormUnitId");
        }
      } catch (e) {
        // ignore storage access errors
      }
      
      // If no sessionStorage ID, use defaultUnitId
      if (!targetId && defaultUnitId !== undefined && defaultUnitId !== null) {
        const found = allUnits.find((u: any) => u.id === defaultUnitId);
        targetId = found ? defaultUnitId : null;
      }
      
      // If we have a target ID, use it; otherwise fall back to first unit with lessons
      if (targetId) {
        setUnitId(targetId);
      } else {
        const withLessons = allUnits.find((u: any) => Array.isArray(u.lessons) && u.lessons.length > 0);
        setUnitId(withLessons ? withLessons.id : allUnits[0].id);
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
      const getNextOrderIndex = (uId: number | null) => {
        try {
          if (!uId) return 0;
          const unit = allUnits.find((uu: any) => uu.id === uId);
          if (!unit) return 0;
          const lessons = Array.isArray(unit.lessons) ? unit.lessons : [];
          const max = lessons.reduce((m: number, l: any) => Math.max(m, (l.orderIndex ?? 0)), -1);
          return max + 1;
        } catch (e) {
          return 0;
        }
      };
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
      } else if (format === "dialogue") {
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
      } else {
        // Question
        const questionPayload: any = {
          id: -(Date.now()),
          questionType: questionType === "MCQ" ? "MCQ" : "SHORT_ANSWER",
          prompt: qPrompt.trim(),
          explanation: null,
          choices: [],
          acceptedAnswers: [],
          shuffledRights: [],
        };

        if (questionType === "MCQ") {
          questionPayload.choices = qChoices.map((c, i) => ({ id: c.id, text: c.text, isCorrect: !!c.isCorrect, orderIndex: i }));
        }

        if (questionType === "SHORT_ANSWER") {
          const list = qAcceptedAnswers.split(",").map((s) => s.trim()).filter(Boolean);
          questionPayload.acceptedAnswers = list.length ? list : [qPrompt.trim()];
        }

        stepsPayload = [
          {
            orderIndex: 0,
            stepType: "QUESTION",
            vocab: null,
            dialogueText: null,
            question: questionPayload,
            payload: null,
          },
        ];
      }

      let titleVal: string;
      let descriptionVal: string;
      if (format === "definition") {
        titleVal = term.trim() || "Learn";
        descriptionVal = defText.trim() || term.trim();
      } else if (format === "dialogue") {
        titleVal = dialogueText.trim().split("\n")[0] || "Dialogue";
        descriptionVal = dialogueText.trim().split("\n").slice(0, 2).join(" ") || "Dialogue example";
      } else {
        // question
        titleVal = qPrompt.trim() || "Question";
        descriptionVal = (qPrompt.trim().split("\n").slice(0, 2).join(" ") || "Question prompt");
      }

      // Basic client-side validation to avoid server-side 400s
      if (!unitId) {
        setError("Please select a Unit before submitting.");
        setLoading(false);
        return;
      }
      if (!titleVal || !titleVal.trim()) {
        setError("Lesson title is required.");
        setLoading(false);
        return;
      }
      if (!descriptionVal || !descriptionVal.trim()) {
        setError("Lesson description is required.");
        setLoading(false);
        return;
      }

      // HANDLE APPENDED UNITS (stored in localStorage with negative IDs)
      if (unitId < 0) {
        // For appended units, we must have a target subunit selected
        if (!subunitId) {
          setError("Please select a specific lesson (subunit) to add content to.");
          setLoading(false);
          return;
        }
        try {
          // Get current user info to include in submission
          const me = await getMe();
          const submittedByUser = me?.displayName ?? me?.email ?? "Unknown";
          
          // Get the selected subunit's title
          const selectedUnit = allUnits.find((u: any) => u.id === unitId);
          let subunitTitle: string | null = null;
          if (selectedUnit && Array.isArray(selectedUnit.lessons) && subunitId) {
            const selectedSubunit = selectedUnit.lessons.find((l: any) => l.id === subunitId);
            if (selectedSubunit) {
              subunitTitle = selectedSubunit.title;
            }
          }
          
          // Create a lesson object with a negative ID
          const lessonId = -(Date.now());
          const newLesson = {
            id: lessonId,
            unitId: unitId,
            title: titleVal,
            slug: `lesson-${lessonId}`,
            description: descriptionVal,
            learningObjective: null,
            estimatedMinutes: null,
            orderIndex: 0,
            status: "DRAFT",
            submittedBy: submittedByUser,
            subunitId: subunitId,
            subunitTitle: subunitTitle,
          };

          // Build steps array (similar to backend step creation)
          const stepsToStore: any[] = [];

          if (format === "definition") {
            // For definitions, store vocab inline in the TEACH step
            stepsToStore.push({
              id: lessonId,
              orderIndex: 0,
              stepType: "TEACH",
              vocabItemId: null,
              vocab: { 
                term: term.trim(), 
                definition: defText.trim(), 
                exampleSentence: example.trim() || null,
                partOfSpeech: null 
              },
              question: null,
              dialogueText: null,
              payload: null,
            });
          } else if (format === "dialogue") {
            stepsToStore.push({
              id: lessonId,
              orderIndex: 0,
              stepType: "DIALOGUE",
              vocabItemId: null,
              vocab: null,
              question: null,
              dialogueText: dialogueText.trim(),
              payload: null,
            });
          } else if (format === "question") {
            stepsToStore.push({
              id: lessonId,
              orderIndex: 0,
              stepType: "QUESTION",
              vocabItemId: null,
              vocab: null,
              question: {
                questionType: questionType,
                prompt: qPrompt.trim(),
                choices: qChoices,
                acceptedAnswers: qAcceptedAnswers,
                allowMultiple: qAllowMultiple,
              },
              dialogueText: null,
              payload: null,
            });
          }

          // Retrieve the tempUnit entry from localStorage and add lesson/steps
          // Find the unit object to get its tempKey (appended units have separate tempKey)
          const unit = allUnits?.find((u: any) => u.id === unitId);
          if (!unit) {
            setError("Could not find the selected unit. Please try again.");
            setLoading(false);
            return;
          }

          // Appended units store with key tempUnit:<tempKey>, not tempUnit:<unitId>
          const tempKey = unit.tempKey || String(unitId);
          const raw = localStorage.getItem(`tempUnit:${tempKey}`);
          if (!raw) {
            setError("Could not find appended unit in storage. Please try again.");
            setLoading(false);
            return;
          }

          const tempUnit = JSON.parse(raw);
          tempUnit.lessons = tempUnit.lessons || [];
          tempUnit.steps = tempUnit.steps || [];
          tempUnit.lessons.push(newLesson);
          tempUnit.steps.push(...stepsToStore);

          localStorage.setItem(`tempUnit:${tempKey}`, JSON.stringify(tempUnit));

          // Update UI and show success
          setSuccess("Lesson submitted — it will appear after review.");
          setError(null);
          setTerm("");
          setDefText("");
          setExample("");
          setDialogueText("");
          setQPrompt("");
          setQuestionType("SHORT_ANSWER");
          setQChoices([{ id: Date.now(), text: "", isCorrect: false }]);
          setQAcceptedAnswers("");
          setQAllowMultiple(false);

          // Trigger refresh in parent component (lesson.$lessonId.tsx)
          if (setTempRefresh) {
            setTempRefresh((v) => v + 1);
          }

          setLoading(false);
          return;
        } catch (err: any) {
          console.error("[LessonForm] appended unit submission error:", err);
          setSuccess(null);
          setError("Failed to submit content to appended unit. Try again.");
          setLoading(false);
          return;
        }
      }

      // HANDLE SERVER UNITS (positive IDs, stored on backend)
      // If this is a simple definition (vocab) submission, create the vocab first
      // then continue to create/attach a TEACH step referencing the vocab item so
      // the lesson flows through the same review pipeline as dialogue/question.
      let createdVocabId: number | null = null;
      if (format === "definition") {
        try {
          const token = await getValidAccessToken();
          if (!token) {
            setError("You must be signed in to submit content. Please sign in and try again.");
            setSuccess(null);
            setLoading(false);
            return;
          }

          // Create a VocabItem via the new vocab API so we can reference it.
          // Some dev setups proxy `/api` via the frontend dev server; when the
          // backend isn't running that proxy returns a Vite 404. If we detect
          // that, retry the request directly against the expected backend
          // port so the developer gets a clearer error.
          try {
            const created = await api.post("vocab", { json: { term: term.trim(), definition: defText.trim(), example: example.trim() || null } }).json<any>();
            createdVocabId = created.id;
          } catch (innerErr: any) {
            // If dev proxy returned a static 404 from the frontend server,
            // try the backend host directly (common local backend port is 8080).
            const status = innerErr?.response?.status;
            let retried = false;
            if (status === 404) {
              try {
                const fallback = await fetch("http://localhost:8080/api/vocab", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ term: term.trim(), definition: defText.trim(), example: example.trim() || null }),
                });
                if (!fallback.ok) {
                  const txt = await fallback.text().catch(() => null);
                  throw new Error(`Fallback vocab creation failed (${fallback.status}): ${txt ?? fallback.statusText}`);
                }
                const created = await fallback.json();
                createdVocabId = created.id;
                retried = true;
              } catch (fallbackErr) {
                // continue to outer catch
                console.error("[LessonForm] fallback create vocab error:", fallbackErr);
              }
            }
            if (!retried) throw innerErr;
          }
        } catch (err: any) {
          console.error("[LessonForm] create vocab error:", err);
          setSuccess(null);
          let message = "Failed to create vocab definition. Try again.";
          try {
            if (err?.response) {
              const res = err.response;
              let body: any = null;
              try {
                body = await res.json();
              } catch (e) {
                try { body = await res.text(); } catch (e2) { body = null; }
              }
              const status = res.status;
              const bodyMsg = body && typeof body === "object" ? (body.message ?? JSON.stringify(body)) : body;
              if (status === 403) {
                message = "Submission forbidden — you do not have permission. Please check your account or contact a moderator.";
              } else {
                message = `Failed to create vocab (${status}): ${bodyMsg ?? err?.message ?? "unknown"}`;
              }
            } else if (err?.message) {
              message = err.message;
            }
          } catch (e) {
            console.error("[LessonForm] error while formatting vocab creation error:", e);
          }
          setError(message);
          setLoading(false);
          return;
        }

        // replace the TEACH step payload with a reference to the created vocab id
        stepsPayload = [
          {
            orderIndex: 0,
            stepType: "TEACH",
            vocabItemId: createdVocabId,
          },
        ];
      }

      if (subunitId) {
        // Create a new lesson wrapper for review with targetSubunitId set
        const created = await api.post("lessons", { json: { unitId, title: titleVal, description: descriptionVal, learningObjective: null, estimatedMinutes: null, targetSubunitId: subunitId } }).json<any>();
        const newLessonId = created.id;
        console.log(`[Submission] Created wrapper lesson ${newLessonId} for subunit ${subunitId}`);
        // create step(s) on the new lesson
        for (const st of stepsPayload) {
          const apiStep = mapStepForApi(st);
          await api.post(`lessons/${newLessonId}/steps`, { json: apiStep }).json();
        }
        // submit the new lesson for review
        await api.patch(`lessons/${newLessonId}`, { json: { status: "PENDING_REVIEW" } }).json();
        console.log(`[Submission] Submitted wrapper lesson for review`);
        
        // add the created lesson to the pending cache so Review shows it immediately
        try {
            const selectedSubunitTitle = subunitId
              ? (allUnits?.find((u: any) => u.id === unitId)?.lessons ?? []).find((l: any) => l.id === subunitId)?.title
              : undefined;
            const summary = {
              id: created.id,
              unitId: created.unitId ?? unitId,
              title: created.title ?? titleVal,
              slug: created.slug ?? (created.id ? `lesson-${created.id}` : undefined),
              description: created.description ?? descriptionVal,
              learningObjective: created.learningObjective ?? null,
              estimatedMinutes: created.estimatedMinutes ?? null,
              orderIndex: created.orderIndex ?? 0,
              status: "PENDING_REVIEW",
              subunitTitle: selectedSubunitTitle,
              subunitId: subunitId ?? null,
              firstStepType: stepsPayload && stepsPayload.length > 0 ? stepsPayload[0].stepType : null,
              firstQuestionType: stepsPayload && stepsPayload.length > 0 ? (stepsPayload[0].questionType ?? null) : null,
            };
            queryClient.setQueryData(["lessons", "pending"], (old: any) => {
              if (!old) return [summary];
              return [summary, ...old];
            });
            try {
              const key = "pendingLessonMeta";
              const raw = localStorage.getItem(key);
              const map = raw ? JSON.parse(raw) : {};
              map[created.id] = { subunitTitle: selectedSubunitTitle, subunitId: subunitId ?? null, firstStepType: summary.firstStepType, firstQuestionType: summary.firstQuestionType, firstStepPrompt: (stepsPayload && stepsPayload.length > 0 && stepsPayload[0].question && stepsPayload[0].question.prompt) ? stepsPayload[0].question.prompt : null };
              localStorage.setItem(key, JSON.stringify(map));
            } catch (e) {
              // ignore storage failures
            }
          } catch (e) {
            // ignore cache failures
          }
      } else {
        // create a new lesson draft and attach steps
        const created = await api.post("lessons", { json: { unitId, title: titleVal, description: descriptionVal, learningObjective: null, estimatedMinutes: null, targetSubunitId: subunitId } }).json<any>();
        const lessonId = created.id;
        for (const st of stepsPayload) {
          const apiStep = mapStepForApi(st);
          await api.post(`lessons/${lessonId}/steps`, { json: apiStep }).json();
        }
        // submit the lesson for review
        await api.patch(`lessons/${lessonId}`, { json: { status: "PENDING_REVIEW" } }).json();
        // add to pending cache so Review shows it
          try {
            const selectedSubunitTitle = subunitId
              ? (allUnits?.find((u: any) => u.id === unitId)?.lessons ?? []).find((l: any) => l.id === subunitId)?.title
              : undefined;
            const summary = {
              id: created.id,
              unitId: created.unitId ?? unitId,
              title: created.title ?? titleVal,
              slug: created.slug ?? (created.id ? `lesson-${created.id}` : undefined),
              description: created.description ?? descriptionVal,
              learningObjective: created.learningObjective ?? null,
              estimatedMinutes: created.estimatedMinutes ?? null,
              orderIndex: created.orderIndex ?? 0,
              status: "PENDING_REVIEW",
              subunitTitle: selectedSubunitTitle,
              subunitId: subunitId ?? null,
            };
          queryClient.setQueryData(["lessons", "pending"], (old: any) => {
            if (!old) return [summary];
            return [summary, ...old];
          });
          try {
            const key = "pendingLessonMeta";
            const raw = localStorage.getItem(key);
            const map = raw ? JSON.parse(raw) : {};
            map[created.id] = { subunitTitle: selectedSubunitTitle, subunitId: subunitId ?? null, firstStepType: stepsPayload && stepsPayload.length > 0 ? stepsPayload[0].stepType : null, firstQuestionType: stepsPayload && stepsPayload.length > 0 ? (stepsPayload[0].questionType ?? null) : null, firstStepPrompt: (stepsPayload && stepsPayload.length > 0 && stepsPayload[0].question && stepsPayload[0].question.prompt) ? stepsPayload[0].question.prompt : null };
            localStorage.setItem(key, JSON.stringify(map));
          } catch (e) {
            // ignore
          }
        } catch (e) {
          // ignore
        }
      }
      setSuccess("Lesson submitted — it will appear after review.");
      // navigate to Review to let the user see the pending item (delay so success message is visible)
        setTimeout(() => {
          try { sessionStorage.setItem("reviewActiveSub", "lesson"); } catch (e) {}
          navigate("/review");
        }, 800);
      setTerm("");
      setDefText("");
      setExample("");
      setDialogueText("");
      // reset question fields
      setQuestionType("SHORT_ANSWER");
      setQPrompt("");
      setQChoices([{ id: Date.now(), text: "", isCorrect: false }]);
      setQAcceptedAnswers("");
      setQAllowMultiple(false);
    } catch (err: any) {
      console.error(err);
      setSuccess(null);
      let message = "Failed to submit lesson. Try again.";
      try {
        if (err?.response) {
          const res = err.response;
          let body: any = null;
          try {
            body = await res.json();
          } catch (e) {
            try {
              body = await res.text();
            } catch (e2) {
              body = null;
            }
          }
          const status = res.status;
          const bodyMsg = body && typeof body === "object" ? (body.message ?? body.detail ?? JSON.stringify(body)) : body;
          const lc = String(bodyMsg ?? "").toLowerCase();
          // If DB or server indicated a duplicate lesson/slug, show a simple friendly message
          if (status === 400 && (lc.includes("already exists") && (lc.includes("lesson") || lc.includes("slug") || lc.includes("lessons")) || lc.includes("[lesson]"))) {
            message = "Failed to submit: Lesson name already exists!";
          } else {
            message = `Failed to submit lesson (${status}): ${bodyMsg ?? err?.message ?? "unknown"}`;
          }
        } else if (err?.message) {
          message = err.message;
        }
      } catch (e) {
        // ignore
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Convert internal step payload shape into the server StepWriteRequest shape
  function mapStepForApi(st: any) {
    const base: any = {
      orderIndex: st.orderIndex ?? 0,
      stepType: st.stepType,
    };
    if (st.stepType === "TEACH") {
      if (st.vocabItemId) {
        base.vocabItemId = st.vocabItemId;
      } else if (st.vocab && st.vocab.term) {
        // fallback: client created TEACH with inline vocab (should not happen here)
        base.vocabItemId = null;
      }
    } else if (st.stepType === "DIALOGUE") {
      base.dialogueText = st.dialogueText ?? null;
    } else if (st.stepType === "QUESTION") {
      const q = st.question ?? {};
      base.questionType = q.questionType ?? null;
      base.prompt = q.prompt ?? null;
      base.explanation = q.explanation ?? null;
      if (q.choices && Array.isArray(q.choices) && q.choices.length > 0) {
        base.options = q.choices.map((c: any) => c.text ?? "");
        const correctIndex = q.choices.findIndex((c: any) => !!c.isCorrect);
        base.correctOptionIndex = correctIndex >= 0 ? correctIndex : null;
      }
      if (q.acceptedAnswers && Array.isArray(q.acceptedAnswers)) {
        base.acceptedAnswers = q.acceptedAnswers;
      }
    }
    return base;
  }

  return (
    <form onSubmit={handleSubmitLesson} className="space-y-4">
        <div className="flex gap-3">
        <button type="button" className={format === "definition" ? "px-3 py-1 rounded bg-primary text-white" : "px-3 py-1 rounded border"} onClick={() => setFormat("definition")}>Learn</button>
        <button type="button" className={format === "dialogue" ? "px-3 py-1 rounded bg-primary text-white" : "px-3 py-1 rounded border"} onClick={() => setFormat("dialogue")}>Dialogue</button>
        <button type="button" className={format === "question" ? "px-3 py-1 rounded bg-primary text-white" : "px-3 py-1 rounded border"} onClick={() => setFormat("question")}>Question</button>
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
          {(() => {
            const unit = allUnits.find((u: any) => u.id === unitId);
            const selectedLesson = unit?.lessons?.find((l: any) => l.id === subunitId);
            const displayTitle = selectedLesson?.title ?? (subunitId ? `Subunit ${subunitId}` : "---");
            
            return (
              <div className="relative">
                <div className="mt-1 w-full rounded-md border bg-card px-3 py-2 text-foreground pointer-events-none">
                  {displayTitle}
                </div>
                <select
                  id="lesson-subunit"
                  name="subunitId"
                  value={subunitId ?? ""}
                  onChange={(e) => setSubunitId(e.target.value ? Number(e.target.value) : null)}
                  className="absolute inset-0 w-full rounded-md border bg-card px-3 py-2 opacity-0 cursor-pointer"
                >
                  {(() => {
                    const unit = allUnits.find((u: any) => u.id === unitId);
                    let lessons = (unit && Array.isArray(unit.lessons)) ? unit.lessons : [];
                    
                    // For server units (positive IDs), also merge in any placeholder subunits from localStorage
                    if (unitId && unitId > 0) {
                      try {
                        for (let i = 0; i < localStorage.length; i++) {
                          const key = localStorage.key(i) || "";
                          if (!key.startsWith("tempPlaceholderUnit:")) continue;
                          const raw = localStorage.getItem(key);
                          if (!raw) continue;
                          const parsed = JSON.parse(raw);
                          if (parsed.originalUnitId === unitId) {
                            lessons = [...lessons, parsed];
                          }
                        }
                      } catch (e) {
                        // ignore storage errors
                      }
                    }
                    
                    const isTempUnit = unit && (typeof unit.id === "number" && unit.id < 0 || (unit.slug && String(unit.slug).startsWith("temp-")));
                    if (isTempUnit) {
                      // For temp units, show appended lessons except known placeholders
                      const isPlaceholderLesson = (l: any) => {
                        if (!l) return false;
                        const t = String(l.title ?? "");
                        const s = String(l.slug ?? "");
                        return t.startsWith("Placeholder Lesson") || s.startsWith("placeholder-") || t === "Coming soon" || s.startsWith("pending-") || !!l.__placeholder;
                      };
                      lessons = (lessons ?? []).filter((l: any) => !isPlaceholderLesson(l));
                    }

                    // If submitting a definition and the term matches a lesson title, hide that lesson from the subunit list
                    const filtered = (format === "definition" && term.trim().length > 0)
                      ? lessons.filter((l: any) => (l.title ?? "").trim() !== term.trim())
                      : lessons;
                    
                    // Only show approved lessons as subunits — pending/other-status lessons should not be selectable
                    // However, for client-side appended 'temp' units we want to allow their lessons to appear
                    // (they may be drafts created in this session). Use `isTempUnit` to relax the status check.
                    const seenIds = new Set<number>();
                    const visible = (filtered ?? []).filter((l: any) => {
                      if (!l) return false;
                      // keep placeholder-lessons out
                      if (l.__placeholder) return false;
                      // don't include the unit itself if it somehow got into the list
                      if (l.id === unitId) return false;
                      // avoid duplicate lessons
                      if (seenIds.has(l.id)) return false;
                      seenIds.add(l.id);
                      // Hide wrapper lessons (those with targetSubunitId set) - they're only for review
                      if (l.targetSubunitId) return false;
                      // if this is NOT a temp unit, enforce APPROVED status; otherwise allow drafts
                      if (!isTempUnit && typeof l.status === "string" && l.status !== "APPROVED") return false;
                      return true;
                    });
                    return visible.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>);
                  })()}
                </select>
              </div>
            );
          })()}
        </div>
      ) : null}

      {format === "definition" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="lesson-term">Term</Label>
            <Input id="lesson-term" name="term" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="lesson-definition">Learn</Label>
            <textarea id="lesson-definition" name="definition" value={defText} onChange={(e) => setDefText(e.target.value)} className="mt-1 w-full rounded-md border bg-card px-3 py-2" rows={3} />
          </div>
          <div>
            <Label htmlFor="lesson-example">Example (optional)</Label>
            <Input id="lesson-example" name="example" value={example} onChange={(e) => setExample(e.target.value)} />
          </div>
        </div>
      ) : (
        format === "dialogue" ? (
          <div>
            <Label htmlFor="lesson-dialogue">Dialogue Text</Label>
            <textarea id="lesson-dialogue" name="dialogueText" value={dialogueText} onChange={(e) => setDialogueText(e.target.value)} className="mt-1 w-full rounded-md border bg-card px-3 py-2" rows={6} placeholder={"A: ...\nB: ..."} />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Question Type</Label>
              <div className="flex gap-2 mt-2">
                <button type="button" className={questionType === "SHORT_ANSWER" ? "px-3 py-1 rounded bg-primary text-white" : "px-3 py-1 rounded border"} onClick={() => setQuestionType("SHORT_ANSWER")}>Short Answer</button>
                <button type="button" className={questionType === "MCQ" ? "px-3 py-1 rounded bg-primary text-white" : "px-3 py-1 rounded border"} onClick={() => setQuestionType("MCQ")}>MCQ</button>
              </div>
            </div>

            <div>
              <Label htmlFor="q-prompt">Prompt</Label>
              <Input id="q-prompt" value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} />
            </div>

            {questionType === "SHORT_ANSWER" && (
              <div>
                <Label htmlFor="q-accepted">Accepted answers (comma-separated)</Label>
                <Input id="q-accepted" value={qAcceptedAnswers} onChange={(e) => setQAcceptedAnswers(e.target.value)} placeholder="answer1, answer2" />
              </div>
            )}

            {questionType === "MCQ" && (
              <div>
                <Label>Choices</Label>
                <div className="mt-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={qAllowMultiple} onChange={(e) => setQAllowMultiple(e.target.checked)} />
                    <span className="text-sm">Allow multiple correct answers</span>
                  </label>
                </div>
                <div className="space-y-2 mt-2">
                  {qChoices.map((c, idx) => (
                    <div key={c.id} className="flex gap-2 items-center">
                      {qAllowMultiple ? (
                        <input type="checkbox" checked={!!c.isCorrect} onChange={(e) => setQChoices((s) => s.map((cc) => cc.id === c.id ? { ...cc, isCorrect: e.target.checked } : cc))} />
                      ) : (
                        <input type="radio" name={`mcq-correct-${String(unitId ?? "unit")}`} checked={!!c.isCorrect} onChange={() => setQChoices((s) => s.map((cc) => ({ ...cc, isCorrect: cc.id === c.id })))} />
                      )}
                      <Input value={c.text} onChange={(e) => setQChoices((s) => s.map((cc) => cc.id === c.id ? { ...cc, text: e.target.value } : cc))} />
                      <button type="button" onClick={() => setQChoices((s) => s.filter((cc) => cc.id !== c.id))} className="text-destructive">Remove</button>
                    </div>
                  ))}
                  <Button type="button" onClick={() => setQChoices((s) => [...s, { id: Date.now(), text: "", isCorrect: false }])}>Add Choice</Button>
                </div>
              </div>
            )}

            
          </div>
        )
      )}

      <div className="flex justify-end">
        <div className="flex flex-col items-end">
          {success && <p className="text-sm text-green-600 mb-2">{success}</p>}
          {error && <p className="text-sm text-destructive mb-2">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Lesson"}</Button>
        </div>
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
