import { useEffect, useRef } from 'react'

function drawPoint(ctx, point, width, height) {
  const x = point.x * width
  const y = point.y * height

  ctx.beginPath()
  ctx.arc(x, y, 4.8, 0, Math.PI * 2)
  ctx.fillStyle = '#4ee1ff'
  ctx.fill()
}

function drawConnections(ctx, landmarks, connections, width, height) {
  connections.forEach(([startIdx, endIdx]) => {
    const start = landmarks[startIdx]
    const end = landmarks[endIdx]

    if (!start || !end) {
      return
    }

    ctx.beginPath()
    ctx.moveTo(start.x * width, start.y * height)
    ctx.lineTo(end.x * width, end.y * height)
    ctx.strokeStyle = 'rgba(78, 225, 255, 0.62)'
    ctx.lineWidth = 2.2
    ctx.stroke()
  })
}

function HandOverlay({ landmarks, connections }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const context = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    context.clearRect(0, 0, width, height)

    if (!landmarks || landmarks.length === 0) {
      return
    }

    drawConnections(context, landmarks, connections, width, height)
    landmarks.forEach((landmark) => drawPoint(context, landmark, width, height))
  }, [landmarks, connections])

  return <canvas ref={canvasRef} width={960} height={720} className="hand-overlay" aria-hidden="true" />
}

export default HandOverlay
