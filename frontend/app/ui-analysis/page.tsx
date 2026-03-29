"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { createEvaluation, getPersonas } from "@/lib/api";
import { Evaluation, Persona } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";

export default function UiAnalysisPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [primaryPersonaId, setPrimaryPersonaId] = useState<string>("");
  const [comparePersonaId, setComparePersonaId] = useState<string>("");
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useAuthGuard();

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

  function onFileChange(file: File | null) {
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
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
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">UI Analysis</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload a screenshot and get persona-based feedback on your interface.
        </p>
        <div className="mt-5 border-b border-slate-200" />
        {personas.length === 0 && !error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            No personas found. Create one in the Personas tab first.
          </div>
        )}
      </header>

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow ring-1 ring-black/5 space-y-5">

        {/* File upload zone */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Screenshot</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith("image/")) onFileChange(file);
            }}
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-200 p-6 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40"
          >
            {imagePreview ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 max-w-full rounded-lg object-contain shadow-sm"
                />
                <p className="text-xs text-slate-500">{imageFile?.name}</p>
                <span className="text-xs font-medium text-indigo-600 hover:underline">Click to change</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-400">PNG, JPG, WebP</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </div>

        {/* Persona selects */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Primary persona</label>
            <select
              value={primaryPersonaId}
              onChange={(e) => onPrimaryPersonaChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="">Select a persona…</option>
              {primaryPersonaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Compare persona
              <span className="ml-1 font-normal text-slate-400">(optional)</span>
            </label>
            <select
              value={comparePersonaId}
              onChange={(e) => setComparePersonaId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            >
              <option value="">No comparison</option>
              {comparePersonaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || personas.length === 0}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 outline-none"
        >
          {loading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Evaluating…
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Get Feedback
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white shadow ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="font-semibold text-slate-900">Evaluation Result</h3>
            <div className="flex items-center gap-2">
              <span className={[
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                result.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              ].join(" ")}>
                {result.status}
              </span>
              {result.overall_score !== null && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  Score: {result.overall_score.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <div className="p-6">
            {result.frontend_report ? (
              <div
                className="evaluation-report text-sm text-slate-700
                  [&_.persona-comparison]:grid [&_.persona-comparison]:grid-cols-[1fr_2px_1fr] [&_.persona-comparison]:gap-0 [&_.persona-comparison]:my-4 [&_.persona-comparison]:items-stretch [&_.persona-comparison]:w-full
                  [&_.persona-col]:min-w-0 [&_.persona-col]:px-4 [&_.persona-col]:py-3
                  [&_.persona-divider]:bg-slate-200 [&_.persona-divider]:self-stretch
                  [&_h1]:text-center [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-4
                  [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-800
                  [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-700
                  [&_h4]:mt-3 [&_h4]:text-sm [&_h4]:font-medium [&_h4]:text-slate-700
                  [&_p]:my-2 [&_p]:leading-relaxed
                  [&_ul]:my-2 [&_ul]:list-inside [&_ul]:list-disc [&_ul]:space-y-1
                  [&_ol]:my-2 [&_ol]:list-inside [&_ol]:list-decimal [&_ol]:space-y-1
                  [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.frontend_report) }}
              />
            ) : (
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
