from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.integrations.llm.router import LLMRouter
from app.services.book_service import BookService, PageModel


class WritingAgent(BaseAgent):
    """
    Agent 6: Writing Agent.
    Generates original per-page structured JSON content tailored to each of the 7 supported
    book types, verifies puzzle solutions programmatically, avoids repetition/copyright issues,
    persists every page individually, and supports single-page regeneration.
    """

    name = "WritingAgent"

    def __init__(
        self,
        llm_router: LLMRouter,
        book_service: Optional[BookService] = None,
    ) -> None:
        super().__init__(llm_router)
        self.book_service = book_service or BookService()

    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        book_type = str(payload.get("book_type") or context.book_type)
        topic = str(payload.get("topic") or "Original Theme")
        page_numbers: List[int] = payload.get("page_numbers") or [1, 2, 3, 4]
        revision_note = str(payload.get("revision_note") or "").strip()
        project_id: UUID = context.project_id or uuid4()

        generated_pages: List[Dict[str, Any]] = []
        total_prompt = 0
        total_completion = 0
        total_cost = 0.0
        seen_headings: set[str] = set()

        for num in page_numbers:
            content = await self._generate_single_page(
                book_type=book_type,
                topic=topic,
                page_number=int(num),
                revision_note=revision_note,
                context=context,
                seen_headings=seen_headings,
            )
            page_payload = content["page_json"]
            seen_headings.add(str(page_payload.get("heading", "")).lower())

            total_prompt += content["prompt_tokens"]
            total_completion += content["completion_tokens"]
            total_cost += content["estimated_cost_usd"]

            model = PageModel(
                id=uuid4(),
                project_id=project_id,
                page_number=int(num),
                page_type=str(page_payload.get("page_type", "content")),
                content_json=page_payload,
                status="draft",
            )
            self.book_service.save_page(model)
            generated_pages.append(
                {
                    "id": str(model.id),
                    "page_number": model.page_number,
                    "page_type": model.page_type,
                    "content_json": model.content_json,
                }
            )

        return AgentResult(
            agent_name=self.name,
            status="completed",
            summary=f"Generated {len(generated_pages)} original page(s) for {book_type} ('{topic}').",
            data={
                "project_id": str(project_id),
                "book_type": book_type,
                "pages": generated_pages,
            },
            prompt_tokens=total_prompt,
            completion_tokens=total_completion,
            estimated_cost_usd=round(total_cost, 6),
        )

    async def regenerate_page(
        self,
        page_number: int,
        book_type: str,
        topic: str,
        revision_note: str,
        context: AgentContext,
    ) -> AgentResult:
        return await self.run(
            payload={
                "book_type": book_type,
                "topic": topic,
                "page_numbers": [page_number],
                "revision_note": revision_note,
            },
            context=context,
        )

    async def _generate_single_page(
        self,
        book_type: str,
        topic: str,
        page_number: int,
        revision_note: str,
        context: AgentContext,
        seen_headings: set[str],
    ) -> Dict[str, Any]:
        llm_resp = await self._call_gateway_json(
            system_prompt=(
                f"You are a KDP Writing Agent crafting original {book_type} content. "
                "Return valid JSON. Never copy copyrighted works, never fabricate research citations, "
                "preserve consistent editorial tone, and avoid repeating previous headings."
            ),
            user_prompt=(
                f"Topic: {topic}\nPage number: {page_number}\nAudience: {context.target_audience}\n"
                f"Previous headings to avoid repeating: {sorted(seen_headings)}\n"
                f"Revision instructions: {revision_note or 'None'}"
            ),
            context=context,
        )

        if llm_resp and llm_resp.parsed_json:
            page_json = llm_resp.parsed_json
        else:
            page_json = self._deterministic_page_by_type(book_type, topic, page_number, revision_note)

        # Programmatic puzzle verification for Puzzle Books
        if book_type == "Puzzle Books" and "grid" in page_json and "words" in page_json:
            verification = self.book_service.verify_word_search_solution(
                page_json["grid"], page_json["words"]
            )
            page_json["solution_verification"] = verification

        return {
            "page_json": page_json,
            "prompt_tokens": llm_resp.prompt_tokens if llm_resp else 0,
            "completion_tokens": llm_resp.completion_tokens if llm_resp else 0,
            "estimated_cost_usd": llm_resp.estimated_cost_usd if llm_resp else 0.0,
        }

    @staticmethod
    def _deterministic_page_by_type(
        book_type: str, topic: str, page_number: int, revision_note: str
    ) -> Dict[str, Any]:
        if book_type == "Coloring Books":
            return {
                "page_type": "coloring_brief",
                "heading": f"Scene {page_number}: {topic} Botanical Composition",
                "illustration_brief": (
                    f"Clean bold black ink line art depicting an original {topic} scene #{page_number}, "
                    "centered with generous white margins, crisp enclosed shapes, zero gray shading."
                ),
                "page_description": f"Single-sided coloring illustration #{page_number} ({revision_note or 'standard density'}).",
            }
        if book_type == "Activity Books":
            return {
                "page_type": "activity",
                "heading": f"Activity {page_number}: {topic} Challenge",
                "instructions": "Complete the guided matching and pattern exercise below.",
                "exercises": [
                    f"Step 1: Trace the key elements of {topic} exercise {page_number}.",
                    "Step 2: Circle the three items that share the same pattern.",
                ],
                "answer_key_ref": f"Back-matter key #{page_number}",
            }
        if book_type == "Puzzle Books":
            words = ["FOREST", "RIVER", "CEDAR"]
            grid = [
                "FORESTXAB",
                "QRIVERZCD",
                "MCEDARYEF",
                "PLKJHGFDS",
                "ZXCVBNMQW",
            ]
            verification = BookService.verify_word_search_solution(grid, words)
            return {
                "page_type": "puzzle",
                "heading": f"Word Search #{page_number}: {topic}",
                "puzzle_kind": "word_search",
                "words": words,
                "grid": grid,
                "solution_verification": verification,
            }
        if book_type == "Low Content Books":
            return {
                "page_type": "low_content_layout",
                "heading": f"Daily Log — Page {page_number}",
                "layout_template": "structured_tracker",
                "writing_areas": ["Top 3 Priorities", "Focus Notes", "Evening Reflection"],
                "line_spacing_pt": 20,
            }
        if book_type == "Children's Books":
            return {
                "page_type": "story_spread",
                "heading": f"Spread {page_number}",
                "story_text": (
                    f"On morning number {page_number}, Pippa discovered a new clue along the {topic} trail "
                    "and invited her friends to explore with kindness and curiosity."
                ),
                "illustration_brief": f"Warm storybook watercolor scene matching spread {page_number} of {topic}.",
                "reading_level": "Early Reader (Ages 4-8)",
            }
        if book_type == "Guides":
            return {
                "page_type": "guide_section",
                "heading": f"Section {page_number}: Practical Foundations of {topic}",
                "body_text": (
                    f"This section outlines repeatable frameworks for applying {topic} step by step. "
                    "All quantitative claims should be cross-checked against primary references prior to print."
                ),
                "factual_verification_status": "requires_author_source_check",
                "citations": [],
            }
        # Journals
        return {
            "page_type": "journal_prompt",
            "heading": f"Reflection Prompt #{page_number}",
            "prompt": f"What small moment connected to {topic} brought you clarity today, and why?",
            "lined_rows": 18,
            "affirmation_footer": "Progress grows from steady, honest reflection.",
        }
