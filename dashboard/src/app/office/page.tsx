'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgents } from '@/hooks/useAgents';
import { AGENT_COLORS, AGENT_ROLES, AGENT_EMOJIS } from '@/lib/constants';
import { getAgentStatus } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Circle, Monitor, Coffee, Users } from 'lucide-react';

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

// Warm palette for canvas rendering
const FLOOR_DARK = '#141210';
const FLOOR_LIGHT = '#181614';
const DESK_COLOR = '#2a2520';
const MONITOR_BG = '#0d0d0d';
const ROOM_BG = '#1a1714';
const ROOM_BORDER = '#2a2520';
const BUBBLE_BG = '#2a2520';
const BUBBLE_BORDER = '#3d352c';
const BUBBLE_TEXT = '#a09484';
const TABLE_COLOR = '#2a2520';
const WALL_COLOR = '#221e1a';
const LABEL_COLOR = '#6b6058';

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function drawPixelAgent(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, frame: number, isWorking: boolean) {
  const px = x * TILE;
  const py = y * TILE;
  const { r, g, b } = hexToRgb(color);
  const s = TILE;

  // Glow effect for working agents
  if (isWorking) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color + '20';
    ctx.beginPath();
    ctx.arc(px + s / 2, py + s * 0.1, s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Head
  ctx.fillStyle = color;
  ctx.fillRect(px + s * 0.25, py - s * 0.5, s * 0.5, s * 0.4);

  // Eyes
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(px + s * 0.3, py - s * 0.35, 2, 2);
  ctx.fillRect(px + s * 0.55, py - s * 0.35, 2, 2);

  // Body
  ctx.fillStyle = `rgb(${Math.floor(r * 0.8)}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.8)})`;
  ctx.fillRect(px + s * 0.15, py, s * 0.7, s * 0.5);

  // Legs with walk animation
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
  ctx.fillStyle = DESK_COLOR;
  ctx.fillRect(px - s * 0.3, py + s * 0.3, s * 1.6, s * 0.3);

  // Desk legs
  ctx.fillStyle = WALL_COLOR;
  ctx.fillRect(px - s * 0.2, py + s * 0.6, 2, s * 0.4);
  ctx.fillRect(px + s * 1.1, py + s * 0.6, 2, s * 0.4);

  // Monitor
  ctx.fillStyle = MONITOR_BG;
  ctx.fillRect(px, py - s * 0.5, s, s * 0.7);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(px, py - s * 0.5, s, s * 0.7);

  if (monitorGlow) {
    // Active screen with color tint
    ctx.fillStyle = color + '40';
    ctx.fillRect(px + 1, py - s * 0.5 + 1, s - 2, s * 0.7 - 2);

    // Scanlines effect
    ctx.fillStyle = color + '15';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(px + 2, py - s * 0.5 + 2 + i * 2, s - 4, 1);
    }
  }

  // Monitor stand
  ctx.fillStyle = DESK_COLOR;
  ctx.fillRect(px + s * 0.35, py + s * 0.2, s * 0.3, s * 0.15);
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, alpha: number) {
  const px = x * TILE;
  const py = y * TILE - TILE * 1.8;

  ctx.save();
  ctx.globalAlpha = alpha;

  const w = text.length * 5 + 12;
  const h = 16;
  const bx = px - w / 2 + TILE / 2;
  const by = py - 10;

  // Bubble background with border
  ctx.fillStyle = BUBBLE_BG;
  ctx.strokeStyle = BUBBLE_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 4);
  ctx.fill();
  ctx.stroke();

  // Bubble tail
  ctx.fillStyle = BUBBLE_BG;
  ctx.beginPath();
  ctx.moveTo(px + TILE / 2 - 3, by + h);
  ctx.lineTo(px + TILE / 2, by + h + 4);
  ctx.lineTo(px + TILE / 2 + 3, by + h);
  ctx.fill();

  // Text
  ctx.fillStyle = BUBBLE_TEXT;
  ctx.font = '8px "Anonymous Pro", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, px + TILE / 2, py + 1);
  ctx.restore();
}

function drawRoomLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string) {
  ctx.save();
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = '9px "Anonymous Pro", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x * TILE, y * TILE);
  ctx.restore();
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const px = x * TILE;
  const py = y * TILE;

  // Pot
  ctx.fillStyle = '#4a3728';
  ctx.fillRect(px, py + 4, 8, 6);

  // Leaves
  ctx.fillStyle = '#2d5a3f';
  ctx.fillRect(px + 1, py - 2, 2, 6);
  ctx.fillRect(px + 4, py - 4, 2, 8);
  ctx.fillRect(px + 6, py, 2, 4);
}

export default function OfficePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spritesRef = useRef<Sprite[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; id: string; state: string } | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
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
        if (sprite.state === 'working') {
          sprite.targetX = sprite.deskX - 2;
          sprite.targetY = sprite.deskY;
        } else if (sprite.state === 'meeting') {
          sprite.targetX = MEETING_X + (Math.random() - 0.5) * 4;
          sprite.targetY = MEETING_Y + (Math.random() - 0.5) * 2;
        } else {
          if (tickRef.current % 60 === 0) {
            sprite.targetX = sprite.deskX - 2 + (Math.random() - 0.5) * 6;
            sprite.targetY = sprite.deskY + (Math.random() - 0.5) * 4;
          }
        }

        const dx = sprite.targetX - sprite.x;
        const dy = sprite.targetY - sprite.y;
        const moving = Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2;
        sprite.x += dx * 0.08;
        sprite.y += dy * 0.08;

        if (moving) sprite.frame++;

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

      // Floor tiles — warm charcoal checkerboard
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? FLOOR_DARK : FLOOR_LIGHT;
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }

      // Workspace zones — subtle area highlights
      ctx.fillStyle = '#1a1714';
      ctx.fillRect(2 * TILE, 4 * TILE, 16 * TILE, 10 * TILE);
      ctx.fillRect(26 * TILE, 4 * TILE, 16 * TILE, 10 * TILE);
      ctx.fillRect(2 * TILE, 18 * TILE, 16 * TILE, 10 * TILE);
      ctx.fillRect(26 * TILE, 18 * TILE, 16 * TILE, 10 * TILE);

      // Zone borders
      ctx.strokeStyle = '#2a252020';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(2 * TILE, 4 * TILE, 16 * TILE, 10 * TILE);
      ctx.strokeRect(26 * TILE, 4 * TILE, 16 * TILE, 10 * TILE);
      ctx.strokeRect(2 * TILE, 18 * TILE, 16 * TILE, 10 * TILE);
      ctx.strokeRect(26 * TILE, 18 * TILE, 16 * TILE, 10 * TILE);

      // Meeting room area
      ctx.fillStyle = ROOM_BG;
      ctx.fillRect((MEETING_X - 4) * TILE, (MEETING_Y - 3) * TILE, 10 * TILE, 7 * TILE);
      ctx.strokeStyle = ROOM_BORDER;
      ctx.lineWidth = 1;
      ctx.strokeRect((MEETING_X - 4) * TILE, (MEETING_Y - 3) * TILE, 10 * TILE, 7 * TILE);

      // Meeting table
      ctx.fillStyle = TABLE_COLOR;
      ctx.fillRect((MEETING_X - 1) * TILE, (MEETING_Y - 1) * TILE, 4 * TILE, 3 * TILE);

      // Room labels
      drawRoomLabel(ctx, MEETING_X + 1, MEETING_Y - 3.5, '[ meeting room ]');
      drawRoomLabel(ctx, 10, 3.5, '[ bay 1 ]');
      drawRoomLabel(ctx, 34, 3.5, '[ bay 2 ]');
      drawRoomLabel(ctx, 10, 17.5, '[ bay 3 ]');

      // Plants for decoration
      drawPlant(ctx, 1 * TILE + 4, 4 * TILE);
      drawPlant(ctx, 48 * TILE, 4 * TILE);
      drawPlant(ctx, 1 * TILE + 4, 28 * TILE);
      drawPlant(ctx, 48 * TILE, 28 * TILE);

      // Divider line (hallway)
      ctx.strokeStyle = '#2a2520';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 15 * TILE);
      ctx.lineTo((MEETING_X - 5) * TILE, 15 * TILE);
      ctx.moveTo((MEETING_X + 7) * TILE, 15 * TILE);
      ctx.lineTo(CANVAS_W, 15 * TILE);
      ctx.stroke();
      ctx.setLineDash([]);

      const sprites = spritesRef.current;

      // Draw desks
      for (const sprite of sprites) {
        drawDesk(ctx, sprite.deskX, sprite.deskY, sprite.state === 'working', sprite.color);
      }

      // Draw agents
      for (const sprite of sprites) {
        drawPixelAgent(ctx, sprite.x, sprite.y, sprite.color, sprite.frame, sprite.state === 'working');
        if (sprite.bubble && sprite.bubbleTimer > 0) {
          const alpha = sprite.bubbleTimer < 20 ? sprite.bubbleTimer / 20 : 1;
          drawBubble(ctx, sprite.x, sprite.y, sprite.bubble, alpha);
        }
      }

      // Name tags under agents
      ctx.save();
      ctx.font = '7px "Anonymous Pro", monospace';
      ctx.textAlign = 'center';
      for (const sprite of sprites) {
        ctx.fillStyle = sprite.color + '90';
        ctx.fillText(sprite.id, sprite.x * TILE + TILE / 2, sprite.y * TILE + TILE * 1.2);
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

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

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

  const agentList = agents.map((a: any) => {
    const lastActivity = a.sessions?.recent?.[0]?.updatedAt;
    const status = getAgentStatus(lastActivity);
    return { ...a, status };
  });

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-text-primary tracking-tight">Digital Office</h1>
        <p className="text-sm text-text-tertiary mt-1">Live view of agent workspace activity</p>
      </div>

      <div className="flex gap-6 flex-col xl:flex-row">
        {/* Canvas area */}
        <div className="flex-1 min-w-0">
          <div className="relative glass bg-surface-1/50 rounded-lg overflow-hidden p-3">
            {/* Status bar above canvas */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Monitor size={12} className="text-text-tertiary" />
                  <span className="text-[11px] text-text-tertiary uppercase tracking-wider">Live Feed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] text-text-tertiary">Recording</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
                <span>{agentList.filter((a: any) => a.status === 'online').length} active</span>
                <span>{agentList.length} total</span>
              </div>
            </div>

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
                className="fixed z-50 glass bg-surface-2/90 rounded-md px-3 py-2 pointer-events-none shadow-lg"
                style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{AGENT_EMOJIS[tooltip.id] || ''}</span>
                  <div>
                    <div className="text-xs font-bold text-text-primary">{tooltip.id}</div>
                    <div className="text-[10px] text-text-tertiary">{AGENT_ROLES[tooltip.id] || ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Circle
                    size={6}
                    className={cn(
                      'fill-current',
                      tooltip.state === 'working' ? 'text-status-online' :
                      tooltip.state === 'idle' ? 'text-status-warning' : 'text-text-tertiary'
                    )}
                  />
                  <span className="text-[10px] text-text-secondary capitalize">{tooltip.state}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Agent roster sidebar */}
        <div className="xl:w-72 shrink-0 space-y-2">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Users size={12} className="text-text-tertiary" />
            <span className="text-[11px] text-text-tertiary uppercase tracking-wider">Agent Roster</span>
          </div>

          {agentList.map((agent: any) => {
            const sprite = spritesRef.current.find(s => s.id === agent.agentId);
            const isSelected = selectedAgent === agent.agentId;
            return (
              <button
                key={agent.agentId}
                onClick={() => setSelectedAgent(isSelected ? null : agent.agentId)}
                className={cn(
                  'w-full text-left glass rounded-lg p-3 transition-all duration-200 cursor-pointer',
                  isSelected
                    ? 'bg-surface-2/80 border-accent/30'
                    : 'bg-surface-1/40 hover:bg-surface-2/60'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-sm"
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
                    <div className="text-[10px] text-text-tertiary truncate mt-0.5">
                      {AGENT_ROLES[agent.agentId]?.split('—')[0]?.trim() || 'Agent'}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-secondary">
                    {AGENT_ROLES[agent.agentId]?.split('—')[1]?.trim() || 'No description'}
                  </div>
                )}
              </button>
            );
          })}

          {agentList.length === 0 && (
            <div className="glass bg-surface-1/40 rounded-lg p-4 text-center">
              <Coffee size={16} className="text-text-tertiary mx-auto mb-2" />
              <p className="text-xs text-text-tertiary">No agents online</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
