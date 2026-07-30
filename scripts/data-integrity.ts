/**
 * Canonical dataset integrity checks.
 *
 * Never generate, synthesize, mock, or fabricate /data. If files are missing
 * or a sha256 mismatches data_manifest.json, abort — SPEC.md numbers are only
 * meaningful against the canonical files.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type ManifestFile = { sha256: string; rows: number };

export type DataManifest = {
  note?: string;
  files: Record<string, ManifestFile>;
  content_assertions: Record<string, number>;
};

export const ROOT = path.resolve(__dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");
export const MANIFEST_PATH = path.join(ROOT, "data_manifest.json");

export function loadManifest(manifestPath: string = MANIFEST_PATH): DataManifest {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing data_manifest.json at ${manifestPath}. Cannot seed without the canonical manifest.`,
    );
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as DataManifest;
}

export function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export type HashCheck = {
  file: string;
  expected: string;
  actual: string | null;
  ok: boolean;
  error?: string;
};

/**
 * Verify every file in the manifest by sha256. Does not load into SQLite.
 * Returns per-file results; throws nothing — callers decide whether to abort.
 */
export function verifyCanonicalHashes(
  manifest: DataManifest = loadManifest(),
  dataDir: string = DATA_DIR,
): HashCheck[] {
  if (!fs.existsSync(dataDir)) {
    return Object.keys(manifest.files).map((file) => ({
      file,
      expected: manifest.files[file].sha256,
      actual: null,
      ok: false,
      error: `data directory missing: ${dataDir}`,
    }));
  }

  return Object.entries(manifest.files).map(([file, meta]) => {
    const full = path.join(dataDir, file);
    if (!fs.existsSync(full)) {
      return {
        file,
        expected: meta.sha256,
        actual: null,
        ok: false,
        error: `file missing: ${full}`,
      };
    }
    const actual = sha256File(full);
    return {
      file,
      expected: meta.sha256,
      actual,
      ok: actual === meta.sha256,
      error:
        actual === meta.sha256
          ? undefined
          : `sha256 mismatch for ${file}: expected ${meta.sha256}, got ${actual}`,
    };
  });
}

/** Abort with a named-file message on any hash failure. */
export function assertCanonicalHashes(
  manifest: DataManifest = loadManifest(),
  dataDir: string = DATA_DIR,
): HashCheck[] {
  const checks = verifyCanonicalHashes(manifest, dataDir);
  const failures = checks.filter((c) => !c.ok);
  if (failures.length > 0) {
    const lines = failures.map(
      (f) =>
        f.error ??
        `sha256 mismatch for ${f.file}: expected ${f.expected}, got ${f.actual}`,
    );
    throw new Error(
      `Canonical dataset verification FAILED. Do not regenerate. Stop and report.\n` +
        lines.join("\n"),
    );
  }
  return checks;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
