const LETTER_THRESHOLD = 0.75
const WORD_THRESHOLD = 0.75

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

const distance = (a, b) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z || 0) - (b.z || 0)
  return Math.hypot(dx, dy, dz)
}

const normalize = (value, base) => (base > 0 ? value / base : 0)
const average = (numbers) => (numbers.length ? numbers.reduce((s, v) => s + v, 0) / numbers.length : 0)

const scoreByBoolean = (condition, trueScore = 1, falseScore = 0.15) => (condition ? trueScore : falseScore)

const getFingerOpenScore = (mcp, pip, tip, palmSize) => {
  const verticalLift = (mcp.y - tip.y) / Math.max(0.0001, palmSize)
  const extension = normalize(distance(mcp, tip), palmSize)
  const curlPenalty = clamp((tip.y - pip.y + 0.06) * 3)
  return clamp(verticalLift * 0.45 + extension * 0.8 - curlPenalty)
}

export const extractHandFeatures = (landmarks, handedness = 'Right') => {
  if (!landmarks || landmarks.length !== 21) {
    return null
  }

  const wrist = landmarks[0]
  const thumbCmc = landmarks[1]
  const thumbMcp = landmarks[2]
  const thumbIp = landmarks[3]
  const thumbTip = landmarks[4]
  const palmCenter = landmarks[9]
  const indexMcp = landmarks[5]
  const pinkyMcp = landmarks[17]

  const palmSize = Math.max(0.0001, distance(wrist, palmCenter))

  const indexScore = getFingerOpenScore(landmarks[5], landmarks[6], landmarks[8], palmSize)
  const middleScore = getFingerOpenScore(landmarks[9], landmarks[10], landmarks[12], palmSize)
  const ringScore = getFingerOpenScore(landmarks[13], landmarks[14], landmarks[16], palmSize)
  const pinkyScore = getFingerOpenScore(landmarks[17], landmarks[18], landmarks[20], palmSize)

  const thumbReach = normalize(distance(thumbTip, thumbMcp), palmSize)
  const thumbAcrossRight = thumbTip.x > thumbIp.x && thumbIp.x > thumbMcp.x
  const thumbAcrossLeft = thumbTip.x < thumbIp.x && thumbIp.x < thumbMcp.x
  const thumbAcross = handedness === 'Right' ? thumbAcrossRight : thumbAcrossLeft

  const thumbOut =
    handedness === 'Right'
      ? thumbTip.x < thumbCmc.x - 0.02 || thumbReach > 0.92
      : thumbTip.x > thumbCmc.x + 0.02 || thumbReach > 0.92

  const thumbTucked = normalize(distance(thumbTip, wrist), palmSize) < 1.05
  const thumbPosition = thumbOut ? 'out' : thumbAcross ? 'across' : thumbTucked ? 'tucked' : 'up'

  const fingerToThumb = [8, 12, 16, 20].map((tipIdx) => normalize(distance(landmarks[tipIdx], thumbTip), palmSize))
  const fingerCurveScore = clamp(1 - average(fingerToThumb) * 0.55)

  const fingers = {
    index: { openScore: indexScore, open: indexScore > 0.55 },
    middle: { openScore: middleScore, open: middleScore > 0.55 },
    ring: { openScore: ringScore, open: ringScore > 0.55 },
    pinky: { openScore: pinkyScore, open: pinkyScore > 0.55 },
  }

  const isFist = !fingers.index.open && !fingers.middle.open && !fingers.ring.open && !fingers.pinky.open
  const isFlatPalm = fingers.index.open && fingers.middle.open && fingers.ring.open && fingers.pinky.open
  const pinchScore = clamp(1.25 - average([fingerToThumb[0], fingerToThumb[1]]))
  const isPinch = pinchScore > 0.68
  const isCShape = fingerCurveScore > 0.46 && !isFist
  const isWShape = fingers.index.open && fingers.middle.open && fingers.ring.open && !fingers.pinky.open
  const isTwoFinger = fingers.index.open && fingers.middle.open && !fingers.ring.open && !fingers.pinky.open
  const isIndexOnly = fingers.index.open && !fingers.middle.open && !fingers.ring.open && !fingers.pinky.open

  return {
    palmSize,
    palmWidth: distance(indexMcp, pinkyMcp),
    landmarks,
    fingers,
    thumbPosition,
    thumbOut,
    thumbAcross,
    thumbTucked,
    fingerCurveScore,
    fingerToThumb,
    pinchScore,
    isPinch,
    isFist,
    isFlatPalm,
    isCShape,
    isWShape,
    isTwoFinger,
    isIndexOnly,
    wrist,
  }
}

const scoreA = (f) => clamp(scoreByBoolean(f.isFist) * 0.65 + scoreByBoolean(f.thumbOut || f.thumbAcross) * 0.35)
const scoreB = (f) => {
  const fingersOpenScore = average([f.fingers.index.openScore, f.fingers.middle.openScore, f.fingers.ring.openScore, f.fingers.pinky.openScore])
  return clamp(fingersOpenScore * 0.7 + scoreByBoolean(f.thumbTucked || f.thumbAcross) * 0.3)
}
const scoreC = (f) => clamp(f.fingerCurveScore * 0.65 + scoreByBoolean(!f.isFist) * 0.35)
const scoreL = (f) => clamp(scoreByBoolean(f.fingers.index.open) * 0.45 + scoreByBoolean(!f.fingers.middle.open && !f.fingers.ring.open && !f.fingers.pinky.open) * 0.3 + scoreByBoolean(f.thumbOut) * 0.25)
const scoreO = (f) => clamp(clamp(1.35 - average(f.fingerToThumb)) * 0.68 + scoreByBoolean(!f.fingers.index.open && !f.fingers.middle.open, 1, 0.3) * 0.32)
const scoreV = (f) => clamp(scoreByBoolean(f.fingers.index.open && f.fingers.middle.open) * 0.58 + scoreByBoolean(!f.fingers.ring.open && !f.fingers.pinky.open) * 0.42)
const scoreY = (f) => clamp(scoreByBoolean(f.fingers.pinky.open) * 0.38 + scoreByBoolean(!f.fingers.index.open && !f.fingers.middle.open && !f.fingers.ring.open) * 0.34 + scoreByBoolean(f.thumbOut) * 0.28)
const scoreI = (f) => clamp(scoreByBoolean(f.fingers.pinky.open) * 0.45 + scoreByBoolean(!f.fingers.index.open && !f.fingers.middle.open && !f.fingers.ring.open) * 0.38 + scoreByBoolean(f.thumbTucked || f.thumbAcross) * 0.17)

const LETTER_SCORERS = {
  A: scoreA,
  B: scoreB,
  C: scoreC,
  I: scoreI,
  L: scoreL,
  O: scoreO,
  V: scoreV,
  Y: scoreY,
}

export const recognizeASLLetter = (landmarks, handedness = 'Right') => {
  const features = extractHandFeatures(landmarks, handedness)
  if (!features) {
    return { letter: null, confidence: 0, features: null }
  }

  let bestLetter = null
  let bestScore = 0

  Object.entries(LETTER_SCORERS).forEach(([letter, scorer]) => {
    const score = scorer(features)
    if (score > bestScore) {
      bestScore = score
      bestLetter = letter
    }
  })

  if (bestScore < LETTER_THRESHOLD) {
    return { letter: null, confidence: Number(bestScore.toFixed(2)), features }
  }

  return { letter: bestLetter, confidence: Number(bestScore.toFixed(2)), features }
}

const getRange = (values) => {
  if (!values.length) {
    return 0
  }
  return Math.max(...values) - Math.min(...values)
}

const getDirectionChanges = (values) => {
  if (values.length < 3) {
    return 0
  }
  let changes = 0
  let previousSign = 0

  for (let i = 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1]
    const sign = Math.abs(delta) < 0.003 ? 0 : delta > 0 ? 1 : -1
    if (sign !== 0 && previousSign !== 0 && sign !== previousSign) {
      changes += 1
    }
    if (sign !== 0) {
      previousSign = sign
    }
  }

  return changes
}

const getCircularity = (points) => {
  if (points.length < 4) {
    return 0
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const width = getRange(xs)
  const height = getRange(ys)

  if (width < 0.03 || height < 0.03) {
    return 0
  }

  let pathLength = 0
  for (let i = 1; i < points.length; i += 1) {
    pathLength += distance(points[i - 1], points[i])
  }

  const perimeter = 2 * (width + height)
  return clamp(pathLength / Math.max(0.001, perimeter) - 0.55)
}

const getFramesForLabel = (history, label) =>
  history
    .map((frame) => {
      const hand = frame.hands.find((item) => item.label === label)
      return hand ? { timestamp: frame.timestamp, hand } : null
    })
    .filter(Boolean)

const getActiveLabels = (history) => {
  const labels = new Set()
  history.forEach((frame) => frame.hands.forEach((hand) => labels.add(hand.label)))
  return [...labels]
}

const getLatestHands = (history) => {
  if (!history.length) {
    return []
  }
  return history[history.length - 1].hands
}

const getVectorAngle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x)

const scoreEat = (dominantFrames) => {
  if (dominantFrames.length < 6) {
    return 0
  }

  const wrists = dominantFrames.map((item) => item.hand.landmarks[0])
  const features = dominantFrames.map((item) => item.hand.features)
  const yValues = wrists.map((point) => point.y)
  const motionUp = scoreByBoolean(wrists[wrists.length - 1].y < wrists[0].y - 0.035, 1, 0.2)
  const bounce = clamp(getDirectionChanges(yValues) / 3)
  const nearMouth = clamp(1 - Math.abs(average(yValues) - 0.34) * 6)
  const pinch = average(features.map((item) => item.pinchScore))

  return clamp(pinch * 0.45 + motionUp * 0.18 + bounce * 0.2 + nearMouth * 0.17)
}

const scoreDrink = (dominantFrames) => {
  if (dominantFrames.length < 6) {
    return 0
  }

  const wrists = dominantFrames.map((item) => item.hand.landmarks[0])
  const features = dominantFrames.map((item) => item.hand.features)
  const isCShape = average(features.map((item) => scoreByBoolean(item.isCShape)))
  const towardMouth = scoreByBoolean(wrists[wrists.length - 1].y < wrists[0].y - 0.03, 1, 0.2)

  const tiltSeries = dominantFrames.map((item) => getVectorAngle(item.hand.landmarks[0], item.hand.landmarks[9]))
  const tiltDelta = clamp(Math.abs(tiltSeries[tiltSeries.length - 1] - tiltSeries[0]) / 0.9)

  return clamp(isCShape * 0.52 + towardMouth * 0.24 + tiltDelta * 0.24)
}

const scorePlease = (dominantFrames) => {
  if (dominantFrames.length < 6) {
    return 0
  }

  const wrists = dominantFrames.map((item) => item.hand.landmarks[0])
  const features = dominantFrames.map((item) => item.hand.features)
  const flatPalm = average(features.map((item) => scoreByBoolean(item.isFlatPalm)))
  const chestProximity = clamp(1 - Math.abs(average(wrists.map((point) => point.y)) - 0.58) * 4.5)
  const circularity = getCircularity(wrists)

  return clamp(flatPalm * 0.45 + chestProximity * 0.25 + circularity * 0.3)
}

const scoreThankYou = (dominantFrames) => {
  if (dominantFrames.length < 6) {
    return 0
  }

  const start = dominantFrames[0].hand.landmarks[0]
  const end = dominantFrames[dominantFrames.length - 1].hand.landmarks[0]
  const features = dominantFrames.map((item) => item.hand.features)

  const flatPalm = average(features.map((item) => scoreByBoolean(item.isFlatPalm)))
  const startsNearChin = clamp(1 - Math.abs(start.y - 0.34) * 7)
  const movesOutward = clamp((start.z - end.z + 0.03) * 4)
  const movesAwayFromFace = scoreByBoolean(end.y > start.y + 0.015 || Math.abs(end.x - 0.5) > Math.abs(start.x - 0.5), 1, 0.2)

  return clamp(flatPalm * 0.45 + startsNearChin * 0.2 + movesOutward * 0.2 + movesAwayFromFace * 0.15)
}

const scoreYes = (dominantFrames) => {
  if (dominantFrames.length < 6) {
    return 0
  }

  const wrists = dominantFrames.map((item) => item.hand.landmarks[0])
  const features = dominantFrames.map((item) => item.hand.features)
  const fist = average(features.map((item) => scoreByBoolean(item.isFist)))
  const yRange = clamp(getRange(wrists.map((point) => point.y)) / 0.12)
  const bounce = clamp(getDirectionChanges(wrists.map((point) => point.y)) / 3)

  return clamp(fist * 0.55 + yRange * 0.25 + bounce * 0.2)
}

const scoreNo = (dominantFrames) => {
  if (dominantFrames.length < 6) {
    return 0
  }

  const features = dominantFrames.map((item) => item.hand.features)
  const twoFinger = average(features.map((item) => scoreByBoolean(item.isTwoFinger)))

  const snapSeries = dominantFrames.map((item) => {
    const thumb = item.hand.landmarks[4]
    const index = item.hand.landmarks[8]
    const middle = item.hand.landmarks[12]
    const palm = Math.max(0.0001, item.hand.features.palmSize)
    return normalize(distance(thumb, index) + distance(thumb, middle), palm * 2)
  })

  const snapChanges = clamp(getDirectionChanges(snapSeries) / 4)
  const closesToThumb = clamp(1.1 - Math.min(...snapSeries) * 1.2)

  return clamp(twoFinger * 0.45 + snapChanges * 0.3 + closesToThumb * 0.25)
}

const scoreWater = (dominantFrames) => {
  if (dominantFrames.length < 6) {
    return 0
  }

  const features = dominantFrames.map((item) => item.hand.features)
  const wrists = dominantFrames.map((item) => item.hand.landmarks[0])

  const wShape = average(features.map((item) => scoreByBoolean(item.isWShape)))
  const nearChin = clamp(1 - Math.abs(average(wrists.map((point) => point.y)) - 0.33) * 6)
  const tap = clamp(getDirectionChanges(wrists.map((point) => point.y)) / 3)

  return clamp(wShape * 0.48 + nearChin * 0.26 + tap * 0.26)
}

const scoreHelp = (leftFrames, rightFrames) => {
  if (leftFrames.length < 5 || rightFrames.length < 5) {
    return 0
  }

  const leftLatest = leftFrames[leftFrames.length - 1].hand.features
  const rightLatest = rightFrames[rightFrames.length - 1].hand.features

  const hasFlatAndFist =
    (leftLatest.isFlatPalm && rightLatest.isFist) || (rightLatest.isFlatPalm && leftLatest.isFist)

  const leftStart = leftFrames[0].hand.landmarks[0]
  const leftEnd = leftFrames[leftFrames.length - 1].hand.landmarks[0]
  const rightStart = rightFrames[0].hand.landmarks[0]
  const rightEnd = rightFrames[rightFrames.length - 1].hand.landmarks[0]

  const riseTogether = scoreByBoolean(leftEnd.y < leftStart.y - 0.02 && rightEnd.y < rightStart.y - 0.02, 1, 0.2)
  const stayAligned = clamp(1 - Math.abs(leftEnd.x - rightEnd.x) * 3)

  return clamp(scoreByBoolean(hasFlatAndFist, 1, 0.15) * 0.56 + riseTogether * 0.24 + stayAligned * 0.2)
}

const scoreHurt = (leftFrames, rightFrames) => {
  if (leftFrames.length < 6 || rightFrames.length < 6) {
    return 0
  }

  const leftLatest = leftFrames[leftFrames.length - 1].hand.features
  const rightLatest = rightFrames[rightFrames.length - 1].hand.features

  const indexOnly = scoreByBoolean(leftLatest.isIndexOnly && rightLatest.isIndexOnly, 1, 0.1)

  const leftTip = leftFrames[leftFrames.length - 1].hand.landmarks[8]
  const rightTip = rightFrames[rightFrames.length - 1].hand.landmarks[8]
  const tipNear = clamp(1 - distance(leftTip, rightTip) * 7)

  const leftAngles = leftFrames.map((item) => getVectorAngle(item.hand.landmarks[5], item.hand.landmarks[8]))
  const rightAngles = rightFrames.map((item) => getVectorAngle(item.hand.landmarks[5], item.hand.landmarks[8]))

  const leftDelta = leftAngles[leftAngles.length - 1] - leftAngles[0]
  const rightDelta = rightAngles[rightAngles.length - 1] - rightAngles[0]
  const oppositeTwist = clamp(Math.abs(leftDelta - rightDelta) / 1.6)

  return clamp(indexOnly * 0.45 + tipNear * 0.25 + oppositeTwist * 0.3)
}

const scoreMore = (leftFrames, rightFrames) => {
  if (leftFrames.length < 6 || rightFrames.length < 6) {
    return 0
  }

  const leftLatest = leftFrames[leftFrames.length - 1].hand.features
  const rightLatest = rightFrames[rightFrames.length - 1].hand.features
  const bothPinch = scoreByBoolean(leftLatest.isPinch && rightLatest.isPinch, 1, 0.15)

  const pairDistances = leftFrames
    .map((item, index) => {
      const other = rightFrames[index]
      if (!other) {
        return null
      }
      return distance(item.hand.landmarks[4], other.hand.landmarks[4])
    })
    .filter((value) => typeof value === 'number')

  const tapBounce = clamp(getDirectionChanges(pairDistances) / 4)
  const closeEnough = clamp(1.1 - Math.min(...pairDistances) * 5)

  return clamp(bothPinch * 0.52 + tapBounce * 0.28 + closeEnough * 0.2)
}

const scoreStop = (leftFrames, rightFrames) => {
  if (leftFrames.length < 5 || rightFrames.length < 5) {
    return 0
  }

  const leftLatest = leftFrames[leftFrames.length - 1].hand.features
  const rightLatest = rightFrames[rightFrames.length - 1].hand.features
  const bothFlat = scoreByBoolean(leftLatest.isFlatPalm && rightLatest.isFlatPalm, 1, 0.2)

  const leftWrist = leftFrames.map((item) => item.hand.landmarks[0])
  const rightWrist = rightFrames.map((item) => item.hand.landmarks[0])
  const oneChopsDown =
    (leftWrist[leftWrist.length - 1].y > leftWrist[0].y + 0.04 && Math.abs(rightWrist[rightWrist.length - 1].y - rightWrist[0].y) < 0.03) ||
    (rightWrist[rightWrist.length - 1].y > rightWrist[0].y + 0.04 && Math.abs(leftWrist[leftWrist.length - 1].y - leftWrist[0].y) < 0.03)

  const crossing = clamp(1 - Math.abs(leftWrist[leftWrist.length - 1].x - rightWrist[rightWrist.length - 1].x) * 3)

  return clamp(bothFlat * 0.45 + scoreByBoolean(oneChopsDown, 1, 0.15) * 0.35 + crossing * 0.2)
}

const scoreAllDone = (leftFrames, rightFrames) => {
  if (leftFrames.length < 6 || rightFrames.length < 6) {
    return 0
  }

  const leftLatest = leftFrames[leftFrames.length - 1].hand.features
  const rightLatest = rightFrames[rightFrames.length - 1].hand.features

  const bothOpen = scoreByBoolean(leftLatest.isFlatPalm && rightLatest.isFlatPalm, 1, 0.2)

  const leftStart = leftFrames[0].hand.landmarks[0]
  const rightStart = rightFrames[0].hand.landmarks[0]
  const leftEnd = leftFrames[leftFrames.length - 1].hand.landmarks[0]
  const rightEnd = rightFrames[rightFrames.length - 1].hand.landmarks[0]

  const moveOutward = scoreByBoolean(leftEnd.x < leftStart.x - 0.01 && rightEnd.x > rightStart.x + 0.01, 1, 0.2)
  const moveDown = scoreByBoolean(leftEnd.y > leftStart.y + 0.01 && rightEnd.y > rightStart.y + 0.01, 1, 0.2)

  return clamp(bothOpen * 0.5 + moveOutward * 0.3 + moveDown * 0.2)
}

const WORD_SCORERS = {
  EAT: ({ dominant }) => scoreEat(dominant),
  DRINK: ({ dominant }) => scoreDrink(dominant),
  PLEASE: ({ dominant }) => scorePlease(dominant),
  THANK_YOU: ({ dominant }) => scoreThankYou(dominant),
  YES: ({ dominant }) => scoreYes(dominant),
  NO: ({ dominant }) => scoreNo(dominant),
  WATER: ({ dominant }) => scoreWater(dominant),
  HELP: ({ left, right }) => scoreHelp(left, right),
  HURT: ({ left, right }) => scoreHurt(left, right),
  MORE: ({ left, right }) => scoreMore(left, right),
  STOP: ({ left, right }) => scoreStop(left, right),
  ALL_DONE: ({ left, right }) => scoreAllDone(left, right),
}

const normalizeWordLabel = (word) => word.replace('_', ' ').toLowerCase()

export const recognizeASLWordSign = (frameHistory = []) => {
  if (!frameHistory.length) {
    return { word: null, confidence: 0 }
  }

  const latestHands = getLatestHands(frameHistory)
  if (!latestHands.length) {
    return { word: null, confidence: 0 }
  }

  const labels = getActiveLabels(frameHistory)
  const dominantLabel = labels.includes('Right') ? 'Right' : labels[0]
  const dominantFrames = getFramesForLabel(frameHistory, dominantLabel)
  const leftFrames = getFramesForLabel(frameHistory, 'Left')
  const rightFrames = getFramesForLabel(frameHistory, 'Right')

  const context = {
    dominant: dominantFrames,
    left: leftFrames,
    right: rightFrames,
  }

  let bestWord = null
  let bestScore = 0

  Object.entries(WORD_SCORERS).forEach(([word, scorer]) => {
    const score = scorer(context)
    if (score > bestScore) {
      bestScore = score
      bestWord = word
    }
  })

  if (!bestWord || bestScore < WORD_THRESHOLD) {
    return { word: null, confidence: Number(bestScore.toFixed(2)) }
  }

  return {
    word: normalizeWordLabel(bestWord),
    confidence: Number(bestScore.toFixed(2)),
  }
}
