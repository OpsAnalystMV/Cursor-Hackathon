import { describe, expect, it } from "vitest";
import {
  loadManifest,
  verifyCanonicalHashes,
} from "./data-integrity";

describe("canonical /data integrity", () => {
  it("data_manifest.json lists all six CSVs with sha256 + rows", () => {
    const manifest = loadManifest();
    const expected = [
      "workers.csv",
      "daily_earnings.csv",
      "recurring_obligations.csv",
      "transactions.csv",
      "earned_wage_advances.csv",
      "weekly_cashflow_summary.csv",
    ];
    expect(Object.keys(manifest.files).sort()).toEqual([...expected].sort());
    for (const file of expected) {
      expect(manifest.files[file].sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.files[file].rows).toBeGreaterThan(0);
    }
    expect(Object.keys(manifest.content_assertions).length).toBeGreaterThan(0);
  });

  it("every /data CSV sha256 matches data_manifest.json", () => {
    const manifest = loadManifest();
    const checks = verifyCanonicalHashes(manifest);

    for (const check of checks) {
      expect(check.ok, check.error ?? `${check.file} hash mismatch`).toBe(true);
      expect(check.actual).toBe(check.expected);
    }
  });
});
