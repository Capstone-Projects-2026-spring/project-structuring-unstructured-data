import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "quiz.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        -- Users: teachers (OTP via Supabase) and admins only.
        -- Students are not stored here; they identify via problem access code + name.
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            email       TEXT NOT NULL UNIQUE,
            password    TEXT,
            role        TEXT NOT NULL DEFAULT 'teacher'
                            CHECK (role IN ('teacher', 'admin')),
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Problems created by teachers.
        CREATE TABLE IF NOT EXISTS problems (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            access_code         TEXT NOT NULL UNIQUE,
            title               TEXT NOT NULL,
            description         TEXT NOT NULL,
            language            TEXT NOT NULL,
            languages           TEXT NOT NULL DEFAULT '[]',
            time_limit_minutes  INTEGER,
            max_attempts        INTEGER,
            allow_copy_paste    INTEGER NOT NULL DEFAULT 1 CHECK (allow_copy_paste IN (0, 1)),
            track_tab_switching INTEGER NOT NULL DEFAULT 0 CHECK (track_tab_switching IN (0, 1)),
            created_at          TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Ordered sections within a problem. Each section has a label and
        -- per-language starter code displayed to the student.
        CREATE TABLE IF NOT EXISTS sections (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
            order_index INTEGER NOT NULL,
            label       TEXT NOT NULL,
            code        TEXT NOT NULL DEFAULT '',
            UNIQUE(problem_id, order_index)
        );

        -- Suggestions (correct answers and distractors) tied to a specific section.
        CREATE TABLE IF NOT EXISTS suggestions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            section_id  INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
            content     TEXT NOT NULL,
            is_correct  INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
            source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai'))
        );

        -- One row per student session on a problem. Students are anonymous —
        -- identified only by the name they entered and the problem they accessed.
        CREATE TABLE IF NOT EXISTS sessions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            problem_id      INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
            student_name    TEXT NOT NULL,
            started_at      TEXT NOT NULL DEFAULT (datetime('now')),
            submitted_at    TEXT,
            score           INTEGER,
            total           INTEGER
        );

        -- One row per answer a student submitted within a session.
        CREATE TABLE IF NOT EXISTS answers (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id      INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            section_id      INTEGER NOT NULL REFERENCES sections(id),
            suggestion_id   INTEGER REFERENCES suggestions(id),
            is_correct      INTEGER NOT NULL CHECK (is_correct IN (0, 1))
        );

        -- Logs for auditable events: tab switches, copy/paste attempts, session
        -- start/end. Keyed to a session so they're always tied to a student+problem.
        CREATE TABLE IF NOT EXISTS logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            event_type  TEXT NOT NULL
                            CHECK (event_type IN (
                                'session_start',
                                'session_end',
                                'tab_switch',
                                'copy_attempt',
                                'paste_attempt',
                                'submission'
                            )),
            detail      TEXT,
            logged_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)

    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
