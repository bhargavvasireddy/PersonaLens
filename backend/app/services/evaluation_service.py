import base64
import json
import mimetypes
import re
from pathlib import Path

from anthropic import Anthropic
from pydantic import ValidationError

from app.core.config import settings
from app.db.models import Persona
from app.schemas.evaluation import EvaluationResult


class AIModelCallError(Exception):
    pass


class AIInvalidJSONError(Exception):
    pass


SYSTEM_PROMPT = (
    "You are a senior UX researcher. Return only valid JSON and no extra text."
    " Evaluate the UI screenshot against the persona context and provide actionable feedback."
)


def evaluate_ui(
    image_path: str,
    primary_persona: Persona,
    compare_persona: Persona | None = None,
) -> EvaluationResult:
    if not settings.model_key.strip():
        raise AIModelCallError("MODEL_KEY is not configured.")

    client = Anthropic(api_key=settings.model_key)
    model_name = (settings.model_name or "").strip() or "claude-haiku-4-5"
    prompt = _build_prompt(primary_persona, compare_persona)

    try:
        raw_text = _call_vision_model(client=client, model_name=model_name, prompt=prompt, image_path=image_path)
    except Exception as vision_error:
        try:
            fallback_prompt = (
                f"{prompt}\n\nFallback disclaimer: visual analysis is unavailable; treat this as a text-only"
                f" evaluation for screenshot file '{Path(image_path).name}'."
            )
            raw_text = _call_text_model(client=client, model_name=model_name, prompt=fallback_prompt)
        except Exception as fallback_error:
            raise AIModelCallError(
                f"Vision call failed ({vision_error}); text fallback failed ({fallback_error})."
            ) from fallback_error

    return _parse_and_validate(raw_text)


def _build_prompt(primary_persona: Persona, compare_persona: Persona | None) -> str:
    if compare_persona is not None:
        compare_block = f"Compare persona name: {compare_persona.name}\nCompare persona description: {compare_persona.description}"
        evaluation_instruction = (
            "Evaluate this UI screenshot from both personas and provide a side-by-side comparison."
        )
        report_instruction = (
            "frontend_report must be a single string containing **only HTML** (no markdown). "
            f"**Title:** One line at the top: <h1>PrimaryName vs. CompareName</h1> using the actual names \"{primary_persona.name}\" and \"{compare_persona.name}\" (e.g. \"{primary_persona.name} vs. {compare_persona.name}\"). Keep the title as a single heading at the top. "
            "**Line under the vs:** Right below the title, output one row that shows only the vertical separator so it sits directly under the \"vs\" in the title: <div class=\"persona-comparison\"><div class=\"persona-col\"></div><div class=\"persona-divider\"></div><div class=\"persona-col\"></div></div> (empty columns, so the line appears centered under the title). "
            "Use HTML for structure: <h2>, <h3>, <h4>, <p>, <strong>, <ul><li>, <ol><li>. "
            "**Side-by-side layout (required):** For each comparison section use: <div class=\"persona-comparison\"><div class=\"persona-col\">first persona content</div><div class=\"persona-divider\"></div><div class=\"persona-col\">second persona content</div></div>. First persona-col = primary, second = compare. "
            "**Each column must include that persona's own score (each **out of 10**, e.g. 8.2/10) and full analysis.** Use one persona-comparison block per section (Summary, Highlights, Issues, Recommendations). Include all JSON fields, split per persona. "
            "**Tradeoffs &amp; solutions (required at the end):** You MUST end the report with a full section: <h2>Tradeoffs &amp; solutions</h2> followed by one or more paragraphs analyzing potential tradeoffs and solutions to best serve both personas (e.g. where their needs conflict and how the UI could address both). Do not omit this section. "
            "Escape quotes in attributes as \\\" and use &amp; for ampersands in the JSON string."
        )
    else:
        compare_block = "No compare persona provided."
        evaluation_instruction = "Evaluate this UI screenshot from the perspective of this persona."
        report_instruction = (
            "frontend_report must be a single string containing **only HTML** (no markdown). "
            f"Use HTML for structure and formatting: <h1><strong>{primary_persona.name}</strong></h1> at the top, "
            "<h2> for section headers, <h3> or <h4> for subsections, <p> for paragraphs, <strong> for emphasis, "
            "<ul><li> or <ol><li> for lists. The frontend_report **must include every important field from the JSON**: the **overall_score** shown explicitly **out of 10** (e.g. \"Overall: 7.5 / 10\" — same value as in JSON), **summary**, all **highlights**, all **issues** (each with title, description, severity, category), and all **recommendations**. Do not omit any of these. "
            "End with a brief summary section. Escape quotes in attributes as \\\" in the JSON string."
        )

    return f"""
{evaluation_instruction}

Primary persona name: {primary_persona.name}
Primary persona description: {primary_persona.description}
{compare_block}

Return JSON with exactly this structure:
{{
  "summary": "string",
  "overall_score": 7.5,
  "highlights": ["string"],
  "issues": [
    {{
      "title": "string",
      "description": "string",
      "severity": "low|medium|high",
      "category": "string"
    }}
  ],
  "recommendations": ["string"],
  "frontend_report": "string"
}}

Rules:
- overall_score must be a number from 0 to 10 (decimals allowed): a **10-point** UX quality score for this evaluation. Do not use a 0-1 scale.
- In frontend_report, state this score clearly **out of 10** (e.g. \"7.5 / 10\" or \"7.5 out of 10\") and match the JSON value.
- Keep recommendations concise and actionable.
- {report_instruction}
- Do not return markdown syntax (# or **), code fences, or prose outside the JSON object.
""".strip()


def _image_media_type(image_file: Path) -> str:
    mime = mimetypes.guess_type(image_file.name)[0] or "application/octet-stream"
    if mime == "application/octet-stream" or not mime.startswith("image/"):
        return "image/png"
    return mime


def _call_vision_model(client: Anthropic, model_name: str, prompt: str, image_path: str) -> str:
    image_file = Path(image_path)
    if not image_file.exists():
        raise AIModelCallError(f"Image does not exist: {image_path}")

    media_type = _image_media_type(image_file)
    image_b64 = base64.b64encode(image_file.read_bytes()).decode("utf-8")

    response = client.messages.create(
        model=model_name,
        max_tokens=8192,
        temperature=0.2,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                ],
            }
        ],
    )
    return _message_to_text(response)


def _call_text_model(client: Anthropic, model_name: str, prompt: str) -> str:
    response = client.messages.create(
        model=model_name,
        max_tokens=8192,
        temperature=0.2,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return _message_to_text(response)


def _message_to_text(response: object) -> str:
    blocks = getattr(response, "content", None)
    if not blocks:
        raise AIModelCallError("Model returned no content.")

    fragments: list[str] = []
    for block in blocks:
        if isinstance(block, dict):
            if block.get("type") == "text":
                text = block.get("text")
                if isinstance(text, str):
                    fragments.append(text)
        else:
            if getattr(block, "type", None) == "text":
                text = getattr(block, "text", None)
                if isinstance(text, str):
                    fragments.append(text)

    merged = "".join(fragments).strip()
    if not merged:
        raise AIModelCallError("Model response content is empty.")
    return merged


def _extract_json_payload(raw_text: str) -> dict[str, object]:
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", raw_text)
    if match is None:
        raise AIInvalidJSONError("Model output did not contain JSON.")

    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise AIInvalidJSONError("Model output JSON could not be parsed.") from exc

    if not isinstance(parsed, dict):
        raise AIInvalidJSONError("Model output JSON must be an object.")
    return parsed


def _parse_and_validate(raw_text: str) -> EvaluationResult:
    payload = _extract_json_payload(raw_text)
    try:
        return EvaluationResult.model_validate(payload)
    except ValidationError as exc:
        raise AIInvalidJSONError("Model output did not match required schema.") from exc
