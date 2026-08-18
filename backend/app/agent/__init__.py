"""The agent package: a hand-rolled Gemini tool-calling loop.

No LangChain, no LangGraph, no framework — demonstrating manual orchestration is a
primary goal of this project, not an implementation detail. See CLAUDE.md.

Importing this package must stay side-effect free: the test suite imports it with no
`GEMINI_API_KEY` set, so the `genai.Client` is built lazily on first use rather than at
module scope (unlike `app.db.session`'s engine, which cannot connect by accident).
"""

from app.agent.loop import MAX_TOOL_ITERATIONS, run_turn
from app.agent.prompts import SYSTEM_PROMPT

__all__ = ["MAX_TOOL_ITERATIONS", "SYSTEM_PROMPT", "run_turn"]
