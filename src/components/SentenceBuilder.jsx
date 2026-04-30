function SentenceBuilder({
  letter,
  confidence,
  latencyMs,
  handedness,
  sentenceWords,
  currentWord,
  suggestions,
  isSpeaking,
  onSpeakNow,
  onSpeakWord,
  onClear,
  onBackspace,
  onInsertSpace,
  onPickSuggestion,
  practiceMode,
  practiceTarget,
  practiceFeedback,
  referenceLetter,
  referenceHint,
  idleHint,
}) {
  return (
    <section className="sentence-panel" aria-label="Detected output">
      <header className="panel-header">
        <h2>Detection</h2>
        <span className="badge">{handedness} hand</span>
      </header>

      <div className="detected-letter" aria-live="polite">
        {letter || '-'}
      </div>

      <div className="metrics-grid">
        <div>
          <p className="metric-label">Confidence</p>
          <p className="metric-value">{Math.round((confidence || 0) * 100)}%</p>
        </div>
        <div>
          <p className="metric-label">Latency</p>
          <p className="metric-value">{latencyMs.toFixed(2)}ms</p>
        </div>
      </div>

      <div className="sentence-output" role="textbox" tabIndex={0} aria-label="Built sentence">
        {sentenceWords.length > 0 ? (
          <div className="sentence-words">
            {sentenceWords.map((word, index) => (
              <button
                type="button"
                key={`${word}-${index}`}
                className="word-chip"
                onDoubleClick={() => onSpeakWord(word)}
                title="Double-click to speak this word"
              >
                {word}
              </button>
            ))}
          </div>
        ) : (
          'Start signing to build a sentence...'
        )}
      </div>

      <button type="button" className={`speak-now ${isSpeaking ? 'active' : ''}`} onClick={onSpeakNow}>
        {isSpeaking ? 'Speaking...' : 'SPEAK NOW'}
      </button>

      {practiceMode && (
        <div className="practice-box" role="status" aria-live="polite">
          <p className="supporting-text">
            Try signing: <strong>{practiceTarget}</strong>
          </p>
          <p className={`practice-feedback ${practiceFeedback}`}>
            {practiceFeedback === 'correct' && '✓ Correct'}
            {practiceFeedback === 'wrong' && '✗ Try again'}
            {practiceFeedback === 'idle' && 'Waiting for your sign...'}
          </p>
        </div>
      )}

      <div className="reference-card" aria-label="ASL visual reference">
        <div className="reference-image" aria-hidden="true">
          {referenceLetter || '-'}
        </div>
        <div>
          <p className="metric-label">ASL Reference</p>
          <p className="supporting-text">{referenceHint}</p>
        </div>
      </div>

      {idleHint && <p className="idle-hint">{idleHint}</p>}

      <p className="supporting-text">Current word: <strong>{currentWord || '-'}</strong></p>

      {suggestions.length > 0 && (
        <div className="suggestions" role="listbox" aria-label="Word suggestions">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="suggestion-chip"
              onClick={() => onPickSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="sentence-actions">
        <button type="button" onClick={onInsertSpace} aria-keyshortcuts="Alt+S">
          Commit Word
        </button>
        <button type="button" onClick={onBackspace} aria-keyshortcuts="Alt+Backspace">
          Backspace
        </button>
        <button type="button" className="danger" onClick={onClear} aria-keyshortcuts="Alt+C">
          Clear
        </button>
      </div>
    </section>
  )
}

export default SentenceBuilder
