"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPersona, deletePersona, getEvaluations, getPersonas, updatePersona } from "@/lib/api";
import { Persona } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";

type PersonaTemplate = {
  id: string;
  name: string;
  description: string;
};

const personaTemplates: PersonaTemplate[] = [
  {
    id: "accessibility-advocate",
    name: "Accessibility Advocate",
    description:
      "Values readable text, clear labels, strong contrast, keyboard accessibility, and inclusive design.",
  },
  {
    id: "first-time-user",
    name: "First-Time User",
    description:
      "Has never used the interface before and needs clear guidance, simple navigation, and obvious next steps.",
  },
  {
    id: "impatient-user",
    name: "Impatient User",
    description:
      "Wants to complete tasks quickly with minimal friction, few clicks, and immediate feedback.",
  },
  {
    id: "elderly-user",
    name: "Elderly User",
    description:
      "Benefits from larger text, straightforward instructions, uncluttered layouts, and easy-to-understand flows.",
  },
  {
    id: "power-user",
    name: "Power User",
    description:
      "Experienced and efficiency-focused, prefers fast workflows, fewer interruptions, and advanced control.",
  },
];

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Persona | null>(null);
  const [deleteEvalCount, setDeleteEvalCount] = useState<number | null>(null);
  const [deleteCountLoading, setDeleteCountLoading] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useAuthGuard();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPersonas()
      .then(setPersonas)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!editingPersona) {
      return;
    }
    setName(editingPersona.name);
    setDescription(editingPersona.description);
    setSelectedTemplateId("");
  }, [editingPersona]);

  useEffect(() => {
    if (!deleteTarget) {
      setDeleteEvalCount(null);
      setDeleteError("");
      return;
    }
    let cancelled = false;
    setDeleteCountLoading(true);
    setDeleteEvalCount(null);
    getEvaluations()
      .then((evaluations) => {
        if (cancelled) {
          return;
        }
        const n = evaluations.filter(
          (e) => e.primary_persona_id === deleteTarget.id || e.compare_persona_id === deleteTarget.id
        ).length;
        setDeleteEvalCount(n);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setDeleteError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDeleteCountLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deleteTarget]);

  function applyTemplate(templateId: string) {
    const template = personaTemplates.find((p) => p.id === templateId);
    if (!template) {
      return;
    }

    setName(template.name);
    setDescription(template.description);
  }

  async function onSubmitPersona(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError("Persona name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = { name: trimmedName, description: description.trim() };
      if (editingPersona) {
        const updated = await updatePersona(editingPersona.id, payload);
        setPersonas((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setEditingPersona(null);
      } else {
        const created = await createPersona(payload);
        setPersonas((prev) => [created, ...prev]);
        setShowModal(false);
      }
      setName("");
      setDescription("");
      setSelectedTemplateId("");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : editingPersona ? "Unable to save persona." : "Unable to create persona."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function closeModal() {
    setSubmitError("");
    setName("");
    setDescription("");
    setSelectedTemplateId("");
    setShowModal(false);
    setEditingPersona(null);
  }

  async function onConfirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setDeleteError("");
    setDeleteSubmitting(true);
    try {
      await deletePersona(deleteTarget.id);
      setPersonas((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unable to delete persona.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Personas</h2>
          <p className="mt-1 text-sm text-slate-500">Create and manage the personas used for UI evaluations.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingPersona(null);
            setName("");
            setDescription("");
            setSelectedTemplateId("");
            setSubmitError("");
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Persona
        </button>
        <div className="mt-5 border-b border-slate-200" />
      </header>

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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow ring-1 ring-black/5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading personas…
          </div>
        ) : personas.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">No personas yet</p>
              <p className="mt-0.5 text-xs text-slate-400">Add your first persona to start running evaluations.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingPersona(null);
                setName("");
                setDescription("");
                setSelectedTemplateId("");
                setSubmitError("");
                setShowModal(true);
              }}
              className="mt-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Add persona
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {personas.map((persona) => (
                <tr key={persona.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{persona.name}</td>
                  <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                    {persona.description || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-400">
                    {new Date(persona.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          setSelectedTemplateId("");
                          setEditingPersona(persona);
                        }}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(persona)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(showModal || editingPersona) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {editingPersona ? "Edit Persona" : "Add Persona"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={onSubmitPersona} className="space-y-4">
              {!editingPersona && (
                <div>
                  <label htmlFor="persona-template" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Starter template
                    <span className="ml-1 font-normal text-slate-400">(optional)</span>
                  </label>
                  <select
                    id="persona-template"
                    value={selectedTemplateId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedTemplateId(value);
                      applyTemplate(value);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="">Choose a starter persona</option>
                    {personaTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="persona-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="persona-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  placeholder="e.g. Busy College Student"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="persona-description" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                  <span className="ml-1 font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="persona-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                  placeholder="Goals, context, constraints, tech comfort level…"
                />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 outline-none"
                >
                  {submitting ? "Saving…" : editingPersona ? "Save changes" : "Save Persona"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteSubmitting) {
              setDeleteTarget(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete persona?</h3>
            <p className="mt-3 text-sm text-slate-600">
              You are about to remove <span className="font-semibold text-slate-800">{deleteTarget.name}</span>. This cannot be undone.
            </p>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
              {deleteCountLoading ? (
                <span className="text-amber-900/80">Checking linked evaluations…</span>
              ) : deleteEvalCount !== null && deleteEvalCount > 0 ? (
                <>
                  <strong className="font-semibold">All UI evaluations that use this persona will be permanently deleted.</strong>
                  <span className="mt-1 block text-amber-900/90">
                    This includes {deleteEvalCount === 1 ? "1 evaluation" : `${deleteEvalCount} evaluations`} where this persona is the primary or comparison persona.
                  </span>
                </>
              ) : deleteEvalCount === 0 ? (
                <span>No existing evaluations reference this persona.</span>
              ) : (
                <span>Could not load evaluation count; deleting will still remove any evaluations tied to this persona.</span>
              )}
            </div>
            {deleteError && <p className="mt-3 text-sm text-red-600">{deleteError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteSubmitting || deleteCountLoading}
                onClick={onConfirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleteSubmitting ? "Deleting…" : "Delete persona"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
