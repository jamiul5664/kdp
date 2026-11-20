import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from app.agents.base import AgentContext, AgentResult
from app.agents.competitor_agent import CompetitorAgent
from app.agents.cover_agent import CoverDesignerAgent
from app.agents.illustration_agent import IllustrationAgent
from app.agents.niche_agent import NicheFinderAgent
from app.agents.planner_agent import BookPlannerAgent
from app.agents.quality_agent import KDPQualityCheckerAgent
from app.agents.research_agent import ResearchAgent
from app.agents.review_agent import CustomerReviewAgent
from app.agents.seo_agent import KDPSeoAgent
from app.agents.writing_agent import WritingAgent
from app.integrations.llm.router import LLMRouter, get_default_llm_router
from app.services.approval_service import ApprovalEngine, ApprovalRecord, ApprovalType
from app.services.provider_management import MultiProviderManager


class WorkflowStage(str, Enum):
    INTENT_CLASSIFICATION = "intent_classification"
    TASK_PLANNING = "task_planning"
    RESEARCH = "research"
    WAIT_RESEARCH_APPROVAL = "wait_research_approval"
    BOOK_PLANNING = "book_planning"
    WAIT_OUTLINE_APPROVAL = "wait_outline_approval"
    WRITING_AND_ILLUSTRATION = "writing_and_illustration"
    WAIT_CONTENT_APPROVAL = "wait_content_approval"
    COVER_SEO_QUALITY = "cover_seo_quality"
    WAIT_FINAL_EXPORT_APPROVAL = "wait_final_export_approval"
    READY_FOR_EXPORT = "ready_for_export"
    CANCELLED = "cancelled"
    FAILED = "failed"


@dataclass
class WorkflowState:
    workflow_id: UUID
    project_id: UUID
    user_id: UUID
    current_stage: WorkflowStage = WorkflowStage.INTENT_CLASSIFICATION
    progress_pct: int = 0
    intent: str = "full_book_workflow"
    task_plan: List[str] = field(default_factory=list)
    agent_outputs: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    pending_approval_id: Optional[UUID] = None
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_estimated_cost_usd: float = 0.0
    cancelled: bool = False
    error: Optional[str] = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AgentOrchestrator:
    """
    Central AI Agent Orchestrator.
    Strictly delegates domain work to the 10 specialized agents and enforces mandatory
    Human-in-the-Loop approval checkpoints between every major stage:
      User Message -> Intent Classification -> Task Planning ->
      Research Agent -> Niche Finder Agent -> Research Report -> WAIT FOR USER APPROVAL ->
      Book Planner Agent -> WAIT FOR USER APPROVAL ->
      Writing / Illustration Agents -> WAIT FOR USER APPROVAL ->
      Cover Designer -> SEO Agent -> Quality Checker -> FINAL EXPORT APPROVAL.
    """

    def __init__(
        self,
        llm_router: Optional[LLMRouter] = None,
        approval_engine: Optional[ApprovalEngine] = None,
        provider_manager: Optional[MultiProviderManager] = None,
        max_task_retries: int = 2,
    ) -> None:
        self.llm = llm_router or get_default_llm_router()
        self.approvals = approval_engine or ApprovalEngine()
        self.provider_manager = provider_manager
        self.max_task_retries = max_task_retries

        # 10 Independent Specialized Agents
        self.research_agent = ResearchAgent(self.llm)
        self.niche_agent = NicheFinderAgent(self.llm)
        self.competitor_agent = CompetitorAgent(self.llm)
        self.review_agent = CustomerReviewAgent(self.llm)
        self.planner_agent = BookPlannerAgent(self.llm)
        self.writing_agent = WritingAgent(self.llm)
        self.illustration_agent = IllustrationAgent(self.llm)
        self.cover_agent = CoverDesignerAgent(self.llm)
        self.seo_agent = KDPSeoAgent(self.llm)
        self.quality_agent = KDPQualityCheckerAgent(self.llm)

        self._workflows: Dict[UUID, WorkflowState] = {}

    def resolve_task_route(
        self,
        user_id: UUID,
        task_key: str,
        override_config_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Resolves the active capability-validated provider and model for a KDP agent task."""
        if not self.provider_manager:
            return None
        candidates = self.provider_manager.resolve_route_candidates(
            user_id=str(user_id),
            task_key=task_key,
            override_config_id=override_config_id,
        )
        if not candidates:
            return None
        primary_rec, primary_model = candidates[0]
        return {
            "task_key": task_key,
            "config_id": primary_rec.id,
            "provider_name": primary_rec.provider_name,
            "provider_type": primary_rec.provider_type,
            "model_id": primary_model,
            "fallback_count": max(0, len(candidates) - 1),
        }

    def classify_intent(self, message: str) -> str:
        low = message.lower()
        if any(k in low for k in ("revise", "revision", "change", "regenerate")):
            return "revision_request"
        if any(k in low for k in ("seo", "keyword", "metadata", "category")):
            return "seo_optimization"
        if any(k in low for k in ("cover", "spine", "wrap")):
            return "cover_design"
        if any(k in low for k in ("quality", "preflight", "validate", "export")):
            return "quality_and_export"
        if any(k in low for k in ("outline", "plan", "chapter", "blueprint")):
            return "book_planning"
        return "full_book_workflow"

    def build_task_plan(self, intent: str) -> List[str]:
        if intent == "revision_request":
            return ["Load pending checkpoint", "Apply user revision instructions", "Re-submit approval checkpoint"]
        return [
            "1. ResearchAgent + NicheFinderAgent (+ Competitor/Review synthesis) -> WAIT FOR USER APPROVAL",
            "2. BookPlannerAgent -> WAIT FOR USER APPROVAL",
            "3. WritingAgent + IllustrationAgent -> WAIT FOR USER APPROVAL",
            "4. CoverDesignerAgent -> KDPSeoAgent -> KDPQualityCheckerAgent -> FINAL EXPORT APPROVAL",
        ]

    async def start_workflow(
        self,
        user_message: str,
        context: AgentContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> WorkflowState:
        """Stage 1: Intent Classification -> Task Planning -> Research & Niche Report -> WAIT FOR USER APPROVAL."""
        project_id = context.project_id or uuid4()
        context.project_id = project_id
        data = dict(payload or {})
        data.setdefault("query", user_message)

        intent = self.classify_intent(user_message)
        state = WorkflowState(
            workflow_id=uuid4(),
            project_id=project_id,
            user_id=context.user_id,
            current_stage=WorkflowStage.TASK_PLANNING,
            progress_pct=10,
            intent=intent,
            task_plan=self.build_task_plan(intent),
        )
        self._workflows[state.workflow_id] = state

        # Run Research Agent -> Niche Finder Agent -> Competitor & Review Agents
        state.current_stage = WorkflowStage.RESEARCH
        research_res = await self._run_with_retry(self.research_agent.run, data, context, state)
        if state.cancelled or research_res.status == "failed":
            return self._mark_failed_or_cancelled(state, research_res.error)

        niche_payload = {
            "query": data.get("query"),
            "category": data.get("category") or context.book_type,
            "target_audience": data.get("target_audience") or context.target_audience,
            "discovered_keywords": research_res.data.get("discovered_keywords", []),
            "observed_competitors": research_res.data.get("observed_competitors", []),
            "weights": data.get("weights"),
        }
        niche_res = await self._run_with_retry(self.niche_agent.run, niche_payload, context, state)
        comp_res = await self._run_with_retry(
            self.competitor_agent.run,
            {"competitors": research_res.data.get("observed_competitors", [])},
            context,
            state,
        )
        review_res = await self._run_with_retry(
            self.review_agent.run,
            {"reviews": data.get("reviews", [])},
            context,
            state,
        )

        combined_report = {
            "research": research_res.data,
            "niche_ranking": niche_res.data,
            "competitor_benchmarks": comp_res.data,
            "review_insights": review_res.data,
            "provider_routes": {
                "market_research": self.resolve_task_route(context.user_id, "market_research"),
                "competitor_analysis": self.resolve_task_route(context.user_id, "competitor_analysis"),
            },
        }
        state.agent_outputs["research_report"] = combined_report

        checkpoint: ApprovalRecord = self.approvals.create_checkpoint(
            project_id=project_id,
            owner_user_id=context.user_id,
            approval_type=ApprovalType.RESEARCH,
            agent_name="ResearchAgent+NicheFinderAgent",
            proposed_output=combined_report,
            explanation="Review market research report and ranked niche opportunities before Book Planning.",
        )
        state.pending_approval_id = checkpoint.id
        state.current_stage = WorkflowStage.WAIT_RESEARCH_APPROVAL
        state.progress_pct = 25
        state.updated_at = datetime.now(timezone.utc)
        return state

    async def advance_to_book_planning(
        self,
        workflow_id: UUID,
        context: AgentContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> WorkflowState:
        """Stage 2: Requires RESEARCH approval -> runs BookPlannerAgent -> WAIT FOR USER APPROVAL."""
        state = self._get_workflow(workflow_id)
        if state.cancelled:
            return state
        self.approvals.require_approval(state.project_id, ApprovalType.RESEARCH)

        state.current_stage = WorkflowStage.BOOK_PLANNING
        plan_res = await self._run_with_retry(self.planner_agent.run, payload or {}, context, state)
        if state.cancelled or plan_res.status == "failed":
            return self._mark_failed_or_cancelled(state, plan_res.error)

        state.agent_outputs["book_plan"] = plan_res.data
        checkpoint = self.approvals.create_checkpoint(
            project_id=state.project_id,
            owner_user_id=context.user_id,
            approval_type=ApprovalType.BOOK_OUTLINE,
            agent_name=self.planner_agent.name,
            proposed_output=plan_res.data,
            explanation="Approve book outline, chapter structure, and interior specs before content generation.",
        )
        state.pending_approval_id = checkpoint.id
        state.current_stage = WorkflowStage.WAIT_OUTLINE_APPROVAL
        state.progress_pct = 50
        state.updated_at = datetime.now(timezone.utc)
        return state

    async def advance_to_content_and_illustrations(
        self,
        workflow_id: UUID,
        context: AgentContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> WorkflowState:
        """Stage 3: Requires BOOK_OUTLINE approval -> WritingAgent + IllustrationAgent -> WAIT FOR USER APPROVAL."""
        state = self._get_workflow(workflow_id)
        if state.cancelled:
            return state
        self.approvals.require_approval(state.project_id, ApprovalType.BOOK_OUTLINE)

        state.current_stage = WorkflowStage.WRITING_AND_ILLUSTRATION
        data = dict(payload or {})
        write_res = await self._run_with_retry(self.writing_agent.run, data, context, state)
        if state.cancelled or write_res.status == "failed":
            return self._mark_failed_or_cancelled(state, write_res.error)

        briefs = [
            {
                "page_number": p["page_number"],
                "prompt": p["content_json"].get("illustration_brief")
                or p["content_json"].get("heading", "Original scene"),
            }
            for p in write_res.data.get("pages", [])
        ]
        illus_res = await self._run_with_retry(
            self.illustration_agent.run,
            {
                "page_briefs": briefs,
                "illustration_type": data.get("illustration_type", "coloring"),
                "target_width_in": data.get("trim_width_in", 8.5),
                "target_height_in": data.get("trim_height_in", 11.0),
            },
            context,
            state,
        )

        bundle = {"writing": write_res.data, "illustrations": illus_res.data}
        state.agent_outputs["content_and_illustrations"] = bundle

        checkpoint = self.approvals.create_checkpoint(
            project_id=state.project_id,
            owner_user_id=context.user_id,
            approval_type=ApprovalType.CONTENT,
            agent_name="WritingAgent+IllustrationAgent",
            proposed_output=bundle,
            explanation="Approve generated pages and verified 300 DPI illustrations before Cover, SEO & QA.",
        )
        state.pending_approval_id = checkpoint.id
        state.current_stage = WorkflowStage.WAIT_CONTENT_APPROVAL
        state.progress_pct = 75
        state.updated_at = datetime.now(timezone.utc)
        return state

    async def advance_to_cover_seo_and_quality(
        self,
        workflow_id: UUID,
        context: AgentContext,
        payload: Optional[Dict[str, Any]] = None,
    ) -> WorkflowState:
        """Stage 4: Requires CONTENT approval -> CoverDesigner -> KDPSeoAgent -> KDPQualityChecker -> FINAL EXPORT APPROVAL."""
        state = self._get_workflow(workflow_id)
        if state.cancelled:
            return state
        self.approvals.require_approval(state.project_id, ApprovalType.CONTENT)

        state.current_stage = WorkflowStage.COVER_SEO_QUALITY
        data = dict(payload or {})
        cover_res = await self._run_with_retry(self.cover_agent.run, data, context, state)
        seo_res = await self._run_with_retry(self.seo_agent.run, data, context, state)

        qa_payload = {
            **data,
            "cover_pdf_bytes": cover_res.data.get("pdf_bytes"),
            "cover_specifications": cover_res.data.get("specifications"),
        }
        qa_res = await self._run_with_retry(self.quality_agent.run, qa_payload, context, state)

        final_package = {
            "cover": {k: v for k, v in cover_res.data.items() if k != "pdf_bytes"},
            "seo": seo_res.data,
            "quality_report": qa_res.data,
        }
        state.agent_outputs["final_package"] = final_package

        checkpoint = self.approvals.create_checkpoint(
            project_id=state.project_id,
            owner_user_id=context.user_id,
            approval_type=ApprovalType.FINAL_EXPORT,
            agent_name="CoverDesignerAgent+KDPSeoAgent+KDPQualityCheckerAgent",
            proposed_output=final_package,
            explanation="Review cover wrap specs, SEO metadata compliance, and KDP Quality Checker report before final export.",
        )
        state.pending_approval_id = checkpoint.id
        state.current_stage = WorkflowStage.WAIT_FINAL_EXPORT_APPROVAL
        state.progress_pct = 95
        state.updated_at = datetime.now(timezone.utc)
        return state

    def cancel_workflow(self, workflow_id: UUID) -> WorkflowState:
        state = self._get_workflow(workflow_id)
        state.cancelled = True
        state.current_stage = WorkflowStage.CANCELLED
        state.updated_at = datetime.now(timezone.utc)
        return state

    def get_workflow(self, workflow_id: UUID) -> WorkflowState:
        return self._get_workflow(workflow_id)

    async def _run_with_retry(
        self,
        fn: Any,
        payload: Dict[str, Any],
        context: AgentContext,
        state: WorkflowState,
    ) -> AgentResult:
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_task_retries + 2):
            if state.cancelled:
                return AgentResult(agent_name="Orchestrator", status="cancelled", summary="Workflow cancelled.")
            try:
                res: AgentResult = await fn(payload, context)
                state.total_prompt_tokens += res.prompt_tokens
                state.total_completion_tokens += res.completion_tokens
                state.total_estimated_cost_usd = round(
                    state.total_estimated_cost_usd + res.estimated_cost_usd, 6
                )
                return res
            except Exception as exc:
                last_exc = exc
                if attempt <= self.max_task_retries:
                    await asyncio.sleep(0.1 * attempt)
        return AgentResult(
            agent_name="Orchestrator",
            status="failed",
            summary="Agent execution failed after retries.",
            error=str(last_exc),
        )

    @staticmethod
    def _mark_failed_or_cancelled(state: WorkflowState, error: Optional[str]) -> WorkflowState:
        if state.cancelled:
            state.current_stage = WorkflowStage.CANCELLED
        else:
            state.current_stage = WorkflowStage.FAILED
            state.error = error
        state.updated_at = datetime.now(timezone.utc)
        return state

    def _get_workflow(self, workflow_id: UUID) -> WorkflowState:
        wf = self._workflows.get(workflow_id)
        if not wf:
            raise KeyError(f"Workflow {workflow_id} not found.")
        return wf
