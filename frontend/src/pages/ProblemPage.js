import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { LANGUAGE_MAP } from '../constants';
import { startSubmission, saveDraft, submitCode } from '../api';

/**
 * @fileoverview Problem page component for the AutoSuggestion Quiz application.
 * @module ProblemPage
 */

function ProblemPage({ problem, onBack, studentName }) {
  const language = problem.language;
  const starterCode = (problem.sections || [])
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => {
      const sectionCode = (typeof s.code === 'object' ? s.code[language] : s.code) || '';
      return `# ${s.label}\n${sectionCode}`;
    })
    .join('\n');

  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('output');
  const [suggestionLog, setSuggestionLog] = useState([]);
  const [pyodide, setPyodide] = useState(null);
  const [pyodideLoading, setPyodideLoading] = useState(true);

  const [sessionId, setSessionId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [draftCode, setDraftCode] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const periodicSaveRef = useRef(null);
  const debounceRef = useRef(null);
  const codeRef = useRef(code);
  useEffect(() => { codeRef.current = code; }, [code]);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const idleTimerRef = useRef(null);
  const completionProviderRef = useRef(null);
  const latestSuggestionsRef = useRef([]);
  const lastLoggedSuggestionRef = useRef(null);

  const registerCompletionProvider = useCallback(
    (monaco, lang) => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
        completionProviderRef.current = null;
      }

      completionProviderRef.current =
        monaco.languages.registerCompletionItemProvider(lang, {
          triggerCharacters: [],

          async provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endLineNumber: position.lineNumber,
              endColumn: word.endColumn,
            };

            let rawSuggestions = [];

            try {
              const currentCode = model.getValue();
              const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
              const response = await fetch(`${apiUrl}/ai/suggestion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  problem_id: problem.id,
                  current_code: currentCode,
                  problem_prompt: problem.description,
                }),
              });

              if (response.ok) {
                const data = await response.json();

                if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                  rawSuggestions = data.suggestions.map((item) => ({
                    label: item.suggestion || 'AI Suggestion',
                    insertText: item.suggestion || '',
                    explanation: item.explanation || '',
                  }));
                }
              }
            } catch (err) {
              console.error('Failed to fetch AI suggestions for Monaco', err);
            }

            const mappedSuggestions = rawSuggestions.map((s, idx) => {
              const codeText = String(s.insertText || '').replace(/^\s+/, '');

              const lines = codeText
                .split('\n')
                .filter((line) => line.trim().length > 0);

              const firstLine = (lines[0] || 'AI suggestion').trimStart();
              const codePreview =
                firstLine.length > 80
                  ? firstLine.slice(0, 77) + '...'
                  : firstLine;

              return {
                label: codePreview || `Suggestion ${idx + 1}`,
                kind: monaco.languages.CompletionItemKind.Snippet,
                detail: 'AI Suggestion',
                documentation: {
                  value:
                    (s.explanation ? `${s.explanation}\n\n` : '') +
                    '```' +
                    lang +
                    '\n' +
                    codeText +
                    '\n```',
                },
                insertText: codeText,
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
                sortText: `0${idx}`,
              };
            });

            latestSuggestionsRef.current = mappedSuggestions;

            return {
              suggestions: mappedSuggestions,
            };
          },
        });
    },
    [problem.id, problem.description]
  );

  const handleEditorDidMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      editor.onDidChangeModelContent((event) => {
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
        }

        for (const change of event.changes) {
          const insertedText = change.text;

          if (!insertedText) continue;

          const matchedSuggestion = latestSuggestionsRef.current.find(
            (suggestion) => suggestion.insertText === insertedText
          );

          if (matchedSuggestion) {
            const logKey = `${matchedSuggestion.label}::${insertedText}`;

            if (lastLoggedSuggestionRef.current !== logKey) {
              setSuggestionLog((prev) => [
                ...prev,
                {
                  time: new Date().toLocaleTimeString(),
                  action: 'accepted',
                  label:
                    typeof matchedSuggestion.label === 'string'
                      ? matchedSuggestion.label
                      : 'Suggestion',
                },
              ]);

              lastLoggedSuggestionRef.current = logKey;
            }

            break;
          }
        }

        idleTimerRef.current = setTimeout(() => {
          if (!editor.hasTextFocus()) return;
          lastLoggedSuggestionRef.current = null;
          editor.trigger('ai-idle', 'editor.action.triggerSuggest', {});
        }, 2000);
      });

      registerCompletionProvider(monaco, LANGUAGE_MAP[language]);
    },
    [registerCompletionProvider, language]
  );

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (completionProviderRef.current) completionProviderRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    if (!studentName) return;
    startSubmission(problem.id, studentName)
      .then((result) => {
        setSessionId(result.session_id);
        if (result.has_draft && result.code) {
          setDraftCode(result.code);
          setShowRestorePrompt(true);
        }
      })
      .catch((err) => {
        setSubmitError(err.message);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSave = useCallback((currentCode) => {
    if (!sessionId) return;
    setSaveStatus('saving');
    saveDraft(sessionId, currentCode)
      .then(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2500);
      })
      .catch(() => setSaveStatus(''));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(code), 5000);
    return () => clearTimeout(debounceRef.current);
  }, [code, sessionId, doSave]);

  useEffect(() => {
    if (!sessionId) return;
    periodicSaveRef.current = setInterval(() => doSave(codeRef.current), 30000);
    return () => clearInterval(periodicSaveRef.current);
  }, [sessionId, doSave]);

  useEffect(() => {
    const initPyodide = async () => {
      try {
        setPyodideLoading(true);

        if (window.loadPyodide) {
          const pyodideInstance = await window.loadPyodide();
          setPyodide(pyodideInstance);
          setPyodideLoading(false);
          return;
        }

        const existingScript = document.querySelector('script[src*="pyodide.js"]');
        if (existingScript) {
          existingScript.onload = async () => {
            const pyodideInstance = await window.loadPyodide();
            setPyodide(pyodideInstance);
            setPyodideLoading(false);
          };
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/pyodide@0.26.4/pyodide.js';
        script.async = true;

        script.onload = async () => {
          try {
            const pyodideInstance = await window.loadPyodide({
              indexURL: 'https://unpkg.com/pyodide@0.26.4/',
            });
            setPyodide(pyodideInstance);
            setPyodideLoading(false);
          } catch (err) {
            console.error('Pyodide init failed:', err);
            setOutput('Error: Failed to initialize Python runtime\n');
            setPyodideLoading(false);
          }
        };

        script.onerror = () => {
          console.error('Failed to load Pyodide script');
          setOutput('Error: Failed to initialize Python runtime\n');
          setPyodideLoading(false);
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load Pyodide:', error);
        setOutput('Error: Failed to initialize Python runtime\n');
        setPyodideLoading(false);
      }
    };

    initPyodide();
  }, []);

  const handleRunCode = async () => {
    if (!pyodide) {
      setOutput('Error: Python runtime not loaded yet. Please wait...\n');
      return;
    }

    if (language !== 'python') {
      setIsRunning(true);
      setActiveTab('output');
      setOutput('Running code...\n');

      setTimeout(() => {
        setOutput(`$ Running ${language} code...\n\nExecution complete.\n`);
        setIsRunning(false);
      }, 1500);
      return;
    }

    setIsRunning(true);
    setActiveTab('output');
    setOutput('');

    try {
      const fullCode = `
import sys
from io import StringIO

_stdout_buf = StringIO()
_stderr_buf = StringIO()
sys.stdout = _stdout_buf
sys.stderr = _stderr_buf

${code}

_stdout = _stdout_buf.getvalue()
_stderr = _stderr_buf.getvalue()
`;

      await pyodide.runPythonAsync(fullCode);

      const stdout = pyodide.globals.get('_stdout');
      const stderr = pyodide.globals.get('_stderr');

      // Try to evaluate the last meaningful line as an expression (REPL-style),
      // so that return values like most_frequent([1,3,3]) are shown automatically.
      let returnValue = '';
      const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        try {
          const val = await pyodide.runPythonAsync(lastLine);
          if (val !== undefined && val !== null) {
            returnValue = `\n=> ${val}`;
          }
        } catch {
          // last line isn't an expression (e.g. it's a def or assignment) — that's fine
        }
      }

      let result = '';
      if (stdout) result += stdout;
      if (returnValue) result += returnValue;
      if (stderr) result += 'Error: ' + stderr;

      setOutput(result || 'Code executed successfully (no output)\n');
    } catch (error) {
      setOutput(`Error executing Python code:\n${error.message}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId) {
      setSubmitError('Session not ready. Please wait a moment and try again.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await submitCode(sessionId, code, suggestionLog);
      clearTimeout(debounceRef.current);
      clearInterval(periodicSaveRef.current);
      setActiveTab('output');
      setOutput('Your solution has been submitted successfully.\nRedirecting to dashboard...');
      setTimeout(() => onBack(), 2000);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app">
      {showConfirmDialog && (
        <div className="restore-overlay">
          <div className="restore-dialog">
            <h3>Submit your solution?</h3>
            <p>
              {suggestionLog.length > 0
                ? `You accepted ${suggestionLog.length} AI suggestion${suggestionLog.length !== 1 ? 's' : ''} during this attempt.`
                : 'You did not accept any AI suggestions during this attempt.'}
            </p>
            <p>This cannot be undone.</p>
            <div className="restore-actions">
              <button
                className="btn btn-run"
                onClick={() => {
                  setShowConfirmDialog(false);
                  handleSubmit();
                }}
              >
                Confirm Submit
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestorePrompt && (
        <div className="restore-overlay">
          <div className="restore-dialog">
            <h3>Resume your work?</h3>
            <p>We found a saved draft for this problem. Would you like to restore it?</p>
            <div className="restore-actions">
              <button
                className="btn btn-run"
                onClick={() => {
                  setCode(draftCode);
                  setShowRestorePrompt(false);
                }}
              >
                Restore Draft
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowRestorePrompt(false)}
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>
            ← Back
          </button>
          <h1 className="logo">AutoSuggestion Quiz</h1>
        </div>
        <div className="header-right">
          {saveStatus === 'saving' && <span className="save-status">Saving…</span>}
          {saveStatus === 'saved' && <span className="save-status save-status--saved">✓ Saved</span>}
          {submitError && <span className="save-status save-status--error">{submitError}</span>}
          <span className="problem-title">{problem.title}</span>
          <button
            className="btn btn-outline"
            onClick={() => setShowConfirmDialog(true)}
            disabled={isSubmitting || !sessionId}
          >
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </header>

      <div className="main-layout">
        <div className="panel problem-panel">
          <div className="panel-header">
            <span className="panel-title">Problem</span>
          </div>
          <div className="panel-body problem-body">
            <h2 className="problem-heading">{problem.title}</h2>
            <p className="problem-description">{problem.description}</p>
          </div>
        </div>

        <div className="panel editor-panel">
          <div className="panel-header editor-header">
            <div className="language-selector">
              <span className="lang-btn active">
                {language.charAt(0).toUpperCase() + language.slice(1)}
              </span>
            </div>

            <div className="editor-actions">
              <button
                className="btn btn-run"
                onClick={handleRunCode}
                disabled={isRunning || (language === 'python' && pyodideLoading)}
              >
                {isRunning
                  ? '⏳ Running...'
                  : language === 'python' && pyodideLoading
                    ? '⏳ Loading Python...'
                    : '▶ Run Code'}
              </button>
            </div>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              language={LANGUAGE_MAP[language]}
              value={code}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                fontSize: 14,
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                wordWrap: 'on',
                padding: { top: 12 },
                quickSuggestions: false,
                suggestOnTriggerCharacters: false,
                wordBasedSuggestions: 'off',
                suggest: {
                  showIcons: true,
                  showStatusBar: true,
                  preview: false,
                  previewMode: 'subwordSmart',
                  shareSuggestSelections: false,
                  showInlineDetails: true,
                  filterGraceful: false,
                },
                inlineSuggest: {
                  enabled: false,
                },
                folding: true,
                bracketPairColorization: { enabled: true },
              }}
            />
          </div>

          <div className="bottom-panel">
            <div className="bottom-tabs">
              <button
                className={`tab-btn ${activeTab === 'output' ? 'active' : ''}`}
                onClick={() => setActiveTab('output')}
              >
                Output
              </button>
              <button
                className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`}
                onClick={() => setActiveTab('log')}
              >
                Suggestion Log
                {suggestionLog.length > 0 && (
                  <span className="log-count">{suggestionLog.length}</span>
                )}
              </button>
            </div>

            <div className="bottom-content">
              {activeTab === 'output' ? (
                <pre className="output-text">
                  {output || 'Click "Run Code" to see output here.'}
                </pre>
              ) : (
                <div className="suggestion-log">
                  {suggestionLog.length === 0 ? (
                    <p className="log-empty">
                      No suggestions accepted yet. Start typing and pause for 2
                      seconds to see autocomplete suggestions.
                    </p>
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProblemPage;