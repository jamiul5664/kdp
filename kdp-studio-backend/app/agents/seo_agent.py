from typing import Any, Dict, List, Optional
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.integrations.llm.router import LLMRouter
from app.services.seo_service import KDPSeoService

MISLEADING_CLAIM_PHRASES = (
    "guaranteed bestseller",
    "#1 bestseller",
    "number one bestseller",
    "guaranteed income",
    "guaranteed sales",
    "instant money",
    "free gift inside",
)


class KDPSeoAgent(BaseAgent):
    """
    Agent 9 (Agent B): KDP SEO & Metadata Compliance Agent.
    Generates title, subtitle, description, 7 backend keyword phrases, category suggestions,
    and audience description; audits keyword relevance, duplication, misleading claims,
    trademark risks, and KDP metadata policies. Never guarantees ranking or sales; requires
    explicit user review before final export.
    """

    name = "KDPSeoAgent"

    def __init__(
        self,
        llm_router: LLMRouter,
        seo_service: Optional[KDPSeoService] = None,
    ) -> None:
        super().__init__(llm_router)
        self.seo_service = seo_service or KDPSeoService()

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        topic = str(payload.get("topic") or payload.get("title") or "Original KDP Book").strip()
        book_type = str(payload.get("book_type") or context.book_type)
        audience = str(payload.get("target_audience") or context.target_audience)
        author_name = str(payload.get("author_name") or "Independent Publisher")

        llm_resp = await self._call_gateway_json(
            system_prompt=(
                "You are an Amazon KDP Metadata & SEO specialist. Return JSON with keys: "
                "title, subtitle, description, seven_keywords (array of exactly 7 unique phrases <=50 chars), "
                "categories (array of 3 relevant BISAC/KDP categories), audience_description. "
                "Never include trademarks, promotional pricing claims, or bestseller/ranking guarantees."
            ),
            user_prompt=f"Topic: {topic}\nBook type: {book_type}\nAudience: {audience}",
            context=context,
        )

        generated = (llm_resp.parsed_json if llm_resp and llm_resp.parsed_json else {}) or {}

        title = str(payload.get("title") or generated.get("title") or topic).strip()
        subtitle = str(
            payload.get("subtitle")
            or generated.get("subtitle")
            or f"Original {book_type.rstrip('s')} Crafted for {audience}"
        ).strip()
        description = str(
            payload.get("description")
            or generated.get("description")
            or (
                f"Discover an original {book_type.lower()} dedicated to {topic}, carefully organized "
                f"for {audience}. Designed with print-ready margins, clear layouts, and distinct pages "
                "for an engaging hands-on reading and creative experience from start to finish."
            )
        ).strip()

        raw_keywords: List[str] = payload.get("keywords") or generated.get("seven_keywords") or [
            f"{topic.lower()} workbook",
            f"creative {book_type.lower()} gift",
            f"{audience.lower()} relaxing pages",
            "print ready paperback edition",
            "mindful screen free hobby",
            "original illustrations collection",
            "thoughtful weekend activity book",
        ]
        seven_keywords = [str(k).strip()[:50] for k in raw_keywords[:7]]
        while len(seven_keywords) < 7:
            seven_keywords.append(f"{topic.lower()[:34]} slot {len(seven_keywords) + 1}")

        categories: List[str] = payload.get("categories") or generated.get("categories") or [
            f"Crafts, Hobbies & Home / {book_type}",
            "Self-Help / Creativity & Mindfulness",
            "Humor & Entertainment / Puzzles & Activities",
        ]
        categories = [str(c) for c in categories[:3]]

        audience_description = str(
            generated.get("audience_description")
            or f"Intended for {audience} seeking an original, well-formatted {book_type.lower()} on {topic}."
        )

        audit = self.seo_service.audit_metadata(
            title=title,
            subtitle=subtitle,
            description=description,
            keywords=seven_keywords,
            categories=categories,
            target_audience=audience,
            author_name=author_name,
        )

        combined_lower = f"{title} {subtitle} {description} {' '.join(seven_keywords)}".lower()
        misleading_hits = [p for p in MISLEADING_CLAIM_PHRASES if p in combined_lower]
        if misleading_hits:
            audit["policy_concerns"].append(
                f"Misleading ranking/promotional claim detected: {misleading_hits}."
            )

        relevance_matches = sum(
            1
            for kw in seven_keywords
            if any(tok in kw.lower() for tok in topic.lower().split() if len(tok) > 2)
            or any(tok in kw.lower() for tok in book_type.lower().split() if len(tok) > 2)
        )
        keyword_relevance = {
            "relevant_slots": relevance_matches,
            "total_slots": len(seven_keywords),
            "status": "pass" if relevance_matches >= 2 else "warning",
        }

        warnings = list(audit["policy_concerns"])
        if audit["duplicate_keywords"]:
            warnings.append(
                f"Duplicate words repeated between title/subtitle and backend keywords: {audit['duplicate_keywords']}"
            )

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=(
                f"Prepared KDP SEO package (Completeness {audit['completeness_score']}/100, "
                f"{len(warnings)} warning(s)). User review is required before final export."
            ),
            data={
                "metadata": {
                    "title": title,
                    "subtitle": subtitle,
                    "description": description,
                    "seven_keyword_phrases": seven_keywords,
                    "category_suggestions": categories,
                    "audience_description": audience_description,
                },
                "checks": {
                    "keyword_relevance": keyword_relevance,
                    "duplicate_keywords": audit["duplicate_keywords"],
                    "misleading_claims": misleading_hits,
                    "trademark_risks": audit["trademark_warnings"],
                    "policy_concerns": audit["policy_concerns"],
                    "completeness_score": audit["completeness_score"],
                    "character_counts": audit["character_counts"],
                },
                "requires_user_review_before_export": True,
                "disclaimer": (
                    "Metadata recommendations follow Amazon KDP guidelines and do not guarantee "
                    "search rankings, visibility, or sales."
                ),
            },
            prompt_tokens=llm_resp.prompt_tokens if llm_resp else 0,
            completion_tokens=llm_resp.completion_tokens if llm_resp else 0,
            estimated_cost_usd=llm_resp.estimated_cost_usd if llm_resp else 0.0,
            warnings=warnings,
        )
