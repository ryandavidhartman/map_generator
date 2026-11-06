import type { DangerLevel, Terrain } from '../data/tables'

export const TERRAIN_COLORS: Record<Terrain, string> = {
  'Desert/arctic': '#d9c088',
  Swamp: '#5b6f4f',
  Grassland: '#7ea55a',
  'Forest/jungle': '#2f5d3a',
  // Hills' color was approved by the user 2026-11-02 (punch-list item 1a).
  Hills: '#a39a5c',
  Coast: '#4a90c4',
  Ocean: '#1c4f7a',
  Mountain: '#8a7f76',
}

// Rivers and lakes (features drawn on top of the terrain fill, punch-list item 1a).
export const WATER_FEATURE_COLOR = '#5fb3e6'

export const DANGER_COLORS: Record<DangerLevel, string> = {
  Safe: '#4caf50',
  Unsafe: '#ffc107',
  Risky: '#ff7f0e',
  Deadly: '#e53935',
}
