"""Wire shapes for `POST /chat`.

Validation lives here rather than in the endpoint so that `loop.run_turn`'s own
`ValueError("user_message must not be empty")` is unreachable over HTTP — a blank message
is a 422 from this schema, not a 500 from the loop.
"""

from pydantic import BaseModel, ConfigDict, Field

# One request's worth of typing. Not a cost control — nothing here bounds request *volume*,
# and /chat is unauthenticated and metered. See the spec's Notes.
MAX_MESSAGE_LENGTH = 2000

# Matches `Conversation.session_id`'s String(128). Longer ids would raise DataError from
# Postgres on insert; rejecting them here keeps that a 422.
MAX_SESSION_ID_LENGTH = 128


class ChatRequest(BaseModel):
    # Strips before the length constraints are applied, which is what makes a
    # whitespace-only message a `string_too_short` 422 rather than an empty string handed
    # to the loop. It also means surrounding whitespace doesn't count toward the cap.
    model_config = ConfigDict(str_strip_whitespace=True)

    session_id: str = Field(
        min_length=1,
        max_length=MAX_SESSION_ID_LENGTH,
        description="Client-generated. The server never mints one.",
    )
    message: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class ChatResponse(BaseModel):
    """Prose only.

    No matched property ids and no lead-captured flag: the reply is the product and the
    database is the record. Easy to widen later, hard to narrow.
    """

    reply: str
    # Echoed so a client that has just generated its first id can confirm what the
    # conversation is keyed on without tracking the request it sent.
    session_id: str
