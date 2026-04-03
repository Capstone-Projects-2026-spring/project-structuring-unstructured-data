import React, { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { LANGUAGE_MAP, AVAILABLE_LANGUAGES } from '../constants';
import { executeCode } from '../api';

/**
 * @fileoverview Problem page component for the AutoSuggestion Quiz application.
 * @module ProblemPage
 */

function ProblemPage({ problem, onBack }) {
  const availableLanguages = problem.languages || [problem.language];
  const [selectedLanguage, setSelectedLanguage] = useState(availableLanguages[0] || 'python');
  const starterCode = (problem.sections || [])
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => {
      const sectionCode = (typeof s.code === 'object' ? s.code[selectedLanguage] : s.code) || '';
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
  const [input, setInput] = useState('');

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

      editor.onKeyDown((e) => {
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
          // e.preventDefault();
          // e.stopPropagation();
        }
      });

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

      registerCompletionProvider(monaco, LANGUAGE_MAP[selectedLanguage]);
    },
    [registerCompletionProvider, selectedLanguage]
  );

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (completionProviderRef.current) completionProviderRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    if (monacoRef.current && editorRef.current) {
      registerCompletionProvider(monacoRef.current, LANGUAGE_MAP[selectedLanguage]);
    }
  }, [selectedLanguage, registerCompletionProvider]);

  useEffect(() => {
    const newStarterCode = (problem.sections || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((s) => {
        const sectionCode = (typeof s.code === 'object' ? s.code[selectedLanguage] : s.code) || '';
        return `# ${s.label}\n${sectionCode}`;
      })
      .join('\n');
    setCode(newStarterCode);
  }, [selectedLanguage, problem.sections]);

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

  // ProblemPage.jsx (or wherever your component is)



// --------------------
// Code execution
// --------------------

const handleRunCode = async () => {
  setIsRunning(true);
  setActiveTab('output');
  setOutput('Running code...\n');

  try {
    if (selectedLanguage === 'python') {
      if (!pyodide) {
        throw new Error('Python runtime not loaded');
      }

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

      let result = '';
      if (stdout) result += stdout;
      if (stderr) result += 'Error: ' + stderr;

      setOutput(result || 'Code executed successfully (no output)\n');
    } 
    else {
      const result = await executeCode(code, selectedLanguage, input);
      let output = result.output;
      if (result.error) {
        output += '\nError: ' + result.error;
      }
      setOutput(output || 'Code executed successfully (no output)\n');
    }

  } catch (error) {
    setOutput(`Error:\n${error.message}\n`);
  } finally {
    setIsRunning(false);
  }
};


  const handleSubmit = () => {
    setActiveTab('output');
    setOutput(
      'Submitting solution...\n\n' +
        'Your solution has been submitted successfully.\n' +
        'Redirecting to dashboard...'
    );
    setTimeout(() => onBack(), 2000);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>
            ← Back
          </button>
          <h1 className="logo">AutoSuggestion Quiz</h1>
        </div>
        <div className="header-right">
          <span className="problem-title">{problem.title}</span>
          <button className="btn btn-outline" onClick={handleSubmit}>
            Submit
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
              <select
                className="lang-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {availableLanguages.map(lang => (
                  <option key={lang} value={lang}>
                    {AVAILABLE_LANGUAGES.find(l => l.id === lang)?.name || lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="editor-actions">
              <button
                className="btn btn-run"
                onClick={handleRunCode}
                disabled={isRunning || (selectedLanguage === 'python' && pyodideLoading)}
              >
                {isRunning
                  ? '⏳ Running...'
                  : selectedLanguage === 'python' && pyodideLoading
                    ? '⏳ Loading Python...'
                    : '▶ Run Code'}
              </button>
            </div>
          </div>

          <div className="editor-container">
            <Editor
              height="100%"
              language={LANGUAGE_MAP[selectedLanguage]}
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
                className={`tab-btn ${activeTab === 'input' ? 'active' : ''}`}
                onClick={() => setActiveTab('input')}
              >
                Input
              </button>
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
              {activeTab === 'input' ? (
                <div className="input-section">
                  <textarea
                    className="input-textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter input for your program (stdin)..."
                    rows={4}
                  />
                </div>
              ) : activeTab === 'output' ? (
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