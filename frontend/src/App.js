import React, { useState } from 'react';
import './App.css';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProblemPage from './pages/ProblemPage';
import CreateProblemPage from './pages/CreateProblemPage';

/**
 * Attempt to restore a teacher session from a saved JWT in localStorage.
 * Returns a user object if the token exists and hasn't expired, null otherwise.
 */
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

  const [currentPage, setCurrentPage] = useState(
    restoredUser ? 'dashboard' : 'login'
  );
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [user, setUser] = useState(restoredUser);

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

  const handleOpenProblem = (problem) => {
    setSelectedProblem(problem);
    setCurrentPage('problem');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
    setSelectedProblem(null);
  };

  const handleCreateProblem = () => {
    setCurrentPage('createProblem');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setSelectedProblem(null);
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
    return <CreateProblemPage onBack={handleBackToDashboard} />;
  }

  return (
    <Dashboard
      onOpenProblem={handleOpenProblem}
      onCreateProblem={handleCreateProblem}
      onLogout={handleLogout}
      user={user}
    />
  );
}

export default App;
