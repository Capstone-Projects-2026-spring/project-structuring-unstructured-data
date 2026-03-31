import json
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from database import get_connection

router = APIRouter(prefix="/submissions", tags=["submissions"])


class StartSubmissionRequest(BaseModel):
    problem_id: int
    student_name: str


class DraftRequest(BaseModel):
    code: str


class SuggestionLogEntry(BaseModel):
    time: str
    action: str
    label: str


class SubmitRequest(BaseModel):
    code: str
    suggestion_log: list[SuggestionLogEntry] = []


@router.post("/start", status_code=201)
def start_submission(req: StartSubmissionRequest):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, max_attempts FROM problems WHERE id = %s",
        (req.problem_id,)
    )
    problem = cursor.fetchone()
    if not problem:
        conn.close()
        raise HTTPException(status_code=404, detail="Problem not found")

    max_attempts = problem["max_attempts"]

    if max_attempts is not None:
        cursor.execute(
            """SELECT COUNT(*) AS cnt FROM sessions
               WHERE problem_id = %s AND student_name = %s
               AND submitted_at IS NOT NULL""",
            (req.problem_id, req.student_name),
        )
        row = cursor.fetchone()
        submitted_count = row["cnt"] if row else 0
        if submitted_count >= max_attempts:
            conn.close()
            raise HTTPException(
                status_code=403,
                detail=f"Submission limit reached ({max_attempts} submission{'s' if max_attempts != 1 else ''} allowed).",
            )

    cursor.execute(
        """SELECT id, code FROM sessions
           WHERE problem_id = %s AND student_name = %s AND submitted_at IS NULL
           ORDER BY started_at DESC LIMIT 1""",
        (req.problem_id, req.student_name),
    )
    draft = cursor.fetchone()

    if draft:
        conn.close()
        return {
            "session_id": draft["id"],
            "has_draft": True,
            "code": draft["code"],
        }

    cursor.execute(
        """INSERT INTO sessions (problem_id, student_name)
           VALUES (%s, %s) RETURNING id""",
        (req.problem_id, req.student_name),
    )
    new_session = cursor.fetchone()
    conn.commit()
    conn.close()

    return {
        "session_id": new_session["id"],
        "has_draft": False,
        "code": None,
    }


@router.put("/{session_id}/draft")
def save_draft(session_id: int, req: DraftRequest):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, submitted_at FROM sessions WHERE id = %s",
        (session_id,)
    )
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")
    if session["submitted_at"] is not None:
        conn.close()
        raise HTTPException(status_code=409, detail="Session already submitted")

    cursor.execute(
        "UPDATE sessions SET code = %s WHERE id = %s",
        (req.code, session_id),
    )
    conn.commit()
    conn.close()
    return {"session_id": session_id, "status": "saved"}


@router.post("/{session_id}/submit", status_code=200)
def submit_session(session_id: int, req: SubmitRequest):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, problem_id, student_name, submitted_at FROM sessions WHERE id = %s",
        (session_id,)
    )
    session = cursor.fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")
    if session["submitted_at"] is not None:
        conn.close()
        raise HTTPException(status_code=409, detail="Already submitted")

    cursor.execute(
        "SELECT max_attempts FROM problems WHERE id = %s",
        (session["problem_id"],)
    )
    problem = cursor.fetchone()
    max_attempts = problem["max_attempts"] if problem else None

    if max_attempts is not None:
        cursor.execute(
            """SELECT COUNT(*) AS cnt FROM sessions
               WHERE problem_id = %s AND student_name = %s
               AND submitted_at IS NOT NULL AND id != %s""",
            (session["problem_id"], session["student_name"], session_id),
        )
        row = cursor.fetchone()
        if row and row["cnt"] >= max_attempts:
            conn.close()
            raise HTTPException(status_code=403, detail="Submission limit reached")

    log_json = json.dumps([e.dict() for e in req.suggestion_log])
    cursor.execute(
        """UPDATE sessions
           SET code = %s, suggestion_log = %s, submitted_at = NOW()
           WHERE id = %s""",
        (req.code, log_json, session_id),
    )
    conn.commit()
    conn.close()
    return {"session_id": session_id, "status": "submitted"}


@router.get("/{session_id}")
def get_session(session_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, code, submitted_at FROM sessions WHERE id = %s",
        (session_id,)
    )
    session = cursor.fetchone()
    conn.close()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session["id"],
        "code": session["code"],
        "submitted": session["submitted_at"] is not None,
    }
