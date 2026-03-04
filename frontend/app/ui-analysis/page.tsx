"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { createEvaluation, getPersonas } from "@/lib/api";
import { Evaluation, Persona } from "@/lib/types";

export default function UiAnalysisPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [primaryPersonaId, setPrimaryPersonaId] = useState<string>("");
  const [comparePersonaId, setComparePersonaId] = useState<string>("");
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPersonas()
      .then(setPersonas)
      .catch((err: Error) => setError(err.message));
  }, []);

  const primaryPersonaOptions = useMemo(
    () => personas.map((p) => ({ value: String(p.id), label: p.name })),
    [personas]
  );

  const comparePersonaOptions = useMemo(
    () =>
      personas
        .filter((p) => String(p.id) !== primaryPersonaId)
        .map((p) => ({ value: String(p.id), label: p.name })),
    [personas, primaryPersonaId]
  );

  function onPrimaryPersonaChange(value: string) {
    setPrimaryPersonaId(value);
    if (comparePersonaId === value) setComparePersonaId("");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!imageFile) {
      setError("Please upload an image before requesting feedback.");
      return;
    }
    if (!primaryPersonaId) {
      setError("Please select a primary persona before requesting feedback.");
      return;
    }

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("primary_persona_id", primaryPersonaId);
    if (comparePersonaId) {
      formData.append("compare_persona_id", comparePersonaId);
    }

    setLoading(true);
    try {
      const response = await createEvaluation(formData);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run evaluation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="max-w-3xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">UI Analysis</h2>
        <p className="text-sm text-slate-600">Upload a screenshot and request persona feedback.</p>
        {personas.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">
            No personas found yet. Create one first, then run an evaluation.
          </p>
        )}
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <label className="text-sm font-medium">Upload image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="block w-full text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Primary persona</label>
          <select
            value={primaryPersonaId}
            onChange={(e) => onPrimaryPersonaChange(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select persona</option>
            {primaryPersonaOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Compare persona (optional)</label>
          <select
            value={comparePersonaId}
            onChange={(e) => setComparePersonaId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">No comparison</option>
            {comparePersonaOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || personas.length === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
        >
          {loading ? "Evaluating..." : "Get Feedback"}
        </button>
      </form>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Latest Evaluation</h3>
          {result.frontend_report ? (
            <div
              className="evaluation-report mt-3 text-sm text-slate-700 [&_.persona-comparison]:grid [&_.persona-comparison]:grid-cols-[1fr_2px_1fr] [&_.persona-comparison]:gap-0 [&_.persona-comparison]:my-4 [&_.persona-comparison]:items-stretch [&_.persona-comparison]:w-full [&_.persona-col]:min-w-0 [&_.persona-col]:px-4 [&_.persona-col]:py-3 [&_.persona-col]:align-top [&_.persona-divider]:bg-slate-300 [&_.persona-divider]:self-stretch [&_h1]:text-center [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:text-sm [&_h4]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-inside [&_ul]:list-disc [&_ol]:my-2 [&_ol]:list-inside [&_ol]:list-decimal [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.frontend_report) }}
            />
          ) : (
            <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
