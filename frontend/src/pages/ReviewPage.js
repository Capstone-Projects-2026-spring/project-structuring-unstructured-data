import React, { useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { LANGUAGE_MAP } from '../constants';

/**
 * @fileoverview Teacher review page — read-only view of a student's submission.
 * @module ReviewPage
 */

/**
 * Parse suggestion_log from the session. Accepts a JSON string or an array.
 */
function parseSuggestionLog(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Given the submitted code and suggestion log, return the set of line numbers
 * (1-based) that contain text matching an accepted suggestion label.
 */
function getHighlightedLines(code, suggestionLog) {
  if (!code || !suggestionLog.length) return new Set();
  const lines = code.split('\n');
  const highlighted = new Set();
  suggestionLog.forEach(({ label }) => {
    if (!label) return;
    // label is the first line of the suggestion snippet — match it trimmed
    const needle = label.trim().toLowerCase();
    lines.forEach((line, idx) => {
      if (line.trim().toLowerCase().includes(needle)) {
        highlighted.add(idx + 1); // Monaco lines are 1-based
      }
    });
  });
  return highlighted;
}

function ReviewPage({ submission, problem, onBack }) {
  const { student_name, submitted_at, code = '', suggestion_log: rawLog } = submission;
  const language = problem.language || 'python';
  const suggestionLog = parseSuggestionLog(rawLog);
  const [activeTab, setActiveTab] = useState('log');
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  const applyDecorations = useCallback((editor, monaco) => {
    const highlighted = getHighlightedLines(code, suggestionLog);
    if (!highlighted.size) return;

    const newDecorations = Array.from(highlighted).map((lineNumber) => ({
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: 'ai-highlight-line',
        glyphMarginClassName: 'ai-highlight-glyph',
        overviewRuler: {
          color: 'rgba(192, 139, 48, 0.6)',
          position: monaco.editor.OverviewRulerLane.Right,
        },
      },
    }));

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [code, suggestionLog]);

  const handleEditorDidMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      applyDecorations(editor, monaco);
    },
    [applyDecorations]
  );

  const formattedDate = submitted_at
    ? new Date(submitted_at).toLocaleString()
    : 'Unknown';

  const testCases = problem.test_cases || [];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h1 className="logo">AutoSuggestion Quiz</h1>
        </div>
        <div className="header-right">
          <span className="review-meta">
            <span className="review-student">{student_name}</span>
            <span className="review-sep">·</span>
            <span className="review-date">Submitted {formattedDate}</span>
          </span>
          <span className="problem-title">{problem.title}</span>
        </div>
      </header>

      <div className="main-layout">
        {/* Left: problem description */}
        <div className="panel problem-panel">
          <div className="panel-header">
            <span className="panel-title">Problem</span>
          </div>
          <div className="panel-body problem-body">
            <h2 className="problem-heading">{problem.title}</h2>
            <p className="problem-description">{problem.description}</p>

            {/* Student info card */}
            <div className="review-info-card">
              <div className="review-info-row">
                <span className="review-info-label">Student</span>
                <span className="review-info-value">{student_name}</span>
              </div>
              <div className="review-info-row">
                <span className="review-info-label">Submitted</span>
                <span className="review-info-value">{formattedDate}</span>
              </div>
              <div className="review-info-row">
                <span className="review-info-label">AI Suggestions Used</span>
                <span className="review-info-value" style={{ color: suggestionLog.length > 0 ? '#c08b30' : '#16825d' }}>
                  {suggestionLog.length}
                </span>
              </div>
              {submission.grade != null && (
                <div className="review-info-row">
                  <span className="review-info-label">Grade</span>
                  <span className="review-info-value">
                    <span className="grade-badge">{submission.grade}%</span>
                  </span>
                </div>
              )}
            </div>

            {/* AI highlight legend */}
            {suggestionLog.length > 0 && (
              <div className="review-legend">
                <span className="review-legend-swatch" />
                <span className="review-legend-text">
                  Lines highlighted in amber contain accepted AI suggestions
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: read-only editor + tabs */}
        <div className="panel editor-panel">
          <div className="panel-header editor-header">
            <div className="language-selector">
              <span className="lang-btn active">
                {language.charAt(0).toUpperCase() + language.slice(1)}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
              Read-only
            </span>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              language={LANGUAGE_MAP[language] || 'python'}
              value={code || '# No code submitted'}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                readOnly: true,
                fontSize: 14,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'on',
                padding: { top: 12 },
                renderLineHighlight: 'none',
                cursorStyle: 'line',
                hideCursorInOverviewRuler: true,
                contextmenu: false,
                folding: true,
                domReadOnly: true,
              }}
            />
          </div>

          {/* Bottom tabs */}
          <div className="bottom-panel">
            <div className="bottom-tabs">
              <button
                className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`}
                onClick={() => setActiveTab('log')}
              >
                Suggestion Log
                {suggestionLog.length > 0 && (
                  <span className="log-count">{suggestionLog.length}</span>
                )}
              </button>
              <button
                className={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
                onClick={() => setActiveTab('tests')}
              >
                Test Cases
                {testCases.length > 0 && (
                  <span className="log-count" style={{ backgroundColor: '#569cd6' }}>
                    {testCases.length}
                  </span>
                )}
              </button>
            </div>

            <div className="bottom-content">
              {activeTab === 'log' ? (
                <div className="suggestion-log">
                  {suggestionLog.length === 0 ? (
                    <p className="log-empty">No AI suggestions were accepted during this submission.</p>
                  ) : (
                    suggestionLog.map((entry, i) => (
                      <div key={i} className="log-entry">
                        <span className="log-time">{entry.time}</span>
                        <span className="log-action">{entry.action}</span>
                        <span className="log-label">{entry.label}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="suggestion-log">
                  {testCases.length === 0 ? (
                    <p className="log-empty">
                      No test cases have been added to this problem yet.
                      You can add them when editing the problem.
                    </p>
                  ) : (
                    testCases.map((tc, i) => (
                      <div key={i} className="review-test-case">
                        <div className="review-test-header">
                          <span className="review-test-label">Test {i + 1}</span>
                          {tc.explanation && (
                            <span className="review-test-explanation">{tc.explanation}</span>
                          )}
                        </div>
                        <div className="review-test-body">
                          <div className="review-test-row">
                            <span className="review-test-key">Input</span>
                            <code className="review-test-val">{tc.input || '—'}</code>
                          </div>
                          <div className="review-test-row">
                            <span className="review-test-key">Expected</span>
                            <code className="review-test-val">{tc.expected || '—'}</code>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReviewPage;
