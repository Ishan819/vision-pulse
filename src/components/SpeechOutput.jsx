function SpeechOutput({
  speechEnabled,
  isSpeaking,
  lastSpoken,
  preferredVoiceName,
  voiceSupported,
  isVoiceCommandActive,
  onToggleSpeech,
  onToggleVoiceCommands,
}) {
  return (
    <section className="speech-panel" aria-label="Speech and voice control">
      <header className="panel-header">
        <h2>Speech Output</h2>
        <span className={`status-dot ${speechEnabled ? 'on' : 'off'}`}>
          {speechEnabled ? 'ON' : 'OFF'}
        </span>
      </header>

      <p className="supporting-text">
        Spoken text: <strong>{lastSpoken || 'Nothing spoken yet'}</strong>
      </p>
      <p className="supporting-text">
        Speech engine: {isSpeaking ? 'Speaking...' : 'Idle'}
      </p>
      <p className="supporting-text">Voice: {preferredVoiceName || 'Default browser voice'}</p>

      <div className="speech-actions">
        <button type="button" onClick={onToggleSpeech} aria-keyshortcuts="Alt+P">
          {speechEnabled ? 'Mute Speech' : 'Enable Speech'}
        </button>
        <button
          type="button"
          onClick={onToggleVoiceCommands}
          disabled={!voiceSupported}
          aria-keyshortcuts="Alt+V"
        >
          {isVoiceCommandActive ? 'Stop Voice Commands' : 'Start Voice Commands'}
        </button>
      </div>

      {!voiceSupported && (
        <p className="panel-error" role="alert">
          Voice commands are not supported in this browser.
        </p>
      )}
    </section>
  )
}

export default SpeechOutput
