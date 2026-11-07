export const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uImage;
uniform float uReedCount;
uniform float uStrength;
uniform float uSeam;
uniform float uBlur;
uniform float uSpecular;
uniform float uHqSamples;
uniform float uMirrorX;
uniform float uRotate180;
uniform vec2 uTexelSize;

in vec2 vUv;
out vec4 fragColor;

// Remap horizontal UV through reeded glass.
// Each flute samples a WIDER source band so features echo / split across ribs.
float refractU(float u, float reedCount, float strength) {
  float x = u * reedCount;
  float cell = floor(x);
  float local = fract(x);

  // -1..1 across one flute
  float centered = (local - 0.5) * 2.0;

  // Cylindrical lens bend: edges pull harder than the center.
  float bent = sign(centered) * pow(max(abs(centered), 0.0001), mix(1.0, 0.35, strength));

  // How many reed-widths of source content each flute compresses in.
  // Higher strength => more overlap between neighbors => stronger echo / split.
  float spread = mix(1.0, 8.0, strength);

  // Extra sawtooth kick so silhouettes step sideways like real fluted glass.
  float echoKick = centered * strength * 1.35;

  float sourceLocal = 0.5 + bent * 0.5 * spread + echoKick;
  float sourceU = (cell + sourceLocal) / reedCount;
  return clamp(sourceU, 0.0, 1.0);
}

// Sample the refracted image, with optional horizontal multi-tap blur.
vec4 sampleGlass(vec2 uv) {
  float blurAmount = uBlur;
  float tapsFloat = max(uHqSamples, blurAmount > 0.01 ? 5.0 : 1.0);

  if (tapsFloat < 1.5) {
    float sourceU = refractU(uv.x, uReedCount, uStrength);
    return texture(uImage, vec2(sourceU, uv.y));
  }

  vec4 color = vec4(0.0);
  float totalWeight = 0.0;
  // Blur radius scales with reed width so softness tracks the glass ribs.
  float reedWidth = 1.0 / max(uReedCount, 1.0);
  float radius = blurAmount * reedWidth * 0.55;
  int taps = int(clamp(tapsFloat, 1.0, 9.0));

  for (int i = 0; i < 9; i++) {
    if (i >= taps) {
      break;
    }
    float offset = (float(i) - float(taps - 1) * 0.5) / max(float(taps - 1), 1.0);
    float weight = 1.0 - abs(offset);
    float sampleU = refractU(uv.x + offset * radius, uReedCount, uStrength);
    color += texture(uImage, vec2(sampleU, uv.y)) * weight;
    totalWeight += weight;
  }

  return color / max(totalWeight, 0.0001);
}

void main() {
  vec2 uv = vUv;

  // Optional 180 rotation used by still-image preview/export.
  if (uRotate180 > 0.5) {
    uv = vec2(1.0 - uv.x, 1.0 - uv.y);
  }

  // Mirror for front-facing camera live preview.
  if (uMirrorX > 0.5) {
    uv.x = 1.0 - uv.x;
  }

  vec4 color = sampleGlass(uv);

  float x = uv.x * uReedCount;
  float local = fract(x);
  float centered = local - 0.5;
  float edge = abs(centered) * 2.0;

  // Dark seams where glass flutes meet.
  float seamMask = pow(edge, 8.0);
  color.rgb *= 1.0 - uSeam * seamMask;

  // Soft highlight along each flute peak.
  float highlight = pow(1.0 - edge, 14.0);
  color.rgb += vec3(uSpecular * highlight);

  fragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
}
`
