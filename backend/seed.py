"""
seed.py — seeds the database with a placeholder teacher and one sample problem.
Run from the backend directory: python3 seed.py
"""
import json
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import init_db, get_connection

init_db()

conn = get_connection()
cursor = conn.cursor()

# ── Wipe existing seed data ────────────────────────────────────────────────────
cursor.execute("DELETE FROM suggestions")
cursor.execute("DELETE FROM sections")
cursor.execute("DELETE FROM problems")
cursor.execute("DELETE FROM users")
conn.commit()
print("Cleared existing data.")

# ── Seed teacher ───────────────────────────────────────────────────────────────
cursor.execute(
    "INSERT INTO users (name, email, role) VALUES (?, ?, ?)",
    ("Seed Teacher", "seed@autoquiz.dev", "teacher"),
)
teacher_id = cursor.lastrowid
print(f"Created seed teacher (id={teacher_id})")

# ── Seed problem ───────────────────────────────────────────────────────────────
ACCESS_CODE = "123456"

cursor.execute(
    """INSERT INTO problems
       (teacher_id, access_code, title, description, language, languages,
        time_limit_minutes, max_attempts, allow_copy_paste, track_tab_switching)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
    (
        teacher_id,
        ACCESS_CODE,
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
        None,
        None,
        1,
        0,
    ),
)
problem_id = cursor.lastrowid
print(f"Created problem '{ACCESS_CODE}' (id={problem_id})")

# ── Sections ───────────────────────────────────────────────────────────────────
SECTIONS = [
    {
        "order_index": 0,
        "label": "Choose a Data Structure",
        "code": (
            "def most_frequent(nums: list[int]) -> int:\n"
            "    # Initialize a data structure to keep track of how many\n"
            "    # times each number appears in the list\n"
            "    "
        ),
        "suggestions": [
            {"content": "", "is_correct": True, "source": "ai"},
        ],
    },
    {
        "order_index": 1,
        "label": "Write a Loop",
        "code": (
            "    # Loop over the list and populate your data structure\n"
            "    # with the count of each element\n"
            "    "
        ),
        "suggestions": [
            {"content": "", "is_correct": True, "source": "ai"},
        ],
    },
    {
        "order_index": 2,
        "label": "Return the Result",
        "code": (
            "    # Return the element that has the highest count\n"
            "    "
        ),
        "suggestions": [
            {"content": "", "is_correct": True, "source": "ai"},
        ],
    },
]

for section in SECTIONS:
    cursor.execute(
        "INSERT INTO sections (problem_id, order_index, label, code) VALUES (?, ?, ?, ?)",
        (problem_id, section["order_index"], section["label"], json.dumps({"python": section["code"]})),
    )
    section_id = cursor.lastrowid
    print(f"  Created section '{section['label']}' (id={section_id})")

    for sg in section["suggestions"]:
        cursor.execute(
            "INSERT INTO suggestions (section_id, content, is_correct, source) "
            "VALUES (?, ?, ?, ?)",
            (section_id, sg["content"], 1 if sg["is_correct"] else 0, sg["source"]),
        )

conn.commit()
conn.close()
print("\nSeed complete.")
