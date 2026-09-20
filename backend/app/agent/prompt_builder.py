"""Builder for the system prompt."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.guardrails import GUARDRAILS_PROMPT
from app.agent.persona import PERSONA_PROMPT
from app.agent.schema_intro import build_seller_fields_prompt
from app.models.site_configuration import SiteConfiguration


def build_system_prompt(db: Session) -> str:
    """Concatenates persona and guardrails, filling in dynamic schema values."""
    seller_fields = build_seller_fields_prompt()
    persona_with_fields = PERSONA_PROMPT.replace("{{SELLER_FIELDS}}", seller_fields)
    
    config = db.scalar(select(SiteConfiguration).limit(1))
    if config:
        contact_info = (
            f"The business phone numbers are: {', '.join(config.phone_numbers) if config.phone_numbers else 'not available'}. "
            f"The contact email is: {config.contact_email or 'not available'}. "
            f"The city is: {config.city or 'not available'}. "
        )
        if config.instagram_link or config.facebook_link or config.x_link or config.tiktok_link:
            contact_info += "Social links: "
            if config.instagram_link: contact_info += f"Instagram: {config.instagram_link}, "
            if config.facebook_link: contact_info += f"Facebook: {config.facebook_link}, "
            if config.x_link: contact_info += f"X: {config.x_link}, "
            if config.tiktok_link: contact_info += f"TikTok: {config.tiktok_link}."
    else:
        contact_info = "Contact information is currently unavailable."
        
    contact_instruction = f"\n\n## Site Configuration & Contact Info\n{contact_info}\n"
    
    return persona_with_fields + contact_instruction + "\n" + GUARDRAILS_PROMPT
