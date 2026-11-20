from typing import Any, Dict, List, Optional
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.integrations.amazon.connectors import ResearchListingRecord
from app.integrations.llm.router import LLMRouter
from app.services.research_service import NicheScoreInput, NicheScoringEngine, ScoringWeights


class NicheFinderAgent(BaseAgent):
    """
    Agent 2: Niche Finder & Opportunity Scoring Agent.
    Ranks candidate niches using the transparent configurable NicheScoringEngine formula
    and separates data confidence from opportunity score.
    """

    name = "NicheFinderAgent"

    def __init__(
        self,
        llm_router: LLMRouter,
        scoring_engine: Optional[NicheScoringEngine] = None,
    ) -> None:
        super().__init__(llm_router)
        self.scoring_engine = scoring_engine or NicheScoringEngine()

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        candidates_raw: List[Dict[str, Any]] = payload.get("candidates") or []
        if not candidates_raw:
            base_query = str(payload.get("query") or "KDP Book Niche")
            candidates_raw = [
                {
                    "niche_name": base_query,
                    "category": payload.get("category") or context.book_type,
                    "target_audience": payload.get("target_audience") or context.target_audience,
                    "keywords": payload.get("discovered_keywords") or [base_query],
                    "competitors": payload.get("observed_competitors") or [],
                    "trends_index": payload.get("trends_index"),
                    "search_suggestions_count": len(payload.get("discovered_keywords") or []),
                    "review_complaint_themes": payload.get("review_complaint_themes") or [],
                    "data_age_days": int(payload.get("data_age_days", 0)),
                }
            ]

        weights_raw = payload.get("weights")
        weights = None
        if isinstance(weights_raw, dict):
            weights = ScoringWeights(
                demand=float(weights_raw.get("demand", 0.35)),
                competition_inverse=float(weights_raw.get("competition_inverse", 0.30)),
                keyword_opportunity=float(weights_raw.get("keyword_opportunity", 0.20)),
                market_gap=float(weights_raw.get("market_gap", 0.15)),
            )

        score_inputs: List[NicheScoreInput] = []
        for c in candidates_raw:
            competitor_objs: List[ResearchListingRecord] = []
            for comp in c.get("competitors", []):
                if isinstance(comp, ResearchListingRecord):
                    competitor_objs.append(comp)
                elif isinstance(comp, dict):
                    competitor_objs.append(
                        ResearchListingRecord(
                            title=str(comp.get("title", "Not Available")),
                            asin=str(comp.get("asin", "Not Available")),
                            category=str(comp.get("category", "Not Available")),
                            price=comp.get("price", "Not Available"),
                            rating=comp.get("rating", "Not Available"),
                            review_count=comp.get("review_count", "Not Available"),
                            bestseller_rank=comp.get("bestseller_rank", "Not Available"),
                            publication_info=str(comp.get("publication_info", "Not Available")),
                            source_url=str(comp.get("source_url", "Not Available")),
                        )
                    )
            score_inputs.append(
                NicheScoreInput(
                    niche_name=str(c.get("niche_name", "Untitled Niche")),
                    category=str(c.get("category") or context.book_type),
                    target_audience=str(c.get("target_audience") or context.target_audience),
                    keywords=[str(k) for k in c.get("keywords", [])],
                    competitors=competitor_objs,
                    trends_index=c.get("trends_index"),
                    search_suggestions_count=int(c.get("search_suggestions_count", 0)),
                    review_complaint_themes=[str(t) for t in c.get("review_complaint_themes", [])],
                    data_age_days=int(c.get("data_age_days", 0)),
                )
            )

        ranked = self.scoring_engine.rank_niches(score_inputs, weights=weights)
        top = ranked[0] if ranked else None

        llm_resp = await self._call_gateway_text(
            system_prompt=(
                "You are a KDP niche strategy advisor. Explain the ranked niche opportunities objectively. "
                "Highlight data confidence penalties and never guarantee sales or profitability."
            ),
            user_prompt=f"Ranked niches: {ranked[:3]}",
            context=context,
        )

        summary = (
            llm_resp.text
            if llm_resp and llm_resp.text
            else (
                f"Ranked {len(ranked)} niche candidate(s). Top opportunity: "
                f"'{top['niche_name']}' (Opportunity {top['opportunity_score']}/100, "
                f"Data Confidence {top['research_confidence']}/100)."
                if top
                else "No niches scored."
            )
        )

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=summary,
            data={"ranked_niches": ranked, "disclaimer": "Scores are estimates, not profit guarantees."},
            prompt_tokens=llm_resp.prompt_tokens if llm_resp else 0,
            completion_tokens=llm_resp.completion_tokens if llm_resp else 0,
            estimated_cost_usd=llm_resp.estimated_cost_usd if llm_resp else 0.0,
        )
