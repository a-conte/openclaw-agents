'use client';

import { useEffect, useState } from 'react';

const STAR_COUNT = 100;

// Deterministic PRNG (mulberry32) so server and client produce identical stars
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStars(rand: () => number) {
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const sizeClass = ['star-sm', 'star-md', 'star-lg'][Math.floor(rand() * 3)];
    return {
      id: i,
      left: `${rand() * 100}%`,
      top: `${rand() * 100}%`,
      sizeClass,
      duration: `${2 + rand() * 3}s`,
      delay: `${rand() * 5}s`,
    };
  });
}

const SEED = 42;
const seededStars = generateStars(mulberry32(SEED));

export function Starfield() {
  return (
    <div className="starfield">
      {seededStars.map((s) => (
        <div
          key={s.id}
          className={`star ${s.sizeClass}`}
          style={{
            left: s.left,
            top: s.top,
            animationDuration: s.duration,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}
