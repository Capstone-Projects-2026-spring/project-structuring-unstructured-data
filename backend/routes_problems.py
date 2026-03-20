import json
import random
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from database import get_connection
from auth import decode_token

router = APIRouter(prefix="/problems", tags=["problems"])


# ── Request Models ─────────────────────────────────────────────────────────────

class SuggestionIn(BaseModel):
    type: str           # 'ai' | 'manual'
    isCorrect: bool
    content: str = ""


class SectionIn(BaseModel):
    order: int
    label: str
    code: Dict[str, Any]   # { language: code_string }
    suggestions: List[SuggestionIn] = []


class CreateProblemRequest(BaseModel):
    title: str
    description: str
    languages: List[str]
    boilerplate: Dict[str, str]   # kept for reference, not stored separately
    sections: List[SectionIn]
    timeLimitMinutes: Optional[int] = None
    maxSubmissions: Optional[int] = None
    allowCopyPaste: bool = True
    trackTabSwitching: bool = False

# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_current_user(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization[len("Bearer "):]
    try:
        return decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _generate_unique_access_code(cursor) -> str:
    for _ in range(10):
        code = str(random.randint(100000, 999999))
        cursor.execute("SELECT id FROM problems WHERE access_code = ?", (code,))
        if not cursor.fetchone():
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique access code")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/")
def create_problem(
    req: CreateProblemRequest,
    authorization: Optional[str] = Header(default=None),
):
    """
    Create a new problem. Requires a teacher or admin JWT.
    Accepts multiple languages; stores each section's code as a JSON dict
    keyed by language so multi-language support is preserved for future use.
    Returns the new problem's id and generated 6-digit access code.
    """
    user = _get_current_user(authorization)
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers can create problems")

    primary_language = req.languages[0] if req.languages else "python"

    conn = get_connection()
    cursor = conn.cursor()
    try:
        access_code = _generate_unique_access_code(cursor)

        cursor.execute(
            """INSERT INTO problems
               (teacher_id, access_code, title, description, language, languages,
                time_limit_minutes, max_attempts, allow_copy_paste, track_tab_switching)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user["user_id"],
                access_code,
                req.title,
                req.description,
                primary_language,
                json.dumps(req.languages),
                req.timeLimitMinutes,
                req.maxSubmissions,
                1 if req.allowCopyPaste else 0,
                1 if req.trackTabSwitching else 0,
            ),
        )
        problem_id = cursor.lastrowid

        for section in sorted(req.sections, key=lambda s: s.order):
            cursor.execute(
                """INSERT INTO sections (problem_id, order_index, label, code)
                   VALUES (?, ?, ?, ?)""",
                (problem_id, section.order, section.label, json.dumps(section.code)),
            )
            section_id = cursor.lastrowid

            for sg in section.suggestions:
                if sg.type == "manual" and not sg.content.strip():
                    continue
                cursor.execute(
                    """INSERT INTO suggestions (section_id, content, is_correct, source)
                       VALUES (?, ?, ?, ?)""",
                    (section_id, sg.content, 1 if sg.isCorrect else 0, sg.type),
                )

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()

    return {"problem_id": problem_id, "access_code": access_code}


@router.get("/access/{code}")
def get_problem_by_code(code: str):
    """
    Look up a problem by its 6-digit access code.
    Returns problem details with its ordered sections and suggestions.
    Section code is returned as a dict keyed by language; ProblemPage
    reads the primary language's string to populate the editor.
    """
    if not code.isdigit() or len(code) != 6:
        raise HTTPException(status_code=400, detail="Access code must be a 6-digit number")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM problems WHERE access_code = ?", (code,))
    problem = cursor.fetchone()
    if not problem:
        conn.close()
        raise HTTPException(status_code=404, detail="Problem not found")

    cursor.execute(
        "SELECT * FROM sections WHERE problem_id = ? ORDER BY order_index",
        (problem["id"],),
    )
    section_rows = cursor.fetchall()

    sections = []
    for s in section_rows:
        cursor.execute(
            "SELECT * FROM suggestions WHERE section_id = ?", (s["id"],)
        )
        suggestion_rows = cursor.fetchall()

        # code is stored as JSON dict; fall back gracefully if it's a plain string
        try:
            code_dict = json.loads(s["code"])
        except (TypeError, ValueError):
            code_dict = {problem["language"]: s["code"]}

        sections.append({
            "id": s["id"],
            "order_index": s["order_index"],
            "label": s["label"],
            "code": code_dict,
            "suggestions": [
                {
                    "id": sg["id"],
                    "content": sg["content"],
                    "is_correct": bool(sg["is_correct"]),
                    "source": sg["source"],
                }
                for sg in suggestion_rows
            ],
        })

    conn.close()

    return {
        "id": problem["id"],
        "access_code": problem["access_code"],
        "title": problem["title"],
        "description": problem["description"],
        "language": problem["language"],
        "languages": json.loads(problem["languages"]),
        "sections": sections,
        "time_limit_minutes": problem["time_limit_minutes"],
        "max_attempts": problem["max_attempts"],
        "allow_copy_paste": bool(problem["allow_copy_paste"]),
        "track_tab_switching": bool(problem["track_tab_switching"]),
    }
