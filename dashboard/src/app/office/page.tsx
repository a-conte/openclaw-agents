'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgents } from '@/hooks/useAgents';
import { useTasks } from '@/hooks/useTasks';
import { AGENT_COLORS, AGENT_ROLES, AGENT_EMOJIS } from '@/lib/constants';
import { getAgentStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Circle, Scroll, Shield, Sword, Sparkles } from 'lucide-react';

// --- Grid & Canvas ---
const PX = 3;
const GRID_W = 56;
const GRID_H = 40;
const T = 8;
const VW = GRID_W * T;
const VH = GRID_H * T;
const CANVAS_W = VW * PX;
const CANVAS_H = VH * PX;
const FPS = 12;

// --- Palette (warm RPG dungeon/tavern) ---
const PAL = {
  black:      '#0d0b09',
  floor1:     '#2a2218',
  floor2:     '#262016',
  floorAccent:'#302820',
  wall:       '#4a3e30',
  wallTop:    '#5c5040',
  wallDark:   '#362e24',
  wallBrick:  '#3a3228',
  wood:       '#5c4a38',
  woodDark:   '#4a3828',
  woodLight:  '#6b5a48',
  stone:      '#3a3630',
  stoneDark:  '#2a2824',
  carpet:     '#2a1e1e',
  carpetB:    '#2e2222',
  carpetGold: '#4a3a20',
  table:      '#5c4a38',
  tableDark:  '#4a3828',
  torch:      '#ff9930',
  torchGlow:  '#ff6600',
  fire1:      '#ff4400',
  fire2:      '#ffaa00',
  fire3:      '#ffdd44',
  banner:     '#8b2020',
  bannerDark: '#6b1818',
  gold:       '#daa520',
  goldDark:   '#b8860b',
  potion1:    '#4040cc',
  potion2:    '#40aa40',
  potion3:    '#cc4040',
  bookRed:    '#8b3030',
  bookBlue:   '#304a8b',
  bookGreen:  '#305a30',
  bookGold:   '#8b7030',
  plant:      '#2d5a3f',
  plantDark:  '#1e4030',
  pot:        '#6b4a30',
  crystal:    '#6080cc',
  crystalGlow:'#80a0ee',
  shadow:     'rgba(0,0,0,0.3)',
  text:       '#E6D7C3',
  textDim:    '#6b6058',
  skin:       '#E6D7C3',
  skinShadow: '#c4b8a4',
};

// --- RPG class mapping for agents ---
const AGENT_CLASS: Record<string, { title: string; weapon: string }> = {
  main:          { title: 'Guild Master', weapon: 'staff' },
  mail:          { title: 'Herald', weapon: 'scroll' },
  docs:          { title: 'Scribe', weapon: 'quill' },
  research:      { title: 'Ranger', weapon: 'spyglass' },
  'ai-research': { title: 'Archmage', weapon: 'crystal' },
  dev:           { title: 'Artificer', weapon: 'hammer' },
  security:      { title: 'Sentinel', weapon: 'shield' },
};

interface Sprite {
  id: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  homeX: number;
  homeY: number;
  state: 'questing' | 'idle' | 'resting';
  frame: number;
  dir: 0 | 1 | 2 | 3;
  bubble: string;
  bubbleTimer: number;
}

const QUEST_BUBBLES = [
  'On a quest...', 'Seeking data...', 'Analyzing scrolls...', 'Forging code...',
  'Scouting ahead...', 'Decrypting runes...', 'Compiling spells...', 'Deploying ward...',
  'Reading tome...', 'Crafting report...', 'Sending raven...', 'Brewing potion...',
  'Mapping terrain...', 'Sharpening tools...', 'Consulting oracle...',
];

// Agent positions in the guild hall
const STATIONS = [
  { x: 10, y: 10, homeX: 10, homeY: 12 },
  { x: 18, y: 10, homeX: 18, homeY: 12 },
  { x: 26, y: 10, homeX: 26, homeY: 12 },
  { x: 10, y: 20, homeX: 10, homeY: 22 },
  { x: 18, y: 20, homeX: 18, homeY: 22 },
  { x: 26, y: 20, homeX: 26, homeY: 22 },
  { x: 34, y: 10, homeX: 34, homeY: 12 },
];

// --- Drawing helpers ---
function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x * PX, y * PX, w * PX, h * PX);
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

// --- Environment drawing ---
function drawStoneFloor(ctx: CanvasRenderingContext2D) {
  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      const base = (tx + ty) % 2 === 0 ? PAL.floor1 : PAL.floor2;
      px(ctx, tx * T, ty * T, T, T, base);
      // Stone grout lines
      px(ctx, tx * T, ty * T, T, 1, PAL.wallDark + '40');
      px(ctx, tx * T, ty * T, 1, T, PAL.wallDark + '40');
    }
  }
}

function drawWallH(ctx: CanvasRenderingContext2D, tx: number, ty: number, len: number) {
  for (let i = 0; i < len; i++) {
    const x = (tx + i) * T;
    const y = ty * T;
    px(ctx, x, y, T, 2, PAL.wallTop);
    px(ctx, x, y + 2, T, T - 2, PAL.wall);
    // Stone texture
    if ((tx + i) % 3 === 0) {
      px(ctx, x + 1, y + 3, 3, 2, PAL.wallBrick);
      px(ctx, x + 5, y + 5, 2, 2, PAL.wallBrick);
    } else if ((tx + i) % 3 === 1) {
      px(ctx, x + 2, y + 4, 4, 2, PAL.wallBrick);
    } else {
      px(ctx, x + 0, y + 6, 3, 1, PAL.wallBrick);
      px(ctx, x + 4, y + 3, 3, 2, PAL.wallBrick);
    }
  }
}

function drawWallV(ctx: CanvasRenderingContext2D, tx: number, ty: number, len: number) {
  for (let i = 0; i < len; i++) {
    const x = tx * T;
    const y = (ty + i) * T;
    px(ctx, x, y, 2, T, PAL.wallTop);
    px(ctx, x + 2, y, T - 2, T, PAL.wall);
    if ((ty + i) % 2 === 0) {
      px(ctx, x + 3, y + 1, 2, 3, PAL.wallBrick);
      px(ctx, x + 5, y + 5, 2, 2, PAL.wallBrick);
    }
  }
}

function drawCarpet(ctx: CanvasRenderingContext2D, cx: number, cy: number, cw: number, ch: number) {
  // Fill
  for (let ty = 0; ty < ch; ty++) {
    for (let tx = 0; tx < cw; tx++) {
      const color = (tx + ty) % 2 === 0 ? PAL.carpet : PAL.carpetB;
      px(ctx, (cx + tx) * T, (cy + ty) * T, T, T, color);
    }
  }
  // Gold border
  for (let i = 0; i < cw; i++) {
    px(ctx, (cx + i) * T, cy * T, T, 1, PAL.carpetGold);
    px(ctx, (cx + i) * T, (cy + ch) * T - 1, T, 1, PAL.carpetGold);
  }
  for (let i = 0; i < ch; i++) {
    px(ctx, cx * T, (cy + i) * T, 1, T, PAL.carpetGold);
    px(ctx, (cx + cw) * T - 1, (cy + i) * T, 1, T, PAL.carpetGold);
  }
}

function drawTorch(ctx: CanvasRenderingContext2D, tx: number, ty: number, tick: number) {
  const x = tx * T;
  const y = ty * T;
  // Bracket
  px(ctx, x + 3, y + 3, 2, 5, PAL.wallDark);
  // Flame (animated)
  const flicker = tick % 4;
  px(ctx, x + 2, y, 4, 3, PAL.fire1);
  px(ctx, x + 3, y - 1 - (flicker % 2), 2, 2, PAL.fire2);
  px(ctx, x + 3, y - 2 - (flicker > 1 ? 1 : 0), 1, 1, PAL.fire3);
  // Glow
  ctx.save();
  ctx.globalAlpha = 0.06 + Math.sin(tick * 0.3) * 0.02;
  ctx.fillStyle = PAL.torch;
  ctx.beginPath();
  ctx.arc((x + 4) * PX, (y + 2) * PX, T * 3 * PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, tx: number, ty: number, color: string) {
  const x = tx * T;
  const y = ty * T;
  // Banner rod
  px(ctx, x, y, T, 1, PAL.gold);
  // Banner body (tapers to point)
  px(ctx, x + 1, y + 1, T - 2, T * 2 - 2, color);
  px(ctx, x + 2, y + 1, T - 4, T * 2 - 2, color);
  // Banner point
  px(ctx, x + 2, y + T * 2 - 1, 1, 1, color);
  px(ctx, x + T - 3, y + T * 2 - 1, 1, 1, color);
  px(ctx, x + 3, y + T * 2, 1, 1, color);
  px(ctx, x + T - 4, y + T * 2, 1, 1, color);
  // Emblem (simple diamond)
  const cx = x + T / 2;
  const cy = y + T;
  px(ctx, cx, cy - 2, 1, 1, PAL.gold);
  px(ctx, cx - 1, cy - 1, 3, 1, PAL.gold);
  px(ctx, cx - 2, cy, 5, 1, PAL.gold);
  px(ctx, cx - 1, cy + 1, 3, 1, PAL.gold);
  px(ctx, cx, cy + 2, 1, 1, PAL.gold);
}

function drawWorkbench(ctx: CanvasRenderingContext2D, tx: number, ty: number, agentColor: string, isActive: boolean) {
  const x = tx * T;
  const y = ty * T;

  // Table surface
  px(ctx, x - T, y, T * 3, T, PAL.wood);
  px(ctx, x - T + 1, y + 1, T * 3 - 2, T - 3, PAL.woodLight);
  px(ctx, x - T, y + T - 1, T * 3, 1, PAL.woodDark); // shadow edge

  // Table legs
  px(ctx, x - T + 1, y + T, 2, 3, PAL.woodDark);
  px(ctx, x + T * 2 - 3, y + T, 2, 3, PAL.woodDark);

  // Crystal ball / scrying orb (instead of monitor)
  if (isActive) {
    // Glowing orb
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = agentColor;
    ctx.beginPath();
    ctx.arc((x + T / 2) * PX, (y - 1) * PX, 6 * PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    px(ctx, x + 1, y - 4, T - 2, 4, agentColor + '80');
    px(ctx, x + 2, y - 3, T - 4, 2, agentColor + 'bb');
    // Sparkle
    if (Math.random() > 0.5) {
      px(ctx, x + 2 + Math.floor(Math.random() * 3), y - 3, 1, 1, '#fff');
    }
  } else {
    px(ctx, x + 1, y - 4, T - 2, 4, PAL.crystal + '60');
    px(ctx, x + 2, y - 3, T - 4, 2, PAL.crystal + '40');
  }
  // Orb stand
  px(ctx, x + 3, y - 1, 2, 1, PAL.goldDark);

  // Scattered items on desk
  px(ctx, x - T + 2, y + 2, 3, 2, PAL.bookRed); // book
  px(ctx, x + T + 2, y + 3, 2, 3, PAL.gold + '80'); // scroll
}

function drawBookshelf(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const x = tx * T;
  const y = ty * T;
  // Shelf frame
  px(ctx, x, y, T * 3, T, PAL.wood);
  px(ctx, x + 1, y + 1, T * 3 - 2, T - 2, PAL.woodDark);
  // Books
  const books = [
    { dx: 1, w: 2, h: 5, c: PAL.bookRed },
    { dx: 3, w: 2, h: 6, c: PAL.bookBlue },
    { dx: 6, w: 3, h: 5, c: PAL.bookGold },
    { dx: 10, w: 2, h: 6, c: PAL.bookGreen },
    { dx: 13, w: 2, h: 4, c: PAL.bookRed },
    { dx: 16, w: 3, h: 6, c: PAL.bookBlue },
    { dx: 20, w: 2, h: 5, c: PAL.bookGold },
  ];
  for (const b of books) {
    px(ctx, x + b.dx, y + (T - b.h - 1), b.w, b.h, b.c);
  }
}

function drawPotionShelf(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const x = tx * T;
  const y = ty * T;
  px(ctx, x, y, T * 2, T, PAL.wood);
  px(ctx, x + 1, y + 1, T * 2 - 2, T - 2, PAL.woodDark);
  // Potion bottles
  px(ctx, x + 2, y + 2, 2, 4, PAL.potion1);
  px(ctx, x + 2, y + 1, 2, 1, PAL.potion1 + '80');
  px(ctx, x + 6, y + 3, 2, 3, PAL.potion2);
  px(ctx, x + 6, y + 2, 2, 1, PAL.potion2 + '80');
  px(ctx, x + 10, y + 2, 2, 4, PAL.potion3);
  px(ctx, x + 10, y + 1, 2, 1, PAL.potion3 + '80');
  px(ctx, x + 13, y + 3, 2, 3, PAL.gold);
}

function drawQuestBoard(ctx: CanvasRenderingContext2D, tx: number, ty: number, activeQuests: number) {
  const x = tx * T;
  const y = ty * T;
  // Board frame
  px(ctx, x, y, T * 3, T * 2, PAL.wood);
  px(ctx, x + 1, y + 1, T * 3 - 2, T * 2 - 2, PAL.woodDark);
  // "Papers" pinned to board
  const papers = [
    { dx: 2, dy: 2, w: 5, h: 4, c: '#d4c8a8' },
    { dx: 8, dy: 3, w: 4, h: 5, c: '#c8bca0' },
    { dx: 14, dy: 2, w: 5, h: 3, c: '#ddd0b0' },
    { dx: 3, dy: 8, w: 4, h: 4, c: '#c4b898' },
    { dx: 10, dy: 9, w: 5, h: 3, c: '#d8ccb0' },
    { dx: 17, dy: 7, w: 4, h: 5, c: '#ccc0a0' },
  ];
  for (let i = 0; i < papers.length; i++) {
    const p = papers[i];
    if (i < activeQuests) {
      // Active quest — has a colored pin
      px(ctx, x + p.dx, y + p.dy, p.w, p.h, p.c);
      px(ctx, x + p.dx + 1, y + p.dy, 1, 1, '#cc3333'); // red pin
    } else {
      px(ctx, x + p.dx, y + p.dy, p.w, p.h, p.c + '40');
    }
  }
  // "QUESTS" header
}

function drawTreasureChest(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const x = tx * T;
  const y = ty * T;
  px(ctx, x, y + 2, T, T - 2, PAL.woodDark);
  px(ctx, x + 1, y + 3, T - 2, T - 4, PAL.wood);
  px(ctx, x, y + 2, T, 2, PAL.woodLight);
  // Lock
  px(ctx, x + 3, y + 4, 2, 2, PAL.gold);
}

function drawFireplace(ctx: CanvasRenderingContext2D, tx: number, ty: number, tick: number) {
  const x = tx * T;
  const y = ty * T;
  // Stone frame
  px(ctx, x, y, T * 3, T * 2, PAL.stone);
  px(ctx, x + 1, y, T * 3 - 2, 2, PAL.stoneDark);
  // Opening
  px(ctx, x + 3, y + 4, T * 3 - 6, T * 2 - 5, PAL.black);
  // Fire (animated)
  const f = tick % 3;
  px(ctx, x + 5, y + T + 2, T - 2, 4, PAL.fire1);
  px(ctx, x + 6, y + T + 1 - f % 2, T - 4, 3, PAL.fire2);
  px(ctx, x + 7, y + T - f, T - 6, 2, PAL.fire3);
  // Warm glow
  ctx.save();
  ctx.globalAlpha = 0.04 + Math.sin(tick * 0.2) * 0.02;
  ctx.fillStyle = PAL.torch;
  ctx.beginPath();
  ctx.arc((x + T * 1.5) * PX, (y + T) * PX, T * 5 * PX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, vx: number, vy: number, text: string) {
  ctx.save();
  ctx.fillStyle = PAL.textDim;
  ctx.font = `${7 * PX}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, vx * PX, vy * PX);
  ctx.restore();
}

// --- RPG character sprite ---
function drawAgent(ctx: CanvasRenderingContext2D, vx: number, vy: number, color: string, frame: number, dir: number, isWorking: boolean) {
  const { r, g, b } = hexToRgb(color);
  const dark = `rgb(${Math.floor(r * 0.5)},${Math.floor(g * 0.5)},${Math.floor(b * 0.5)})`;
  const mid = `rgb(${Math.floor(r * 0.75)},${Math.floor(g * 0.75)},${Math.floor(b * 0.75)})`;

  // Shadow
  px(ctx, vx + 1, vy + 12, 6, 1, 'rgba(0,0,0,0.25)');

  // Boots
  const step = frame % 4;
  const leftOff = step < 2 ? 0 : 1;
  const rightOff = step < 2 ? 1 : 0;
  px(ctx, vx + 1, vy + 10 + leftOff, 2, 2 - leftOff, PAL.woodDark);
  px(ctx, vx + 5, vy + 10 + rightOff, 2, 2 - rightOff, PAL.woodDark);

  // Cloak/robe body
  px(ctx, vx + 1, vy + 5, 6, 5, mid);
  px(ctx, vx + 2, vy + 5, 4, 5, color);

  // Belt
  px(ctx, vx + 1, vy + 7, 6, 1, PAL.goldDark);

  // Arms
  const armBob = frame % 2;
  if (isWorking) {
    px(ctx, vx, vy + 5, 1, 3, mid);
    px(ctx, vx + 7, vy + 5, 1, 3, mid);
  } else {
    px(ctx, vx, vy + 5 + armBob, 1, 3, mid);
    px(ctx, vx + 7, vy + 6 - armBob, 1, 3, mid);
  }

  // Head
  px(ctx, vx + 1, vy + 1, 6, 4, PAL.skin);

  // Hood/hair
  px(ctx, vx + 1, vy, 6, 2, dark);
  px(ctx, vx, vy + 1, 1, 2, dark);
  px(ctx, vx + 7, vy + 1, 1, 2, dark);

  // Face
  if (dir !== 1) {
    px(ctx, vx + 2, vy + 2, 1, 1, PAL.black);
    px(ctx, vx + 5, vy + 2, 1, 1, PAL.black);
  }

  // Class indicator — small colored particle above head when working
  if (isWorking) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(frame * 0.5) * 0.3;
    px(ctx, vx + 3, vy - 2 - (frame % 2), 2, 1, color);
    ctx.restore();
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, vx: number, vy: number, text: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const fontSize = 6 * PX;
  ctx.font = `${fontSize}px monospace`;
  const textW = ctx.measureText(text).width;
  const padX = 4 * PX;
  const padY = 3 * PX;
  const bw = textW + padX * 2;
  const bh = fontSize + padY * 2;
  const bx = (vx + 4) * PX - bw / 2;
  const by = (vy - 12) * PX;

  // Parchment-style bubble
  ctx.fillStyle = '#3a3228';
  ctx.strokeStyle = PAL.goldDark;
  ctx.lineWidth = PX;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 2 * PX);
  ctx.fill();
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.moveTo((vx + 2) * PX, by + bh);
  ctx.lineTo((vx + 4) * PX, by + bh + 3 * PX);
  ctx.lineTo((vx + 6) * PX, by + bh);
  ctx.fillStyle = '#3a3228';
  ctx.fill();

  ctx.fillStyle = PAL.text;
  ctx.textAlign = 'center';
  ctx.fillText(text, (vx + 4) * PX, by + padY + fontSize - PX);
  ctx.restore();
}

// --- MAIN COMPONENT ---
export default function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<Sprite[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: string; state: string } | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const animFrameRef = useRef<number>(0);
  const tickRef = useRef(0);

  // Count active quests
  const activeQuests = tasks.filter((t: any) => t.status === 'in_progress' || t.status === 'todo').length;

  useEffect(() => {
    const existing = spritesRef.current;
    const agentIds = agents.map((a: any) => a.agentId);

    const sprites: Sprite[] = agentIds.map((id: string, i: number) => {
      const prev = existing.find(s => s.id === id);
      const ws = STATIONS[i % STATIONS.length];
      const lastActivity = agents[i]?.sessions?.recent?.[0]?.updatedAt;
      const status = getAgentStatus(lastActivity);
      const state = status === 'online' ? 'questing' as const : 'idle' as const;
      const homeX = ws.homeX * T;
      const homeY = ws.homeY * T;

      if (prev) {
        return { ...prev, state, homeX, homeY, color: AGENT_COLORS[id] || '#888' };
      }

      return {
        id,
        color: AGENT_COLORS[id] || '#888',
        x: homeX,
        y: homeY,
        targetX: homeX,
        targetY: homeY,
        homeX,
        homeY,
        state,
        frame: 0,
        dir: 1 as const,
        bubble: '',
        bubbleTimer: 0,
      };
    });

    spritesRef.current = sprites;
  }, [agents]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    let running = true;
    let lastTime = 0;
    const interval = 1000 / FPS;

    function update() {
      tickRef.current++;
      const sprites = spritesRef.current;

      for (const sprite of sprites) {
        if (sprite.state === 'questing') {
          sprite.targetX = sprite.homeX;
          sprite.targetY = sprite.homeY;
          sprite.dir = 1;
        } else {
          if (tickRef.current % 50 === 0 && Math.random() < 0.35) {
            const wanderR = 28;
            sprite.targetX = sprite.homeX + (Math.random() - 0.5) * wanderR * 2;
            sprite.targetY = sprite.homeY + (Math.random() - 0.5) * wanderR * 2;
            sprite.targetX = Math.max(T * 3, Math.min(sprite.targetX, (GRID_W - 3) * T));
            sprite.targetY = Math.max(T * 3, Math.min(sprite.targetY, (GRID_H - 3) * T));
          }
        }

        const dx = sprite.targetX - sprite.x;
        const dy = sprite.targetY - sprite.y;
        const moving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
        sprite.x += dx * 0.05;
        sprite.y += dy * 0.05;

        if (moving) {
          sprite.frame++;
          if (Math.abs(dx) > Math.abs(dy)) {
            sprite.dir = dx > 0 ? 3 : 2;
          } else {
            sprite.dir = dy > 0 ? 0 : 1;
          }
        }

        if (sprite.state === 'questing' && sprite.bubbleTimer <= 0 && Math.random() < 0.006) {
          sprite.bubble = QUEST_BUBBLES[Math.floor(Math.random() * QUEST_BUBBLES.length)];
          sprite.bubbleTimer = 55;
        }
        if (sprite.bubbleTimer > 0) sprite.bubbleTimer--;
        if (sprite.bubbleTimer <= 0) sprite.bubble = '';
      }
    }

    function render() {
      if (!ctx || !canvas) return;
      const tick = tickRef.current;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Stone floor
      drawStoneFloor(ctx);

      // Carpets
      drawCarpet(ctx, 6, 7, 31, 18);
      drawCarpet(ctx, 40, 7, 12, 10);

      // Walls
      drawWallH(ctx, 0, 0, GRID_W);
      drawWallH(ctx, 0, GRID_H - 1, GRID_W);
      drawWallV(ctx, 0, 1, GRID_H - 2);
      drawWallV(ctx, GRID_W - 1, 1, GRID_H - 2);

      // Interior wall dividing main hall from war room
      drawWallV(ctx, 38, 1, 5);
      drawWallV(ctx, 38, 8, 10); // doorway gap at y=6-7
      drawWallV(ctx, 38, 20, GRID_H - 21);

      // War room top/bottom walls
      drawWallH(ctx, 38, 6, GRID_W - 39);
      drawWallH(ctx, 38, 18, GRID_W - 39);

      // --- Furniture ---
      // Fireplace (center top wall)
      drawFireplace(ctx, 17, 1, tick);

      // Torches along walls
      drawTorch(ctx, 6, 2, tick);
      drawTorch(ctx, 14, 2, tick);
      drawTorch(ctx, 22, 2, tick);
      drawTorch(ctx, 30, 2, tick);
      drawTorch(ctx, 2, 15, tick);
      drawTorch(ctx, 2, 25, tick);
      drawTorch(ctx, 35, 15, tick);
      drawTorch(ctx, 35, 25, tick);

      // Banners on walls
      drawBanner(ctx, 8, 2, PAL.banner);
      drawBanner(ctx, 28, 2, PAL.bannerDark);

      // Workbenches
      const sprites = spritesRef.current;
      for (let i = 0; i < STATIONS.length; i++) {
        const ws = STATIONS[i];
        const sprite = sprites[i];
        const color = sprite?.color || '#888';
        const isActive = sprite?.state === 'questing';
        drawWorkbench(ctx, ws.x, ws.y, color, isActive);
      }

      // Bookshelves along walls
      drawBookshelf(ctx, 3, 3);
      drawBookshelf(ctx, 32, 3);
      drawBookshelf(ctx, 3, 28);

      // Potion shelf
      drawPotionShelf(ctx, 33, 28);

      // Quest board (left wall)
      drawQuestBoard(ctx, 3, 32, activeQuests);

      // Treasure chest
      drawTreasureChest(ctx, 34, 32);

      // War room table
      const warTableX = 42;
      const warTableY = 10;
      px(ctx, warTableX * T, warTableY * T, T * 5, T * 3, PAL.wood);
      px(ctx, warTableX * T + 1, warTableY * T + 1, T * 5 - 2, T * 3 - 2, PAL.woodDark);
      // Map on table
      px(ctx, warTableX * T + 3, warTableY * T + 3, T * 5 - 6, T * 3 - 6, '#c4b898');
      px(ctx, warTableX * T + 6, warTableY * T + 5, 8, 5, '#8b7060'); // terrain
      px(ctx, warTableX * T + 18, warTableY * T + 8, 5, 4, '#607080'); // water
      // War room torch
      drawTorch(ctx, 50, 8, tick);
      drawTorch(ctx, 50, 15, tick);

      // Room labels
      drawLabel(ctx, 21 * T, (GRID_H - 2) * T, 'GUILD HALL');
      drawLabel(ctx, 46 * T, 19 * T - 2, 'WAR ROOM');

      // --- Draw agents (sorted by Y for overlap) ---
      const sorted = [...sprites].sort((a, b) => a.y - b.y);
      for (const sprite of sorted) {
        drawAgent(ctx, sprite.x, sprite.y, sprite.color, sprite.frame, sprite.dir, sprite.state === 'questing');
        if (sprite.bubble && sprite.bubbleTimer > 0) {
          const alpha = sprite.bubbleTimer < 15 ? sprite.bubbleTimer / 15 : 1;
          drawBubble(ctx, sprite.x, sprite.y, sprite.bubble, alpha);
        }
      }

      // Name labels
      ctx.save();
      ctx.font = `${5 * PX}px monospace`;
      ctx.textAlign = 'center';
      for (const sprite of sorted) {
        ctx.fillStyle = sprite.color;
        ctx.globalAlpha = 0.8;
        ctx.fillText(sprite.id, (sprite.x + 4) * PX, (sprite.y + 16) * PX);
      }
      ctx.restore();
    }

    function loop(time: number) {
      if (!running) return;
      if (time - lastTime >= interval) {
        update();
        render();
        lastTime = time;
      }
      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [activeQuests]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX / PX;
    const my = (e.clientY - rect.top) * scaleY / PX;

    const sprites = spritesRef.current;
    let found = false;
    for (const sprite of sprites) {
      if (mx >= sprite.x - 2 && mx <= sprite.x + 10 && my >= sprite.y - 2 && my <= sprite.y + 14) {
        setTooltip({ x: e.clientX, y: e.clientY, id: sprite.id, state: sprite.state });
        found = true;
        break;
      }
    }
    if (!found) setTooltip(null);
  }, []);

  const agentList = agents.map((a: any) => {
    const lastActivity = a.sessions?.recent?.[0]?.updatedAt;
    const status = getAgentStatus(lastActivity);
    return { ...a, status };
  });

  // Per-agent quest counts
  const agentQuests = (id: string) => tasks.filter((t: any) => t.agentId === id && (t.status === 'in_progress' || t.status === 'todo'));

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-text-primary tracking-tight">Guild Hall</h1>
        <p className="text-sm text-text-tertiary mt-1">
          {activeQuests} active quest{activeQuests !== 1 ? 's' : ''} &middot; {agentList.length} heroes
        </p>
      </div>

      <div className="flex gap-6 flex-col xl:flex-row">
        <div className="flex-1 min-w-0">
          <div className="relative glass bg-surface-1/50 rounded-lg overflow-hidden p-2">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full rounded"
              style={{ imageRendering: 'pixelated' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
            />

            {tooltip && (
              <div
                className="fixed z-50 glass bg-surface-2/95 rounded-md px-3 py-2 pointer-events-none shadow-lg border border-border"
                style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{AGENT_EMOJIS[tooltip.id] || ''}</span>
                  <div>
                    <div className="text-xs font-bold text-text-primary">{tooltip.id}</div>
                    <div className="text-[10px] text-accent">{AGENT_CLASS[tooltip.id]?.title || 'Adventurer'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Circle
                    size={6}
                    className={cn(
                      'fill-current',
                      tooltip.state === 'questing' ? 'text-status-online' :
                      tooltip.state === 'idle' ? 'text-status-warning' : 'text-text-tertiary'
                    )}
                  />
                  <span className="text-[10px] text-text-secondary capitalize">
                    {tooltip.state === 'questing' ? 'On Quest' : 'Resting'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hero roster + quest log */}
        <div className="xl:w-80 shrink-0 space-y-4">
          {/* Hero Cards */}
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Shield size={12} className="text-text-tertiary" />
              <span className="text-[11px] text-text-tertiary uppercase tracking-wider">Heroes</span>
            </div>

            <div className="space-y-2">
              {agentList.map((agent: any) => {
                const cls = AGENT_CLASS[agent.agentId];
                const quests = agentQuests(agent.agentId);
                const isSelected = selectedAgent === agent.agentId;
                return (
                  <button
                    key={agent.agentId}
                    onClick={() => setSelectedAgent(isSelected ? null : agent.agentId)}
                    className={cn(
                      'w-full text-left glass rounded-lg p-3 transition-all duration-200 cursor-pointer',
                      isSelected
                        ? 'bg-surface-2/80'
                        : 'bg-surface-1/40 hover:bg-surface-2/60'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-md flex items-center justify-center text-sm"
                        style={{ backgroundColor: (AGENT_COLORS[agent.agentId] || '#555') + '20' }}
                      >
                        {AGENT_EMOJIS[agent.agentId] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary">{agent.agentId}</span>
                          <Circle
                            size={6}
                            className={cn(
                              'fill-current shrink-0',
                              agent.status === 'online' ? 'text-status-online' :
                              agent.status === 'warning' ? 'text-status-warning' : 'text-text-tertiary'
                            )}
                          />
                        </div>
                        <div className="text-[10px] text-accent mt-0.5">
                          {cls?.title || 'Adventurer'}
                        </div>
                      </div>
                      {quests.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
                          <Scroll size={10} />
                          <span>{quests.length}</span>
                        </div>
                      )}
                    </div>

                    {isSelected && quests.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border space-y-1.5">
                        {quests.slice(0, 3).map((q: any) => (
                          <div key={q.id} className="flex items-start gap-2">
                            <Sword size={9} className="text-accent mt-0.5 shrink-0" />
                            <span className="text-[10px] text-text-secondary leading-tight">{q.title}</span>
                          </div>
                        ))}
                        {quests.length > 3 && (
                          <div className="text-[10px] text-text-tertiary pl-4">+{quests.length - 3} more</div>
                        )}
                      </div>
                    )}
                    {isSelected && quests.length === 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <span className="text-[10px] text-text-tertiary italic">No active quests</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Quests Summary */}
          {activeQuests > 0 && (
            <div className="glass bg-surface-1/40 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} className="text-accent" />
                <span className="text-[11px] text-text-tertiary uppercase tracking-wider">Active Quests</span>
              </div>
              <div className="space-y-1.5">
                {tasks
                  .filter((t: any) => t.status === 'in_progress')
                  .slice(0, 5)
                  .map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: AGENT_COLORS[t.agentId] || '#555' }}
                      />
                      <span className="text-[10px] text-text-secondary truncate">{t.title}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {agentList.length === 0 && (
            <div className="glass bg-surface-1/40 rounded-lg p-4 text-center">
              <Sword size={16} className="text-text-tertiary mx-auto mb-2" />
              <p className="text-xs text-text-tertiary">The guild hall is empty</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
