import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Chip,
  Container,
  CssBaseline,
  Snackbar,
  Toolbar,
  Typography,
  createTheme,
  ThemeProvider,
} from '@mui/material'
import UploadZone from './components/UploadZone.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import GlassPreview from './components/GlassPreview.jsx'
import { GlassRenderer } from './glass/GlassRenderer.js'
import { DEFAULT_SETTINGS, SAMPLE_IMAGES } from './glass/defaults.js'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#c4956a',
    },
    secondary: {
      main: '#8fa3b8',
    },
    background: {
      default: '#0f0e0c',
      paper: '#171512',
    },
    text: {
      primary: '#f3ebe2',
      secondary: '#b7aea3',
    },
  },
  typography: {
    fontFamily: '"DM Sans", sans-serif',
    h1: {
      fontFamily: '"Fraunces", serif',
    },
    h6: {
      fontFamily: '"Fraunces", serif',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
})

// Load a File or URL into an ImageBitmap for GPU upload.
async function loadImageBitmap(source) {
  if (typeof source === 'string') {
    const response = await fetch(source)
    const blob = await response.blob()
    return createImageBitmap(blob)
  }

  return createImageBitmap(source)
}

// Trigger a browser download for the exported blob.
function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [imageSource, setImageSource] = useState(null)
  const [imageLabel, setImageLabel] = useState('')
  const [maxEdge, setMaxEdge] = useState(4096)
  const [isExporting, setIsExporting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [facingMode, setFacingMode] = useState('user')
  const [isCapturing, setIsCapturing] = useState(false)

  const exportCanvasRef = useRef(null)
  const exportRendererRef = useRef(null)
  const objectUrlRef = useRef(null)
  const previewRef = useRef(null)

  // Create a hidden full-res WebGL canvas used only for HQ export.
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    exportCanvasRef.current = canvas

    try {
      exportRendererRef.current = new GlassRenderer(canvas)
    } catch (error) {
      setErrorMessage(error.message)
    }

    return () => {
      exportRendererRef.current?.destroy()
      exportRendererRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
    }
  }, [])

  // Decode an uploaded file or sample URL and push it into preview + export renderers.
  async function applyImageSource(source, label) {
    setCameraActive(false)
    setCameraReady(false)
    setIsLoading(true)
    setErrorMessage('')

    try {
      const bitmap = await loadImageBitmap(source)
      setImageSource(bitmap)
      setImageLabel(label)
      exportRendererRef.current?.setImage(bitmap)
      setInfoMessage(`Loaded ${label}`)
    } catch (error) {
      console.error(error)
      setErrorMessage('Could not load that image. Try a JPG, PNG, or WebP file.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle a local file upload from the drop zone.
  async function handleFileSelected(file) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }
    objectUrlRef.current = URL.createObjectURL(file)
    await applyImageSource(file, file.name)
  }

  // Open the live camera inside the main preview area.
  function handleStartCamera() {
    setErrorMessage('')
    setCameraActive(true)
    setInfoMessage('Camera live — adjust glass controls on the right')
  }

  // Stop the camera and return to still / empty preview.
  function handleStopCamera() {
    setCameraActive(false)
    setCameraReady(false)
    setInfoMessage('Camera stopped')
  }

  // Flip between front and back cameras.
  function handleFlipCamera() {
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'))
  }

  // Capture the current camera frame into the still-image workflow.
  async function handleTakePhoto() {
    if (!previewRef.current || isCapturing) {
      return
    }

    setIsCapturing(true)
    setErrorMessage('')

    try {
      const file = await previewRef.current.capturePhoto()
      setCameraActive(false)
      setCameraReady(false)
      await handleFileSelected(file)
      setInfoMessage('Photo captured — keep tuning or export HQ PNG')
    } catch (error) {
      console.error(error)
      setErrorMessage(error.message || 'Could not take the photo.')
    } finally {
      setIsCapturing(false)
    }
  }

  // Render a high-quality PNG at (capped) source resolution and download it.
  async function handleExport() {
    if (!exportRendererRef.current || !imageSource) {
      return
    }

    setIsExporting(true)
    setErrorMessage('')

    try {
      exportRendererRef.current.setImage(imageSource)
      const blob = await exportRendererRef.current.exportPng(settings, maxEdge)
      const safeName = (imageLabel || 'glass-distortion')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9-_]+/gi, '-')
      downloadBlob(blob, `${safeName}-glass.png`)
      setInfoMessage('HQ PNG downloaded')
    } catch (error) {
      console.error(error)
      setErrorMessage(error.message || 'Export failed.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          background:
            'radial-gradient(ellipse at top left, rgba(196,149,106,0.16), transparent 40%), radial-gradient(ellipse at bottom right, rgba(143,163,184,0.12), transparent 42%), linear-gradient(180deg, #14110f 0%, #0b0a09 100%)',
        }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: 'rgba(15,14,12,0.8)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="h6" sx={{ letterSpacing: '0.02em' }}>
              Glass Distortion
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {cameraActive
                ? 'Live camera + glass controls'
                : 'Client-only reeded glass effect'}
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ maxWidth: 720 }}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.2rem', md: '3.2rem' },
                  lineHeight: 1.1,
                  mb: 1,
                }}
              >
                Glass Distortion
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Upload a photo or use your camera in the preview, tune the vertical flutes,
                and export a high-quality PNG — all in your browser.
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 3,
                alignItems: 'stretch',
              }}
            >
              <Box sx={{ flex: 1.6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <GlassPreview
                  ref={previewRef}
                  imageSource={imageSource}
                  settings={settings}
                  cameraActive={cameraActive}
                  facingMode={facingMode}
                  onCameraError={(message) => {
                    setCameraActive(false)
                    setCameraReady(false)
                    setErrorMessage(message)
                  }}
                  onCameraReadyChange={setCameraReady}
                />

                <UploadZone
                  onFileSelected={handleFileSelected}
                  disabled={isLoading || isExporting || isCapturing}
                  cameraActive={cameraActive}
                  cameraReady={cameraReady}
                  isCapturing={isCapturing}
                  onStartCamera={handleStartCamera}
                  onStopCamera={handleStopCamera}
                  onFlipCamera={handleFlipCamera}
                  onTakePhoto={handleTakePhoto}
                />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Try a sample
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {SAMPLE_IMAGES.map((sample) => (
                      <Chip
                        key={sample.id}
                        label={sample.label}
                        clickable
                        disabled={isLoading || isExporting || isCapturing}
                        onClick={() => applyImageSource(sample.src, sample.label)}
                        sx={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ flex: 1, minWidth: { md: 300 } }}>
                <ControlPanel
                  settings={settings}
                  onSettingsChange={setSettings}
                  onPresetSelect={setSettings}
                  maxEdge={maxEdge}
                  onMaxEdgeChange={setMaxEdge}
                  onExport={handleExport}
                  isExporting={isExporting}
                  hasImage={Boolean(imageSource) && !cameraActive}
                />
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Snackbar
        open={Boolean(errorMessage)}
        autoHideDuration={5000}
        onClose={() => setErrorMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(infoMessage)}
        autoHideDuration={2500}
        onClose={() => setInfoMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setInfoMessage('')}>
          {infoMessage}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  )
}

export default App
