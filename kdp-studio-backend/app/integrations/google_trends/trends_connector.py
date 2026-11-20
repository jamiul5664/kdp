from datetime import datetime, timezone
from typing import Any, Dict, List
from app.integrations.amazon.connectors import NOT_AVAILABLE


class GoogleTrendsConnector:
    """Fetches relative Google Trends interest indices (0–100) without fabricating absolute search volume."""

    name = "google_trends"

    async def get_interest_over_time(
        self,
        keywords: List[str],
        timeframe: str = "today 12-m",
        geo: str = "US",
    ) -> Dict[str, Any]:
        collected_at = datetime.now(timezone.utc).isoformat()
        clean_keywords = [kw.strip() for kw in keywords if kw.strip()][:5]
        return {
            "connector": self.name,
            "keywords": clean_keywords,
            "timeframe": timeframe,
            "geo": geo,
            "trend_direction": NOT_AVAILABLE,
            "relative_interest_index": NOT_AVAILABLE,
            "note": (
                "Google Trends returns relative search interest (0–100), not absolute monthly "
                "Amazon unit sales. Connect an authorized trends feed to populate live series."
            ),
            "source_url": f"https://trends.google.com/trends/explore?geo={geo}&q={','.join(clean_keywords)}",
            "collected_at": collected_at,
        }
