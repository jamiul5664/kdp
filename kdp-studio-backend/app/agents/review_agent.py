from collections import Counter
from typing import Any, Dict, List
from app.agents.base import AgentContext, AgentResult, BaseAgent


COMPLAINT_KEYWORDS = {
    "bleed_through": ["bleed", "thin paper", "marker", "double-sided", "double sided"],
    "font_size": ["too small", "tiny font", "hard to read", "print size"],
    "repetitive_content": ["repetitive", "duplicate", "same page", "ai slop", "copy"],
    "binding_margins": ["gutter", "margin", "cut off", "binding", "spine"],
    "answer_key_errors": ["wrong answer", "missing answer", "typo", "error in solution"],
}


class CustomerReviewAgent(BaseAgent):
    """
    Agent 4: Customer Review & Market Gap Agent.
    Extracts buyer praise themes, recurring product complaints, and actionable book improvements
    from authorized/user-provided review texts.
    """

    name = "CustomerReviewAgent"

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        reviews: List[str] = [str(r) for r in payload.get("reviews", []) if str(r).strip()]
        theme_counts: Counter[str] = Counter()

        for text in reviews:
            low = text.lower()
            for theme, terms in COMPLAINT_KEYWORDS.items():
                if any(term in low for term in terms):
                    theme_counts[theme] += 1

        market_gaps = [
            {
                "theme": theme,
                "mentions": count,
                "recommended_fix": self._fix_for_theme(theme),
            }
            for theme, count in theme_counts.most_common()
        ]

        llm_resp = await self._call_gateway_text(
            system_prompt=(
                "Synthesize customer review feedback into concrete, actionable KDP interior and design "
                "improvements. Only reference themes supported by the supplied reviews."
            ),
            user_prompt=f"Total supplied reviews: {len(reviews)}\nDetected themes: {market_gaps}",
            context=context,
        )

        summary = (
            llm_resp.text
            if llm_resp and llm_resp.text
            else f"Analyzed {len(reviews)} review record(s) and identified {len(market_gaps)} actionable gap theme(s)."
        )

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=summary,
            data={
                "reviews_analyzed": len(reviews),
                "complaint_themes": [g["theme"] for g in market_gaps],
                "market_gaps": market_gaps,
            },
            prompt_tokens=llm_resp.prompt_tokens if llm_resp else 0,
            completion_tokens=llm_resp.completion_tokens if llm_resp else 0,
            estimated_cost_usd=llm_resp.estimated_cost_usd if llm_resp else 0.0,
        )

    @staticmethod
    def _fix_for_theme(theme: str) -> str:
        fixes = {
            "bleed_through": "Use single-sided layouts with blank reverse pages so markers do not ruin the next illustration.",
            "font_size": "Use large-print typography (14pt–16pt body) with generous line spacing.",
            "repetitive_content": "Ensure every page brief is distinct and run duplicate-content checks prior to approval.",
            "binding_margins": "Increase inside gutter margin according to KDP page-count tiers and keep text inside safe zones.",
            "answer_key_errors": "Programmatically verify every puzzle grid and answer key before interior PDF export.",
        }
        return fixes.get(theme, "Address buyer feedback directly in book specifications.")
