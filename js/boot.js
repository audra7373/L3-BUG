export const BOOT_LINES = [
    { text: '> Initializing kernel modules........', cls: 'dim' },
    { text: '> [OK] CORE_RUNTIME loaded', cls: 'ok' },
    { text: '> Loading sector map.................', cls: 'dim' },
    { text: '> [OK] SECTOR_0x01 mapped', cls: 'ok' },
    { text: '> Allocating QUANTUM_RAM blocks......', cls: 'dim' },
    { text: '> [OK] 512MB online — integrity 67%', cls: 'warn' },
    { text: '> Scanning filesystem integrity......', cls: 'dim' },
    { text: '> [!!] CORRUPTION DETECTED in 0x4F2A', cls: 'corrupt', corrupted: true },
    { text: '> [!!] DATA_LOSS: 3 sectors affected', cls: 'corrupt', corrupted: true },
    { text: '> Attempting auto-repair.............', cls: 'dim' },
    { text: '> [WARN] Repair partial — bypassing', cls: 'warn' },
    { text: '> Spawning player node...............', cls: 'dim' },
    { text: '> [OK] NODE_OCTAHEDRON active', cls: 'ok' },
    { text: '> Establishing tunnel uplink.........', cls: 'dim' },
    { text: '> [OK] TUNNEL_BREACH ready — GOOD LUCK', cls: 'ok' },
];

const SCRAMBLE_CHARS = '!@#$%^&*<>?/|\\0123456789ABCDEF';

export function scramble(str) {
    return str.split('').map(c => c === ' ' ? ' ' : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]).join('');
}