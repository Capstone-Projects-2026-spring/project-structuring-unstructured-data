import React, { useState } from 'react';
import { DIFFICULTY_COLORS } from '../constants';

// ─── Access Code Modal ────────────────────────────────────────────────────────

function AccessCodeModal({ problem, onClose }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(problem.access_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">Share Problem</span>
                    <button className="modal-close-btn" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <p className="modal-problem-title">{problem.title}</p>
                    <p className="modal-label">Student Access Code</p>
                    <div className="access-code-row">
                        <span className="access-code-value">{problem.access_code || '------'}</span>
                        <button className="btn btn-outline" onClick={handleCopy}>
                            {copied ? '✓ Copied' : 'Copy'}
                        </button>
                    </div>
                    <p className="modal-hint">
                        Share this 6-digit code with your students. They enter it on the login screen to access this problem directly — no account needed.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteModal({ problem, onConfirm, onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">Delete Problem</span>
                    <button className="modal-close-btn" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <p className="modal-delete-warning">
                        Are you sure you want to delete{' '}
                        <strong style={{ color: '#e0e0e0' }}>{problem.title}</strong>?
                        This will remove all student submissions and cannot be undone.
                    </p>
                    <div className="modal-actions">
                        <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                        <button className="btn btn-danger" onClick={() => onConfirm(problem.id)}>
                            Delete Problem
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Submissions Modal ────────────────────────────────────────────────────────

function SubmissionsModal({ problem, onClose }) {
    const submissions = problem.submissions || [];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">Submissions — {problem.title}</span>
                    <button className="modal-close-btn" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    {submissions.length === 0 ? (
                        <p className="modal-empty">No submissions yet for this problem.</p>
                    ) : (
                        <table className="submissions-table">
                            <thead>
                            <tr>
                                <th>Student</th>
                                <th>Submitted</th>
                                <th>Grade</th>
                                <th>Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {submissions.map((s, i) => (
                                <tr key={i}>
                                    <td>{s.student_name || 'Unknown'}</td>
                                    <td>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</td>
                                    <td>
                                        {s.grade != null
                                            ? <span className="grade-badge">{s.grade}%</span>
                                            : '—'}
                                    </td>
                                    <td>
                      <span style={{ color: s.grade != null ? '#16825d' : '#569cd6', fontSize: '12px', fontWeight: 500 }}>
                        {s.grade != null ? 'Graded' : 'Submitted'}
                      </span>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Problem Card ─────────────────────────────────────────────────────────────

function ProblemCard({ problem, onShare, onDelete, onViewSubmissions }) {
    const submissionCount = (problem.submissions || []).length;

    return (
        <div className="problem-card" style={{ cursor: 'default' }}>
            <div className="card-top">
        <span
            className="difficulty-badge"
            style={{ color: DIFFICULTY_COLORS[problem.difficulty] || '#888' }}
        >
          {problem.difficulty || 'N/A'}
        </span>
                <span style={{ fontSize: '11px', color: '#569cd6', fontWeight: 500 }}>
          {submissionCount} {submissionCount === 1 ? 'submission' : 'submissions'}
        </span>
            </div>

            <h3 className="card-title">{problem.title}</h3>

            {problem.access_code && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #333',
                    borderRadius: '5px',
                }}>
          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#666' }}>
            Code
          </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#9cdcfe', letterSpacing: '3px', flex: 1 }}>
            {problem.access_code}
          </span>
                </div>
            )}

            <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #333' }}>
                <button
                    className="btn btn-outline"
                    style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => onViewSubmissions(problem)}
                >
                    Submissions
                </button>
                <button
                    className="btn btn-outline"
                    style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                    onClick={() => onShare(problem)}
                >
                    Share Code
                </button>
                <button
                    className="btn btn-outline"
                    style={{ flex: 1, fontSize: '11px', padding: '4px 8px', borderColor: '#3c3c3c', color: '#888' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f48771'; e.currentTarget.style.borderColor = '#f48771'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#3c3c3c'; }}
                    onClick={() => onDelete(problem)}
                >
                    Delete
                </button>
            </div>
        </div>
    );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ problems = [], onCreateProblem, onDeleteProblem, onLogout, user }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [shareModal, setShareModal] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [submissionsModal, setSubmissionsModal] = useState(null);

    const totalSubmissions = problems.reduce((acc, p) => acc + (p.submissions?.length || 0), 0);
    const activeCount = problems.filter((p) => (p.submissions?.length || 0) > 0).length;

    const filtered = problems.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
            q === '' ||
            p.title.toLowerCase().includes(q) ||
            (p.access_code || '').includes(q)
        );
    });

    const handleConfirmDelete = (problemId) => {
        if (onDeleteProblem) onDeleteProblem(problemId);
        setDeleteModal(null);
    };

    return (
        <div className="app">
            <header className="app-header">
                <div className="header-left">
                    <h1 className="logo">AutoSuggestion Quiz</h1>
                </div>
                <div className="header-right">
          <span className="dashboard-greeting">
            Welcome back, {user?.name || user?.email || 'Teacher'}
          </span>
                    <button className="btn btn-outline" onClick={onCreateProblem}>
                        + New Problem
                    </button>
                    <button className="btn btn-outline" onClick={onLogout}>
                        Log Out
                    </button>
                </div>
            </header>

            <div className="dashboard">

                {/* Stats */}
                <div className="stats-bar">
                    <div className="stat-card">
                        <span className="stat-value">{problems.length}</span>
                        <span className="stat-label">Problems</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value" style={{ color: '#569cd6' }}>{totalSubmissions}</span>
                        <span className="stat-label">Submissions</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value" style={{ color: '#16825d' }}>{activeCount}</span>
                        <span className="stat-label">Active Problems</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-value" style={{ color: '#888' }}>{problems.length - activeCount}</span>
                        <span className="stat-label">No Submissions Yet</span>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="dashboard-toolbar">
                    <div className="search-box">
                        <span className="search-icon">⌕</span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search problems or access codes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Grid */}
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        {problems.length === 0
                            ? <p>No problems yet. Click <strong style={{ color: '#569cd6' }}>+ New Problem</strong> to create your first one.</p>
                            : <p>No problems match your search.</p>
                        }
                    </div>
                ) : (
                    <div className="problem-grid">
                        {filtered.map((problem) => (
                            <ProblemCard
                                key={problem.id}
                                problem={problem}
                                onShare={(p) => setShareModal(p)}
                                onDelete={(p) => setDeleteModal(p)}
                                onViewSubmissions={(p) => setSubmissionsModal(p)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {shareModal && (
                <AccessCodeModal problem={shareModal} onClose={() => setShareModal(null)} />
            )}
            {deleteModal && (
                <DeleteModal
                    problem={deleteModal}
                    onConfirm={handleConfirmDelete}
                    onClose={() => setDeleteModal(null)}
                />
            )}
            {submissionsModal && (
                <SubmissionsModal
                    problem={submissionsModal}
                    onClose={() => setSubmissionsModal(null)}
                />
            )}
        </div>
    );
}

export default Dashboard;