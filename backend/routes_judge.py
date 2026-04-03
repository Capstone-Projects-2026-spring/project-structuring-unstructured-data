from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import httpx
import base64
import asyncio
import time

router = APIRouter(prefix="/code", tags=["code"])

LANGUAGE_IDS = {
    "python": 71,
    "javascript": 63,
    "c": 50,
    "java": 62
}

class CodeExecutionRequest(BaseModel):
    code: str
    language: str
    input: str = ""

class CodeExecutionResponse(BaseModel):
    output: str
    error: str = ""

@router.post("/execute", response_model=CodeExecutionResponse)
async def execute_code(req: CodeExecutionRequest) -> CodeExecutionResponse:
    if req.language not in LANGUAGE_IDS:
        raise HTTPException(status_code=400, detail="Unsupported language")
    
    language_id = LANGUAGE_IDS[req.language]
    
    judge0_url = os.getenv("JUDGE0_URL")
    api_key = os.getenv("JUDGE0_API_KEY")
    
    if not judge0_url or not api_key:
        raise HTTPException(status_code=500, detail="Judge0 configuration missing")
    
    # Submit code
    submit_url = f"{judge0_url}/submissions?base64_encoded=false&wait=true"
    headers = {
        "content-type": "application/json",
        "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
        "x-rapidapi-key": api_key,
    }
    data = {
        "source_code": req.code,
        "language_id": language_id,
        "stdin": req.input,
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(submit_url, headers=headers, json=data)
            response.raise_for_status()
            result = response.json()
            
            stdout = result.get("stdout", "")
            stderr = result.get("stderr", "")
            compile_output = result.get("compile_output", "")
            message = result.get("message", "")
            
            output = stdout or ""
            error = (stderr or compile_output or message or "")
            
            return CodeExecutionResponse(output=output, error=error)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to execute code: {str(e)}")