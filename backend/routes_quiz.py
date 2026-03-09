from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from database import get_connection
from auth import decode_token
import jwt

router = APIRouter(prefix="/quiz", tags=["quiz"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class QuizAnswer(BaseModel):
    question_index: int   # 0-based index of the question in the problem
    selected_option: str  # The answer text the student chose
    is_correct: bool      # Frontend can compute this; stored for reporting


class QuizSubmitRequest(BaseModel):
    problem_id: int
    language: str
    answers: list[QuizAnswer]
    time_taken_seconds: Optional[int] = None


class QuizAnswerResponse(BaseModel):
    question_index: int
    selected_option: str
    is_correct: bool


class QuizAttemptResponse(BaseModel):
    id: int
    problem_id: int
    user_id: int
    language: str
    score: int
    total: int
    time_taken_seconds: Optional[int]
    submitted_at: str
    answers: list[QuizAnswerResponse] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_user_from_token(authorization: Optional[str]) -> dict:
    """Extract and validate the Bearer JWT from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        return decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/submit", response_model=QuizAttemptResponse, status_code=201)
def submit_quiz(
    req: QuizSubmitRequest,
    authorization: Optional[str] = Header(default=None),
):
    """
    Submit a completed quiz attempt.

    - Requires a valid Bearer JWT in the `Authorization` header.
    - Saves the attempt and all answers to the database.
    - Returns the saved attempt with a computed score.
    """
    payload = _get_user_from_token(authorization)
    user_id: int = payload["user_id"]

    conn = get_connection()
    cursor = conn.cursor()

    # Validate problem exists
    cursor.execute("SELECT id FROM problems WHERE id = ?", (req.problem_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Problem not found")

    score = sum(1 for a in req.answers if a.is_correct)
    total = len(req.answers)

    cursor.execute(
        """
        INSERT INTO quiz_attempts (user_id, problem_id, language, score, total, time_taken_seconds)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (user_id, req.problem_id, req.language, score, total, req.time_taken_seconds),
    )
    attempt_id = cursor.lastrowid

    for answer in req.answers:
        cursor.execute(
            """
            INSERT INTO quiz_answers (attempt_id, question_index, selected_option, is_correct)
            VALUES (?, ?, ?, ?)
            """,
            (attempt_id, answer.question_index, answer.selected_option, int(answer.is_correct)),
        )

    conn.commit()

    # Fetch the saved attempt to return
    cursor.execute("SELECT * FROM quiz_attempts WHERE id = ?", (attempt_id,))
    row = cursor.fetchone()

    cursor.execute("SELECT * FROM quiz_answers WHERE attempt_id = ?", (attempt_id,))
    answer_rows = cursor.fetchall()
    conn.close()

    return QuizAttemptResponse(
        id=row["id"],
        problem_id=row["problem_id"],
        user_id=row["user_id"],
        language=row["language"],
        score=row["score"],
        total=row["total"],
        time_taken_seconds=row["time_taken_seconds"],
        submitted_at=row["submitted_at"],
        answers=[
            QuizAnswerResponse(
                question_index=a["question_index"],
                selected_option=a["selected_option"],
                is_correct=bool(a["is_correct"]),
            )
            for a in answer_rows
        ],
    )


@router.get("/attempts/{user_id}", response_model=list[QuizAttemptResponse])
def get_attempts(
    user_id: int,
    authorization: Optional[str] = Header(default=None),
):
    """
    Get all quiz attempts for a user.

    - Students can only fetch their own attempts.
    - Teachers and admins can fetch any user's attempts.
    """
    payload = _get_user_from_token(authorization)
    requester_id: int = payload["user_id"]
    requester_role: str = payload["role"]

    if requester_role == "student" and requester_id != user_id:
        raise HTTPException(status_code=403, detail="Students can only view their own attempts")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY submitted_at DESC",
        (user_id,),
    )
    attempts = cursor.fetchall()
    conn.close()

    return [
        QuizAttemptResponse(
            id=row["id"],
            problem_id=row["problem_id"],
            user_id=row["user_id"],
            language=row["language"],
            score=row["score"],
            total=row["total"],
            time_taken_seconds=row["time_taken_seconds"],
            submitted_at=row["submitted_at"],
            answers=[],  # Omitted in list view for performance
        )
        for row in attempts
    ]


@router.get("/attempt/{attempt_id}", response_model=QuizAttemptResponse)
def get_attempt_detail(
    attempt_id: int,
    authorization: Optional[str] = Header(default=None),
):
    """
    Get a single quiz attempt with all answers.

    - Students can only fetch their own attempts.
    - Teachers and admins can fetch any attempt.
    """
    payload = _get_user_from_token(authorization)
    requester_id: int = payload["user_id"]
    requester_role: str = payload["role"]

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM quiz_attempts WHERE id = ?", (attempt_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Attempt not found")

    if requester_role == "student" and row["user_id"] != requester_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Access denied")

    cursor.execute("SELECT * FROM quiz_answers WHERE attempt_id = ?", (attempt_id,))
    answer_rows = cursor.fetchall()
    conn.close()

    return QuizAttemptResponse(
        id=row["id"],
        problem_id=row["problem_id"],
        user_id=row["user_id"],
        language=row["language"],
        score=row["score"],
        total=row["total"],
        time_taken_seconds=row["time_taken_seconds"],
        submitted_at=row["submitted_at"],
        answers=[
            QuizAnswerResponse(
                question_index=a["question_index"],
                selected_option=a["selected_option"],
                is_correct=bool(a["is_correct"]),
            )
            for a in answer_rows
        ],
    )