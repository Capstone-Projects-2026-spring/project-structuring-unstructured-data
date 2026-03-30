from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

from routes_auth import router as auth_router
from routes_ai import router as ai_router
from routes_quiz import router as quiz_router
from routes_problems import router as problems_router

app = FastAPI(
    title="AutoSuggestion Quiz API",
    description="Backend API for the AutoSuggestion Quiz application.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://autosuggestions.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ai_router)
app.include_router(quiz_router)
app.include_router(problems_router)


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "AutoSuggestion Quiz API is running"}
