"""Builder for the system prompt."""

from app.agent.guardrails import GUARDRAILS_PROMPT
from app.agent.persona import PERSONA_PROMPT
from app.agent.schema_intro import build_seller_fields_prompt


def build_system_prompt() -> str:
    """Concatenates persona and guardrails, filling in dynamic schema values."""
    seller_fields = build_seller_fields_prompt()
    persona_with_fields = PERSONA_PROMPT.replace("{{SELLER_FIELDS}}", seller_fields)
    
    return persona_with_fields + "\n" + GUARDRAILS_PROMPT
