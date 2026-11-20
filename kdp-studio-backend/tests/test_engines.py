from uuid import uuid4
import pytest
from app.agents.base import AgentContext
from app.agents.orchestrator import AgentOrchestrator, WorkflowStage
from app.agents.quality_agent import KDPQualityCheckerAgent
from app.agents.seo_agent import KDPSeoAgent
from app.integrations.amazon.connectors import NOT_AVAILABLE, ResearchListingRecord
from app.integrations.image_generation.base import ImageGenerationParams
from app.integrations.image_generation.providers import IllustrationEngine
from app.integrations.llm.base import LLMMessage, LLMProvider, LLMResponse, ModelConfiguration
from app.integrations.llm.router import LLMRouter
from app.services.approval_service import ApprovalEngine, ApprovalState, ApprovalType
from app.services.book_service import BookService
from app.services.cover_service import CoverCalculationInput, CoverDesignInput, KDPCoverCalculator, KDPCoverGenerationService
from app.services.pdf_service import InteriorPageInput, InteriorPrintSpec, KDPInteriorPDFService
from app.services.research_service import NicheScoreInput, NicheScoringEngine, ScoringWeights


class StubOfflineProvider(LLMProvider):
    name = "stub"

    async def generate_text(self, messages, config):
        return LLMResponse(text="Stub summary", provider=self.name, model=config.model_name, prompt_tokens=10, completion_tokens=5, total_tokens=15)

    async def generate_json(self, messages, config, json_schema=None):
        return LLMResponse(text="{}", provider=self.name, model=config.model_name, parsed_json=None, prompt_tokens=10, completion_tokens=5, total_tokens=15)

    async def stream_text(self, messages, config):
        yield "Stub"


def _make_router() -> LLMRouter:
    return LLMRouter(
        providers={"stub": StubOfflineProvider()},
        default_config=ModelConfiguration(provider_name="stub", model_name="stub-v1"),
    )


def test_niche_scoring_formula_and_confidence_penalties() -> None:
    engine = NicheScoringEngine()
    weights = ScoringWeights(demand=0.35, competition_inverse=0.30, keyword_opportunity=0.20, market_gap=0.15)
    result = engine.score(
        NicheScoreInput(
            niche_name="Cozy Cottagecore Coloring Book",
            category="Coloring Books",
            target_audience="Adults",
            keywords=["cozy cottagecore coloring book", "bold easy coloring pages adults"],
            competitors=[
                ResearchListingRecord(
                    title="Example Listing",
                    review_count=120,
                    source_url="https://www.amazon.com/dp/B000000001",
                )
            ],
            trends_index=72.0,
            search_suggestions_count=8,
            review_complaint_themes=["bleed_through", "repetitive_content"],
            data_age_days=5,
        ),
        weights=weights,
    )
    scores = result["scores"]
    expected_opp = round(
        (scores["demand_score"]["value"] * 0.35)
        + ((100.0 - scores["competition_score"]["value"]) * 0.30)
        + (scores["keyword_opportunity_score"]["value"] * 0.20)
        + (scores["market_gap_score"]["value"] * 0.15),
        1,
    )
    assert result["opportunity_score"] == expected_opp
    assert result["measured_inputs"]["sales_volume"] == NOT_AVAILABLE
    assert result["research_confidence"] == 100.0

    # Stale and incomplete data must lower Data Confidence Score
    stale = engine.score(
        NicheScoreInput(
            niche_name="Stale Niche",
            category="Guides",
            target_audience="General",
            keywords=["stale"],
            data_age_days=60,
        )
    )
    assert stale["research_confidence"] < 25.0


def test_approval_engine_owner_enforcement_and_hard_gate() -> None:
    engine = ApprovalEngine()
    project_id = uuid4()
    owner_id = uuid4()
    intruder_id = uuid4()

    cp = engine.create_checkpoint(
        project_id=project_id,
        owner_user_id=owner_id,
        approval_type=ApprovalType.BOOK_OUTLINE,
        agent_name="BookPlannerAgent",
        proposed_output={"title": "Original Outline"},
        explanation="Approve outline v1",
    )

    with pytest.raises(RuntimeError):
        engine.require_approval(project_id, ApprovalType.BOOK_OUTLINE)

    with pytest.raises(PermissionError):
        engine.approve(cp.id, intruder_id)

    approved = engine.approve(cp.id, owner_id, note="Looks clean")
    assert approved.state == ApprovalState.APPROVED
    engine.require_approval(project_id, ApprovalType.BOOK_OUTLINE)
    assert len(engine.audit_log) == 2


def test_dynamic_kdp_cover_calculator_and_full_wrap_pdf() -> None:
    # 100 white B&W pages -> 100 * 0.002252 = 0.2252" spine
    calc = CoverCalculationInput(
        trim_width_in=6.0,
        trim_height_in=9.0,
        page_count=100,
        paper_type="white",
        ink_type="black_and_white",
        bleed=True,
    )
    dims = KDPCoverCalculator.calculate(calc)
    assert dims.spine_width_in == pytest.approx(0.2252, abs=1e-4)
    assert dims.full_width_in == pytest.approx(12.475, abs=1e-3)
    assert dims.spine_text_allowed is True

    # Under 79 pages -> spine text disallowed
    thin = KDPCoverCalculator.calculate(
        CoverCalculationInput(trim_width_in=8.5, trim_height_in=11.0, page_count=48)
    )
    assert thin.spine_text_allowed is False

    service = KDPCoverGenerationService()
    out = service.generate_full_wrap_pdf(
        calc,
        CoverDesignInput(title="Botanical Press", subtitle="Field Notes", author_name="A. Rivera"),
    )
    assert out["validation"]["pdf_integrity"] is True
    assert out["validation"]["barcode_safe_area_reserved"] is True


def test_interior_pdf_and_puzzle_verification() -> None:
    pdf_service = KDPInteriorPDFService()
    pages = [InteriorPageInput(page_number=i, heading=f"Chapter {i}", body_text="Original copy.") for i in range(1, 25)]
    res = pdf_service.generate_interior_pdf(
        InteriorPrintSpec(title="Sample Guide", author="Author", trim_width_in=6.0, trim_height_in=9.0),
        pages,
    )
    assert res["page_count"] == 24
    assert res["validation_report"]["overall"] == "pass"

    grid = ["FORESTX", "QRIVERZ", "MCEDARY"]
    check = BookService.verify_word_search_solution(grid, ["FOREST", "RIVER", "CEDAR"])
    assert check["valid"] is True


@pytest.mark.asyncio
async def test_illustration_actual_pixel_dpi_and_duplicate_detection() -> None:
    engine = IllustrationEngine()
    params = ImageGenerationParams(
        prompt="Botanical fern line art",
        illustration_type="coloring",
        target_width_in=2.0,
        target_height_in=2.0,
        target_dpi=300,
    )
    first = await engine.generate_for_page(params)
    second = await engine.generate_for_page(params)
    assert first.resolution.width_px == 600
    assert first.resolution.meets_300_dpi is True
    assert first.is_duplicate is False
    assert second.is_duplicate is True


@pytest.mark.asyncio
async def test_orchestrator_enforces_approvals_and_runs_quality_and_seo_agents() -> None:
    router = _make_router()
    approvals = ApprovalEngine()
    orch = AgentOrchestrator(llm_router=router, approval_engine=approvals)
    owner_id = uuid4()
    ctx = AgentContext(user_id=owner_id, book_type="Coloring Books", target_audience="Adults")

    wf = await orch.start_workflow("Cozy cottage coloring book", ctx)
    assert wf.current_stage == WorkflowStage.WAIT_RESEARCH_APPROVAL
    assert wf.pending_approval_id is not None

    # Attempting to skip research approval MUST fail
    with pytest.raises(RuntimeError):
        await orch.advance_to_book_planning(wf.workflow_id, ctx, {"topic": "Cozy Cottage"})

    # Owner approves research -> planner runs -> pauses at WAIT_OUTLINE_APPROVAL
    approvals.approve(wf.pending_approval_id, owner_id)
    wf = await orch.advance_to_book_planning(wf.workflow_id, ctx, {"topic": "Cozy Cottage", "book_type": "Coloring Books"})
    assert wf.current_stage == WorkflowStage.WAIT_OUTLINE_APPROVAL

    # Test Agent A (Quality Checker) & Agent B (SEO Agent)
    seo_agent = KDPSeoAgent(router)
    seo_res = await seo_agent.run(
        {"title": "Cozy Cottage Coloring", "keywords": ["disney castle", "cozy cottage"]},
        ctx,
    )
    assert seo_res.data["requires_user_review_before_export"] is True
    assert len(seo_res.data["checks"]["trademark_risks"]) >= 1

    qa_agent = KDPQualityCheckerAgent(router)
    qa_res = await qa_agent.run(
        {"trim_width_in": 6.0, "trim_height_in": 9.0, "page_count": 10},  # invalid < 24 pages
        ctx,
    )
    assert qa_res.data["overall_status"] == "Fail"
    assert qa_res.data["ready_for_final_export_approval"] is False
