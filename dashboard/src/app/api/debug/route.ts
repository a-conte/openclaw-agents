import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const home = process.env.HOME;
  const cwd = process.cwd();
  const openclawHome = process.env.OPENCLAW_HOME || `${home}/.openclaw`;
  const configPath = path.join(openclawHome, 'openclaw.json');
  const configExists = existsSync(configPath);

  const parentDir = path.resolve(cwd, '..');
  const parentHasMain = existsSync(path.join(parentDir, 'main'));
  const parentHasDashboard = existsSync(path.join(parentDir, 'dashboard'));

  const defaultAgentsDir = `${home}/openclaw-agents`;
  const defaultExists = existsSync(defaultAgentsDir);

  return NextResponse.json({
    home,
    cwd,
    openclawHome,
    configPath,
    configExists,
    parentDir,
    parentHasMain,
    parentHasDashboard,
    defaultAgentsDir,
    defaultExists,
    resolvedAgentsRoot: parentHasMain || parentHasDashboard ? parentDir : defaultAgentsDir,
  });
}
