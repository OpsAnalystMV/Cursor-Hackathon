import fs from "node:fs";
import path from "node:path";
import { AppShell } from "../components/AppShell";
import { formatMoney } from "@/lib/format";

type FixturesShape = {
  population: {
    asOf: string;
    n: number;
    medianBalance: number;
    medianCommitted30: number;
    medianFreeBalance30: number;
    countFreeBalanceNegative: number;
    countFreeNegativeWithPositiveBalance: number;
    medianDayRate: number;
    medianFloorDayNet: number;
    countFloorBelowDayRate: number;
    medianCommittedShareOfIncomePct: number;
    p90CommittedShareOfIncomePct: number;
    countCommittedShareOver60Pct: number;
  };
  negativeResult: {
    note: string;
    eligibleAdvances: number;
    excludedForInsufficientHistory: number;
    paceDeficitRecallPct: number;
    paceDeficitControlPct: number;
    paceDeficitLift: number;
    freeBalanceRecallPct: number;
    freeBalanceControlPct: number;
    freeBalanceLift: number;
    freeNegativeAmongBorrowersPct: number;
    freeNegativeAmongNonBorrowersPct: number;
    crossSectionLift: number;
    conclusion: string;
  };
  coverage?: {
    workerDatesSampled?: number;
    shareAnyCondition?: number;
    shareWorkersEverTriggered?: number;
    note?: string;
  };
};

function loadFixtures(): FixturesShape {
  const p = path.join(process.cwd(), "fixtures.json");
  return JSON.parse(fs.readFileSync(p, "utf8")) as FixturesShape;
}

export default function ProofPage() {
  const fixtures = loadFixtures();
  const nr = fixtures.negativeResult;
  const pop = fixtures.population;
  const coverage = fixtures.coverage;

  return (
    <AppShell showPickers={false}>
      <article aria-label="Why it works this way" className="space-y-8">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[1.85rem] leading-snug tracking-tight text-[var(--ink)]">
            Why it works this way
          </h1>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-[var(--ink)]">
            Balance-based and cashflow-based prediction do not work for this
            user, so Pace shows what is already true instead.
          </p>
        </div>

        <section className="space-y-3 border-t border-[var(--line)] pt-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            The negative result
          </h2>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            {nr.note} Tested against {nr.eligibleAdvances} eligible advances (
            {nr.excludedForInsufficientHistory} excluded for insufficient
            history).
          </p>

          <div className="space-y-4 text-sm leading-relaxed">
            <div>
              <p className="font-semibold text-[var(--ink)]">
                Pace-deficit detector
              </p>
              <p className="text-[var(--muted)]">
                Recall {nr.paceDeficitRecallPct}% vs control{" "}
                {nr.paceDeficitControlPct}% — lift{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {nr.paceDeficitLift}×
                </span>
                .
              </p>
            </div>
            <div>
              <p className="font-semibold text-[var(--ink)]">
                Free-balance detector
              </p>
              <p className="text-[var(--muted)]">
                Recall {nr.freeBalanceRecallPct}% vs control{" "}
                {nr.freeBalanceControlPct}% — lift{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {nr.freeBalanceLift}×
                </span>
                .
              </p>
            </div>
            <div>
              <p className="font-semibold text-[var(--ink)]">
                Cross-section (inverted)
              </p>
              <p className="text-[var(--muted)]">
                Negative free balance among borrowers{" "}
                {nr.freeNegativeAmongBorrowersPct}% vs non-borrowers{" "}
                {nr.freeNegativeAmongNonBorrowersPct}% — lift{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {nr.crossSectionLift}×
                </span>
                . Negative free balance is <em>less</em> common among borrowers.
              </p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-[var(--ink)]">
            {nr.conclusion}
          </p>
        </section>

        <section className="space-y-3 border-t border-[var(--line)] pt-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            What is already true
          </h2>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Population as of {pop.asOf}, n = {pop.n}.
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-[var(--ink)]">
            <li>
              <span className="font-semibold">
                {pop.countFreeNegativeWithPositiveBalance}
              </span>{" "}
              of {pop.n} hold a positive balance and a negative free balance at
              once — the number budgeting apps hide.
            </li>
            <li>
              <span className="font-semibold">
                {pop.countFloorBelowDayRate}
              </span>{" "}
              have a p20 day below their own day rate — a bad shift does not
              cover its share of the bills.
            </li>
            <li>
              Median committed share of income{" "}
              <span className="font-semibold">
                {pop.medianCommittedShareOfIncomePct}%
              </span>
              ; p90 is{" "}
              <span className="font-semibold">
                {pop.p90CommittedShareOfIncomePct}%
              </span>
              .
            </li>
            <li>
              Median free balance {formatMoney(pop.medianFreeBalance30)};{" "}
              {pop.countFreeBalanceNegative} workers are negative on that
              measure.
            </li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-[var(--line)] pt-5">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Honesty about coverage
          </h2>
          {coverage ? (
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {coverage.note ??
                "Most workers are fine on most days."}
              {coverage.shareAnyCondition != null && (
                <>
                  {" "}
                  Conditions fire on roughly{" "}
                  {Math.round(coverage.shareAnyCondition * 100)}% of sampled
                  worker-dates
                </>
              )}
              {coverage.shareWorkersEverTriggered != null && (
                <>
                  ; about{" "}
                  {Math.round(coverage.shareWorkersEverTriggered * 100)}% of
                  workers trigger at least one at least once
                </>
              )}
              .
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Most workers are fine on most days.{" "}
              {pop.countFreeBalanceNegative} of {pop.n} show a negative free
              balance on the snapshot date — a minority, not everyone. A picker
              that implies every worker is in trouble is the same overreach as
              the predictive model.
            </p>
          )}
        </section>
      </article>
    </AppShell>
  );
}
