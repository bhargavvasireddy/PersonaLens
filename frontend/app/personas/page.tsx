"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPersona, getPersonas } from "@/lib/api";
import { Persona } from "@/lib/types";

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPersonas()
      .then(setPersonas)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function onCreatePersona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError("Persona name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPersona({ name: trimmedName, description: description.trim() });
      setPersonas((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      setShowModal(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unable to create persona.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="max-w-4xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Personas</h2>
          <p className="text-sm text-slate-600">Browse and manage personas used for evaluations.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add Persona
        </button>
      </header>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {personas.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No personas yet.
                </td>
              </tr>
            )}
            {personas.map((persona) => (
              <tr key={persona.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{persona.name}</td>
                <td className="px-4 py-3 text-slate-700">{persona.description || "-"}</td>
                <td className="px-4 py-3 text-slate-700">
                  {new Date(persona.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Add Persona</h3>
            <form onSubmit={onCreatePersona} className="mt-4 space-y-4">
              <div className="space-y-1">
                <label htmlFor="persona-name" className="text-sm font-medium text-slate-700">
                  Name
                </label>
                <input
                  id="persona-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. Busy Student"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="persona-description" className="text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  id="persona-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Add persona goals, constraints, and context."
                />
              </div>
              {submitError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError("");
                    setShowModal(false);
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
                >
                  {submitting ? "Saving..." : "Save Persona"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
