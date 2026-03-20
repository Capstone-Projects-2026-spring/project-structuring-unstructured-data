import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_connection
from auth import hash_password, verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "teacher"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class OtpRequestRequest(BaseModel):
    email: str


class OtpVerifyRequest(BaseModel):
    email: str
    token: str


@router.post("/dev-login", response_model=AuthResponse)
def dev_login():
    """
    Development-only endpoint. Returns a valid JWT for the seed teacher
    without requiring OTP. Only works when DEBUG=True in .env.
    """
    if os.getenv("DEBUG", "False").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, role FROM users WHERE email = ?", ("seed@autoquiz.dev",))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=500, detail="Seed teacher not found — run seed.py first")

    token = create_token(row["id"], row["email"], row["role"])
    return {"token": token, "user": {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}}


@router.post("/otp/request", status_code=200)
async def request_otp(req: OtpRequestRequest):
    """
    Send a one-time password to a teacher's email via Supabase.

    - **email**: The teacher's email address
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase is not configured")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{supabase_url}/auth/v1/otp",
            headers={
                "apikey": supabase_key,
                "Content-Type": "application/json",
            },
            json={"email": req.email, "create_user": True},
        )

    if response.status_code not in (200, 204):
        raise HTTPException(status_code=502, detail="Failed to send OTP")

    return {"message": "OTP sent"}


@router.post("/otp/verify", response_model=AuthResponse)
async def verify_otp(req: OtpVerifyRequest):
    """
    Verify a Supabase OTP and return a local JWT for the teacher.

    - **email**: The teacher's email address
    - **token**: The 6-digit OTP from the email
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase is not configured")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{supabase_url}/auth/v1/verify",
            headers={
                "apikey": supabase_key,
                "Content-Type": "application/json",
            },
            json={"email": req.email, "token": req.token, "type": "email"},
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    data = response.json()
    supabase_email = data.get("user", {}).get("email", req.email)

    # Look up or create the teacher in our local DB
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, role FROM users WHERE email = ?", (supabase_email,))
    row = cursor.fetchone()

    if row:
        user_id, name, email, role = row["id"], row["name"], row["email"], row["role"]
    else:
        cursor.execute(
            "INSERT INTO users (name, email, role) VALUES (?, ?, ?)",
            (supabase_email, supabase_email, "teacher"),
        )
        conn.commit()
        user_id = cursor.lastrowid
        name, email, role = supabase_email, supabase_email, "teacher"

    conn.close()

    token = create_token(user_id, email, role)
    return {"token": token, "user": {"id": user_id, "name": name, "email": email, "role": role}}


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    """
    Register a new user.

    - **name**: Full name of the user
    - **email**: Must be unique
    - **password**: Will be hashed before storage
    - **role**: Must be one of `student`, `teacher`, `admin`
    """
    if req.role not in ("teacher", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(req.password)
    cursor.execute(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        (req.name, req.email, hashed, req.role),
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    token = create_token(user_id, req.email, req.role)
    return {"token": token, "user": {"id": user_id, "name": req.name, "email": req.email, "role": req.role}}


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """
    Authenticate a user and return a JWT token.

    - **email**: Registered email address
    - **password**: Plain text password to verify against stored hash
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, email, password, role FROM users WHERE email = ?", (req.email,))
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(req.password, row["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(row["id"], row["email"], row["role"])
    return {"token": token, "user": {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}}