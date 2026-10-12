import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export const BACKGROUND_COLOR = 0x1c1917

/** Everything needed to draw a frame: scene, camera, renderer, controls and shared environment map. */
export interface Stage {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly controls: OrbitControls
  readonly envMap: THREE.Texture
  /** Runs every frame before rendering. Returns an unsubscribe function. */
  onFrame(callback: (deltaSeconds: number) => void): () => void
}

export function createStage(container: HTMLElement): Stage {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BACKGROUND_COLOR)
  scene.fog = new THREE.Fog(BACKGROUND_COLOR, 20, 50)

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(10, 10, 10)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.screenSpacePanning = false
  controls.minDistance = 2
  controls.maxDistance = 50
  controls.maxPolarAngle = Math.PI / 2.1 // can't go below the board

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))

  const sun = new THREE.DirectionalLight(0xffffff, 1)
  sun.position.set(5, 10, 7.5)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -10
  sun.shadow.camera.right = 10
  sun.shadow.camera.top = 10
  sun.shadow.camera.bottom = -10
  scene.add(sun)

  // A tiny lit room, baked once into an environment map so glossy materials
  // have something to reflect.
  const roomScene = new THREE.Scene()
  const roomLight = new THREE.PointLight(0xffffff, 50, 10)
  roomLight.position.set(2, 2, 2)
  roomScene.add(roomLight)
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const envMap = pmrem.fromScene(roomScene).texture

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  const callbacks = new Set<(deltaSeconds: number) => void>()
  const clock = new THREE.Clock()
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta()
    controls.update()
    callbacks.forEach((callback) => callback(delta))
    renderer.render(scene, camera)
  })

  return {
    scene,
    camera,
    renderer,
    controls,
    envMap,
    onFrame(callback) {
      callbacks.add(callback)
      return () => callbacks.delete(callback)
    },
  }
}
