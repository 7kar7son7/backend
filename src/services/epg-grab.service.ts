import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';

import { env } from '../config/env';

/**
 * Wykonuje komendę używając spawn z shell: true
 * Node.js automatycznie znajdzie dostępny shell w systemie
 */
function spawnAsync(
  command: string,
  options: { cwd: string }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Użyj spawn z shell: true - Node.js automatycznie znajdzie dostępny shell
    // W Alpine będzie to /bin/ash, w innych systemach /bin/sh lub /bin/bash
    // Gdy shell: true, command jest wykonywany jako string w shellu
    const child = spawn(command, [], {
      cwd: options.cwd,
      shell: true, // Node.js automatycznie wybierze dostępny shell
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error: Error) => {
      reject(error);
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`));
      }
    });
  });
}

export async function runConfiguredGrab(logger: FastifyBaseLogger) {
  const enabled = env.EPG_GRAB_ENABLED ?? false;
  if (!enabled) {
    return false;
  }

  const command = env.EPG_GRAB_COMMAND ?? 'npm run grab --- --site=tvprofil.com --lang=pl --output guide.xml --maxConnections=5';
  const workingDir = resolve(process.cwd(), env.EPG_GRAB_WORKDIR ?? '../epg-source');

  logger.info({ command, cwd: workingDir }, '🔄 Aktualizuję feed EPG (grab).');

  try {
    const { stdout, stderr } = await spawnAsync(command, {
      cwd: workingDir,
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
    logger.error({ err: error }, '❌ Nie udało się uruchomić komendy grab.');
    throw error;
  }
}
