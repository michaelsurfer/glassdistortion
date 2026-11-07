import { useRef, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import CameraswitchOutlinedIcon from '@mui/icons-material/CameraswitchOutlined'
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined'

// Drag-and-drop upload area plus inline camera controls.
function UploadZone({
  onFileSelected,
  disabled,
  cameraActive,
  onStartCamera,
  onStopCamera,
  onFlipCamera,
  onTakePhoto,
  cameraReady,
  isCapturing,
}) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  // Accept only image files from input or drop events.
  function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) {
      return
    }

    const file = fileList[0]
    if (!file.type.startsWith('image/')) {
      return
    }

    onFileSelected(file)
  }

  return (
    <Box
      onDragOver={(event) => {
        event.preventDefault()
        if (!cameraActive) {
          setIsDragging(true)
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        if (!cameraActive) {
          handleFiles(event.dataTransfer.files)
        }
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        padding: 3,
        borderRadius: 2,
        border: '1px dashed',
        borderColor: isDragging ? 'primary.main' : 'divider',
        backgroundColor: isDragging
          ? 'rgba(196, 149, 106, 0.12)'
          : 'rgba(255,255,255,0.04)',
        transition: 'border-color 160ms ease, background-color 160ms ease',
      }}
    >
      <CloudUploadOutlinedIcon sx={{ fontSize: 36, color: 'text.secondary' }} />
      <Typography variant="body1" sx={{ fontWeight: 500 }}>
        {cameraActive
          ? 'Live camera is showing above'
          : 'Drop a photo here'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        {cameraActive
          ? 'Adjust the glass controls on the right, then take a photo'
          : 'or upload a file / use your camera in the preview above'}
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          justifyContent: 'center',
        }}
      >
        {!cameraActive && (
          <>
            <Button
              variant="contained"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Upload image
            </Button>
            <Button
              variant="outlined"
              disabled={disabled}
              startIcon={<PhotoCameraOutlinedIcon />}
              onClick={onStartCamera}
            >
              Use camera
            </Button>
          </>
        )}

        {cameraActive && (
          <>
            <Button
              variant="contained"
              disabled={disabled || !cameraReady || isCapturing}
              startIcon={<PhotoCameraOutlinedIcon />}
              onClick={onTakePhoto}
            >
              {isCapturing ? 'Capturing…' : 'Take photo'}
            </Button>
            <Button
              variant="outlined"
              disabled={disabled || isCapturing}
              startIcon={<CameraswitchOutlinedIcon />}
              onClick={onFlipCamera}
            >
              Flip
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              disabled={isCapturing}
              startIcon={<StopCircleOutlinedIcon />}
              onClick={onStopCamera}
            >
              Stop camera
            </Button>
          </>
        )}
      </Box>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ''
        }}
      />
    </Box>
  )
}

export default UploadZone
