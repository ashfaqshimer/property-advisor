import asyncio
from unittest.mock import AsyncMock, patch

import httpx

from app.scraper.ikman_client import IkmanClient


def test_ikman_client_follow_redirects_configured():
    async def _run():
        client = IkmanClient(delay=0)
        try:
            assert client.client.follow_redirects is True
        finally:
            await client.close()

    asyncio.run(_run())


def test_fetch_ad_detail_parses_initial_data():
    async def _run():
        client = IkmanClient(delay=0)
        mock_html = """
        <html>
            <body>
                <script>
                window.initialData = {
                    "adDetail": {
                        "data": {
                            "ad": {
                                "id": "test-ad-123",
                                "title": "Nice house",
                                "contactCard": {
                                    "name": "Kasun",
                                    "phoneNumbers": [{"number": "0771234567"}]
                                }
                            }
                        }
                    }
                };
                </script>
            </body>
        </html>
        """
        mock_response = httpx.Response(
            status_code=200,
            text=mock_html,
            request=httpx.Request("GET", "https://ikman.lk/en/ad/test-slug")
        )
        try:
            with patch.object(client.client, "get", new_callable=AsyncMock) as mock_get:
                mock_get.return_value = mock_response
                detail = await client.fetch_ad_detail("test-slug")
                assert detail is not None
                assert detail.id == "test-ad-123"
                assert detail.title == "Nice house"
                assert detail.contactCard is not None
                assert detail.contactCard.name == "Kasun"
                assert detail.contactCard.phoneNumbers[0]["number"] == "0771234567"
        finally:
            await client.close()

    asyncio.run(_run())
