import * as THREE from 'three'
import type { Color } from '../core'

export interface Materials {
  lightSquare: THREE.MeshStandardMaterial
  darkSquare: THREE.MeshStandardMaterial
  boardBase: THREE.MeshStandardMaterial
  piece: Record<Color, THREE.MeshStandardMaterial>
}

export function createMaterials(envMap: THREE.Texture): Materials {
  return {
    lightSquare: new THREE.MeshStandardMaterial({
      color: 0xe0d6c3,
      roughness: 0.15,
      metalness: 0.05,
      envMap,
      envMapIntensity: 0.5,
    }),
    darkSquare: new THREE.MeshStandardMaterial({
      color: 0x221108,
      roughness: 0.1,
      metalness: 0.1,
      envMap,
      envMapIntensity: 0.8,
    }),
    boardBase: new THREE.MeshStandardMaterial({
      color: 0x150a05,
      roughness: 0.3,
      metalness: 0.0,
      envMap,
      envMapIntensity: 0.3,
    }),
    piece: {
      w: new THREE.MeshStandardMaterial({
        color: 0xfffffc,
        roughness: 0.2,
        metalness: 0.1,
        envMap,
        envMapIntensity: 0.4,
      }),
      b: new THREE.MeshStandardMaterial({
        color: 0x555555, // lighter than true black so the pieces stay readable
        roughness: 0.15,
        metalness: 0.8,
        emissive: 0x111111,
        envMap,
        envMapIntensity: 2.0,
      }),
    },
  }
}
