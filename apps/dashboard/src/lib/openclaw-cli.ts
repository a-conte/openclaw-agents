import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

type OpenClawExecOptions = {
  timeout?: number;
  cwd?: string;
};

function getOpenClawBinary() {
  return process.env.OPENCLAW_BIN?.trim() || 'openclaw';
}

function getRemoteOpenClawBinary() {
  return process.env.OPENCLAW_REMOTE_BIN?.trim() || getOpenClawBinary();
}

function getRemotePath() {
  return process.env.OPENCLAW_REMOTE_PATH?.trim() || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
}

function getCleanEnv() {
  const { OPENCLAW_AGENTS: _a, OPENCLAW_HOME: _h, ...cleanEnv } = process.env;
  return cleanEnv;
}

function getSshArgs(target: string, args: string[]) {
  const command = [getRemoteOpenClawBinary(), ...args]
    .map((arg) => `'${arg.replace(/'/g, `'\"'\"'`)}'`)
    .join(' ');

  const remoteCommand = `PATH='${getRemotePath()}'; export PATH; ${command}`;
  return [target, remoteCommand];
}

export async function runOpenClaw(args: string[], options: OpenClawExecOptions = {}) {
  const env = getCleanEnv();
  const sshTarget = process.env.OPENCLAW_SSH_TARGET?.trim();

  if (sshTarget) {
  return execFileAsync('ssh', getSshArgs(sshTarget, args), {
      timeout: options.timeout ?? 60_000,
      encoding: 'utf-8',
      env,
      cwd: options.cwd,
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  return execFileAsync(getOpenClawBinary(), args, {
    timeout: options.timeout ?? 60_000,
    encoding: 'utf-8',
    env,
    cwd: options.cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
}

export async function runOpenClawJson<T>(args: string[], options: OpenClawExecOptions = {}): Promise<T> {
  const { stdout } = await runOpenClaw(args, options);
  return JSON.parse(stdout) as T;
}
