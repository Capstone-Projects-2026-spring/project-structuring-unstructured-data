from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import httpx

router = APIRouter(prefix="/code", tags=["code"])

LANGUAGE_IDS = {
    "python": 71,
    "javascript": 63,
    "c": 50,
    "java": 62,
}


class CodeExecutionRequest(BaseModel):
    code: str
    language: str
    input: str = ""


class CodeExecutionResponse(BaseModel):
    output: str
    error: str = ""


def build_judge0_headers() -> dict[str, str]:
    headers = {"content-type": "application/json"}

    auth_token = os.getenv("JUDGE0_AUTH_TOKEN")
    if auth_token:
        headers["X-Auth-Token"] = auth_token

    return headers


@router.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(req: CodeExecutionRequest) -> CodeExecutionResponse:
    if req.language not in LANGUAGE_IDS:
        raise HTTPException(status_code=400, detail="Unsupported language")

    judge0_url = os.getenv("JUDGE0_URL", "").strip()
    if not judge0_url:
        raise HTTPException(status_code=500, detail="JUDGE0_URL is not configured")

    submit_url = f"{judge0_url.rstrip('/')}/submissions?base64_encoded=false&wait=true"
    headers = build_judge0_headers()
    payload = {
        "source_code": req.code,
        "language_id": LANGUAGE_IDS[req.language],
        "stdin": req.input,
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(submit_url, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()

            stdout = result.get("stdout", "") or ""
            stderr = result.get("stderr", "") or ""
            compile_output = result.get("compile_output", "") or ""
            message = result.get("message", "") or ""

            return CodeExecutionResponse(
                output=stdout,
                error=(stderr or compile_output or message),
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text.strip() or str(exc)
            raise HTTPException(status_code=502, detail=f"Judge0 request failed: {detail}")
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to execute code: {str(exc)}")
