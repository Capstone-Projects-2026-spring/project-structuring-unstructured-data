import React, { useState, useEffect } from 'react';
import './App.css';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProblemPage from './pages/ProblemPage';
import CreateProblemPage from './pages/CreateProblemPage';
import { getTeacherProblems, deleteProblem } from './api';

function restoreSession() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('token');
            return null;
        }
        return { token, email: payload.email, role: payload.role, id: payload.user_id };
    } catch {
        return null;
    }
}

function App() {
    const restoredUser = restoreSession();

    const [currentPage, setCurrentPage] = useState(restoredUser ? 'dashboard' : 'login');
    const [selectedProblem, setSelectedProblem] = useState(null);
    const [user, setUser] = useState(restoredUser);
    const [problems, setProblems] = useState([]);

    useEffect(() => {
        if (user?.token && currentPage === 'dashboard') {
            getTeacherProblems(user.token)
                .then(setProblems)
                .catch((err) => console.error('Failed to load problems:', err));
        }
    }, [user, currentPage]);

    const handleLogin = (userData) => {
        setUser(userData);
        if (userData.token) {
            localStorage.setItem('token', userData.token);
        }
        if (userData.role === 'student') {
            setSelectedProblem(userData.problem);
            setCurrentPage('problem');
        } else {
            setCurrentPage('dashboard');
        }
    };

    const handleBackToDashboard = () => {
        setCurrentPage('dashboard');
        setSelectedProblem(null);
    };

    const handleCreateProblem = () => {
        setCurrentPage('createProblem');
    };

    const handleProblemCreated = (newProblem) => {
        setProblems((prev) => [newProblem, ...prev]);
        setCurrentPage('dashboard');
    };

    const handleDeleteProblem = async (problemId) => {
        try {
            await deleteProblem(problemId, user.token);
            setProblems((prev) => prev.filter((p) => p.id !== problemId));
        } catch (err) {
            console.error('Failed to delete problem:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setSelectedProblem(null);
        setProblems([]);
        setCurrentPage('login');
    };

    if (currentPage === 'login') {
        return <LoginPage onLogin={handleLogin} />;
    }

    if (currentPage === 'problem' && selectedProblem) {
        return (
            <ProblemPage
                problem={selectedProblem}
                onBack={handleBackToDashboard}
            />
        );
    }

    if (currentPage === 'createProblem') {
        return (
            <CreateProblemPage
                onBack={handleBackToDashboard}
                onCreated={handleProblemCreated}
            />
        );
    }

    return (
        <Dashboard
            problems={problems}
            onCreateProblem={handleCreateProblem}
            onDeleteProblem={handleDeleteProblem}
            onProblemsUpdate={setProblems}
            onLogout={handleLogout}
            user={user}
        />
    );
}

export default App;