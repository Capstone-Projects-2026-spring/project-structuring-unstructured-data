from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from aiSuggestion import aiSuggestion

router = APIRouter(prefix="/ai", tags=["ai"])


class AISuggestionRequest(BaseModel):
    problem_id: int
    current_code: str
    problem_prompt: str


class SingleSuggestion(BaseModel):
    suggestion: str
    explanation: str


class AISuggestionResponse(BaseModel):
    suggestions: list[SingleSuggestion]


@router.post("/suggestion", response_model=AISuggestionResponse)
def get_ai_suggestion(req: AISuggestionRequest) -> AISuggestionResponse:
    try:
        result = aiSuggestion(req.current_code, req.problem_prompt)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return result
