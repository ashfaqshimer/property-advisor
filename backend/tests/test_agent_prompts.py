"""Guards on the system prompt and the client wiring.

These are deletion guards, in the same spirit as the frontend's Tailwind class assertions:
they prove a settled rule is still *present*, not that the model obeys it. Obedience is
manual verification against live `flash-lite` — see context/features/agent-core/spec.md.
"""

from pathlib import Path

import pytest

from app.agent.client import GeminiClient, GeminiNotConfigured
from app.agent.prompts import FALLBACK_REPLY, SYSTEM_PROMPT
from app.config import BACKEND_DIR


class TestPersona:
    def test_she_is_amaya(self):
        assert "You are Amaya" in SYSTEM_PROMPT

    def test_the_brokerage_is_not_her_name(self):
        """Home Advisor is where she works. CLAUDE.md's branding section covers this; the
        old rule said the agent was named after the brand and was amended deliberately."""
        assert "You are Home Advisor" not in SYSTEM_PROMPT
        assert "Home Advisor" in SYSTEM_PROMPT, "the brokerage is still named"

    def test_no_placeholder_branding_from_the_mockup(self):
        assert "terra" not in SYSTEM_PROMPT.lower()

    @pytest.mark.parametrize(
        "rule",
        [
            "Only ever describe a property that a tool call returned to you",
            "Do NOT say we have nothing in that area",
            "never claim to be human",
            "Don't invent a biography",
            "Respond in English",
            "Make no comparative claims about other agents",
            "Never quote a valuation, a commission, or a timeline",
            # Rewritten twice. A live run showed flash-lite re-asking for a number in
            # disguise after being declined; a flat ban then collided with the owner's
            # empty-inventory instruction, which *is* a second ask. Settled wording allows
            # exactly one re-offer, hedged.
            "Don't nag",
            "One exception, and only once",
        ],
    )
    def test_settled_rule_is_still_present(self, rule: str):
        assert rule in SYSTEM_PROMPT

    def test_fallback_obeys_the_same_rules_as_the_prompt(self):
        lowered = FALLBACK_REPLY.lower()
        assert "agent" in lowered
        assert "don't have" not in lowered and "no properties" not in lowered


class TestPromptSourceOfTruth:
    """Persona lives in prompts.py only — changing how Amaya talks must never mean editing
    orchestration code."""

    @pytest.mark.parametrize("module", ["loop.py", "tools.py", "client.py"])
    def test_no_persona_text_in_other_agent_modules(self, module: str):
        source = (BACKEND_DIR / "app" / "agent" / module).read_text()
        assert "You are Amaya" not in source

    def test_model_string_is_not_inlined_anywhere_in_app(self):
        """CLAUDE.md: the model string lives in config, so swapping flash-lite for the
        non-lite Flash is a one-line change."""
        offenders = [
            path.relative_to(BACKEND_DIR)
            for path in (BACKEND_DIR / "app").rglob("*.py")
            if "gemini-3" in path.read_text() and path.name != "config.py"
        ]
        assert offenders == []


class TestClientConfiguration:
    def test_missing_key_raises_a_named_error_with_a_fix(self):
        with pytest.raises(GeminiNotConfigured) as exc:
            GeminiClient(api_key="", model="gemini-3.1-flash-lite")
        assert "GEMINI_API_KEY" in str(exc.value)

    def test_whitespace_key_is_treated_as_missing(self):
        with pytest.raises(GeminiNotConfigured):
            GeminiClient(api_key="   ", model="gemini-3.1-flash-lite")

    def test_importing_the_agent_package_needs_no_key(self):
        """The suite runs with no GEMINI_API_KEY, so construction has to be lazy — an
        import-time client would make these tests impossible to collect."""
        import app.agent  # noqa: F401

    def test_constructing_with_a_key_does_not_dial_out(self):
        """`genai.Client` resolves credentials without connecting, the same way
        `create_engine` resolves a dialect without connecting."""
        client = GeminiClient(api_key="not-a-real-key", model="gemini-3.1-flash-lite")
        assert client.model == "gemini-3.1-flash-lite"

    def test_the_cached_client_takes_its_model_from_settings(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        """The whole reason the model string lives in config: swapping flash-lite for the
        non-lite Flash must be a one-line change and nothing else."""
        from app.agent import client as client_module
        from app.config import Settings

        def fake_settings() -> Settings:
            return Settings(
                database_url="postgresql+psycopg://x:x@localhost/x",
                gemini_api_key="not-a-real-key",
                gemini_model="gemini-3.1-flash",
            )

        monkeypatch.setattr(client_module, "get_settings", fake_settings)
        client_module.get_gemini_client.cache_clear()
        try:
            assert client_module.get_gemini_client().model == "gemini-3.1-flash"
        finally:
            # Cached per process — leaving a fake in place would leak into other tests.
            client_module.get_gemini_client.cache_clear()

    def test_no_agent_framework_crept_in(self):
        """The hand-rolled loop is the point of the project, per CLAUDE.md."""
        manifest = Path(BACKEND_DIR / "pyproject.toml").read_text().lower()
        for framework in ("langchain", "langgraph", "llama-index", "crewai"):
            assert framework not in manifest
