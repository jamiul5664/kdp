from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.integrations.amazon.connectors import (
    NOT_AVAILABLE,
    AmazonPAAPIConnector,
    AmazonPublicCatalogConnector,
    AuthorizedKeywordAPIConnector,
    ResearchListingRecord,
    SearchSuggestionConnector,
    UserCSVDatasetConnector,
)
from app.integrations.google_trends.trends_connector import GoogleTrendsConnector


@dataclass
class ScoringWeights:
    demand: float = 0.35
    competition_inverse: float = 0.30
    keyword_opportunity: float = 0.20
    market_gap: float = 0.15

    def validate(self) -> None:
        total = round(
            self.demand + self.competition_inverse + self.keyword_opportunity + self.market_gap, 4
        )
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Scoring weights must sum to 1.0 (got {total}).")


@dataclass
class NicheScoreInput:
    niche_name: str
    category: str
    target_audience: str
    keywords: List[str]
    competitors: List[ResearchListingRecord] = field(default_factory=list)
    trends_index: Optional[float] = None  # 0-100 relative Google Trends interest
    search_suggestions_count: int = 0
    review_complaint_themes: List[str] = field(default_factory=list)
    data_age_days: int = 0


class NicheScoringEngine:
    """Transparent KDP Niche Opportunity Scoring Engine separating measured inputs from estimates."""

    def score(
        self,
        item: NicheScoreInput,
        weights: Optional[ScoringWeights] = None,
    ) -> Dict[str, Any]:
        w = weights or ScoringWeights()
        w.validate()

        competitor_count = len(item.competitors)
        measured_reviews = [
            c.review_count for c in item.competitors if isinstance(c.review_count, int)
        ]
        avg_reviews = round(sum(measured_reviews) / len(measured_reviews), 1) if measured_reviews else None

        # 1. Demand Score (0-100) — never equates review count to unit sales volume
        trends_component = item.trends_index if item.trends_index is not None else 45.0
        suggestion_component = min(100.0, item.search_suggestions_count * 10.0) if item.search_suggestions_count else 40.0
        demand_score = round(min(100.0, (trends_component * 0.6) + (suggestion_component * 0.4)), 1)

        # 2. Competition Score (0-100, higher = more saturated)
        if competitor_count == 0:
            competition_score = 50.0  # neutral when unmeasured
        else:
            count_pressure = min(60.0, competitor_count * 2.5)
            review_moat = min(40.0, ((avg_reviews or 0) / 500.0) * 40.0)
            competition_score = round(min(100.0, count_pressure + review_moat), 1)

        # 3. Keyword Opportunity Score (0-100)
        long_tail_count = sum(1 for kw in item.keywords if len(kw.split()) >= 3)
        keyword_opportunity = round(
            min(100.0, 35.0 + (long_tail_count * 12.0) + min(25.0, item.search_suggestions_count * 2.5)),
            1,
        )

        # 4. Market Gap Score (0-100)
        gap_count = len(item.review_complaint_themes)
        market_gap = round(min(100.0, 35.0 + gap_count * 15.0), 1)

        # 5. Composite Opportunity Score (exact configurable weighted formula)
        opportunity_score = round(
            (demand_score * w.demand)
            + ((100.0 - competition_score) * w.competition_inverse)
            + (keyword_opportunity * w.keyword_opportunity)
            + (market_gap * w.market_gap),
            1,
        )

        # 6. Separate Data Confidence Score (penalizes missing or outdated sources)
        confidence = 100.0
        penalties: List[str] = []
        if competitor_count == 0:
            confidence -= 30.0
            penalties.append("No measured competitor listings collected (-30)")
        if not measured_reviews:
            confidence -= 15.0
            penalties.append("Review counts unavailable (-15)")
        if item.trends_index is None:
            confidence -= 20.0
            penalties.append("Google Trends index unavailable (-20)")
        if item.search_suggestions_count == 0:
            confidence -= 10.0
            penalties.append("No autocomplete suggestion depth (-10)")
        if item.data_age_days > 30:
            age_penalty = min(25.0, (item.data_age_days - 30) * 0.5)
            confidence -= age_penalty
            penalties.append(f"Dataset is {item.data_age_days} days old (-{age_penalty:.1f})")
        confidence_score = round(max(0.0, confidence), 1)

        risks = list(penalties)
        if competition_score >= 70:
            risks.append("High review moat among observed listings may increase ad spend.")
        risks.append("Scores are analytical estimates and do not guarantee KDP ranking or profitability.")

        suggested_formats = self._suggest_formats(item.category)

        return {
            "niche_name": item.niche_name,
            "category": item.category,
            "target_audience": item.target_audience,
            "opportunity_score": opportunity_score,
            "scores": {
                "demand_score": {
                    "value": demand_score,
                    "classification": "estimated",
                    "explanation": "Derived from relative trends interest and autocomplete depth; does NOT represent actual unit sales.",
                },
                "competition_score": {
                    "value": competition_score,
                    "classification": "estimated_from_measured" if competitor_count else "estimated",
                    "explanation": "Higher score indicates denser competitor count and higher average review counts.",
                },
                "keyword_opportunity_score": {
                    "value": keyword_opportunity,
                    "classification": "estimated",
                    "explanation": "Measures long-tail phrase specificity and suggestion coverage.",
                },
                "market_gap_score": {
                    "value": market_gap,
                    "classification": "estimated",
                    "explanation": "Reflects recurring buyer complaint themes addressable in a new edition.",
                },
                "data_confidence_score": {
                    "value": confidence_score,
                    "classification": "measured_completeness",
                    "explanation": "Evaluates coverage and recency of measured data sources.",
                },
            },
            "weights_used": {
                "demand": w.demand,
                "competition_inverse": w.competition_inverse,
                "keyword_opportunity": w.keyword_opportunity,
                "market_gap": w.market_gap,
            },
            "measured_inputs": {
                "competitor_count": competitor_count,
                "average_observed_reviews": avg_reviews if avg_reviews is not None else NOT_AVAILABLE,
                "search_suggestions_count": item.search_suggestions_count,
                "trends_index": item.trends_index if item.trends_index is not None else NOT_AVAILABLE,
                "sales_volume": NOT_AVAILABLE,
            },
            "evidence": [c.source_url for c in item.competitors if c.source_url != NOT_AVAILABLE],
            "risks": risks,
            "suggested_book_formats": suggested_formats,
            "research_confidence": confidence_score,
        }

    def rank_niches(
        self,
        items: List[NicheScoreInput],
        weights: Optional[ScoringWeights] = None,
    ) -> List[Dict[str, Any]]:
        scored = [self.score(item, weights=weights) for item in items]
        return sorted(scored, key=lambda x: x["opportunity_score"], reverse=True)

    @staticmethod
    def _suggest_formats(category: str) -> List[str]:
        low = category.lower()
        if "color" in low or "activity" in low:
            return ["8.5\" × 11\" Paperback (Single-Sided)", "8.5\" × 8.5\" Square Paperback"]
        if "child" in low:
            return ["8.5\" × 8.5\" Premium Color Paperback", "8.5\" × 11\" Picture Book"]
        if "puzzle" in low:
            return ["8.5\" × 11\" Large Print Paperback", "6\" × 9\" Travel Paperback"]
        return ["6\" × 9\" Trade Paperback", "7\" × 10\" Guided Workbook"]


class MarketResearchService:
    """Orchestrates compliant source connectors and the NicheScoringEngine."""

    def __init__(self) -> None:
        self.paapi = AmazonPAAPIConnector()
        self.public_catalog = AmazonPublicCatalogConnector()
        self.trends = GoogleTrendsConnector()
        self.suggestions = SearchSuggestionConnector()
        self.keyword_api = AuthorizedKeywordAPIConnector()
        self.csv_connector = UserCSVDatasetConnector()
        self.scorer = NicheScoringEngine()

    async def run_compliant_research(
        self,
        query: str,
        category: str,
        target_audience: str,
        marketplace: str = "amazon.com",
        csv_dataset: Optional[str] = None,
        weights: Optional[ScoringWeights] = None,
    ) -> Dict[str, Any]:
        collected_at = datetime.now(timezone.utc).isoformat()
        paapi_res = await self.paapi.fetch(query, marketplace)
        catalog_res = await self.public_catalog.fetch(query, marketplace)
        suggestion_res = await self.suggestions.fetch(query, marketplace)
        keyword_api_res = await self.keyword_api.fetch(query, marketplace)
        trends_res = await self.trends.get_interest_over_time([query])

        csv_records = self.csv_connector.parse_csv(csv_dataset) if csv_dataset else []
        suggestions_list: List[str] = suggestion_res.get("suggestions", [])

        score_report = self.scorer.score(
            NicheScoreInput(
                niche_name=query,
                category=category,
                target_audience=target_audience,
                keywords=suggestions_list or [query],
                competitors=csv_records,
                trends_index=None,
                search_suggestions_count=len(suggestions_list),
                review_complaint_themes=[],
                data_age_days=0,
            ),
            weights=weights,
        )

        return {
            "query": query,
            "marketplace": marketplace,
            "collected_at": collected_at,
            "connectors": {
                "amazon_paapi": paapi_res["status"],
                "amazon_public_catalog": catalog_res["status"],
                "search_suggestions": suggestion_res["status"],
                "authorized_keyword_api": keyword_api_res["status"],
                "google_trends": trends_res["trend_direction"],
                "user_csv_dataset": f"{len(csv_records)} records" if csv_records else NOT_AVAILABLE,
            },
            "discovered_keywords": suggestions_list,
            "observed_competitors": [c.__dict__ for c in csv_records],
            "ranked_niches": [score_report],
            "citations": [
                src
                for src in [
                    suggestion_res.get("source_url"),
                    trends_res.get("source_url"),
                    catalog_res.get("source_url"),
                ]
                if src
            ],
        }
