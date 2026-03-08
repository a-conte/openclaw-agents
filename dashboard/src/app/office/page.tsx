'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgents } from '@/hooks/useAgents';
import { AGENT_COLORS, AGENT_ROLES } from '@/lib/constants';
import { getAgentStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Circle } from 'lucide-react';

const TILE = 12;
const COLS = 52;
const ROWS = 32;
const CANVAS_W = COLS * TILE;
const CANVAS_H = ROWS * TILE;
const FPS = 20;

interface Sprite {
  id: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  deskX: number;
  deskY: number;
  state: 'working' | 'idle' | 'meeting';
  frame: number;
  bubble: string;
  bubbleTimer: number;
}

const BUBBLES = ['processing...', 'data ready', 'syncing', 'done', 'analyzing', 'writing...', 'scanning', 'compiling', 'thinking...', 'deploying'];
const MEETING_X = 24;
const MEETING_Y = 15;

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function drawPixelAgent(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, frame: number) {
  const px = x * TILE;
  const py = y * TILE;
  const { r, g, b } = hexToRgb(color);
  const s = TILE;

  // Head
  ctx.fillStyle = color;
  ctx.fillRect(px + s * 0.25, py - s * 0.5, s * 0.5, s * 0.4);

  // Body
  ctx.fillStyle = `rgb(${Math.floor(r * 0.8)}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.8)})`;
  ctx.fillRect(px + s * 0.15, py, s * 0.7, s * 0.5);

  // Legs
  const legOffset = frame % 2 === 0 ? 1 : -1;
  ctx.fillStyle = `rgb(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.6)})`;
  ctx.fillRect(px + s * 0.2 + legOffset, py + s * 0.5, s * 0.2, s * 0.3);
  ctx.fillRect(px + s * 0.55 - legOffset, py + s * 0.5, s * 0.2, s * 0.3);
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, monitorGlow: boolean, color: string) {
  const px = x * TILE;
  const py = y * TILE;
  const s = TILE;

  // Desk surface
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(px - s * 0.3, py + s * 0.3, s * 1.6, s * 0.3);

  // Monitor
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(px, py - s * 0.5, s, s * 0.7);
  if (monitorGlow) {
    ctx.fillStyle = color + '60';
    ctx.fillRect(px + 1, py - s * 0.5 + 1, s - 2, s * 0.7 - 2);
  }

  // Monitor stand
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(px + s * 0.35, py + s * 0.2, s * 0.3, s * 0.15);
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, alpha: number) {
  const px = x * TILE;
  const py = y * TILE - TILE * 1.5;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1a1a2e';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;

  const w = text.length * 5 + 8;
  ctx.beginPath();
  ctx.roundRect(px - w / 2 + TILE / 2, py - 10, w, 14, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#888';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, px + TILE / 2, py);
  ctx.restore();
}

export default function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<Sprite[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: string; state: string } | null>(null);
  const { agents } = useAgents();
  const animFrameRef = useRef<number>(0);
  const tickRef = useRef(0);

  // Initialize sprites when agents change
  useEffect(() => {
    const existing = spritesRef.current;
    const agentIds = agents.map((a: any) => a.agentId);

    const deskPositions = [
      { x: 8, y: 8 }, { x: 20, y: 8 }, { x: 32, y: 8 }, { x: 44, y: 8 },
      { x: 8, y: 22 }, { x: 20, y: 22 }, { x: 32, y: 22 },
    ];

    const sprites: Sprite[] = agentIds.map((id: string, i: number) => {
      const prev = existing.find(s => s.id === id);
      const desk = deskPositions[i % deskPositions.length];
      const lastActivity = agents[i]?.sessions?.recent?.[0]?.updatedAt;
      const status = getAgentStatus(lastActivity);
      const state = status === 'online' ? 'working' : status === 'warning' ? 'idle' : 'idle';

      if (prev) {
        return { ...prev, state, deskX: desk.x, deskY: desk.y, color: AGENT_COLORS[id] || '#555' };
      }

      return {
        id,
        color: AGENT_COLORS[id] || '#555',
        x: desk.x - 2,
        y: desk.y,
        targetX: desk.x - 2,
        targetY: desk.y,
        deskX: desk.x,
        deskY: desk.y,
        state,
        frame: 0,
        bubble: '',
        bubbleTimer: 0,
      };
    });

    spritesRef.current = sprites;
  }, [agents]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let lastTime = 0;
    const interval = 1000 / FPS;

    function update() {
      tickRef.current++;
      const sprites = spritesRef.current;

      for (const sprite of sprites) {
        // Update target based on state
        if (sprite.state === 'working') {
          sprite.targetX = sprite.deskX - 2;
          sprite.targetY = sprite.deskY;
        } else if (sprite.state === 'meeting') {
          sprite.targetX = MEETING_X + (Math.random() - 0.5) * 4;
          sprite.targetY = MEETING_Y + (Math.random() - 0.5) * 2;
        } else {
          // Idle: wander near desk
          if (tickRef.current % 60 === 0) {
            sprite.targetX = sprite.deskX - 2 + (Math.random() - 0.5) * 6;
            sprite.targetY = sprite.deskY + (Math.random() - 0.5) * 4;
          }
        }

        // Lerp position
        const dx = sprite.targetX - sprite.x;
        const dy = sprite.targetY - sprite.y;
        const moving = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2;
        sprite.x += dx * 0.08;
        sprite.y += dy * 0.08;

        if (moving) sprite.frame++;

        // Bubble logic
        if (sprite.state === 'working' && sprite.bubbleTimer <= 0 && Math.random() < 0.005) {
          sprite.bubble = BUBBLES[Math.floor(Math.random() * BUBBLES.length)];
          sprite.bubbleTimer = 80;
        }
        if (sprite.bubbleTimer > 0) sprite.bubbleTimer--;
        if (sprite.bubbleTimer <= 0) sprite.bubble = '';
      }
    }

    function render() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Floor tiles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#0a0a14' : '#0d0d18';
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }

      // Meeting room area
      ctx.fillStyle = '#0f0f1a';
      ctx.fillRect((MEETING_X - 4) * TILE, (MEETING_Y - 3) * TILE, 10 * TILE, 7 * TILE);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      ctx.strokeRect((MEETING_X - 4) * TILE, (MEETING_Y - 3) * TILE, 10 * TILE, 7 * TILE);

      // Meeting table
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect((MEETING_X - 1) * TILE, (MEETING_Y - 1) * TILE, 4 * TILE, 3 * TILE);

      const sprites = spritesRef.current;

      // Draw desks
      for (const sprite of sprites) {
        drawDesk(ctx, sprite.deskX, sprite.deskY, sprite.state === 'working', sprite.color);
      }

      // Draw agents
      for (const sprite of sprites) {
        drawPixelAgent(ctx, sprite.x, sprite.y, sprite.color, sprite.frame);
        if (sprite.bubble && sprite.bubbleTimer > 0) {
          const alpha = sprite.bubbleTimer < 20 ? sprite.bubbleTimer / 20 : 1;
          drawBubble(ctx, sprite.x, sprite.y, sprite.bubble, alpha);
        }
      }
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

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Mouse hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX / TILE;
    const my = (e.clientY - rect.top) * scaleY / TILE;

    const sprites = spritesRef.current;
    let found = false;
    for (const sprite of sprites) {
      if (Math.abs(sprite.x - mx) < 1.5 && Math.abs(sprite.y - my) < 1.5) {
        setTooltip({ x: e.clientX, y: e.clientY, id: sprite.id, state: sprite.state });
        found = true;
        break;
      }
    }
    if (!found) setTooltip(null);
  }, []);

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary font-[var(--font-heading)]">Office</h1>
        <p className="text-sm text-text-tertiary mt-1">Pixel art visualization of agent activity</p>
      </div>

      <div className="relative bg-surface-0 border border-border rounded-lg overflow-hidden inline-block">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full max-w-4xl"
          style={{ imageRendering: 'pixelated' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        />
        {tooltip && (
          <div
            className="fixed z-50 bg-surface-3 border border-border rounded-md px-3 py-2 pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
          >
            <div className="text-xs font-semibold text-text-primary">{tooltip.id}</div>
            <div className="text-[10px] text-text-tertiary">{AGENT_ROLES[tooltip.id] || ''}</div>
            <div className="text-[10px] text-text-secondary mt-0.5">{tooltip.state}</div>
          </div>
        )}
      </div>

      {/* Agent Legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        {spritesRef.current.map((sprite) => (
          <div key={sprite.id} className="flex items-center gap-2">
            <Circle size={8} className="fill-current" style={{ color: sprite.color }} />
            <span className="text-xs text-text-secondary">{sprite.id}</span>
            <span className={cn(
              'text-[10px]',
              sprite.state === 'working' ? 'text-status-online' :
              sprite.state === 'idle' ? 'text-status-warning' : 'text-text-tertiary'
            )}>
              {sprite.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
