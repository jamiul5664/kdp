from statistics import mean
from typing import Any, Dict, List
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.integrations.amazon.connectors import NOT_AVAILABLE


class CompetitorAgent(BaseAgent):
    """
    Agent 3: Competitor Discovery & Comparison Agent.
    Compares observed KDP listings strictly on measured fields (price, rating, review count, BSR)
    without inventing unit sales.
    """

    name = "CompetitorAgent"

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        listings: List[Dict[str, Any]] = payload.get("competitors") or []

        prices = [float(x["price"]) for x in listings if isinstance(x.get("price"), (int, float))]
        ratings = [float(x["rating"]) for x in listings if isinstance(x.get("rating"), (int, float))]
        reviews = [int(x["review_count"]) for x in listings if isinstance(x.get("review_count"), int)]
        ranks = [int(x["bestseller_rank"]) for x in listings if isinstance(x.get("bestseller_rank"), int)]

        benchmarks = {
            "observed_count": len(listings),
            "average_price_usd": round(mean(prices), 2) if prices else NOT_AVAILABLE,
            "price_range_usd": [min(prices), max(prices)] if prices else NOT_AVAILABLE,
            "average_rating": round(mean(ratings), 2) if ratings else NOT_AVAILABLE,
            "average_review_count": round(mean(reviews), 1) if reviews else NOT_AVAILABLE,
            "best_observed_bsr": min(ranks) if ranks else NOT_AVAILABLE,
            "estimated_monthly_sales": NOT_AVAILABLE,
        }

        llm_resp = await self._call_gateway_text(
            system_prompt=(
                "Analyze observed Amazon KDP competitor benchmarks. Never claim review counts are sales "
                "and never invent revenue figures."
            ),
            user_prompt=f"Competitor benchmarks: {benchmarks}",
            context=context,
        )

        summary = (
            llm_resp.text
            if llm_resp and llm_resp.text
            else f"Compared {len(listings)} observed competitor listing(s) with transparent benchmark metrics."
        )

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=summary,
            data={"benchmarks": benchmarks, "competitors": listings},
            prompt_tokens=llm_resp.prompt_tokens if llm_resp else 0,
            completion_tokens=llm_resp.completion_tokens if llm_resp else 0,
            estimated_cost_usd=llm_resp.estimated_cost_usd if llm_resp else 0.0,
        )
