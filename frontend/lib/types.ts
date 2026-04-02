export type Persona = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

export type EvaluationIssue = {
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  category: string;
};

export type SampleUi = {
  html: string;
};

export type EvaluationResult = {
  summary: string;
  overall_score: number;
  highlights: string[];
  issues: EvaluationIssue[];
  recommendations: string[];
  frontend_report?: string;
  sample_ui?: SampleUi | null;
};

export type Evaluation = {
  id: number;
  image_path: string;
  primary_persona_id: number;
  primary_persona_name: string;
  compare_persona_id: number | null;
  compare_persona_name: string | null;
  status: "succeeded" | "failed";
  overall_score: number | null;
  error_message: string | null;
  result_json: EvaluationResult | Record<string, unknown>;
  frontend_report?: string;
  sample_ui?: SampleUi | null;
  created_at: string;
};

export type CreatePersonaInput = {
  name: string;
  description: string;
};

export type AssistMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PersonaAssistResponse = {
  message: string;
  suggested_description: string | null;
};
