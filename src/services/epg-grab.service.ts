import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import type { ExecOptions } from 'node:child_process';

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
    // Użyj shell: true żeby Node.js automatycznie wybrał dostępny shell
    // W Alpine może być /bin/ash, w innych systemach /bin/sh lub /bin/bash
    // TypeScript wymusza string, ale true działa lepiej - używamy as any
    const options: any = {
      cwd: workingDir,
      maxBuffer: 1024 * 1024 * 20,
      shell: true, // Node.js automatycznie wybierze dostępny shell
    };
    const { stdout, stderr } = await execAsync(command, options);

    const stdoutStr = typeof stdout === 'string' ? stdout : String(stdout);
    const stderrStr = typeof stderr === 'string' ? stderr : String(stderr);

    if (stdoutStr.trim().length > 0) {
      logger.info({ stdout: stdoutStr }, '📄 Wynik komendy grab (stdout)');
    }
    if (stderrStr.trim().length > 0) {
      logger.warn({ stderr: stderrStr }, '⚠️ Wynik komendy grab (stderr)');
    }

    logger.info('✅ Feed EPG został odświeżony.');
    return true;
  } catch (error) {
    logger.error({ err: error }, '❌ Nie udało się uruchomić komendy grab.' );
    throw error;
  }
}
