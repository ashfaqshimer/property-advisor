"""Tests for transient error detection and retry/backoff in app.agent.client."""

from unittest.mock import MagicMock
import httpx
import pytest
from google.genai import errors as genai_errors

from app.agent.client import (
    GeminiClient,
    is_transient_error,
    retry_with_backoff,
)


def test_is_transient_error_status_codes():
    for code in (429, 500, 502, 503, 504):
        err = genai_errors.ServerError(code, {"error": {"message": f"err {code}"}})
        assert is_transient_error(err) is True

    # 400 Bad Request, 401 Unauthorized, 404 Not Found are NOT transient
    client_err = genai_errors.ClientError(400, {"error": {"message": "bad request"}})
    assert is_transient_error(client_err) is False

    auth_err = genai_errors.ClientError(401, {"error": {"message": "unauthorized"}})
    assert is_transient_error(auth_err) is False

    assert is_transient_error(ValueError("generic error")) is False


def test_is_transient_error_network():
    req = httpx.Request("POST", "https://example.com")
    assert is_transient_error(httpx.ConnectError("connection refused", request=req)) is True
    assert is_transient_error(httpx.ReadTimeout("timeout", request=req)) is True


def test_retry_with_backoff_success_after_failure():
    attempts = 0

    def flaky():
        nonlocal attempts
        attempts += 1
        if attempts < 2:
            raise genai_errors.ServerError(503, {"error": {"message": "overloaded"}})
        return "success"

    result = retry_with_backoff(flaky, max_attempts=3, base_delay=0.01)
    assert result == "success"
    assert attempts == 2


def test_retry_with_backoff_raises_non_transient_immediately():
    attempts = 0

    def non_transient():
        nonlocal attempts
        attempts += 1
        raise genai_errors.ClientError(400, {"error": {"message": "bad request"}})

    with pytest.raises(genai_errors.ClientError):
        retry_with_backoff(non_transient, max_attempts=3, base_delay=0.01)

    assert attempts == 1


def test_generate_stream_retries_transient_failure():
    client = GeminiClient(api_key="fake-key", model="gemini-fake")

    call_count = 0

    def mock_stream(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise genai_errors.ServerError(503, {"error": {"message": "overloaded"}})
        return iter(["chunk1", "chunk2"])

    client._client = MagicMock()
    client._client.models.generate_content_stream = mock_stream

    stream = client.generate_stream(contents=[], tools=[], system_instruction="")
    chunks = list(stream)

    assert chunks == ["chunk1", "chunk2"]
    assert call_count == 2
