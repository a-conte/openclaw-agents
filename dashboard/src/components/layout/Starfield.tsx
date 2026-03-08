'use client';

import { useMemo } from 'react';

const STAR_COUNT = 100;

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function Starfield() {
  const stars = useMemo(() => {
    return Array.from({ length: STAR_COUNT }, (_, i) => {
      const sizeClass = ['star-sm', 'star-md', 'star-lg'][Math.floor(Math.random() * 3)];
      return {
        id: i,
        left: `${randomBetween(0, 100)}%`,
        top: `${randomBetween(0, 100)}%`,
        sizeClass,
        duration: `${randomBetween(2, 5)}s`,
        delay: `${randomBetween(0, 5)}s`,
      };
    });
  }, []);

  return (
    <div className="starfield">
      {stars.map((s) => (
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
