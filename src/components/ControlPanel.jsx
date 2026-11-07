import {
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Slider,
  TextField,
  Typography,
} from '@mui/material'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import { PRESETS } from '../glass/defaults.js'

// Labeled slider used for each glass parameter.
function SettingSlider({ label, value, min, max, step, onChange, valueLabel }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {valueLabel ?? value}
        </Typography>
      </Box>
      <Slider
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(_event, nextValue) => onChange(nextValue)}
      />
    </Box>
  )
}

// Side panel with presets, sliders, and export controls.
function ControlPanel({
  settings,
  onSettingsChange,
  onPresetSelect,
  maxEdge,
  onMaxEdgeChange,
  onExport,
  isExporting,
  hasImage,
}) {
  // Update one settings field while keeping the rest intact.
  function updateSetting(key, value) {
    onSettingsChange({
      ...settings,
      [key]: value,
    })
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        padding: 2.5,
        borderRadius: 2,
        backgroundColor: 'rgba(20, 18, 16, 0.72)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box>
        <Typography variant="h6" sx={{ fontFamily: 'Fraunces, serif', mb: 0.5 }}>
          Glass controls
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vertical flutes create horizontal splits and echoes.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {PRESETS.map((preset) => (
          <Chip
            key={preset.id}
            label={preset.label}
            clickable
            onClick={() => onPresetSelect(preset.settings)}
            sx={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          />
        ))}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <SettingSlider
        label="Reed count"
        value={settings.reedCount}
        min={12}
        max={80}
        step={1}
        onChange={(value) => updateSetting('reedCount', value)}
      />
      <SettingSlider
        label="Distortion strength"
        value={settings.strength}
        min={0}
        max={1}
        step={0.01}
        valueLabel={settings.strength.toFixed(2)}
        onChange={(value) => updateSetting('strength', value)}
      />
      <SettingSlider
        label="Seam darkness"
        value={settings.seam}
        min={0}
        max={0.6}
        step={0.01}
        valueLabel={settings.seam.toFixed(2)}
        onChange={(value) => updateSetting('seam', value)}
      />
      <SettingSlider
        label="Glass blur"
        value={settings.blur}
        min={0}
        max={1}
        step={0.01}
        valueLabel={settings.blur.toFixed(2)}
        onChange={(value) => updateSetting('blur', value)}
      />
      <SettingSlider
        label="Specular highlight"
        value={settings.specular}
        min={0}
        max={0.35}
        step={0.01}
        valueLabel={settings.specular.toFixed(2)}
        onChange={(value) => updateSetting('specular', value)}
      />

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      <TextField
        select
        size="small"
        label="Export max edge"
        value={maxEdge}
        onChange={(event) => onMaxEdgeChange(Number(event.target.value))}
        helperText="Full source size is used when smaller than this cap."
      >
        <MenuItem value={2048}>2048 px</MenuItem>
        <MenuItem value={4096}>4096 px</MenuItem>
        <MenuItem value={8192}>8192 px</MenuItem>
      </TextField>

      <Button
        variant="contained"
        size="large"
        startIcon={<DownloadOutlinedIcon />}
        disabled={!hasImage || isExporting}
        onClick={onExport}
      >
        {isExporting ? 'Exporting…' : 'Export HQ PNG'}
      </Button>
    </Box>
  )
}

export default ControlPanel
