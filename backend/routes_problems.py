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
    type: str
    isCorrect: bool
    content: str = ""


class SectionIn(BaseModel):
    order: int
    label: str
    code: Dict[str, Any]
    suggestions: List[SuggestionIn] = []


class CreateProblemRequest(BaseModel):
    title: str
    description: str
    languages: List[str]
    boilerplate: Dict[str, str]
    sections: List[SectionIn]
    timeLimitMinutes: Optional[int] = None
    maxSubmissions: Optional[int] = None
    allowCopyPaste: bool = True
    trackTabSwitching: bool = False


class EditProblemRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    timeLimitMinutes: Optional[int] = None
    maxSubmissions: Optional[int] = None
    allowCopyPaste: Optional[bool] = None
    trackTabSwitching: Optional[bool] = None


class GradeSubmissionRequest(BaseModel):
    session_id: int
    grade: int  # 0-100


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


def _build_problem(cursor, problem) -> dict:
    """Build full problem dict with sections, suggestions, and submissions."""
    cursor.execute(
        "SELECT * FROM sections WHERE problem_id = ? ORDER BY order_index",
        (problem["id"],),
    )
    section_rows = cursor.fetchall()

    sections = []
    for s in section_rows:
        cursor.execute("SELECT * FROM suggestions WHERE section_id = ?", (s["id"],))
        suggestion_rows = cursor.fetchall()

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

    # Pull submissions from sessions table
    cursor.execute(
        """SELECT id, student_name, submitted_at, score, total
           FROM sessions
           WHERE problem_id = ? AND submitted_at IS NOT NULL
           ORDER BY submitted_at DESC""",
        (problem["id"],),
    )
    session_rows = cursor.fetchall()
    submissions = [
        {
            "session_id": row["id"],
            "student_name": row["student_name"],
            "submitted_at": row["submitted_at"],
            "score": row["score"],
            "total": row["total"],
            "grade": round((row["score"] / row["total"]) * 100) if row["total"] else None,
        }
        for row in session_rows
    ]

    return {
        "id": problem["id"],
        "access_code": problem["access_code"],
        "title": problem["title"],
        "description": problem["description"],
        "language": problem["language"],
        "languages": json.loads(problem["languages"]),
        "sections": sections,
        "submissions": submissions,
        "time_limit_minutes": problem["time_limit_minutes"],
        "max_attempts": problem["max_attempts"],
        "allow_copy_paste": bool(problem["allow_copy_paste"]),
        "track_tab_switching": bool(problem["track_tab_switching"]),
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/")
def get_teacher_problems(
        authorization: Optional[str] = Header(default=None),
):
    """Get all problems created by the authenticated teacher."""
    user = _get_current_user(authorization)
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers can access this endpoint")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM problems WHERE teacher_id = ? ORDER BY created_at DESC",
        (user["user_id"],),
    )
    problems = cursor.fetchall()
    result = [_build_problem(cursor, p) for p in problems]
    conn.close()
    return result


@router.post("/")
def create_problem(
        req: CreateProblemRequest,
        authorization: Optional[str] = Header(default=None),
):
    """Create a new problem. Returns the full problem object."""
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
        cursor.execute("SELECT * FROM problems WHERE id = ?", (problem_id,))
        new_problem = cursor.fetchone()
        result = _build_problem(cursor, new_problem)
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return result


@router.patch("/{problem_id}")
def edit_problem(
        problem_id: int,
        req: EditProblemRequest,
        authorization: Optional[str] = Header(default=None),
):
    """Edit a problem's title, description, and settings."""
    user = _get_current_user(authorization)
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers can edit problems")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM problems WHERE id = ?", (problem_id,))
    problem = cursor.fetchone()
    if not problem:
        conn.close()
        raise HTTPException(status_code=404, detail="Problem not found")

    if user.get("role") == "teacher" and problem["teacher_id"] != user["user_id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only edit your own problems")

    fields = []
    values = []

    if req.title is not None:
        fields.append("title = ?")
        values.append(req.title)
    if req.description is not None:
        fields.append("description = ?")
        values.append(req.description)
    if req.timeLimitMinutes is not None:
        fields.append("time_limit_minutes = ?")
        values.append(req.timeLimitMinutes)
    if req.maxSubmissions is not None:
        fields.append("max_attempts = ?")
        values.append(req.maxSubmissions)
    if req.allowCopyPaste is not None:
        fields.append("allow_copy_paste = ?")
        values.append(1 if req.allowCopyPaste else 0)
    if req.trackTabSwitching is not None:
        fields.append("track_tab_switching = ?")
        values.append(1 if req.trackTabSwitching else 0)

    if fields:
        values.append(problem_id)
        cursor.execute(f"UPDATE problems SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()

    cursor.execute("SELECT * FROM problems WHERE id = ?", (problem_id,))
    updated = cursor.fetchone()
    result = _build_problem(cursor, updated)
    conn.close()
    return result


@router.delete("/{problem_id}", status_code=204)
def delete_problem(
        problem_id: int,
        authorization: Optional[str] = Header(default=None),
):
    """Delete a problem. Cascades to sections, suggestions, sessions, and logs."""
    user = _get_current_user(authorization)
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers can delete problems")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT teacher_id FROM problems WHERE id = ?", (problem_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Problem not found")

    if user.get("role") == "teacher" and row["teacher_id"] != user["user_id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only delete your own problems")

    cursor.execute("DELETE FROM problems WHERE id = ?", (problem_id,))
    conn.commit()
    conn.close()


@router.post("/{problem_id}/grade")
def grade_submission(
        problem_id: int,
        req: GradeSubmissionRequest,
        authorization: Optional[str] = Header(default=None),
):
    """Manually grade a student submission by overriding the score."""
    user = _get_current_user(authorization)
    if user.get("role") not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Only teachers can grade submissions")

    if not 0 <= req.grade <= 100:
        raise HTTPException(status_code=400, detail="Grade must be between 0 and 100")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT teacher_id FROM problems WHERE id = ?", (problem_id,))
    problem = cursor.fetchone()
    if not problem:
        conn.close()
        raise HTTPException(status_code=404, detail="Problem not found")

    if user.get("role") == "teacher" and problem["teacher_id"] != user["user_id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only grade your own problems")

    cursor.execute("SELECT id FROM sessions WHERE id = ? AND problem_id = ?", (req.session_id, problem_id))
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Submission not found")

    # Store grade as score out of 100
    cursor.execute(
        "UPDATE sessions SET score = ?, total = 100 WHERE id = ?",
        (req.grade, req.session_id),
    )
    conn.commit()
    conn.close()

    return {"session_id": req.session_id, "grade": req.grade}


@router.get("/access/{code}")
def get_problem_by_code(code: str):
    """Look up a problem by its 6-digit access code."""
    if not code.isdigit() or len(code) != 6:
        raise HTTPException(status_code=400, detail="Access code must be a 6-digit number")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM problems WHERE access_code = ?", (code,))
    problem = cursor.fetchone()
    if not problem:
        conn.close()
        raise HTTPException(status_code=404, detail="Problem not found")

    result = _build_problem(cursor, problem)
    conn.close()
    return result