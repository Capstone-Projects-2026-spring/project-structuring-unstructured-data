from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

from routes_auth import router as auth_router
from routes_ai import router as ai_router
from routes_quiz import router as quiz_router
from routes_problems import router as problems_router
from routes_judge import router as code_router
from routes_submissions import router as submissions_router

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
app.include_router(code_router)

@app.on_event("startup")
def startup():
    """
    Run on application startup.

    Initializes the SQLite database schema if it does not already exist,
    then seeds the database with a default teacher and sample problem if
    the users table is empty.
    """
    import os
    print(f"[startup] DEBUG={os.getenv('DEBUG')} | OPENAI_KEY={'set' if os.getenv('OPENAI_API_KEY') else 'NOT SET'}")
    init_db()

    from database import get_connection
    import json

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]

    if count == 0:
        # Seed teacher
        cursor.execute(
            "INSERT INTO users (name, email, role) VALUES (?, ?, ?)",
            ("Seed Teacher", "seed@autoquiz.dev", "teacher"),
        )
        teacher_id = cursor.lastrowid

        # Seed problem with access code 123456
        cursor.execute(
            """INSERT INTO problems
               (teacher_id, access_code, title, description, language, languages,
                time_limit_minutes, max_attempts, allow_copy_paste, track_tab_switching)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                teacher_id,
                "123456",
                "Most Frequent Element",
                (
                    "Given a list of integers, return the element that appears most frequently.\n\n"
                    "You may assume there is always a single element with the highest frequency.\n\n"
                    "Example:\n"
                    "  most_frequent([1, 3, 2, 3, 1, 3]) -> 3\n"
                    "  most_frequent([4, 4, 1, 2])       -> 4"
                ),
                "python",
                json.dumps(["python"]),
                None, None, 1, 0,
            ),
        )
        problem_id = cursor.lastrowid

        sections = [
            (0, "Choose a Data Structure", "def most_frequent(nums: list[int]) -> int:\n    # Initialize a data structure to keep track of how many\n    # times each number appears in the list\n    "),
            (1, "Write a Loop",            "    # Loop over the list and populate your data structure\n    # with the count of each element\n    "),
            (2, "Return the Result",       "    # Return the element that has the highest count\n    "),
        ]
        for order, label, code in sections:
            cursor.execute(
                "INSERT INTO sections (problem_id, order_index, label, code) VALUES (?, ?, ?, ?)",
                (problem_id, order, label, json.dumps({"python": code})),
            )
            section_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO suggestions (section_id, content, is_correct, source) VALUES (?, ?, ?, ?)",
                (section_id, "", 1, "ai"),
            )

        conn.commit()
        print("Auto-seeded database with seed teacher and sample problem 123456.")

    conn.close()
app.include_router(submissions_router)


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "AutoSuggestion Quiz API is running"}
