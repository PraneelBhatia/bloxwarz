const adjectives = ['FIRE', 'AQUA', 'BLAZE', 'FROST', 'EMBER', 'STORM', 'MAGMA', 'TIDE'];

const codeToRoomId = new Map<string, string>();

export function generateRoomCode(roomId: string): string {
  let code: string;
  let attempts = 0;
  do {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const num = Math.floor(Math.random() * 90) + 10; // 10-99
    code = `${adj}${num}`;
    attempts++;
    if (attempts > 1000) {
      // Fallback: use roomId suffix to ensure uniqueness
      code = `${adj}${roomId.slice(-4).toUpperCase()}`;
      break;
    }
  } while (codeToRoomId.has(code));

  codeToRoomId.set(code, roomId);
  return code;
}

export function getRoomIdByCode(code: string): string | undefined {
  return codeToRoomId.get(code);
}

export function removeRoomCode(code: string): void {
  codeToRoomId.delete(code);
}
