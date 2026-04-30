function Controls({
  speechRate,
  speechVolume,
  onRateChange,
  onVolumeChange,
  highContrast,
  onToggleContrast,
  practiceMode,
  onTogglePracticeMode,
  practiceScore,
  recognitionMode,
  onToggleRecognitionMode,
}) {
  return (
    <section className="controls-panel" aria-label="App settings and accessibility">
      <header className="panel-header">
        <h2>Controls</h2>
        <span className="badge">Keyboard Ready</span>
      </header>

      <label className="slider-control">
        Speech Speed
        <input
          type="range"
          min="0.5"
          max="1.8"
          step="0.1"
          value={speechRate}
          onChange={(event) => onRateChange(Number(event.target.value))}
        />
        <span>{speechRate.toFixed(1)}x</span>
      </label>

      <label className="slider-control">
        Speech Volume
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={speechVolume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
        <span>{Math.round(speechVolume * 100)}%</span>
      </label>

      <button type="button" onClick={onToggleContrast} aria-keyshortcuts="Alt+H">
        {highContrast ? 'Disable High Contrast' : 'Enable High Contrast'}
      </button>

      <button type="button" onClick={onTogglePracticeMode} aria-pressed={practiceMode}>
        {practiceMode ? 'Practice Mode ON' : 'Practice Mode OFF'}
      </button>

      <button type="button" onClick={onToggleRecognitionMode}>
        {recognitionMode === 'word' ? 'Word Mode' : 'Letter Mode'}
      </button>

      <p className="supporting-text">
        Practice score: <strong>{practiceScore.correct}</strong>/<strong>{practiceScore.total}</strong>
      </p>

      <p className="shortcuts">
        Keyboard shortcuts: Alt+C Clear, Alt+S Space, Alt+Backspace Backspace, Alt+V Voice Commands, Alt+P Speech, Alt+H High Contrast.
      </p>
    </section>
  )
}

export default Controls
