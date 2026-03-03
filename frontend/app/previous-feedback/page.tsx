"use client";

import { useEffect, useState } from "react";
import { getEvaluations } from "@/lib/api";
import { Evaluation } from "@/lib/types";

export default function PreviousFeedbackPage() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getEvaluations()
      .then(setEvaluations)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <section className="max-w-5xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Previous Feedback</h2>
        <p className="text-sm text-slate-600">Review prior evaluation runs.</p>
      </header>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        {evaluations.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            No evaluations yet.
          </div>
        )}
        {evaluations.map((evaluation) => (
          <article key={evaluation.id} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-semibold text-slate-900">Evaluation #{evaluation.id}</h3>
              <span
                className={[
                  "rounded-full px-2 py-1 text-xs font-semibold",
                  evaluation.status === "succeeded"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                ].join(" ")}
              >
                {evaluation.status}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                Score: {evaluation.overall_score !== null ? evaluation.overall_score.toFixed(2) : "N/A"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Primary persona: {evaluation.primary_persona_name} (#{evaluation.primary_persona_id})
              {evaluation.compare_persona_id
                ? ` | Compare persona: ${evaluation.compare_persona_name || "Unknown"} (#${evaluation.compare_persona_id})`
                : ""}
            </p>
            <p className="mt-1 text-xs text-slate-500">{new Date(evaluation.created_at).toLocaleString()}</p>
            {evaluation.error_message && (
              <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {evaluation.error_message}
              </p>
            )}
            <pre className="mt-3 overflow-x-auto rounded bg-slate-900 p-4 text-xs text-slate-100">
              {JSON.stringify(evaluation.result_json, null, 2)}
            </pre>
          </article>
        ))}
      </div>
    </section>
  );
}
