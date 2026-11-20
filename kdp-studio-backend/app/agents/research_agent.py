from typing import Any, Dict, Optional
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.integrations.llm.router import LLMRouter
from app.services.research_service import MarketResearchService, ScoringWeights


class ResearchAgent(BaseAgent):
    """
    Agent 1: Compliant KDP Market Research Agent.
    Delegates source collection to MarketResearchService connectors and synthesizes
    findings via LLMRouter without ever fabricating sales volume or bypassing access controls.
    """

    name = "ResearchAgent"

    def __init__(
        self,
        llm_router: LLMRouter,
        research_service: Optional[MarketResearchService] = None,
    ) -> None:
        super().__init__(llm_router)
        self.research_service = research_service or MarketResearchService()

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        query = str(payload.get("query", "")).strip()
        if not query:
            return AgentResult(
                agent_name=self.name,
                status="failed",
                summary="Research query is required.",
                error="Missing required field: query",
            )

        category = str(payload.get("category") or context.book_type)
        audience = str(payload.get("target_audience") or context.target_audience)
        marketplace = str(payload.get("marketplace") or context.marketplace)
        csv_dataset = payload.get("csv_dataset")

        weights_dict = payload.get("weights")
        weights = None
        if isinstance(weights_dict, dict):
            weights = ScoringWeights(
                demand=float(weights_dict.get("demand", 0.35)),
                competition_inverse=float(weights_dict.get("competition_inverse", 0.30)),
                keyword_opportunity=float(weights_dict.get("keyword_opportunity", 0.20)),
                market_gap=float(weights_dict.get("market_gap", 0.15)),
            )

        report = await self.research_service.run_compliant_research(
            query=query,
            category=category,
            target_audience=audience,
            marketplace=marketplace,
            csv_dataset=csv_dataset,
            weights=weights,
        )

        llm_resp = await self._call_gateway_text(
            system_prompt=(
                "You are a compliant Amazon KDP market research analyst. Summarize ONLY the observed "
                "data provided. Never invent sales figures, never claim review counts equal sales, "
                "and clearly state 'Not Available' for unavailable sources."
            ),
            user_prompt=(
                f"Query: {query}\nMarketplace: {marketplace}\n"
                f"Discovered keywords: {report['discovered_keywords'][:10]}\n"
                f"Observed competitors: {len(report['observed_competitors'])}\n"
                f"Connector statuses: {report['connectors']}"
            ),
            context=context,
        )

        executive_summary = (
            llm_resp.text
            if llm_resp and llm_resp.text
            else (
                f"Completed compliant market research for '{query}' on {marketplace}. "
                f"Discovered {len(report['discovered_keywords'])} keyword suggestions and "
                f"{len(report['observed_competitors'])} observed competitor records. "
                "Sales volume is Not Available from public sources."
            )
        )
        report["executive_summary"] = executive_summary

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=executive_summary,
            data=report,
            prompt_tokens=llm_resp.prompt_tokens if llm_resp else 0,
            completion_tokens=llm_resp.completion_tokens if llm_resp else 0,
            estimated_cost_usd=llm_resp.estimated_cost_usd if llm_resp else 0.0,
        )
