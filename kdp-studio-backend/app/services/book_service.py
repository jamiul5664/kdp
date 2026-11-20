from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4


@dataclass
class PageModel:
    id: UUID
    project_id: UUID
    page_number: int
    page_type: str
    content_json: Dict[str, Any]
    image_asset_id: Optional[UUID] = None
    status: str = "draft"


class BookService:
    """Manages per-page book models, individual page regeneration, and programmatic puzzle verification."""

    def __init__(self) -> None:
        self._pages_by_project: Dict[UUID, List[PageModel]] = {}

    def save_page(self, page: PageModel) -> PageModel:
        pages = self._pages_by_project.setdefault(page.project_id, [])
        pages = [p for p in pages if p.page_number != page.page_number]
        pages.append(page)
        pages.sort(key=lambda p: p.page_number)
        self._pages_by_project[page.project_id] = pages
        return page

    def list_pages(self, project_id: UUID) -> List[PageModel]:
        return list(self._pages_by_project.get(project_id, []))

    @staticmethod
    def verify_word_search_solution(grid: List[str], words: List[str]) -> Dict[str, Any]:
        """Programmatically verify that every listed answer word exists in the word-search grid."""
        rows = len(grid)
        cols = len(grid[0]) if rows else 0
        directions = [(0, 1), (1, 0), (1, 1), (-1, 1), (0, -1), (-1, 0), (-1, -1), (1, -1)]

        def find_word(word: str) -> Optional[Dict[str, Any]]:
            target = word.upper().replace(" ", "")
            for r in range(rows):
                for c in range(cols):
                    for dr, dc in directions:
                        end_r = r + dr * (len(target) - 1)
                        end_c = c + dc * (len(target) - 1)
                        if not (0 <= end_r < rows and 0 <= end_c < cols):
                            continue
                        if all(grid[r + dr * i][c + dc * i].upper() == target[i] for i in range(len(target))):
                            return {"word": word, "start": [r, c], "end": [end_r, end_c]}
            return None

        verified: List[Dict[str, Any]] = []
        missing: List[str] = []
        for w in words:
            hit = find_word(w)
            if hit:
                verified.append(hit)
            else:
                missing.append(w)

        return {"valid": len(missing) == 0, "verified_answers": verified, "missing_words": missing}

    @staticmethod
    def verify_sudoku_solution(board: List[List[int]]) -> bool:
        """Programmatically verify a 9×9 Sudoku solution grid."""
        if len(board) != 9 or any(len(row) != 9 for row in board):
            return False
        expected = set(range(1, 10))
        for i in range(9):
            if set(board[i]) != expected:
                return False
            if {board[r][i] for r in range(9)} != expected:
                return False
        for br in range(0, 9, 3):
            for bc in range(0, 9, 3):
                box = {board[r][c] for r in range(br, br + 3) for c in range(bc, bc + 3)}
                if box != expected:
                    return False
        return True
