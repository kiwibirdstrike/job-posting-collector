import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type JobCollectionRunStatus = "running" | "completed" | "failed";

export type JobCollectionRunLog = {
  id: string;
  at: string;
  message: string;
};

export type JobCollectionRunSnapshot = {
  id: string;
  status: JobCollectionRunStatus;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  logs: JobCollectionRunLog[];
};

const maxLogsPerRun = 200;
export const jobCollectionCooldownMs = 12 * 60 * 60 * 1000;
const runDirectory = join(process.cwd(), ".runtime", "job-collection-runs");
const legacyRunDirectory = join(process.cwd(), ".next", "cache", "job-collection-runs");

type RunStorageOptions = {
  directory?: string;
  now?: Date;
};

function nowIso(now = new Date()): string {
  return now.toISOString();
}

function createLog(message: string, now = new Date()): JobCollectionRunLog {
  return {
    id: randomUUID(),
    at: nowIso(now),
    message
  };
}

function storageDirectories(directory?: string): string[] {
  return directory ? [directory] : [runDirectory, legacyRunDirectory];
}

function runPath(directory: string, id: string): string {
  return join(directory, `${id}.json`);
}

function saveRun(run: JobCollectionRunSnapshot, directory = runDirectory): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(runPath(directory, run.id), JSON.stringify(run), "utf8");
}

function readRunFromDirectory(id: string, directory: string): JobCollectionRunSnapshot | null {
  try {
    return JSON.parse(readFileSync(runPath(directory, id), "utf8")) as JobCollectionRunSnapshot;
  } catch {
    return null;
  }
}

function findRun(id: string, directory?: string): {
  run: JobCollectionRunSnapshot;
  directory: string;
} | null {
  for (const candidateDirectory of storageDirectories(directory)) {
    const run = readRunFromDirectory(id, candidateDirectory);
    if (run) return { run, directory: candidateDirectory };
  }
  return null;
}

export function startJobCollectionRun(options: RunStorageOptions = {}): JobCollectionRunSnapshot {
  const now = options.now ?? new Date();
  const id = randomUUID();
  const run: JobCollectionRunSnapshot = {
    id,
    status: "running",
    startedAt: nowIso(now),
    finishedAt: null,
    summary: null,
    logs: [createLog("자동 수집을 시작했습니다.", now)]
  };
  saveRun(run, options.directory);
  return run;
}

export function appendJobCollectionRunLog(
  id: string,
  message: string,
  options: RunStorageOptions = {}
): JobCollectionRunSnapshot | null {
  const found = findRun(id, options.directory);
  if (!found) return null;

  found.run.logs = [
    ...found.run.logs,
    createLog(message, options.now)
  ].slice(-maxLogsPerRun);
  saveRun(found.run, found.directory);
  return found.run;
}

export function finishJobCollectionRun(
  id: string,
  status: Exclude<JobCollectionRunStatus, "running">,
  summary: string,
  options: RunStorageOptions = {}
): JobCollectionRunSnapshot | null {
  const found = findRun(id, options.directory);
  if (!found) return null;

  found.run.status = status;
  found.run.finishedAt = nowIso(options.now);
  found.run.summary = summary;
  found.run.logs = [
    ...found.run.logs,
    createLog(summary, options.now)
  ].slice(-maxLogsPerRun);
  saveRun(found.run, found.directory);
  return found.run;
}

export function getJobCollectionRun(
  id: string,
  options: Pick<RunStorageOptions, "directory"> = {}
): JobCollectionRunSnapshot | null {
  return findRun(id, options.directory)?.run ?? null;
}

export function findRecentJobCollectionRun(
  options: RunStorageOptions & { cooldownMs?: number } = {}
): JobCollectionRunSnapshot | null {
  const now = options.now ?? new Date();
  const cooldownMs = options.cooldownMs ?? jobCollectionCooldownMs;
  let latest: JobCollectionRunSnapshot | null = null;

  for (const directory of storageDirectories(options.directory)) {
    let filenames: string[] = [];
    try {
      filenames = readdirSync(directory).filter((filename) => filename.endsWith(".json"));
    } catch {
      continue;
    }

    for (const filename of filenames) {
      const run = readRunFromDirectory(filename.slice(0, -5), directory);
      if (!run) continue;
      if (!latest || Date.parse(run.startedAt) > Date.parse(latest.startedAt)) {
        latest = run;
      }
    }
  }

  if (!latest) return null;
  const elapsed = now.getTime() - Date.parse(latest.startedAt);
  return elapsed >= 0 && elapsed < cooldownMs ? latest : null;
}
