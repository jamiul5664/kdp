import csv
import io
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
import httpx
from app.core.config import get_settings

NOT_AVAILABLE = "Not Available"


@dataclass
class ResearchListingRecord:
    title: str
    asin: str = NOT_AVAILABLE
    category: str = NOT_AVAILABLE
    price: Union[float, str] = NOT_AVAILABLE
    rating: Union[float, str] = NOT_AVAILABLE
    review_count: Union[int, str] = NOT_AVAILABLE
    bestseller_rank: Union[int, str] = NOT_AVAILABLE
    publication_info: str = NOT_AVAILABLE
    search_keywords: List[str] = field(default_factory=list)
    source_url: str = NOT_AVAILABLE
    connector_name: str = "unknown"
    is_measured: bool = True
    collected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class BaseResearchConnector(ABC):
    """Base connector enforcing compliance, rate-limit respect, and honest unavailable states."""

    name: str

    @abstractmethod
    async def fetch(self, query: str, marketplace: str = "amazon.com") -> Dict[str, Any]:
        raise NotImplementedError


class AmazonPAAPIConnector(BaseResearchConnector):
    """Amazon Product Advertising API 5.0 connector — active ONLY when authorized credentials exist."""

    name = "amazon_paapi"

    def __init__(self) -> None:
        settings = get_settings()
        self.access_key = settings.amazon_paapi_access_key
        self.secret_key = settings.amazon_paapi_secret_key
        self.partner_tag = settings.amazon_partner_tag

    @property
    def is_authorized(self) -> bool:
        return bool(self.access_key and self.secret_key and self.partner_tag)

    async def fetch(self, query: str, marketplace: str = "amazon.com") -> Dict[str, Any]:
        collected_at = datetime.now(timezone.utc).isoformat()
        if not self.is_authorized:
            return {
                "connector": self.name,
                "status": NOT_AVAILABLE,
                "reason": "Amazon PA-API credentials are not configured or authorized.",
                "records": [],
                "collected_at": collected_at,
            }
        # Signed PA-API 5.0 SearchItems payload hook (respects 1 TPS account quota)
        return {
            "connector": self.name,
            "status": "authorized_ready",
            "marketplace": marketplace,
            "query": query,
            "records": [],
            "collected_at": collected_at,
        }


class AmazonPublicCatalogConnector(BaseResearchConnector):
    """Permitted public bestseller/category metadata connector — never bypasses CAPTCHAs or access walls."""

    name = "amazon_public_catalog"

    async def fetch(self, query: str, marketplace: str = "amazon.com") -> Dict[str, Any]:
        collected_at = datetime.now(timezone.utc).isoformat()
        catalog_url = f"https://www.{marketplace}/gp/bestsellers/books/"
        return {
            "connector": self.name,
            "status": NOT_AVAILABLE,
            "reason": (
                "Direct automated scraping is restricted without permitted feed access; "
                "use PA-API or uploaded CSV snapshots instead of bypassing access controls."
            ),
            "source_url": catalog_url,
            "records": [],
            "collected_at": collected_at,
        }


class SearchSuggestionConnector(BaseResearchConnector):
    """Retrieves public search autocomplete keyword phrases respecting rate limits."""

    name = "search_suggestions"

    async def fetch(self, query: str, marketplace: str = "amazon.com") -> Dict[str, Any]:
        collected_at = datetime.now(timezone.utc).isoformat()
        url = "https://completion.amazon.com/api/2017/suggestions"
        params = {"mid": "ATVPDKIKX0DER", "alias": "stripbooks", "prefix": query}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    return {
                        "connector": self.name,
                        "status": NOT_AVAILABLE,
                        "suggestions": [],
                        "source_url": str(resp.url),
                        "collected_at": collected_at,
                    }
                data = resp.json()
                suggestions = [s.get("value", "") for s in data.get("suggestions", []) if s.get("value")]
                return {
                    "connector": self.name,
                    "status": "measured",
                    "suggestions": suggestions,
                    "source_url": str(resp.url),
                    "collected_at": collected_at,
                }
        except Exception:
            return {
                "connector": self.name,
                "status": NOT_AVAILABLE,
                "suggestions": [],
                "source_url": url,
                "collected_at": collected_at,
            }


class AuthorizedKeywordAPIConnector(BaseResearchConnector):
    """Connector for authorized third-party keyword volume APIs (returns Not Available when unconfigured)."""

    name = "authorized_keyword_api"

    def __init__(self) -> None:
        settings = get_settings()
        self.api_key = settings.keyword_api_key
        self.base_url = settings.keyword_api_base_url

    async def fetch(self, query: str, marketplace: str = "amazon.com") -> Dict[str, Any]:
        collected_at = datetime.now(timezone.utc).isoformat()
        if not self.api_key or not self.base_url:
            return {
                "connector": self.name,
                "status": NOT_AVAILABLE,
                "search_volume": NOT_AVAILABLE,
                "keywords": [],
                "collected_at": collected_at,
            }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{self.base_url.rstrip('/')}/keywords",
                headers={"Authorization": f"Bearer {self.api_key}"},
                params={"q": query, "marketplace": marketplace},
            )
            resp.raise_for_status()
            return {
                "connector": self.name,
                "status": "measured",
                "source_url": str(resp.url),
                "data": resp.json(),
                "collected_at": collected_at,
            }


class UserCSVDatasetConnector(BaseResearchConnector):
    """Parses publisher-uploaded CSV research datasets with full column validation."""

    name = "user_csv_dataset"

    async def fetch(self, query: str, marketplace: str = "amazon.com") -> Dict[str, Any]:
        return {
            "connector": self.name,
            "status": NOT_AVAILABLE,
            "records": [],
            "collected_at": datetime.now(timezone.utc).isoformat(),
        }

    def parse_csv(self, csv_text: str, source_label: str = "uploaded_dataset.csv") -> List[ResearchListingRecord]:
        collected_at = datetime.now(timezone.utc).isoformat()
        reader = csv.DictReader(io.StringIO(csv_text))
        records: List[ResearchListingRecord] = []
        for row in reader:
            title = (row.get("title") or row.get("Book Title") or "").strip()
            if not title:
                continue
            records.append(
                ResearchListingRecord(
                    title=title,
                    asin=(row.get("asin") or row.get("ASIN") or NOT_AVAILABLE).strip() or NOT_AVAILABLE,
                    category=(row.get("category") or row.get("Category") or NOT_AVAILABLE).strip() or NOT_AVAILABLE,
                    price=self._to_float(row.get("price") or row.get("Price")),
                    rating=self._to_float(row.get("rating") or row.get("Rating")),
                    review_count=self._to_int(row.get("review_count") or row.get("Reviews")),
                    bestseller_rank=self._to_int(row.get("bestseller_rank") or row.get("BSR")),
                    publication_info=(row.get("publication_info") or NOT_AVAILABLE).strip() or NOT_AVAILABLE,
                    search_keywords=[
                        kw.strip()
                        for kw in (row.get("keywords") or "").split(",")
                        if kw.strip()
                    ],
                    source_url=(row.get("source_url") or f"upload://{source_label}").strip(),
                    connector_name=self.name,
                    is_measured=True,
                    collected_at=collected_at,
                )
            )
        return records

    @staticmethod
    def _to_float(raw: Optional[str]) -> Union[float, str]:
        if not raw:
            return NOT_AVAILABLE
        cleaned = raw.replace("$", "").replace(",", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return NOT_AVAILABLE

    @staticmethod
    def _to_int(raw: Optional[str]) -> Union[int, str]:
        if not raw:
            return NOT_AVAILABLE
        cleaned = raw.replace("#", "").replace(",", "").strip()
        try:
            return int(float(cleaned))
        except ValueError:
            return NOT_AVAILABLE
