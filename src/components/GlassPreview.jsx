import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { GlassRenderer } from '../glass/GlassRenderer.js'

const PREVIEW_MAX_WIDTH = 1100
const LIVE_MAX_EDGE = 960

// Stop every track on a media stream so the camera light turns off.
function stopMediaStream(stream) {
  if (!stream) {
    return
  }
  stream.getTracks().forEach((track) => {
    track.stop()
  })
}

// Wait until the video element has real frame dimensions.
function waitForVideoDimensions(videoElement) {
  if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('Camera started but no video frames arrived.'))
    }, 8000)

    function onReady() {
      if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        cleanup()
        resolve()
      }
    }

    function cleanup() {
      window.clearTimeout(timeoutId)
      videoElement.removeEventListener('loadedmetadata', onReady)
      videoElement.removeEventListener('loadeddata', onReady)
      videoElement.removeEventListener('playing', onReady)
    }

    videoElement.addEventListener('loadedmetadata', onReady)
    videoElement.addEventListener('loadeddata', onReady)
    videoElement.addEventListener('playing', onReady)
    onReady()
  })
}

// Fit preview drawing into the available container.
function getDrawSize(sourceWidth, sourceHeight, containerWidth) {
  if (!sourceWidth || !sourceHeight || !containerWidth) {
    return { width: 1, height: 1 }
  }

  const availableWidth = Math.min(containerWidth, PREVIEW_MAX_WIDTH)
  const scale = Math.min(
    1,
    availableWidth / sourceWidth,
    LIVE_MAX_EDGE / Math.max(sourceWidth, sourceHeight)
  )

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

// Capture the current video frame as a JPEG file.
async function captureFrameAsFile(videoElement, shouldMirror) {
  const width = videoElement.videoWidth
  const height = videoElement.videoHeight

  if (!width || !height) {
    throw new Error('Camera frame is not ready yet.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  // Live WebGL uploads video with UNPACK_FLIP_Y, but canvas 2D drawImage does not.
  // Flip Y (and mirror X for selfies) so the saved still matches the live preview.
  if (shouldMirror) {
    context.translate(width, height)
    context.scale(-1, -1)
  } else {
    context.translate(0, height)
    context.scale(1, -1)
  }
  context.drawImage(videoElement, 0, 0, width, height)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Could not capture photo.'))
          return
        }
        resolve(result)
      },
      'image/jpeg',
      0.95
    )
  })

  return new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

// Main preview: still images or live camera, both with glass distortion.
const GlassPreview = forwardRef(function GlassPreview(
  {
    imageSource,
    settings,
    cameraActive,
    facingMode,
    onCameraError,
    onCameraReadyChange,
  },
  ref
) {
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const rendererRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const settingsRef = useRef(settings)
  const imageRef = useRef(imageSource)
  const facingModeRef = useRef(facingMode)

  const [cameraReady, setCameraReady] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  settingsRef.current = settings
  imageRef.current = imageSource
  facingModeRef.current = facingMode

  // Expose capture to the parent Take photo button.
  useImperativeHandle(ref, () => ({
    async capturePhoto() {
      if (!videoRef.current || !cameraActive) {
        throw new Error('Camera is not active.')
      }
      return captureFrameAsFile(videoRef.current, facingModeRef.current === 'user')
    },
  }))

  // Create the WebGL renderer once the canvas mounts.
  useEffect(() => {
    if (!canvasRef.current) {
      return undefined
    }

    let renderer = null

    try {
      canvasRef.current.style.display = 'block'
      renderer = new GlassRenderer(canvasRef.current)
      rendererRef.current = renderer
    } catch (error) {
      console.error(error)
      rendererRef.current = null
      onCameraError?.(error.message || 'WebGL preview failed.')
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      renderer?.destroy()
      if (rendererRef.current === renderer) {
        rendererRef.current = null
      }
    }
  }, [])

  // Build the settings used for still vs live camera rendering.
  function getRenderSettings() {
    if (cameraActive) {
      return {
        ...settingsRef.current,
        rotate180: false,
        mirrorX: facingModeRef.current === 'user',
      }
    }

    return {
      ...settingsRef.current,
      rotate180: false,
      mirrorX: false,
    }
  }

  // Draw a still image into the preview canvas.
  function drawStillPreview() {
    const renderer = rendererRef.current
    const container = containerRef.current
    const image = imageRef.current

    if (!renderer || !image || !container || cameraActive) {
      return
    }

    const size = getDrawSize(image.width, image.height, container.clientWidth)
    renderer.render(getRenderSettings(), size.width, size.height, false)
  }

  // Start / stop the camera when cameraActive or facingMode changes.
  useEffect(() => {
    if (!cameraActive) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      stopMediaStream(streamRef.current)
      streamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setCameraReady(false)
      setStatusMessage('')
      onCameraReadyChange?.(false)
      if (imageRef.current) {
        rendererRef.current?.setImage(imageRef.current)
        drawStillPreview()
      }
      return undefined
    }

    let cancelled = false
    let running = false

    async function startCamera() {
      setCameraReady(false)
      onCameraReadyChange?.(false)
      setStatusMessage('Starting camera…')
      stopMediaStream(streamRef.current)
      streamRef.current = null

      if (!navigator.mediaDevices?.getUserMedia) {
        const message = 'Camera access is not supported in this browser.'
        setStatusMessage('')
        onCameraError?.(message)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (cancelled) {
          stopMediaStream(stream)
          return
        }

        const video = videoRef.current
        const renderer = rendererRef.current
        const container = containerRef.current

        if (!video || !renderer || !container) {
          stopMediaStream(stream)
          throw new Error('Camera preview was not ready.')
        }

        streamRef.current = stream
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        await video.play()
        await waitForVideoDimensions(video)

        if (cancelled) {
          return
        }

        setCameraReady(true)
        onCameraReadyChange?.(true)
        setStatusMessage('')
        running = true

        function drawLiveFrame() {
          if (!running || cancelled) {
            return
          }

          if (video.readyState >= 2 && video.videoWidth > 0) {
            const uploaded = renderer.updateFrame(video)
            if (uploaded) {
              const size = getDrawSize(
                video.videoWidth,
                video.videoHeight,
                container.clientWidth
              )
              renderer.render(getRenderSettings(), size.width, size.height, false)
            }
          }

          rafRef.current = requestAnimationFrame(drawLiveFrame)
        }

        rafRef.current = requestAnimationFrame(drawLiveFrame)
      } catch (error) {
        console.error(error)
        setCameraReady(false)
        onCameraReadyChange?.(false)
        setStatusMessage('')
        onCameraError?.(
          error?.message?.includes('frames')
            ? error.message
            : 'Could not open the camera. Allow camera permission and try again.'
        )
      }
    }

    startCamera()

    return () => {
      cancelled = true
      running = false
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
      stopMediaStream(streamRef.current)
      streamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
  }, [cameraActive, facingMode])

  // Upload still texture then redraw whenever the source image changes.
  useEffect(() => {
    if (cameraActive) {
      return undefined
    }

    if (!rendererRef.current || !imageSource) {
      return undefined
    }

    rendererRef.current.setImage(imageSource)
    drawStillPreview()

    const container = containerRef.current
    if (!container) {
      return undefined
    }

    const observer = new ResizeObserver(() => {
      drawStillPreview()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [imageSource, cameraActive])

  // When settings change in still mode, redraw. Live mode reads settings each frame.
  useEffect(() => {
    if (!cameraActive) {
      drawStillPreview()
    }
  }, [settings, cameraActive])

  const showEmptyState = !imageSource && !cameraActive
  const showCanvas = Boolean(imageSource) || cameraActive

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 360,
        width: '100%',
        borderRadius: 2,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), transparent 45%), linear-gradient(160deg, #1a1714 0%, #0d0c0b 55%, #151210 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Full-size but invisible: tiny video elements often stop decoding frames. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {showEmptyState && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ padding: 4, textAlign: 'center' }}
        >
          Upload a photo or pick a sample to preview the glass distortion.
        </Typography>
      )}

      {cameraActive && !cameraReady && (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ position: 'absolute', zIndex: 2, padding: 4, textAlign: 'center' }}
        >
          {statusMessage || 'Starting camera…'}
        </Typography>
      )}

      <canvas
        ref={canvasRef}
        style={{
          // Keep display:block so the WebGL context stays valid.
          display: 'block',
          width: showCanvas ? '100%' : 0,
          height: showCanvas ? 'auto' : 0,
          maxWidth: '100%',
          opacity: !showCanvas ? 0 : cameraActive && !cameraReady ? 0.25 : 1,
        }}
      />
    </Box>
  )
})

export default GlassPreview
