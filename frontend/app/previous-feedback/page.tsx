"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { getEvaluations, getPersonas } from "@/lib/api";
import { clampScore, formatScoreWithMax } from "@/lib/evaluation-score";
import { useProjectContext } from "@/lib/project-context";
import { Evaluation, EvaluationResult, Persona } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";

function isStructuredResult(r: unknown): r is EvaluationResult {
  return (
    typeof r === "object" &&
    r !== null &&
    "summary" in r &&
    typeof (r as EvaluationResult).summary === "string"
  );
}

function sampleUiHtmlFromEvaluation(evaluation: Evaluation): string | null {
  const top = evaluation.sample_ui?.html;
  if (top) return top;
  const rj = evaluation.result_json;
  if (rj && typeof rj === "object" && rj !== null && "sample_ui" in rj) {
    const su = (rj as { sample_ui?: { html?: string } }).sample_ui;
    if (su?.html) return su.html;
  }
  return null;
}

const severityStyle: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600"
};

function ScoreBar({ score }: { score: number }) {
  const ten = clampScore(score);
  const pct = Math.min(100, Math.max(0, (ten / 10) * 100));
  const color = ten >= 7 ? "bg-emerald-500" : ten >= 4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">
        {formatScoreWithMax(score)}
      </span>
    </div>
  );
}

function StructuredResult({ result }: { result: EvaluationResult }) {
  return (
    <div className="space-y-5 text-sm">
      {/* Summary */}
      {result.summary && (
        <p className="leading-relaxed text-slate-700">{result.summary}</p>
      )}

      {/* Score bar */}
      {typeof result.overall_score === "number" && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Overall score (out of 10)</p>
          <ScoreBar score={result.overall_score} />
        </div>
      )}

      {/* Highlights */}
      {result.highlights && result.highlights.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Highlights</p>
          <ul className="space-y-1.5">
            {result.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues */}
      {result.issues && result.issues.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Issues</p>
          <div className="space-y-2">
            {result.issues.map((issue, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-800">{issue.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${severityStyle[issue.severity] ?? "bg-slate-100 text-slate-600"}`}>
                    {issue.severity}
                  </span>
                </div>
                {issue.description && (
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">{issue.description}</p>
                )}
                {issue.category && (
                  <span className="mt-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{issue.category}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations && result.recommendations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendations</p>
          <ol className="space-y-1.5 list-none">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-slate-700">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600 mt-0.5">
                  {i + 1}
                </span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function PreviousFeedbackPage() {
  const { selectedProjectId, selectedProject, loading: projectLoading } = useProjectContext();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useAuthGuard();

  useEffect(() => {
    let cancelled = false;

    if (projectLoading) {
      return () => {
        cancelled = true;
      };
    }
    if (!selectedProjectId) {
      setPersonas([]);
      return () => {
        cancelled = true;
      };
    }

    getPersonas(Number(selectedProjectId))
      .then((rows) => {
        if (!cancelled) {
          setPersonas(rows);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, projectLoading]);

  useEffect(() => {
    let cancelled = false;

    if (projectLoading) {
      return () => {
        cancelled = true;
      };
    }
    if (!selectedProjectId) {
      setEvaluations([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError("");
    getEvaluations({
      personaId: selectedPersonaId ? Number(selectedPersonaId) : undefined,
      projectId: Number(selectedProjectId),
    })
      .then((rows) => {
        if (!cancelled) {
          setEvaluations(rows);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setEvaluations([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPersonaId, selectedProjectId, projectLoading]);

  useEffect(() => {
    setSelectedPersonaId("");
  }, [selectedProjectId]);

  const selectedPersona = personas.find((persona) => String(persona.id) === selectedPersonaId) ?? null;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Previous Feedback</h2>
        <p className="mt-1 text-sm text-slate-500">
          Review all past UI evaluation runs.
          {selectedProject ? ` Current project: ${selectedProject.name}.` : ""}
        </p>
        <div className="mt-5 border-b border-slate-200" />
      </header>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">Filter by persona</p>
          <p className="text-xs text-slate-500">
            {selectedPersona
              ? `Showing evaluations where ${selectedPersona.name} was the primary or comparison persona.`
              : selectedProject
                ? `Showing evaluations in ${selectedProject.name}.`
                : "Showing evaluations across all personas."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:min-w-72">
          <label htmlFor="persona-filter" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Persona
          </label>
          <select
            id="persona-filter"
            value={selectedPersonaId}
            onChange={(event) => setSelectedPersonaId(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          >
            <option value="">All personas</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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

      {!projectLoading && !loading && !error && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>
            {evaluations.length} evaluation{evaluations.length === 1 ? "" : "s"}
          </span>
          {selectedPersona && (
            <button
              type="button"
              onClick={() => setSelectedPersonaId("")}
              className="rounded-md px-2.5 py-1 font-medium text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {projectLoading || loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-16 text-sm text-slate-400 shadow-sm">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {projectLoading ? "Loading project…" : "Loading evaluations…"}
        </div>
      ) : null}

      {!projectLoading && !loading && evaluations.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="9" y1="16" x2="12" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">
              {selectedPersona ? "No evaluations match this persona" : "No evaluations yet"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {selectedPersona
                ? "Try another persona or clear the filter to see all results."
                : selectedProject
                  ? `Run a UI analysis in ${selectedProject.name} to see results here.`
                  : "Run a UI analysis to see results here."}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {!projectLoading && !loading && evaluations.map((evaluation) => {
          const frontendReport = evaluation.frontend_report;
          const structured = isStructuredResult(evaluation.result_json) ? evaluation.result_json : null;
          const sampleHtml = sampleUiHtmlFromEvaluation(evaluation);

          return (
            <article key={evaluation.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow ring-1 ring-black/5">
              {/* Card header */}
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">Evaluation #{evaluation.id}</h3>
                <span className={[
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  evaluation.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                ].join(" ")}>
                  {evaluation.status}
                </span>
                {evaluation.overall_score !== null && (
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-indigo-700">
                    Score: {formatScoreWithMax(evaluation.overall_score)}
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {evaluation.project_name}
                </span>
                <span className="ml-auto text-xs text-slate-400">
                  {new Date(evaluation.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
                <span>
                  <span className="font-medium text-slate-700">Primary:</span>{" "}
                  {evaluation.primary_persona_name}
                </span>
                {evaluation.compare_persona_id && (
                  <span>
                    <span className="font-medium text-slate-700">Compare:</span>{" "}
                    {evaluation.compare_persona_name ?? `#${evaluation.compare_persona_id}`}
                  </span>
                )}
              </div>

              {/* Result body */}
              <div className="px-5 py-4">
                {evaluation.error_message && (
                  <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {evaluation.error_message}
                  </div>
                )}

                <div className="space-y-6">
                  {sampleHtml ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sample UI</p>
                      <div
                        className="max-h-[min(70vh,720px)] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 shadow-inner
                          [&_.sample-ui-mock]:min-h-[120px]"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sampleHtml) }}
                      />
                    </div>
                  ) : null}
                  {frontendReport ? (
                    <div>
                      {sampleHtml ? (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback</p>
                      ) : null}
                      <div
                        className="evaluation-report text-sm text-slate-700
                      [&_.persona-comparison]:grid [&_.persona-comparison]:grid-cols-[1fr_2px_1fr] [&_.persona-comparison]:gap-0 [&_.persona-comparison]:my-4 [&_.persona-comparison]:items-stretch
                      [&_.persona-col]:min-w-0 [&_.persona-col]:px-4 [&_.persona-col]:py-3
                      [&_.persona-divider]:bg-slate-200 [&_.persona-divider]:self-stretch
                      [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-3
                      [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-800
                      [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-700
                      [&_p]:my-2 [&_p]:leading-relaxed
                      [&_ul]:my-2 [&_ul]:list-inside [&_ul]:list-disc [&_ul]:space-y-1
                      [&_ol]:my-2 [&_ol]:list-inside [&_ol]:list-decimal [&_ol]:space-y-1
                      [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(frontendReport) }}
                      />
                    </div>
                  ) : structured ? (
                    <div>
                      {sampleHtml ? (
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Feedback</p>
                      ) : null}
                      <StructuredResult result={structured} />
                    </div>
                  ) : !sampleHtml ? (
                    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
                      {JSON.stringify(evaluation.result_json, null, 2)}
                    </pre>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
