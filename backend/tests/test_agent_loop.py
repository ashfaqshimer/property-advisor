"""The tool-calling loop's mechanics.

Driven by `tests/agent_fakes.ScriptedGemini`, so every assertion here is about
orchestration and persistence: dispatch, sequencing, the iteration cap, history replay.
Nothing here says anything about whether the model obeys the prompt — the fake writes the
replies. See the note at the top of `agent_fakes.py`.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import loop
from app.agent.loop import MAX_TOOL_ITERATIONS, run_turn
from app.agent.prompts import GREETING
from app.models import Conversation, Lead, Message, MessageRole
from tests.agent_fakes import (
    ScriptedGemini,
    always_calls,
    call_response,
    contentless_response,
    empty_response,
    text_response,
)


def _messages(session: Session) -> list[Message]:
    return list(
        session.execute(select(Message).order_by(Message.seq)).scalars()
    )


class TestPlainReply:
    def test_returns_the_models_text(self, seeded: Session):
        client = ScriptedGemini([text_response("Happy to help — what area?")])
        reply = run_turn(seeded, "s1", "Hi", client=client)
        assert reply == "Happy to help — what area?"
        assert client.call_count == 1

    def test_persists_user_then_assistant_in_seq_order(self, seeded: Session):
        run_turn(seeded, "s1", "Hi", client=ScriptedGemini([text_response("Hello")]))
        rows = _messages(seeded)
        assert [(m.role, m.content) for m in rows] == [
            (MessageRole.ASSISTANT, GREETING),  # seq 0, inserted not generated
            (MessageRole.USER, "Hi"),
            (MessageRole.ASSISTANT, "Hello"),
        ]
        assert [m.seq for m in rows] == [0, 1, 2]

    def test_sends_the_system_instruction_and_both_tools(self, seeded: Session):
        client = ScriptedGemini([text_response("Hello")])
        run_turn(seeded, "s1", "Hi", client=client)
        turn = client.turns[0]
        assert "Amaya" in turn.system_instruction
        declared = {
            d.name for tool in turn.tools for d in tool.function_declarations
        }
        assert declared == {"search_properties", "capture_lead"}

    def test_empty_user_message_spends_no_model_call(self, seeded: Session):
        client = ScriptedGemini([])
        with pytest.raises(ValueError):
            run_turn(seeded, "s1", "   ", client=client)
        assert client.call_count == 0


class TestToolDispatch:
    def test_executes_a_search_and_replies_from_the_result(self, seeded: Session):
        client = ScriptedGemini(
            [
                call_response("search_properties", {"location": "Colombo 7"}),
                text_response("There's a villa on Ward Place at LKR 185M."),
            ]
        )
        reply = run_turn(seeded, "s1", "Anything in Colombo 7?", client=client)

        assert reply.startswith("There's a villa")
        assert client.call_count == 2

    def test_persists_the_call_and_the_response_as_separate_turns(self, seeded: Session):
        client = ScriptedGemini(
            [
                call_response("search_properties", {"location": "Colombo 7"}),
                text_response("Found one."),
            ]
        )
        run_turn(seeded, "s1", "Colombo 7?", client=client)

        rows = _messages(seeded)
        assert [m.role for m in rows] == [
            MessageRole.ASSISTANT,  # the greeting at seq 0
            MessageRole.USER,
            MessageRole.ASSISTANT,  # the function_call turn
            MessageRole.TOOL,  # the function_response turn
            MessageRole.ASSISTANT,  # the prose reply
        ]
        assert [m.seq for m in rows] == [0, 1, 2, 3, 4]

        call_row, tool_row = rows[2], rows[3]
        assert call_row.tool_payload["function_call"]["name"] == "search_properties"
        assert call_row.tool_payload["function_call"]["args"] == {"location": "Colombo 7"}
        assert tool_row.tool_payload["function_response"]["name"] == "search_properties"
        assert tool_row.tool_payload["function_response"]["response"]["match_count"] >= 1

    def test_tool_payload_survives_the_json_round_trip(self, seeded: Session):
        """`text` can't replay a tool exchange, which is why `tool_payload` exists — and a
        Decimal price would make it unserialisable."""
        client = ScriptedGemini(
            [call_response("search_properties", {}), text_response("Here you go.")]
        )
        run_turn(seeded, "s1", "What have you got?", client=client)
        seeded.expire_all()

        tool_row = next(m for m in _messages(seeded) if m.role is MessageRole.TOOL)
        matches = tool_row.tool_payload["function_response"]["response"]["matches"]
        assert isinstance(matches[0]["price_lkr"], int)

    def test_capture_lead_writes_through_the_loop(self, seeded: Session):
        client = ScriptedGemini(
            [
                call_response(
                    "capture_lead", {"name": "Nimal", "phone": "0771234567", "intent": "buy"}
                ),
                text_response("Thanks Nimal — an agent will call you."),
            ]
        )
        run_turn(seeded, "s1", "I'm Nimal, 0771234567", client=client)

        lead = seeded.execute(select(Lead)).scalar_one()
        assert lead.name == "Nimal"
        assert lead.conversation_id is not None

    def test_zero_match_guidance_reaches_the_model(self, seeded: Session):
        """The other half of the truthfulness contract: the guidance isn't just returned by
        the tool, it's actually in the contents on the next model call."""
        client = ScriptedGemini(
            [
                call_response("search_properties", {"location": "Jaffna"}),
                text_response("Let me have an agent check and come back to you."),
            ]
        )
        run_turn(seeded, "s1", "Anything in Jaffna?", client=client)

        second_call = client.turns[1]
        responses = [
            part.function_response
            for content in second_call.contents
            for part in (content.parts or [])
            if part.function_response
        ]
        payload = responses[-1].response
        assert payload["matches"] == []
        assert "do not tell the user we have nothing" in payload["guidance"].lower()

    def test_prose_alongside_a_call_still_executes_the_call(self, seeded: Session):
        """Gemini returns both at once; stopping at the text would skip the search."""
        client = ScriptedGemini(
            [
                call_response("search_properties", {}, text="Let me look…"),
                text_response("Here are a few."),
            ]
        )
        reply = run_turn(seeded, "s1", "Show me something", client=client)

        assert reply == "Here are a few."
        assert any(m.role is MessageRole.TOOL for m in _messages(seeded))
        assert any(m.content == "Let me look…" for m in _messages(seeded))

    def test_unknown_tool_does_not_break_the_turn(self, seeded: Session):
        client = ScriptedGemini(
            [
                call_response("book_a_viewing", {"when": "Tuesday"}),
                text_response("I can't book that, but an agent can."),
            ]
        )
        reply = run_turn(seeded, "s1", "Book me a viewing", client=client)

        assert reply == "I can't book that, but an agent can."
        tool_row = next(m for m in _messages(seeded) if m.role is MessageRole.TOOL)
        assert "error" in tool_row.tool_payload["function_response"]["response"]


class TestIterationCap:
    def test_stops_after_exactly_max_iterations(self, seeded: Session):
        """A model stuck re-calling a tool must not become an unbounded bill."""
        client = always_calls("search_properties", {"location": "Colombo"})
        reply = run_turn(seeded, "s1", "Hello?", client=client)

        assert client.call_count == MAX_TOOL_ITERATIONS
        assert reply, "the cap must answer in prose, not raise or return empty"

    def test_cap_reply_does_not_deny_coverage(self, seeded: Session):
        """The fallback obeys the same rules as the prompt: no "we have nothing", and it
        moves toward a human."""
        reply = run_turn(
            seeded, "s1", "Hello?", client=always_calls("search_properties")
        )
        lowered = reply.lower()
        assert "don't have" not in lowered
        assert "no properties" not in lowered
        assert "agent" in lowered

    def test_cap_still_persists_an_assistant_turn(self, seeded: Session):
        run_turn(seeded, "s1", "Hello?", client=always_calls("search_properties"))
        rows = _messages(seeded)
        assert rows[-1].role is MessageRole.ASSISTANT
        assert [m.seq for m in rows] == list(range(len(rows)))


class TestDegradedResponses:
    def test_no_candidates_falls_back_instead_of_returning_empty(self, seeded: Session):
        reply = run_turn(
            seeded, "s1", "Hi", client=ScriptedGemini([empty_response()])
        )
        assert reply.strip()

    def test_blank_text_falls_back(self, seeded: Session):
        reply = run_turn(seeded, "s1", "Hi", client=ScriptedGemini([text_response("   ")]))
        assert reply.strip()

    def test_candidate_with_no_content_falls_back(self, seeded: Session):
        reply = run_turn(
            seeded, "s1", "Hi", client=ScriptedGemini([contentless_response()])
        )
        assert reply.strip()

    def test_a_degraded_turn_is_still_persisted(self, seeded: Session):
        """The user's message and a reply both land, so the next turn replays a coherent
        conversation rather than a dangling question."""
        run_turn(seeded, "s1", "Hi", client=ScriptedGemini([empty_response()]))
        rows = _messages(seeded)
        assert [m.role for m in rows] == [
            MessageRole.ASSISTANT,  # greeting
            MessageRole.USER,
            MessageRole.ASSISTANT,
        ]


class TestGreeting:
    """Amaya's opening bubble is inserted by the loop, not generated by the model.

    The panel shows it before any request is made, so persisting it is what keeps the
    model's replayed history identical to what the visitor actually has on screen.
    """

    def test_a_new_conversation_persists_the_greeting_at_seq_zero(self, seeded: Session):
        run_turn(seeded, "s1", "Hi", client=ScriptedGemini([text_response("Hello")]))
        first = _messages(seeded)[0]
        assert first.seq == 0
        assert first.role is MessageRole.ASSISTANT
        assert first.content == GREETING

    def test_the_greeting_costs_no_model_call(self, seeded: Session):
        """It's a constant, not a generation — inserting it must not spend a turn."""
        client = ScriptedGemini([text_response("Hello")])
        run_turn(seeded, "s1", "Hi", client=client)
        assert client.call_count == 1

    def test_a_second_turn_does_not_insert_it_again(self, seeded: Session):
        run_turn(seeded, "s1", "First", client=ScriptedGemini([text_response("One")]))
        run_turn(seeded, "s1", "Second", client=ScriptedGemini([text_response("Two")]))

        greetings = [m for m in _messages(seeded) if m.content == GREETING]
        assert len(greetings) == 1

    def test_contents_open_with_the_greeting_as_a_model_turn(self, seeded: Session):
        """Not merely persisted — actually replayed to Gemini, and as `model` rather than
        `user`, or she reads her own hello as something the visitor said."""
        client = ScriptedGemini([text_response("Hello")])
        run_turn(seeded, "s1", "Hi", client=client)

        opening = client.turns[0].contents[0]
        assert opening.role == "model"
        assert [part.text for part in (opening.parts or [])] == [GREETING]

    def test_each_conversation_gets_its_own_greeting(self, seeded: Session):
        run_turn(seeded, "s1", "Hi", client=ScriptedGemini([text_response("One")]))
        run_turn(seeded, "s2", "Hi", client=ScriptedGemini([text_response("Two")]))

        greetings = [m for m in _messages(seeded) if m.content == GREETING]
        assert len(greetings) == 2
        assert {m.seq for m in greetings} == {0}

    def test_a_rejected_empty_message_leaves_no_greeting_behind(self, seeded: Session):
        """The greeting rides on a real first message. A turn that never runs must not
        create a conversation whose only content is a hello nobody answered."""
        with pytest.raises(ValueError):
            run_turn(seeded, "s1", "   ", client=ScriptedGemini([]))
        assert _messages(seeded) == []


class TestConversationContinuity:
    def test_same_session_id_continues_one_conversation(self, seeded: Session):
        run_turn(seeded, "s1", "First", client=ScriptedGemini([text_response("One")]))
        run_turn(seeded, "s1", "Second", client=ScriptedGemini([text_response("Two")]))

        assert seeded.execute(select(Conversation)).scalars().all().__len__() == 1
        # Greeting, then two turns of two rows each — the greeting is not re-inserted.
        assert [m.seq for m in _messages(seeded)] == [0, 1, 2, 3, 4]

    def test_history_is_replayed_to_the_model(self, seeded: Session):
        run_turn(seeded, "s1", "First", client=ScriptedGemini([text_response("One")]))
        client = ScriptedGemini([text_response("Two")])
        run_turn(seeded, "s1", "Second", client=client)

        texts = [
            part.text
            for content in client.turns[0].contents
            for part in (content.parts or [])
            if part.text
        ]
        assert texts == [GREETING, "First", "One", "Second"]

    def test_replay_reconstructs_tool_turns_not_just_prose(self, seeded: Session):
        """A replayed conversation has to include the function_call/function_response pair,
        or the model sees itself answer a question it never asked."""
        run_turn(
            seeded,
            "s1",
            "Colombo 7?",
            client=ScriptedGemini(
                [call_response("search_properties", {"location": "Colombo 7"}),
                 text_response("Found one.")]
            ),
        )
        client = ScriptedGemini([text_response("Anything else?")])
        run_turn(seeded, "s1", "And Galle?", client=client)

        replayed = client.turns[0].contents
        assert any(
            part.function_call
            for content in replayed
            for part in (content.parts or [])
        )
        assert any(
            part.function_response
            for content in replayed
            for part in (content.parts or [])
        )

    def test_different_session_ids_are_separate_conversations(self, seeded: Session):
        run_turn(seeded, "s1", "Hi", client=ScriptedGemini([text_response("One")]))
        run_turn(seeded, "s2", "Hi", client=ScriptedGemini([text_response("Two")]))

        assert seeded.execute(select(Conversation)).scalars().all().__len__() == 2
        for conversation in seeded.execute(select(Conversation)).scalars():
            seqs = [
                m.seq
                for m in _messages(seeded)
                if m.conversation_id == conversation.id
            ]
            assert seqs == [0, 1, 2], "seq restarts per conversation"

    def test_blank_session_id_is_rejected(self, seeded: Session):
        with pytest.raises(ValueError):
            loop.get_or_create_conversation(seeded, "  ")
