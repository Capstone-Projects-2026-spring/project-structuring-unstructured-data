const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// --- Teacher auth (OTP via backend → Supabase) ---

export const requestOTP = async (email) => {
    const response = await fetch(`${API_URL}/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to send OTP');
    }
};

export const verifyOTP = async (email, token) => {
    const response = await fetch(`${API_URL}/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Invalid or expired OTP');
    }

    return response.json(); // { token, user }
};

// --- Problems (student flow) ---

export async function getProblemByCode(code) {
    const response = await fetch(`${API_URL}/problems/access/${code}`);

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Problem not found');
    }

    return response.json();
}

// --- Problems (teacher flow) ---

export async function getTeacherProblems(token) {
    const response = await fetch(`${API_URL}/problems/`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to fetch problems');
    }

    return response.json();
}

export async function createProblem(problemData, token) {
    const response = await fetch(`${API_URL}/problems/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(problemData),
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create problem');
    }

    return response.json();
}

export async function deleteProblem(problemId, token) {
    const response = await fetch(`${API_URL}/problems/${problemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to delete problem');
    }
}