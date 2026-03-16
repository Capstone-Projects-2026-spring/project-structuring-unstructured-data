import React, { useState, useRef } from 'react';
import { AVAILABLE_LANGUAGES } from '../constants';


const STEPS = ['Details', 'Languages', 'Sections', 'Settings'];


/**
 * Creates a blank suggestion object.
 * @returns {{ id: number, type: 'ai'|'manual', content: string, isCorrect: boolean }}
 */
const makeSuggestion = () => ({
  id: Date.now() + Math.random(),
  type: 'ai',
  content: '',
  isCorrect: true,
});

/**
 * Creates a blank section object.
 * @returns {{ id: number, label: string, code: string, suggestions: Object[] }}
 */
const makeSection = () => ({
  id: Date.now() + Math.random(),
  label: '',
  code: '',
  suggestions: [makeSuggestion()],
});


function StepDetails({ title, setTitle, description, setDescription, errors }) {
  return (
    <div className="cp-step">
      <div className="cp-step-intro">
        <h3 className="cp-step-title">Problem Details</h3>
        <p className="cp-step-subtitle">Give your problem a title and a clear description for students.</p>
      </div>

      <div className="form-field">
        <label className="form-label">Title</label>
        <input
          type="text"
          className={`form-input${errors.title ? ' form-input-error' : ''}`}
          placeholder="e.g. Two Sum, Reverse a String..."
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
        />
        {errors.title && <span className="form-error">{errors.title}</span>}
      </div>

      <div className="form-field">
        <label className="form-label">Description</label>
        <textarea
          className={`form-input form-textarea${errors.description ? ' form-input-error' : ''}`}
          placeholder="Describe the problem, constraints, and what the student needs to solve..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={6}
        />
        {errors.description && <span className="form-error">{errors.description}</span>}
      </div>
    </div>
  );
}

function StepLanguages({ selectedLanguages, toggleLanguage, errors }) {
  return (
    <div className="cp-step">
      <div className="cp-step-intro">
        <h3 className="cp-step-title">Languages</h3>
        <p className="cp-step-subtitle">Select which languages students can use to solve this problem.</p>
      </div>

      <div className="form-field">
        <label className="form-label">Allowed Languages</label>
        <div className="language-checkboxes">
          {AVAILABLE_LANGUAGES.map(({ key, label }) => (
            <label
              key={key}
              className={`lang-checkbox-item${selectedLanguages.includes(key) ? ' lang-checkbox-active' : ''}`}
            >
              <input
                type="checkbox"
                className="lang-checkbox-input"
                checked={selectedLanguages.includes(key)}
                onChange={() => toggleLanguage(key)}
              />
              {label}
            </label>
          ))}
        </div>
        {errors.languages && <span className="form-error">{errors.languages}</span>}
        <span className="form-hint">At least one language is required.</span>
      </div>
    </div>
  );
}
function SuggestionRow({ suggestion, onChange, onRemove, canRemove }) {
  return (
    <div className="cp-suggestion-row">
      <div className="cp-suggestion-controls">
        <div className="cp-suggestion-type-toggle">
          <button
            type="button"
            className={`cp-type-btn${suggestion.type === 'ai' ? ' active' : ''}`}
            onClick={() => onChange({ ...suggestion, type: 'ai', content: '' })}
          >
            AI
          </button>
          <button
            type="button"
            className={`cp-type-btn${suggestion.type === 'manual' ? ' active' : ''}`}
            onClick={() => onChange({ ...suggestion, type: 'manual' })}
          >
            Manual
          </button>
        </div>

        <div className="cp-suggestion-correctness">
          <button
            type="button"
            className={`cp-correct-btn${suggestion.isCorrect ? ' correct' : ' distractor'}`}
            onClick={() => onChange({ ...suggestion, isCorrect: !suggestion.isCorrect })}
          >
            {suggestion.isCorrect ? '✓ Correct' : '✗ Distractor'}
          </button>
        </div>

        {canRemove && (
          <button type="button" className="cp-remove-btn" onClick={onRemove} title="Remove suggestion">
            ×
          </button>
        )}
      </div>

      {suggestion.type === 'manual' ? (
        <textarea
          className="form-input form-textarea code-textarea cp-suggestion-code"
          placeholder="Write the code suggestion here..."
          value={suggestion.content}
          onChange={e => onChange({ ...suggestion, content: e.target.value })}
          rows={3}
          spellCheck={false}
        />
      ) : (
        <div className="cp-ai-note">
          The AI will generate this suggestion at runtime using this section's label and code as context.
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, index, onChange, onRemove, canRemove, selectedLanguages }) {
  const [activeLanguage, setActiveLanguage] = useState(selectedLanguages[0] || 'python');

  const updateSuggestion = (suggId, updated) => {
    onChange({
      ...section,
      suggestions: section.suggestions.map(s => s.id === suggId ? updated : s),
    });
  };

  const removeSuggestion = (suggId) => {
    onChange({
      ...section,
      suggestions: section.suggestions.filter(s => s.id !== suggId),
    });
  };

  const addSuggestion = () => {
    onChange({
      ...section,
      suggestions: [...section.suggestions, makeSuggestion()],
    });
  };

  const updateCode = (lang, value) => {
    onChange({
      ...section,
      code: { ...section.code, [lang]: value },
    });
  };

  return (
    <div className="cp-section-card">
      <div className="cp-section-header">
        <div className="cp-section-number">{index + 1}</div>
        <input
          type="text"
          className="cp-section-label-input"
          placeholder="Section label (e.g. Initialize data structure)"
          value={section.label}
          onChange={e => onChange({ ...section, label: e.target.value })}
        />
        {canRemove && (
          <button type="button" className="cp-remove-section-btn" onClick={onRemove} title="Remove section">
            ×
          </button>
        )}
      </div>

      <div className="cp-section-body">
        <div className="cp-code-area">
          <div className="cp-lang-tabs">
            {selectedLanguages.map(lang => (
              <button
                key={lang}
                type="button"
                className={`cp-lang-tab${activeLanguage === lang ? ' active' : ''}`}
                onClick={() => setActiveLanguage(lang)}
              >
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
          <textarea
            className="form-input form-textarea code-textarea cp-code-block"
            placeholder={`Write the code for this section in ${activeLanguage}...`}
            value={(section.code && section.code[activeLanguage]) || ''}
            onChange={e => updateCode(activeLanguage, e.target.value)}
            rows={6}
            spellCheck={false}
          />
          <span className="form-hint">
            Use comments to describe what students should write in this section. The AI uses them to generate better suggestions.
          </span>
        </div>

        <div className="cp-suggestions-area">
          <div className="cp-suggestions-label">Suggestions for this section</div>
          {section.suggestions.map(s => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              onChange={updated => updateSuggestion(s.id, updated)}
              onRemove={() => removeSuggestion(s.id)}
              canRemove={section.suggestions.length > 1}
            />
          ))}
          <button type="button" className="btn-add-distractor" onClick={addSuggestion}>
            + Add Suggestion
          </button>
        </div>
      </div>
    </div>
  );
}


function StepSections({ sections, setSections, selectedLanguages, errors }) {
  const addSection = () => {
    const newSection = makeSection();
    // Initialise code map for each selected language
    newSection.code = Object.fromEntries(selectedLanguages.map(l => [l, '']));
    setSections(prev => [...prev, newSection]);
  };

  const updateSection = (id, updated) => {
    setSections(prev => prev.map(s => s.id === id ? updated : s));
  };

  const removeSection = (id) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="cp-step">
      <div className="cp-step-intro">
        <h3 className="cp-step-title">Sections</h3>
        <p className="cp-step-subtitle">
          Break the problem into sections. Each section becomes a block of code the student works through in order.
          Attach suggestions or distractors to each section, either written by you or generated by AI at runtime.
        </p>

      </div>

      {errors.sections && <p className="form-error">{errors.sections}</p>}

      <div className="cp-sections-list">
        {sections.map((section, index) => (
          <SectionCard
            key={section.id}
            section={section}
            index={index}
            onChange={updated => updateSection(section.id, updated)}
            onRemove={() => removeSection(section.id)}
            canRemove={sections.length > 1}
            selectedLanguages={selectedLanguages}
          />
        ))}
      </div>

      <button type="button" className="cp-add-section-btn" onClick={addSection}>
        + Add Section
      </button>

      <div className="cp-compiled-preview">
        <div className="cp-preview-label">Boilerplate Preview (what students will see)</div>
        <pre className="cp-preview-code">
          {selectedLanguages.length > 0
            ? sections.map((s, i) => {
                const lang = selectedLanguages[0];
                const commentChar = lang === 'python' ? '#' : '//';
                const label = s.label.trim() || `Section ${i + 1}`;
                const header = `${commentChar} ${label} ${'-'.repeat(Math.max(0, 40 - label.length))}`;
                const code = (s.code && s.code[lang]) || '';
                return `${header}\n${code}`;
              }).join('\n')
            : '- select a language to preview -'
          }
        </pre>
      </div>
    </div>
  );
}


// ─── Step 4: Settings ────────────────────────────────────────────────────────

function StepSettings({
  timeLimitMinutes, setTimeLimitMinutes,
  maxSubmissions, setMaxSubmissions,
  allowCopyPaste, setAllowCopyPaste,
  trackTabSwitching, setTrackTabSwitching,
}) {
  return (
    <div className="cp-step">
      <div className="cp-step-intro">
        <h3 className="cp-step-title">Settings</h3>
        <p className="cp-step-subtitle">Configure constraints and monitoring options for this problem.</p>
      </div>

      <div className="form-row">
        <div className="form-field form-field-half">
          <label className="form-label">Time Limit</label>
          <div className="time-limit-wrapper">
            <input
              type="number"
              className="form-input"
              placeholder="None"
              value={timeLimitMinutes}
              min={1}
              onChange={e => setTimeLimitMinutes(e.target.value)}
            />
            <span className="time-limit-unit">minutes</span>
          </div>
          <span className="form-hint">Leave blank for no time limit.</span>
        </div>

        <div className="form-field form-field-half">
          <label className="form-label">Max Submissions</label>
          <input
            type="number"
            className="form-input"
            placeholder="Unlimited"
            value={maxSubmissions}
            min={1}
            onChange={e => setMaxSubmissions(e.target.value)}
          />
          <span className="form-hint">Leave blank for unlimited submissions.</span>
        </div>
      </div>

      <div className="cp-toggles">
        <div className="toggle-field">
          <div className="toggle-field-info">
            <span className="toggle-field-label">Allow Copy &amp; Paste</span>
            <span className="toggle-field-desc">
              {allowCopyPaste
                ? 'Students can freely copy and paste code.'
                : 'Copy and paste is disabled in the editor.'}
            </span>
          </div>
          <button
            type="button"
            className={`toggle-switch${allowCopyPaste ? ' toggle-on' : ' toggle-off'}`}
            onClick={() => setAllowCopyPaste(v => !v)}
            aria-label="Toggle copy and paste"
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="toggle-field">
          <div className="toggle-field-info">
            <span className="toggle-field-label">Track Tab Switching</span>
            <span className="toggle-field-desc">
              {trackTabSwitching
                ? 'Tab and window focus changes will be logged during the problem.'
                : 'Tab switching will not be monitored.'}
            </span>
          </div>
          <button
            type="button"
            className={`toggle-switch${trackTabSwitching ? ' toggle-on' : ' toggle-off'}`}
            onClick={() => setTrackTabSwitching(v => !v)}
            aria-label="Toggle tab switching tracking"
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ currentStep }) {
  return (
    <div className="cp-step-indicator">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className={`cp-step-dot ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}`}>
            <span className="cp-step-dot-num">{i < currentStep ? '✓' : i + 1}</span>
            <span className="cp-step-dot-label">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`cp-step-line${i < currentStep ? ' done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}


// ─── Main Component ──────────────────────────────────────────────────────────

function CreateProblemPage({ onBack }) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Step 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Step 2
  const [selectedLanguages, setSelectedLanguages] = useState(
    AVAILABLE_LANGUAGES.map(({ key }) => key)
  );

  // Step 3 — start with one blank section
  const initSection = () => {
    const s = makeSection();
    s.code = Object.fromEntries(AVAILABLE_LANGUAGES.map(({ key }) => [key, '']));
    return s;
  };
  const [sections, setSections] = useState([initSection()]);

  // Step 4
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('');
  const [maxSubmissions, setMaxSubmissions] = useState('');
  const [allowCopyPaste, setAllowCopyPaste] = useState(true);
  const [trackTabSwitching, setTrackTabSwitching] = useState(false);

  const toggleLanguage = (key) => {
    setSelectedLanguages(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter(l => l !== key);
      }
      return [...prev, key];
    });
  };

  // ── Validation ──
  const validate = () => {
    const errs = {};
    if (step === 0) {
      if (!title.trim()) errs.title = 'Title is required.';
      if (!description.trim()) errs.description = 'Description is required.';
    }
    if (step === 1) {
      if (selectedLanguages.length === 0) errs.languages = 'Select at least one language.';
    }
    if (step === 2) {
      const hasEmpty = sections.some(s => !s.label.trim());
      if (hasEmpty) errs.sections = 'Every section needs a label.';
    }
    return errs;
  };

  const handleNext = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };


  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // Compile boilerplate per language by joining section code blocks in order
    const boilerplate = Object.fromEntries(
      selectedLanguages.map(lang => [
        lang,
        sections.map(s => (s.code && s.code[lang]) || '').join('\n'),
      ])
    );

    const problemData = {
      title: title.trim(),
      description: description.trim(),
      languages: selectedLanguages,
      boilerplate,
      sections: sections.map((s, i) => ({
        order: i + 1,
        label: s.label.trim(),
        code: s.code,
        suggestions: s.suggestions.map(sg => ({
          type: sg.type,
          isCorrect: sg.isCorrect,
          content: sg.type === 'manual' ? sg.content : '',
        })),
      })),
      timeLimitMinutes: timeLimitMinutes !== '' ? Number(timeLimitMinutes) : null,
      maxSubmissions: maxSubmissions !== '' ? Number(maxSubmissions) : null,
      allowCopyPaste,
      trackTabSwitching,
    };

    console.log('Creating problem:', problemData);
    setSubmitted(true);
    setTimeout(() => onBack(), 1500);
  };

  // ── Render ──
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="logo">AutoSuggestion Quiz</h1>
        </div>
        <div className="header-right">
          <button className="btn-back" onClick={onBack}>← Dashboard</button>
        </div>
      </header>

      <div className="create-problem-page">
        <div className="create-problem-container">
          <div className="create-problem-header">
            <h2 className="create-problem-title">Create New Problem</h2>
            <StepIndicator currentStep={step} />
          </div>

          {submitted ? (
            <div className="submit-success">
              <span className="submit-success-icon">✓</span>
              <span>Problem created successfully! Returning to dashboard...</span>
            </div>
          ) : (
            <>
              {step === 0 && (
                <StepDetails
                  title={title} setTitle={setTitle}
                  description={description} setDescription={setDescription}
                  errors={errors}
                />
              )}
              {step === 1 && (
                <StepLanguages
                  selectedLanguages={selectedLanguages}
                  toggleLanguage={toggleLanguage}
                  errors={errors}
                />
              )}
              {step === 2 && (
                <StepSections
                  sections={sections}
                  setSections={setSections}
                  selectedLanguages={selectedLanguages}
                  errors={errors}
                />
              )}
              {step === 3 && (
                <StepSettings
                  timeLimitMinutes={timeLimitMinutes} setTimeLimitMinutes={setTimeLimitMinutes}
                  maxSubmissions={maxSubmissions} setMaxSubmissions={setMaxSubmissions}
                  allowCopyPaste={allowCopyPaste} setAllowCopyPaste={setAllowCopyPaste}
                  trackTabSwitching={trackTabSwitching} setTrackTabSwitching={setTrackTabSwitching}
                />
              )}

              <div className="cp-nav-buttons">
                {step > 0 && (
                  <button type="button" className="btn btn-outline" onClick={handleBack}>
                    ← Back
                  </button>
                )}
                {step < STEPS.length - 1 ? (
                  <button type="button" className="btn btn-run" onClick={handleNext}>
                    Next →
                  </button>
                ) : (
                  <button type="button" className="btn btn-run" onClick={handleSubmit}>
                    Create Problem
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateProblemPage;
