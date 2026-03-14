type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  msg: string;
  ts: string;
  ctx?: string;
  [key: string]: unknown;
}

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(line);
  } else if (entry.level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(ctx: string) {
  return {
    info(msg: string, extra?: Record<string, unknown>) {
      emit({ level: 'info', msg, ts: new Date().toISOString(), ctx, ...extra });
    },
    warn(msg: string, extra?: Record<string, unknown>) {
      emit({ level: 'warn', msg, ts: new Date().toISOString(), ctx, ...extra });
    },
    error(msg: string, extra?: Record<string, unknown>) {
      emit({ level: 'error', msg, ts: new Date().toISOString(), ctx, ...extra });
    },
  };
}
