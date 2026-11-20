from typing import Any, Dict, List
from app.agents.base import AgentContext, AgentResult, BaseAgent

SUPPORTED_BOOK_TYPES = (
    "Coloring Books",
    "Activity Books",
    "Puzzle Books",
    "Low Content Books",
    "Children's Books",
    "Guides",
    "Journals",
)

BOOK_TYPE_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "Coloring Books": {
        "trim_size": "8.5x11",
        "trim_width_in": 8.5,
        "trim_height_in": 11.0,
        "bleed": True,
        "single_sided": True,
        "default_pages": 64,
        "interior_type": "Black & White",
    },
    "Activity Books": {
        "trim_size": "8.5x11",
        "trim_width_in": 8.5,
        "trim_height_in": 11.0,
        "bleed": True,
        "single_sided": False,
        "default_pages": 80,
        "interior_type": "Black & White",
    },
    "Puzzle Books": {
        "trim_size": "8.5x11",
        "trim_width_in": 8.5,
        "trim_height_in": 11.0,
        "bleed": False,
        "single_sided": False,
        "default_pages": 100,
        "interior_type": "Black & White",
    },
    "Low Content Books": {
        "trim_size": "6x9",
        "trim_width_in": 6.0,
        "trim_height_in": 9.0,
        "bleed": False,
        "single_sided": False,
        "default_pages": 120,
        "interior_type": "Black & White",
    },
    "Children's Books": {
        "trim_size": "8.5x8.5",
        "trim_width_in": 8.5,
        "trim_height_in": 8.5,
        "bleed": True,
        "single_sided": False,
        "default_pages": 32,
        "interior_type": "Premium Color",
    },
    "Guides": {
        "trim_size": "6x9",
        "trim_width_in": 6.0,
        "trim_height_in": 9.0,
        "bleed": False,
        "single_sided": False,
        "default_pages": 140,
        "interior_type": "Black & White",
    },
    "Journals": {
        "trim_size": "6x9",
        "trim_width_in": 6.0,
        "trim_height_in": 9.0,
        "bleed": False,
        "single_sided": False,
        "default_pages": 120,
        "interior_type": "Black & White",
    },
}


class BookPlannerAgent(BaseAgent):
    """
    Agent 5: Book Planner Agent.
    Supports all 7 KDP book types and returns a structured JSON blueprint containing
    concept, title, subtitle, target audience, age range, page count, chapters,
    page-by-page plan, and KDP interior design specifications.
    """

    name = "BookPlannerAgent"

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        book_type = str(payload.get("book_type") or context.book_type)
        if book_type not in SUPPORTED_BOOK_TYPES:
            return AgentResult(
                agent_name=self.name,
                status="failed",
                summary=f"Unsupported book type '{book_type}'.",
                error=f"Supported book types: {', '.join(SUPPORTED_BOOK_TYPES)}",
            )

        topic = str(payload.get("topic") or payload.get("niche_name") or "Original KDP Edition").strip()
        audience = str(payload.get("target_audience") or context.target_audience)
        age_range = payload.get("age_range") or (
            "Ages 4-8" if book_type == "Children's Books" else "Ages 6-10" if book_type == "Activity Books" else None
        )
        defaults = BOOK_TYPE_DEFAULTS[book_type]
        page_count = int(payload.get("page_count") or defaults["default_pages"])
        page_count = max(24, min(828, page_count))

        llm_resp = await self._call_gateway_json(
            system_prompt=(
                "You are an expert Amazon KDP book planner. Output strictly valid JSON describing an "
                "original, non-infringing book concept, title, subtitle, chapters, and page-by-page plan. "
                "Never use copyrighted characters or trademarks."
            ),
            user_prompt=(
                f"Book type: {book_type}\nTopic: {topic}\nTarget audience: {audience}\n"
                f"Page count: {page_count}\nTrim size: {defaults['trim_size']}"
            ),
            context=context,
        )

        if llm_resp and llm_resp.parsed_json:
            plan = llm_resp.parsed_json
            plan.setdefault("book_type", book_type)
            plan.setdefault("interior_specifications", defaults)
        else:
            plan = self._build_structured_plan(
                book_type=book_type,
                topic=topic,
                audience=audience,
                age_range=age_range,
                page_count=page_count,
                defaults=defaults,
            )

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=f"Prepared {book_type} blueprint '{plan['title']}' ({page_count} pages, {defaults['trim_size']}).",
            data=plan,
            prompt_tokens=llm_resp.prompt_tokens if llm_resp else 0,
            completion_tokens=llm_resp.completion_tokens if llm_resp else 0,
            estimated_cost_usd=llm_resp.estimated_cost_usd if llm_resp else 0.0,
        )

    @staticmethod
    def _build_structured_plan(
        book_type: str,
        topic: str,
        audience: str,
        age_range: Any,
        page_count: int,
        defaults: Dict[str, Any],
    ) -> Dict[str, Any]:
        chapters: List[Dict[str, Any]] = [
            {"chapter_number": 1, "title": "Front Matter & How to Use This Book", "page_range": [1, 4]},
            {"chapter_number": 2, "title": f"Core {topic} Collection — Part I", "page_range": [5, page_count // 2]},
            {"chapter_number": 3, "title": f"Core {topic} Collection — Part II", "page_range": [(page_count // 2) + 1, page_count - 4]},
            {"chapter_number": 4, "title": "Closing Notes / Answer Key & Next Steps", "page_range": [page_count - 3, page_count]},
        ]

        preview_pages = min(page_count, 24)
        page_plan: List[Dict[str, Any]] = []
        for num in range(1, preview_pages + 1):
            if num == 1:
                p_type, goal = "title_page", f"Title page for {topic}"
            elif num == 2:
                p_type, goal = "copyright", "Original copyright notice and edition details"
            elif num == 3:
                p_type, goal = "introduction", f"Reader welcome and instructions tailored to {audience}"
            elif defaults["single_sided"] and num % 2 == 0:
                p_type, goal = "blank_reverse", "Intentional blank reverse page to prevent ink bleed-through"
            else:
                p_type, goal = "content", f"Original {book_type.rstrip('s')} spread #{num}: unique {topic} theme"
            page_plan.append({"page_number": num, "page_type": p_type, "objective": goal})

        return {
            "book_type": book_type,
            "concept": f"An original, print-engineered {book_type.lower()} centered on {topic} for {audience}.",
            "title": f"{topic}: Original Edition",
            "subtitle": f"A Thoughtfully Crafted {book_type.rstrip('s')} Designed for {audience}",
            "target_audience": audience,
            "age_range": age_range,
            "page_count": page_count,
            "book_structure": {
                "front_matter_pages": 4,
                "body_pages": max(16, page_count - 8),
                "back_matter_pages": 4,
            },
            "chapter_outline": chapters,
            "page_by_page_plan": page_plan,
            "interior_specifications": {
                "trim_size": defaults["trim_size"],
                "trim_width_in": defaults["trim_width_in"],
                "trim_height_in": defaults["trim_height_in"],
                "bleed": defaults["bleed"],
                "single_sided": defaults["single_sided"],
                "interior_type": defaults["interior_type"],
                "paper_type": "white",
                "minimum_image_dpi": 300,
            },
            "compliance_notes": [
                "Original concept — zero copyrighted franchises or trademarked characters.",
                "Every page planned with unique prompts to prevent repetitive interiors.",
            ],
        }
