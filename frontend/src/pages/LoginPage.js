import React, { useState } from 'react';
import { authenticateUser } from '../api';

/**
 * @fileoverview Login page component for the AutoSuggestion Quiz application.
 * @module LoginPage
 */

/**
 * Login page with two modes:
 * - Student (default): prompts for name and a 6-digit problem key. No backend auth.
 * - Teacher: prompts for email and password, authenticated via the backend.
 *
 * A small toggle button in the top-right corner switches between modes.
 *
 * @component
 * @param {Object} props
 * @param {function(Object): void} props.onLogin - Callback invoked with the user object on success.
 * @returns {React.ReactElement} The rendered login page.
 */
function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('student'); // 'student' | 'teacher'

  // Student fields
  const [studentName, setStudentName] = useState('');
  const [problemKey, setProblemKey] = useState('');

  // Teacher fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  /**
   * Handles student form submission.
   * Validates that a name and a 6-digit problem key are provided,
   * then calls onLogin with a synthetic student user object.
   * Backend wiring is deferred — no API call is made here yet.
   */
  const handleStudentSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!studentName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!/^\d{6}$/.test(problemKey.trim())) {
      setError('Please enter a valid 6-digit problem key.');
      return;
    }

    onLogin({ name: studentName.trim(), role: 'student', problemKey: problemKey.trim() });
  };

  /**
   * Handles teacher form submission.
   * Validates email and password, then authenticates via the backend.
   */
  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await authenticateUser(email, password);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="logo">AutoSuggestion Quiz</h1>
        </div>
        <div className="header-right">
          {mode === 'student' ? (
            <button className="link-btn" onClick={() => switchMode('teacher')}>
              Teacher Login →
            </button>
          ) : (
            <button className="link-btn" onClick={() => switchMode('student')}>
              ← Student Login
            </button>
          )}
        </div>
      </header>

      <div className="login-page">
        <div className="login-card">

          {mode === 'student' ? (
            <>
              <div className="login-header">
                <h2 className="login-title">Enter Problem</h2>
                <p className="login-subtitle">Enter your name and the problem key given by your teacher.</p>
              </div>

              <form className="login-form" onSubmit={handleStudentSubmit}>
                <div className="form-field">
                  <label className="form-label" htmlFor="student-name">Your Name</label>
                  <input
                    id="student-name"
                    type="text"
                    className="form-input"
                    placeholder="First Last"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="problem-key">Problem Key</label>
                  <input
                    id="problem-key"
                    type="text"
                    className="form-input"
                    placeholder="6-digit code"
                    value={problemKey}
                    onChange={(e) => setProblemKey(e.target.value)}
                    maxLength={6}
                  />
                </div>

                {error && <p className="form-error">{error}</p>}

                <button type="submit" className="btn login-btn">
                  Enter
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="login-header">
                <h2 className="login-title">Teacher Sign In</h2>
                <p className="login-subtitle">Enter your credentials to continue.</p>
              </div>

              <form className="login-form" onSubmit={handleTeacherSubmit}>
                <div className="form-field">
                  <label className="form-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="text"
                    className="form-input"
                    placeholder="you@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error && <p className="form-error">{error}</p>}

                <button type="submit" className="btn login-btn" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

export default LoginPage;
