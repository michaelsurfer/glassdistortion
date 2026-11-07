# Glass Distortion

Client-only web app that applies a **reeded / fluted glass** look to an uploaded photo: vertical ribs create horizontal splits and feature echoes.

## Features

- Drag-and-drop or file upload
- Live WebGL preview with adjustable reed count, strength, seam, blur, and specular
- Presets plus bundled sample images
- High-quality PNG export at full (or capped) resolution

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

## Export

Use **Export HQ PNG**. Export uses a separate full-resolution WebGL pass with multi-tap sampling — not a screenshot of the preview.
