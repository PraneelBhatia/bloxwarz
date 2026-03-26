import { Element, BlockOrientation, TileType, getAllLevels } from '@fbwb/shared';
import { GameRenderer } from './renderer/scene.js';
import { GridMesh } from './entities/gridMesh.js';
import { BlockMesh } from './entities/blockMesh.js';
import { setupOnlineInput, setupLocalInput } from './input.js';
import { NetworkClient, GameState } from './network.js';

// --- Level names (kept client-side for UI display) ---
const LEVEL_NAMES: Record<number, string> = {
  1: 'First Steps',
  2: 'Hot & Cold',
  3: 'Open Sesame',
  4: 'Give & Take',
  5: 'Watch Your Step',
  6: 'Flip the Script',
  7: 'One at a Time',
  8: 'Fork in the Road',
  9: 'No Safe Ground',
  10: 'The Gauntlet',
};

// --- Renderer ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new GameRenderer(canvas);

// --- Entities ---
const gridMesh = new GridMesh(renderer);
const fireBlock = new BlockMesh(renderer, Element.Fire);
const waterBlock = new BlockMesh(renderer, Element.Water);
fireBlock.setVisible(false);
waterBlock.setVisible(false);

// --- Network ---
const network = new NetworkClient();

// --- Lobby UI ---
const lobbyDiv = document.getElementById('lobby')!;
const hudDiv = document.getElementById('hud')!;
const levelCompleteDiv = document.getElementById('level-complete')!;

let gameMode: 'local' | 'online' | null = null;

function buildModeSelect() {
  const container = document.createElement('div');
  container.className = 'lobby-container';

  // Title
  const titleRow = document.createElement('div');
  titleRow.className = 'lobby-title-row';
  const fireIcon = document.createElement('span');
  fireIcon.className = 'lobby-fire-icon';
  fireIcon.textContent = '\u{1F525}';
  titleRow.appendChild(fireIcon);
  const titleFire = document.createElement('span');
  titleFire.className = 'title-fire';
  titleFire.textContent = 'FIRE BLOCK';
  titleRow.appendChild(titleFire);
  const titleAmp = document.createElement('span');
  titleAmp.className = 'title-amp';
  titleAmp.textContent = '&';
  titleRow.appendChild(titleAmp);
  const titleWater = document.createElement('span');
  titleWater.className = 'title-water';
  titleWater.textContent = 'WATER BLOCK';
  titleRow.appendChild(titleWater);
  const waterIcon = document.createElement('span');
  waterIcon.className = 'lobby-water-icon';
  waterIcon.textContent = '\u{1F4A7}';
  titleRow.appendChild(waterIcon);
  container.appendChild(titleRow);

  const tagline = document.createElement('p');
  tagline.className = 'lobby-tagline';
  tagline.textContent = 'A cooperative puzzle adventure';
  container.appendChild(tagline);

  // Local Co-op button
  const localBtn = document.createElement('button');
  localBtn.className = 'btn-fire';
  localBtn.style.width = '280px';
  localBtn.style.marginBottom = '12px';
  localBtn.textContent = 'Local Co-Op';
  localBtn.addEventListener('click', async () => {
    gameMode = 'local';
    localBtn.disabled = true;
    localBtn.textContent = 'Starting...';
    await network.startLocal();
    setupLocalInput((player, direction) => {
      network.sendLocalMove(player, direction);
    });
    lobbyDiv.style.display = 'none';
    hudDiv.style.display = 'flex';
  });
  container.appendChild(localBtn);

  // Controls hint for local
  const localHint = document.createElement('p');
  localHint.style.cssText = 'color:#666;font-size:0.75rem;margin-bottom:16px;text-align:center;';
  localHint.textContent = 'WASD = Fire Block  |  Arrow Keys = Water Block';
  container.appendChild(localHint);

  // Online Co-op button
  const onlineBtn = document.createElement('button');
  onlineBtn.className = 'btn-water';
  onlineBtn.style.width = '280px';
  onlineBtn.textContent = 'Online Co-Op';
  onlineBtn.addEventListener('click', () => {
    gameMode = 'online';
    // Remove mode select, show online lobby
    while (lobbyDiv.firstChild) lobbyDiv.removeChild(lobbyDiv.firstChild);
    buildOnlineLobby();
    setupOnlineInput((direction) => {
      network.sendMove(direction);
    });
  });
  container.appendChild(onlineBtn);

  lobbyDiv.appendChild(container);
}

function buildOnlineLobby() {
  const container = document.createElement('div');
  container.className = 'lobby-container';

  // --- Title row with decorative icons ---
  const titleRow = document.createElement('div');
  titleRow.className = 'lobby-title-row';

  const fireIcon = document.createElement('span');
  fireIcon.className = 'lobby-fire-icon';
  fireIcon.setAttribute('aria-hidden', 'true');
  fireIcon.textContent = '\u{1F525}';
  titleRow.appendChild(fireIcon);

  const titleFire = document.createElement('span');
  titleFire.className = 'title-fire';
  titleFire.textContent = 'FIRE BLOCK';
  titleRow.appendChild(titleFire);

  const titleAmp = document.createElement('span');
  titleAmp.className = 'title-amp';
  titleAmp.textContent = '&';
  titleRow.appendChild(titleAmp);

  const titleWater = document.createElement('span');
  titleWater.className = 'title-water';
  titleWater.textContent = 'WATER BLOCK';
  titleRow.appendChild(titleWater);

  const waterIcon = document.createElement('span');
  waterIcon.className = 'lobby-water-icon';
  waterIcon.setAttribute('aria-hidden', 'true');
  waterIcon.textContent = '\u{1F4A7}';
  titleRow.appendChild(waterIcon);

  container.appendChild(titleRow);

  // --- Tagline ---
  const tagline = document.createElement('p');
  tagline.className = 'lobby-tagline';
  tagline.textContent = 'A cooperative puzzle adventure';
  container.appendChild(tagline);

  // --- Room code display (hidden initially) ---
  const roomCodeBox = document.createElement('div');
  roomCodeBox.className = 'lobby-room-code-box';
  container.appendChild(roomCodeBox);

  // --- Create Room button ---
  const createBtn = document.createElement('button');
  createBtn.className = 'btn-fire';
  createBtn.textContent = 'Create Room';
  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    try {
      const code = await network.createRoom();
      roomCodeBox.style.display = 'block';

      // Clear existing children
      while (roomCodeBox.firstChild) {
        roomCodeBox.removeChild(roomCodeBox.firstChild);
      }

      const label = document.createElement('div');
      label.className = 'lobby-room-code-label';
      label.textContent = 'Room Code';
      roomCodeBox.appendChild(label);

      const codeEl = document.createElement('div');
      codeEl.className = 'lobby-room-code-value';
      codeEl.textContent = code;
      codeEl.addEventListener('click', () => {
        navigator.clipboard.writeText(code).then(() => {
          copyHint.textContent = 'Copied!';
          setTimeout(() => {
            copyHint.textContent = 'Click to copy';
          }, 1500);
        });
      });
      roomCodeBox.appendChild(codeEl);

      const copyHint = document.createElement('div');
      copyHint.className = 'lobby-room-code-copy-hint';
      copyHint.textContent = 'Click to copy';
      roomCodeBox.appendChild(copyHint);

      const waitMsg = document.createElement('div');
      waitMsg.className = 'lobby-waiting';
      waitMsg.textContent = 'Waiting for partner';
      roomCodeBox.appendChild(waitMsg);

      createBtn.textContent = 'Room Created';
    } catch (err) {
      createBtn.disabled = false;
      createBtn.textContent = 'Create Room';
      console.error('Failed to create room:', err);
    }
  });
  container.appendChild(createBtn);

  // --- Divider ---
  const divider = document.createElement('div');
  divider.className = 'lobby-divider';
  const line1 = document.createElement('hr');
  line1.className = 'lobby-divider-line';
  const orText = document.createElement('span');
  orText.className = 'lobby-divider-text';
  orText.textContent = 'or';
  const line2 = document.createElement('hr');
  line2.className = 'lobby-divider-line';
  divider.appendChild(line1);
  divider.appendChild(orText);
  divider.appendChild(line2);
  container.appendChild(divider);

  // --- Join row ---
  const joinRow = document.createElement('div');
  joinRow.className = 'lobby-join-row';

  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.className = 'lobby-input';
  codeInput.placeholder = 'Enter room code';
  joinRow.appendChild(codeInput);

  const joinBtn = document.createElement('button');
  joinBtn.className = 'btn-water';
  joinBtn.textContent = 'Join';
  joinRow.appendChild(joinBtn);
  container.appendChild(joinRow);

  // --- Error display ---
  const errorMsg = document.createElement('div');
  errorMsg.className = 'lobby-error';
  container.appendChild(errorMsg);

  joinBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code) return;
    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining...';
    errorMsg.textContent = '';
    try {
      await network.joinByCode(code);
    } catch (err) {
      errorMsg.textContent = 'Room not found. Check the code and try again.';
      joinBtn.disabled = false;
      joinBtn.textContent = 'Join';
    }
  });

  // Allow Enter key to join
  codeInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      joinBtn.click();
    }
  });

  lobbyDiv.appendChild(container);
}

// --- HUD ---
let hudMoveCounter: HTMLElement;
let hudRoomCode: HTMLElement;
let hudLevelName: HTMLElement;
let hudConnectionDot: HTMLElement;
let hudFallOffToggle: HTMLElement;

function buildHUD() {
  hudDiv.className = 'hud-panel';

  // Connection & Room code row
  const roomItem = document.createElement('div');
  roomItem.className = 'hud-item';

  hudConnectionDot = document.createElement('span');
  hudConnectionDot.className = 'hud-connection-dot connected';
  roomItem.appendChild(hudConnectionDot);

  hudRoomCode = document.createElement('span');
  hudRoomCode.className = 'hud-room-code';
  roomItem.appendChild(hudRoomCode);
  hudDiv.appendChild(roomItem);

  // Level name
  const levelItem = document.createElement('div');
  levelItem.className = 'hud-item';
  const levelIcon = document.createElement('span');
  levelIcon.className = 'hud-icon';
  levelIcon.textContent = '\u{1F3AE}';
  levelItem.appendChild(levelIcon);
  hudLevelName = document.createElement('span');
  hudLevelName.className = 'hud-value';
  hudLevelName.style.fontSize = '0.8rem';
  levelItem.appendChild(hudLevelName);
  hudDiv.appendChild(levelItem);

  // Move counter
  const moveItem = document.createElement('div');
  moveItem.className = 'hud-item';
  const moveLabel = document.createElement('span');
  moveLabel.className = 'hud-label';
  moveLabel.textContent = 'Moves';
  moveItem.appendChild(moveLabel);
  hudMoveCounter = document.createElement('span');
  hudMoveCounter.className = 'hud-value';
  moveItem.appendChild(hudMoveCounter);
  hudDiv.appendChild(moveItem);

  // Fall off edge toggle
  const fallOffItem = document.createElement('div');
  fallOffItem.className = 'hud-item';
  fallOffItem.style.cursor = 'pointer';
  const fallOffLabel = document.createElement('span');
  fallOffLabel.className = 'hud-label';
  fallOffLabel.textContent = 'Fall Off Edge';
  fallOffItem.appendChild(fallOffLabel);
  hudFallOffToggle = document.createElement('span');
  hudFallOffToggle.className = 'hud-value';
  hudFallOffToggle.textContent = 'ON';
  hudFallOffToggle.style.color = '#4caf50';
  fallOffItem.appendChild(hudFallOffToggle);
  fallOffItem.addEventListener('click', () => {
    network.toggleFallOff();
  });
  hudDiv.appendChild(fallOffItem);

  // Level select button
  const levelSelectBtn = document.createElement('button');
  levelSelectBtn.className = 'hud-btn-levels';
  levelSelectBtn.textContent = 'Levels';
  levelSelectBtn.addEventListener('click', () => {
    showLevelSelect();
  });
  hudDiv.appendChild(levelSelectBtn);
}

// --- Level Complete ---
let lcMovesValue: HTMLElement;

function buildLevelComplete() {
  levelCompleteDiv.className = 'lc-backdrop';

  const panel = document.createElement('div');
  panel.className = 'lc-panel';

  // Star icon
  const star = document.createElement('div');
  star.className = 'lc-star';
  star.textContent = '\u{2B50}';
  panel.appendChild(star);

  // Heading
  const heading = document.createElement('h2');
  heading.className = 'lc-heading';
  heading.textContent = 'LEVEL COMPLETE!';
  panel.appendChild(heading);

  // Moves summary
  const movesDiv = document.createElement('div');
  movesDiv.className = 'lc-moves';
  const movesLabel = document.createTextNode('Total moves: ');
  movesDiv.appendChild(movesLabel);
  lcMovesValue = document.createElement('span');
  lcMovesValue.className = 'lc-moves-value';
  lcMovesValue.textContent = '0';
  movesDiv.appendChild(lcMovesValue);
  panel.appendChild(movesDiv);

  // Button row
  const btnRow = document.createElement('div');
  btnRow.className = 'lc-btn-row';

  const nextLevelBtn = document.createElement('button');
  nextLevelBtn.className = 'btn-fire';
  nextLevelBtn.textContent = 'Next Level';
  nextLevelBtn.style.fontSize = '0.95rem';
  nextLevelBtn.style.padding = '12px 28px';
  nextLevelBtn.addEventListener('click', () => {
    const nextId = currentLevelId + 1;
    if (nextId <= getAllLevels().length) {
      network.sendSelectLevel(nextId);
    }
  });
  btnRow.appendChild(nextLevelBtn);

  const restartBtn = document.createElement('button');
  restartBtn.className = 'btn-secondary';
  restartBtn.textContent = 'Play Again';
  restartBtn.addEventListener('click', () => {
    network.sendRestart();
  });
  btnRow.appendChild(restartBtn);

  panel.appendChild(btnRow);

  // Level select text link
  const selectLink = document.createElement('button');
  selectLink.className = 'btn-text-link';
  selectLink.textContent = 'Level Select';
  selectLink.addEventListener('click', () => {
    showLevelSelect();
  });
  panel.appendChild(selectLink);

  levelCompleteDiv.appendChild(panel);
}

// --- Level Select UI ---
let levelSelectDiv: HTMLDivElement | null = null;

function showLevelSelect() {
  if (levelSelectDiv) {
    levelSelectDiv.style.display = 'flex';
    // Update current level highlight
    updateLevelSelectHighlight();
    return;
  }

  levelSelectDiv = document.createElement('div');
  levelSelectDiv.className = 'ls-backdrop';

  const panel = document.createElement('div');
  panel.className = 'ls-panel';

  const title = document.createElement('h2');
  title.className = 'ls-title';
  title.textContent = 'Select Level';
  panel.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'ls-grid';

  const totalLevels = getAllLevels().length;
  for (let i = 1; i <= totalLevels; i++) {
    const btnWrapper = document.createElement('div');
    btnWrapper.style.position = 'relative';
    btnWrapper.style.marginBottom = '18px';

    const btn = document.createElement('button');
    btn.className = 'ls-btn';
    btn.dataset.levelId = String(i);
    if (i === currentLevelId) {
      btn.classList.add('current');
    }
    btn.textContent = String(i);

    // Level name tooltip
    const nameLabel = document.createElement('span');
    nameLabel.className = 'ls-btn-name';
    nameLabel.textContent = LEVEL_NAMES[i] || '';
    btn.appendChild(nameLabel);

    btn.addEventListener('click', () => {
      network.sendSelectLevel(i);
      hideLevelSelect();
    });

    btnWrapper.appendChild(btn);
    grid.appendChild(btnWrapper);
  }
  panel.appendChild(grid);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-secondary';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => {
    hideLevelSelect();
  });
  panel.appendChild(closeBtn);

  levelSelectDiv.appendChild(panel);
  document.body.appendChild(levelSelectDiv);
}

function updateLevelSelectHighlight() {
  if (!levelSelectDiv) return;
  const buttons = levelSelectDiv.querySelectorAll('.ls-btn');
  buttons.forEach((btn) => {
    const el = btn as HTMLElement;
    if (el.dataset.levelId === String(currentLevelId)) {
      el.classList.add('current');
    } else {
      el.classList.remove('current');
    }
  });
}

function hideLevelSelect() {
  if (levelSelectDiv) {
    levelSelectDiv.style.display = 'none';
  }
}

// --- Block Death Feedback ---
let deathOverlayTimeout: ReturnType<typeof setTimeout> | null = null;
let lastFireAlive = true;
let lastWaterAlive = true;

function showDeathOverlay() {
  // Remove existing overlay if present
  const existing = document.getElementById('death-overlay');
  if (existing) {
    existing.remove();
  }
  if (deathOverlayTimeout) {
    clearTimeout(deathOverlayTimeout);
  }

  const overlay = document.createElement('div');
  overlay.id = 'death-overlay';
  overlay.className = 'death-overlay';

  const text = document.createElement('div');
  text.className = 'death-overlay-text';
  text.textContent = 'Block Destroyed!';
  overlay.appendChild(text);

  const uiOverlay = document.getElementById('ui-overlay');
  if (uiOverlay) {
    uiOverlay.appendChild(overlay);
  }

  deathOverlayTimeout = setTimeout(() => {
    overlay.remove();
    deathOverlayTimeout = null;
  }, 2000);
}

// --- State sync ---
let currentPhase = 'waiting';
let currentLevelId = 1;

// Track the last server-authoritative pose for each block so we can
// detect changes and feed them into the rolling animation.
interface TrackedPose {
  x: number;
  y: number;
  orientation: BlockOrientation;
}
let lastFirePose: TrackedPose | null = null;
let lastWaterPose: TrackedPose | null = null;

network.onStateChange = (state: GameState) => {
  // Phase transitions
  if (state.phase !== currentPhase) {
    currentPhase = state.phase;

    if (currentPhase === 'playing' || currentPhase === 'completed') {
      lobbyDiv.style.display = 'none';
      hudDiv.style.display = 'flex';
    }

    if (currentPhase === 'completed') {
      levelCompleteDiv.style.display = 'flex';
    } else {
      levelCompleteDiv.style.display = 'none';
    }
  }

  // Update grid from tiles JSON
  if (state.tilesJson) {
    try {
      const tiles: TileType[][] = JSON.parse(state.tilesJson);
      gridMesh.updateTiles(tiles);
      // Center camera on the grid when level loads
      if (tiles.length > 0 && tiles[0].length > 0) {
        renderer.centerOnGrid(tiles[0].length, tiles.length);
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Update fire block
  if (state.fireBlock) {
    fireBlock.setVisible(state.fireBlock.alive);

    // Detect death
    if (!state.fireBlock.alive && lastFireAlive) {
      showDeathOverlay();
    }
    lastFireAlive = state.fireBlock.alive;

    const newFireOri = state.fireBlock.orientation as BlockOrientation;
    const newFireX = state.fireBlock.position.x;
    const newFireY = state.fireBlock.position.y;

    if (lastFirePose === null) {
      // First time — snap without animation
      fireBlock.setPositionImmediate({ x: newFireX, y: newFireY }, newFireOri);
    } else if (
      newFireX !== lastFirePose.x ||
      newFireY !== lastFirePose.y ||
      newFireOri !== lastFirePose.orientation
    ) {
      // Position or orientation changed — animate the roll
      const now = performance.now() / 1000;
      fireBlock.animateRoll(
        { x: lastFirePose.x, y: lastFirePose.y },
        lastFirePose.orientation,
        { x: newFireX, y: newFireY },
        newFireOri,
        now,
      );
    }

    lastFirePose = { x: newFireX, y: newFireY, orientation: newFireOri };
  }

  // Update water block
  if (state.waterBlock) {
    waterBlock.setVisible(state.waterBlock.alive);

    // Detect death
    if (!state.waterBlock.alive && lastWaterAlive) {
      showDeathOverlay();
    }
    lastWaterAlive = state.waterBlock.alive;

    const newWaterOri = state.waterBlock.orientation as BlockOrientation;
    const newWaterX = state.waterBlock.position.x;
    const newWaterY = state.waterBlock.position.y;

    if (lastWaterPose === null) {
      // First time — snap without animation
      waterBlock.setPositionImmediate({ x: newWaterX, y: newWaterY }, newWaterOri);
    } else if (
      newWaterX !== lastWaterPose.x ||
      newWaterY !== lastWaterPose.y ||
      newWaterOri !== lastWaterPose.orientation
    ) {
      // Position or orientation changed — animate the roll
      const now = performance.now() / 1000;
      waterBlock.animateRoll(
        { x: lastWaterPose.x, y: lastWaterPose.y },
        lastWaterPose.orientation,
        { x: newWaterX, y: newWaterY },
        newWaterOri,
        now,
      );
    }

    lastWaterPose = { x: newWaterX, y: newWaterY, orientation: newWaterOri };
  }

  // Track current level; reset poses on level change so the new start
  // position snaps rather than animating from the old level's position.
  if (state.levelId && state.levelId !== currentLevelId) {
    currentLevelId = state.levelId;
    lastFirePose = null;
    lastWaterPose = null;
    // Reset alive trackers on level change
    lastFireAlive = true;
    lastWaterAlive = true;
  } else if (state.levelId) {
    currentLevelId = state.levelId;
  }

  // Hide level select when a new level starts playing
  if (state.phase === 'playing') {
    hideLevelSelect();
  }

  // Update HUD
  if (hudMoveCounter) {
    hudMoveCounter.textContent = String(state.moveCount);
  }
  if (hudRoomCode && state.roomCode) {
    hudRoomCode.textContent = 'Room ' + state.roomCode;
  }
  if (hudLevelName) {
    const name = LEVEL_NAMES[currentLevelId];
    hudLevelName.textContent = name ? name : 'Level ' + currentLevelId;
  }
  if (hudFallOffToggle && state.settings) {
    hudFallOffToggle.textContent = state.settings.fallOffEdge ? 'ON' : 'OFF';
    hudFallOffToggle.style.color = state.settings.fallOffEdge ? '#4caf50' : '#ff4444';
  }
  // Update level complete moves
  if (lcMovesValue) {
    lcMovesValue.textContent = String(state.moveCount);
  }
};

// --- Build UI ---
buildModeSelect();
buildHUD();
buildLevelComplete();

// --- Render loop ---
let lastTime = performance.now() / 1000;

renderer.startLoop(() => {
  const now = performance.now() / 1000;
  const dt = Math.min(now - lastTime, 0.1); // Cap dt to avoid large jumps
  lastTime = now;

  // Update particle effects on blocks
  fireBlock.update(dt, now);
  waterBlock.update(dt, now);

  // Update tile visual effects (lava pulse, water shimmer)
  gridMesh.update(now);
});
