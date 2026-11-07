import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders.js'

// Compile a single GLSL shader and throw a clear error if it fails.
function compileShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${message}`)
  }

  return shader
}

// Link vertex + fragment shaders into a usable program.
function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link failed: ${message}`)
  }

  return program
}

// Read width/height from images, bitmaps, canvases, or video elements.
function getSourceSize(imageSource) {
  const width = imageSource.videoWidth || imageSource.width || 0
  const height = imageSource.videoHeight || imageSource.height || 0
  return { width, height }
}

/**
 * WebGL2 renderer that applies a reeded / fluted glass distortion.
 * Vertical ribs create horizontal splits and feature echoes.
 */
export class GlassRenderer {
  constructor(canvas) {
    this.canvas = canvas
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    })

    if (!this.gl) {
      throw new Error('WebGL2 is not available in this browser.')
    }

    this.program = createProgram(this.gl, VERTEX_SHADER, FRAGMENT_SHADER)
    this.texture = null
    this.imageWidth = 0
    this.imageHeight = 0

    this.uniforms = {
      uImage: this.gl.getUniformLocation(this.program, 'uImage'),
      uReedCount: this.gl.getUniformLocation(this.program, 'uReedCount'),
      uStrength: this.gl.getUniformLocation(this.program, 'uStrength'),
      uSeam: this.gl.getUniformLocation(this.program, 'uSeam'),
      uBlur: this.gl.getUniformLocation(this.program, 'uBlur'),
      uSpecular: this.gl.getUniformLocation(this.program, 'uSpecular'),
      uHqSamples: this.gl.getUniformLocation(this.program, 'uHqSamples'),
      uMirrorX: this.gl.getUniformLocation(this.program, 'uMirrorX'),
      uRotate180: this.gl.getUniformLocation(this.program, 'uRotate180'),
      uTexelSize: this.gl.getUniformLocation(this.program, 'uTexelSize'),
    }

    this.setupGeometry()
  }

  // Create a fullscreen triangle covering the clip space.
  setupGeometry() {
    const gl = this.gl
    const positions = new Float32Array([
      -1, -1,
      3, -1,
      -1, 3,
    ])

    this.vertexArray = gl.createVertexArray()
    gl.bindVertexArray(this.vertexArray)

    this.positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(this.program, 'aPosition')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    gl.bindVertexArray(null)
  }

  // Create an empty texture with the sampling settings we need for glass.
  createTexture() {
    const gl = this.gl
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return texture
  }

  // Upload an HTMLImageElement, ImageBitmap, canvas, or video as the source texture.
  setImage(imageSource) {
    const gl = this.gl
    const { width, height } = getSourceSize(imageSource)

    if (!width || !height) {
      return false
    }

    if (this.texture) {
      gl.deleteTexture(this.texture)
      this.texture = null
    }

    this.imageWidth = width
    this.imageHeight = height
    this.texture = this.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageSource)
    return true
  }

  // Fast path for live camera frames: reuse the texture object every frame.
  updateFrame(imageSource) {
    const gl = this.gl
    const { width, height } = getSourceSize(imageSource)

    if (!width || !height) {
      return false
    }

    if (!this.texture) {
      return this.setImage(imageSource)
    }

    this.imageWidth = width
    this.imageHeight = height
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageSource)
    return true
  }

  // Draw the effect into the bound canvas at the requested size.
  render(settings, width, height, highQuality) {
    const gl = this.gl

    if (!this.texture || width < 1 || height < 1) {
      return
    }

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }

    gl.viewport(0, 0, width, height)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vertexArray)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(this.uniforms.uImage, 0)
    gl.uniform1f(this.uniforms.uReedCount, settings.reedCount)
    gl.uniform1f(this.uniforms.uStrength, settings.strength)
    gl.uniform1f(this.uniforms.uSeam, settings.seam)
    gl.uniform1f(this.uniforms.uBlur, settings.blur)
    gl.uniform1f(this.uniforms.uSpecular, settings.specular)
    gl.uniform1f(this.uniforms.uMirrorX, settings.mirrorX ? 1.0 : 0.0)
    gl.uniform1f(this.uniforms.uRotate180, settings.rotate180 ? 1.0 : 0.0)
    // Live/preview uses fewer taps; export uses more.
    gl.uniform1f(this.uniforms.uHqSamples, highQuality ? 9.0 : 3.0)
    gl.uniform2f(
      this.uniforms.uTexelSize,
      1.0 / Math.max(this.imageWidth, 1),
      1.0 / Math.max(this.imageHeight, 1)
    )

    gl.clearColor(0.08, 0.08, 0.1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  // Render at full source resolution (or capped) and return a PNG blob.
  async exportPng(settings, maxEdge) {
    if (!this.texture) {
      throw new Error('No image loaded.')
    }

    const longestEdge = Math.max(this.imageWidth, this.imageHeight)
    const scale = longestEdge > maxEdge ? maxEdge / longestEdge : 1
    const exportWidth = Math.max(1, Math.round(this.imageWidth * scale))
    const exportHeight = Math.max(1, Math.round(this.imageHeight * scale))

    this.render(settings, exportWidth, exportHeight, true)

    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create PNG blob.'))
            return
          }
          resolve(blob)
        },
        'image/png'
      )
    })
  }

  // Free GPU resources.
  destroy() {
    const gl = this.gl

    if (this.texture) {
      gl.deleteTexture(this.texture)
    }
    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer)
    }
    if (this.vertexArray) {
      gl.deleteVertexArray(this.vertexArray)
    }
    if (this.program) {
      gl.deleteProgram(this.program)
    }
  }
}
