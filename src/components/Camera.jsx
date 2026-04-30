import HandOverlay from './HandOverlay'

function Camera({
  videoRef,
  landmarks,
  connections,
  isInitializing,
  error,
  cameraError,
  confidenceState,
}) {
  const frameClass =
    confidenceState === 'confident'
      ? 'camera-frame confident'
      : confidenceState === 'unsure'
        ? 'camera-frame unsure'
        : 'camera-frame'

  return (
    <section className="camera-panel" aria-label="Live sign detection feed">
      <div className={frameClass}>
        <video
          ref={videoRef}
          className="camera-video"
          autoPlay
          muted
          playsInline
          aria-label="Webcam live feed"
        />
        <HandOverlay landmarks={landmarks} connections={connections} />

        {isInitializing && (
          <div className="camera-loading" role="status" aria-live="polite">
            <div className="loader" />
            <p>Initializing hand model and camera...</p>
          </div>
        )}
      </div>

      {(error || cameraError) && (
        <p className="panel-error" role="alert">
          {error || cameraError}
        </p>
      )}
    </section>
  )
}

export default Camera
