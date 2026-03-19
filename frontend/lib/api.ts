import { CreatePersonaInput, Evaluation, Persona } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function getAccessToken(): Promise<string | null> {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Unable to load Supabase session:", error.message);
      return null;
    }
    return session?.access_token ?? null;
  } catch (error) {
    console.error("Unexpected Supabase session error:", error);
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store"
    });
  } catch {
    throw new Error(
      "Failed to reach backend API. Verify backend is running on port 8000 and CORS includes your frontend origin."
    );
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") {
        detail = body.detail;
      }
    } catch {
      const textBody = await response.text().catch(() => "");
      if (textBody) {
        detail = textBody;
      }
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

