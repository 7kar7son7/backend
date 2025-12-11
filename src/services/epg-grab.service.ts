import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';

import { env } from '../config/env';

const execAsync = promisify(exec);

export async function runConfiguredGrab(logger: FastifyBaseLogger) {
  const enabled = env.EPG_GRAB_ENABLED ?? false;
  if (!enabled) {
    return false;
  }

  const command = env.EPG_GRAB_COMMAND ?? 'npm run grab --- --site=tvprofil.com --lang=pl --output guide.xml --maxConnections=5';
  const workingDir = resolve(process.cwd(), env.EPG_GRAB_WORKDIR ?? '../epg-source');

  logger.info({ command, cwd: workingDir }, '🔄 Aktualizuję feed EPG (grab).');

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      maxBuffer: 1024 * 1024 * 20,
    });

    if (stdout.trim().length > 0) {
      logger.info({ stdout }, '📄 Wynik komendy grab (stdout)');
    }
    if (stderr.trim().length > 0) {
      logger.warn({ stderr }, '⚠️ Wynik komendy grab (stderr)');
    }

    logger.info('✅ Feed EPG został odświeżony.');
    return true;
  } catch (error) {
    logger.error({ err: error }, '❌ Nie udało się uruchomić komendy grab.' );
    throw error;
  }
}
