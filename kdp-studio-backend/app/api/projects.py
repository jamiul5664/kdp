from typing import Any, Dict, List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.models.entities import BookProject
from app.schemas.dto import BookProjectCreate

router = APIRouter()


@router.get("/")
async def list_projects(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    res = await db.execute(select(BookProject).where(BookProject.user_id == user_id))
    projects = res.scalars().all()
    return [
        {
            "id": str(p.id),
            "title": p.title,
            "subtitle": p.subtitle,
            "book_type": p.book_type,
            "target_audience": p.target_audience,
            "trim_width": p.trim_width,
            "trim_height": p.trim_height,
            "page_count": p.page_count,
            "bleed": p.bleed,
            "paper_type": p.paper_type,
            "status": p.status,
        }
        for p in projects
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: BookProjectCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    project = BookProject(
        user_id=user_id,
        title=payload.title,
        subtitle=payload.subtitle,
        book_type=payload.book_type,
        target_audience=payload.target_audience,
        language=payload.language,
        trim_width=payload.trim_width,
        trim_height=payload.trim_height,
        page_count=payload.page_count,
        bleed=payload.bleed,
        paper_type=payload.paper_type,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return {"id": str(project.id), "title": project.title, "status": project.status}


@router.get("/{project_id}")
async def get_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(
        select(BookProject).where(BookProject.id == project_id, BookProject.user_id == user_id)
    )
    project = res.scalar_one_or_none()
    if not project:
        raise AppError("Project not found.", status.HTTP_404_NOT_FOUND, "PROJECT_NOT_FOUND")
    return {
        "id": str(project.id),
        "title": project.title,
        "subtitle": project.subtitle,
        "book_type": project.book_type,
        "page_count": project.page_count,
        "trim_width": project.trim_width,
        "trim_height": project.trim_height,
        "status": project.status,
        "seo_metadata": project.seo_metadata_json,
    }
