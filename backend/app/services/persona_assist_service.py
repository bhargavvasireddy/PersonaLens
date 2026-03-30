import json
import re

from anthropic import Anthropic

from app.core.config import settings
from app.schemas.persona import AssistMessage

SYSTEM_PROMPT = (
    "You are a UX research assistant helping users build detailed personas for UI/UX evaluations. "
    "Gather information through friendly, focused questions—then write a rich persona description.\n\n"
    "Rules:\n"
    "- Ask ONE question at a time. Cover: role/background, age range, technical comfort level, "
    "main goals/motivations, frustrations/pain points, and how/where they use the product.\n"
    "- After 3-5 user responses (once you have enough detail), produce a suggested description.\n"
    "- Always respond with JSON only—no extra text:\n"
    '  {"message": "your question", "suggested_description": null}\n'
    "  When ready to suggest:\n"
    '  {"message": "Here\'s a suggested description based on what you told me!", '
    '"suggested_description": "2-4 sentences covering demographics, goals, tech comfort, and key context"}\n'
    "- Be concise and conversational. Do not re-ask things already answered."
)


def get_assist_reply(name: str, messages: list[AssistMessage]) -> tuple[str, str | None]:
    if not settings.model_key.strip():
        raise ValueError("MODEL_KEY is not configured.")

    client = Anthropic(api_key=settings.model_key)
    model_name = (settings.model_name or "").strip() or "claude-haiku-4-5"

    # Synthetic opener so the AI has context from the very first turn
    anthropic_messages: list[dict] = [
        {
            "role": "user",
            "content": f'I want to create a persona named "{name}". Help me build a detailed description.',
        }
    ]
    for msg in messages:
        anthropic_messages.append({"role": msg.role, "content": msg.content})

    response = client.messages.create(
        model=model_name,
        max_tokens=512,
        temperature=0.7,
        system=SYSTEM_PROMPT,
        messages=anthropic_messages,
    )

    raw = "".join(getattr(block, "text", "") for block in response.content).strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        parsed = json.loads(match.group(0)) if match else {}

    message: str = parsed.get("message") or raw
    suggested: str | None = parsed.get("suggested_description") or None
    return message, suggested
