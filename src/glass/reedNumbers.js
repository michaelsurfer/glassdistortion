/**
 * Draw a 1-based index on each reed along the top of a 2D canvas.
 * Uses the canvas's bitmap size so it lines up with the WebGL output.
 * Set clearCanvas=true only for transparent overlays; never when drawing on top of an image.
 */
export function drawReedNumbers(context, width, height, reedCount, clearCanvas = false) {
  const count = Math.max(1, Math.round(reedCount))

  if (clearCanvas) {
    context.clearRect(0, 0, width, height)
  }

  const reedWidth = width / count
  const fontSize = Math.max(9, Math.min(18, reedWidth * 0.5))
  const topPadding = Math.max(6, Math.round(fontSize * 0.35))

  context.font = `600 ${fontSize}px "DM Sans", sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'top'
  context.lineJoin = 'round'
  context.lineWidth = Math.max(2, fontSize * 0.22)

  for (let index = 0; index < count; index += 1) {
    const label = String(index + 1)
    const x = (index + 0.5) * reedWidth
    const y = topPadding

    context.strokeStyle = 'rgba(0, 0, 0, 0.7)'
    context.fillStyle = 'rgba(255, 255, 255, 0.95)'
    context.strokeText(label, x, y)
    context.fillText(label, x, y)
  }
}

/**
 * Copy a WebGL canvas into a new 2D canvas and stamp reed numbers on top.
 */
export function compositeWithReedNumbers(sourceCanvas, reedCount) {
  const output = document.createElement('canvas')
  output.width = sourceCanvas.width
  output.height = sourceCanvas.height

  const context = output.getContext('2d')
  context.drawImage(sourceCanvas, 0, 0)
  // Do not clear — that would wipe the copied image and leave only numbers.
  drawReedNumbers(context, output.width, output.height, reedCount, false)
  return output
}
