import * as THREE from 'three';

export const sectorPalettes = [
    { tunnel: 0x00ff00, fog: 0x000500, light: 0x00ff00 },
    { tunnel: 0x00ffff, fog: 0x000505, light: 0x00ffff },
    { tunnel: 0xff00ff, fog: 0x050005, light: 0xff00ff },
    { tunnel: 0xffff00, fog: 0x050500, light: 0xffff00 },
    { tunnel: 0xff6600, fog: 0x050200, light: 0xff6600 },
    { tunnel: 0x6600ff, fog: 0x020005, light: 0x6600ff },
];

export class GameState {
    constructor() {
        this.speed = 0.2;
        this.bits = 0;
        this.sector = 1;
        this.totalScore = 0;
        this.lanes = [-2.5, 0, 2.5];
        this.targetLane = 1;
        this.isFlipped = false;
        this.gameActive = true;
        this.isOverclocked = false;
        this.isForked = false;
        this.MAX_SPEED = 4.0;
        this.obstacles = [];
        this.collectibles = [];
        this.gates = [];
        this.forks = [];
        this.highScore = localStorage.getItem('lebug_highscore') || 0;
        this.photoSensitiveMode = false;
    }
}