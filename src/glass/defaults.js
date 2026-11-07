export const DEFAULT_SETTINGS = {
  reedCount: 36,
  strength: 0.72,
  seam: 0.26,
  blur: 0.4,
  specular: 0.1,
}

export const PRESETS = [
  {
    id: 'fine',
    label: 'Fine reed',
    settings: {
      reedCount: 52,
      strength: 0.62,
      seam: 0.2,
      blur: 0.3,
      specular: 0.08,
    },
  },
  {
    id: 'classic',
    label: 'Classic split',
    settings: {
      reedCount: 36,
      strength: 0.72,
      seam: 0.26,
      blur: 0.4,
      specular: 0.1,
    },
  },
  {
    id: 'echo',
    label: 'Strong echo',
    settings: {
      reedCount: 24,
      strength: 0.92,
      seam: 0.32,
      blur: 0.5,
      specular: 0.12,
    },
  },
]

export const SAMPLE_IMAGES = [
  {
    id: 'portrait-red',
    label: 'Portrait',
    src: '/samples/portrait.jpg',
  },
  {
    id: 'profile-purple',
    label: 'Profile',
    src: '/samples/profile-purple.webp',
  },
  {
    id: 'hands',
    label: 'Hands',
    src: '/samples/hands.jpg',
  },
  {
    id: 'lily',
    label: 'Lily',
    src: '/samples/images-14.jpeg',
  },
  {
    id: 'mono',
    label: 'Mono',
    src: '/samples/images-15.jpeg',
  },
]
