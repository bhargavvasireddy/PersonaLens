import { CreatePersonaInput, Evaluation, Persona } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        detail = body.detail;
      }
    } catch {
      // Keep fallback detail when JSON parsing fails.
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export function getPersonas() {
  return request<Persona[]>("/personas");
}

export function createPersona(payload: CreatePersonaInput) {
  return request<Persona>("/personas", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export function createEvaluation(formData: FormData) {
  return request<Evaluation>("/evaluate", {
    method: "POST",
    body: formData
  });
}

export function getEvaluations() {
  return request<Evaluation[]>("/evaluations");
}

