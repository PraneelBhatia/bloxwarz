import * as THREE from 'three';

export class GameRenderer {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  tileSize = 1;

  // Grid dimensions for centering
  private gridWidth = 0;
  private gridHeight = 0;
  private viewSize = 8;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.OrthographicCamera(
      -this.viewSize * aspect,
      this.viewSize * aspect,
      this.viewSize,
      -this.viewSize,
      0.1,
      200,
    );

    // OG Bloxorz camera angle: looking down at ~30° from horizontal,
    // rotated 45° around Y axis. This creates the classic isometric
    // perspective where the grid runs diagonally.
    const distance = 40;
    const elevationAngle = 30 * (Math.PI / 180); // 30° from horizontal
    const rotationAngle = 45 * (Math.PI / 180);  // 45° around Y — matches OG Bloxorz view

    this.camera.position.set(
      distance * Math.cos(elevationAngle) * Math.sin(rotationAngle),
      distance * Math.sin(elevationAngle),
      distance * Math.cos(elevationAngle) * Math.cos(rotationAngle),
    );
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;

    // Lighting matching OG game feel
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(5, 15, 5);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    this.scene.add(directional);

    window.addEventListener('resize', () => this.onResize());
  }

  /** Call when a new level loads to center the camera on the grid */
  centerOnGrid(width: number, height: number) {
    this.gridWidth = width;
    this.gridHeight = height;

    // Calculate center of the grid in world space
    const centerX = (width - 1) * this.tileSize / 2;
    const centerZ = -(height - 1) * this.tileSize / 2;

    // Position camera relative to grid center
    const distance = 40;
    const elevationAngle = 30 * (Math.PI / 180);
    const rotationAngle = 45 * (Math.PI / 180);

    this.camera.position.set(
      centerX + distance * Math.cos(elevationAngle) * Math.sin(rotationAngle),
      distance * Math.sin(elevationAngle),
      centerZ + distance * Math.cos(elevationAngle) * Math.cos(rotationAngle),
    );
    this.camera.lookAt(centerX, 0, centerZ);

    // Auto-fit: adjust viewSize based on grid dimensions
    const maxDim = Math.max(width, height);
    this.viewSize = Math.max(5, maxDim * 0.75);
    this.onResize();
  }

  onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -this.viewSize * aspect;
    this.camera.right = this.viewSize * aspect;
    this.camera.top = this.viewSize;
    this.camera.bottom = -this.viewSize;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /** Convert grid coordinates to world position */
  gridToWorld(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(
      x * this.tileSize,
      0,
      -y * this.tileSize,
    );
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  startLoop(update: () => void) {
    const loop = () => {
      update();
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
