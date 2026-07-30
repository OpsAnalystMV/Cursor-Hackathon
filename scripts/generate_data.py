#!/usr/bin/env python3
"""
Generate the six Pace CSVs under /data to the Section 3 contract.

The starter repo shipped without CSVs; this synthesizes a dataset that matches
exact row counts and the W-0001 facts pinned in SPEC §7. Other workers are
plausible Alberta daily/gig earners sized to the aggregate stats in §1/§3.
"""

from __future__ import annotations

import csv
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RNG = random.Random(20260401)

CITIES = [
    ("Calgary", "AB"),
    ("Edmonton", "AB"),
    ("Red Deer", "AB"),
    ("Lethbridge", "AB"),
    ("Medicine Hat", "AB"),
    ("Fort McMurray", "AB"),
    ("Grande Prairie", "AB"),
]
OCCUPATIONS = [
    "moving helper",
    "warehouse associate",
    "delivery driver",
    "restaurant cook",
    "barista",
    "retail associate",
    "cleaner",
    "construction labourer",
    "rideshare driver",
    "care aide",
    "landscaper",
    "security guard",
]
PAY_TYPES = ["hourly", "daily", "gig"]
RENT_BANDS = ["low", "moderate", "high", "severe"]
SHIFT_TYPES = ["day", "evening", "night", "split"]
CATEGORIES = [
    "housing",
    "utilities",
    "phone",
    "childcare",
    "debt_payment",
    "entertainment",
]
TXN_CATEGORIES = [
    "groceries",
    "transport",
    "food",
    "housing",
    "utilities",
    "phone",
    "entertainment",
    "health",
    "clothing",
    "other",
]
MERCHANT_TYPES = [
    "grocery",
    "gas",
    "restaurant",
    "landlord",
    "utility",
    "telecom",
    "streaming",
    "retail",
    "atm",
    "transfer",
]
CHANNELS = ["debit_card", "credit_card", "eft", "cash", "prepaid"]
REASON_CODES = [
    "bill_due",
    "shortfall",
    "emergency",
    "transport",
    "groceries",
    "other",
]

START = date(2026, 4, 1)
END_EARN = date(2026, 6, 30)
END_TXN = date(2026, 7, 5)


def daterange(a: date, b: date):
    d = a
    while d <= b:
        yield d
        d += timedelta(days=1)


def iso(d: date | datetime) -> str:
    if isinstance(d, datetime):
        return d.strftime("%Y-%m-%dT%H:%M:%S")
    return d.isoformat()


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            out = {k: ("" if row.get(k) is None else row[k]) for k in fieldnames}
            w.writerow(out)


def worker_id(i: int) -> str:
    return f"W-{i:04d}"


def build_workers() -> list[dict]:
    workers: list[dict] = []
    # W-0001 — exact persona from SPEC §7
    workers.append(
        {
            "worker_id": "W-0001",
            "city": "Calgary",
            "province": "AB",
            "occupation": "moving helper",
            "pay_type": "daily",
            "typical_daily_net_cad": 185.0,
            "income_volatility": 0.48,
            "tip_share": 0.0,
            "household_size": 2,
            "dependents": 1,
            "has_bank_account": 1,
            "uses_prepaid_card": 0,
            "primary_employer_id": "E-0001",
            "tenure_months": 14,
            "has_side_gig": 0,
            "commute_mode": "transit",
            "rent_burden_band": "severe",
        }
    )
    for i in range(2, 221):
        city, province = RNG.choice(CITIES)
        pay_type = RNG.choices(PAY_TYPES, weights=[0.45, 0.35, 0.20])[0]
        typical = {
            "hourly": RNG.uniform(140, 210),
            "daily": RNG.uniform(150, 230),
            "gig": RNG.uniform(110, 200),
        }[pay_type]
        band = RNG.choices(RENT_BANDS, weights=[0.15, 0.30, 0.30, 0.25])[0]
        workers.append(
            {
                "worker_id": worker_id(i),
                "city": city,
                "province": province,
                "occupation": RNG.choice(OCCUPATIONS),
                "pay_type": pay_type,
                "typical_daily_net_cad": round(typical, 2),
                "income_volatility": round(RNG.uniform(0.10, 0.60), 2),
                "tip_share": round(RNG.uniform(0.0, 0.25) if pay_type != "daily" else RNG.uniform(0.0, 0.05), 2),
                "household_size": RNG.randint(1, 5),
                "dependents": RNG.randint(0, 3),
                "has_bank_account": 1 if RNG.random() < 0.92 else 0,
                "uses_prepaid_card": 1 if RNG.random() < 0.18 else 0,
                "primary_employer_id": f"E-{RNG.randint(1, 40):04d}",
                "tenure_months": RNG.randint(1, 84),
                "has_side_gig": 1 if RNG.random() < 0.22 else 0,
                "commute_mode": RNG.choice(["car", "transit", "walk", "bike", "rideshare"]),
                "rent_burden_band": band,
            }
        )
    assert len(workers) == 220
    return workers


def w0001_april_dates() -> list[date]:
    # SPEC §7 April work pattern
    days = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 21, 23, 24, 26, 27, 30]
    return [date(2026, 4, d) for d in days]


def w0001_may_june_dates(n_needed: int) -> list[date]:
    """Fill remaining shifts after April to hit 48 total across 91 days."""
    candidates = [d for d in daterange(date(2026, 5, 1), END_EARN) if d.weekday() != 6]
    # Sundays as occasional overtime if we still need slots
    sundays = [d for d in daterange(date(2026, 5, 1), END_EARN) if d.weekday() == 6]
    # Cadence: take roughly every other weekday → ~30–32 days in May+Jun
    picked: list[date] = []
    i = 0
    while len(picked) < n_needed and i < len(candidates):
        picked.append(candidates[i])
        i += 2 if len(picked) % 3 else 1
    leftover = [d for d in candidates if d not in picked] + sundays
    while len(picked) < n_needed and leftover:
        picked.append(leftover.pop(0))
    if len(picked) < n_needed:
        raise RuntimeError(f"Could not allocate {n_needed} May/Jun shifts for W-0001")
    return sorted(picked)[:n_needed]


def make_shift(
    earnings_id: str,
    wid: str,
    work_date: date,
    employer_id: str,
    typical: float,
    volatility: float,
    tip_share: float,
    force_net: float | None = None,
) -> dict:
    hours = round(RNG.uniform(5.0, 9.5), 1)
    if force_net is not None:
        net = round(force_net, 2)
        tips = round(net * tip_share, 2)
        deductions = round(RNG.uniform(8, 22), 2)
        gross = round(net - tips + deductions, 2)
    else:
        base = typical * (1 + RNG.gauss(0, volatility * 0.35))
        base = max(60.0, min(280.0, base))
        tips = round(base * tip_share * RNG.uniform(0.5, 1.4), 2)
        deductions = round(RNG.uniform(8, 25), 2)
        gross = round(base + tips * 0.3, 2)
        net = round(gross + tips - deductions, 2)
        # re-derive consistency
        tips = round(max(0.0, tips), 2)
        net = round(gross + tips - deductions, 2)
    return {
        "earnings_id": earnings_id,
        "worker_id": wid,
        "work_date": iso(work_date),
        "employer_id": employer_id,
        "shift_type": RNG.choices(SHIFT_TYPES, weights=[0.55, 0.25, 0.12, 0.08])[0],
        "hours_worked": hours,
        "gross_pay_cad": gross,
        "tips_cad": tips,
        "deductions_cad": deductions,
        "net_pay_cad": net,
        "paid_same_day": 1 if RNG.random() < 0.40 else 0,
        "pay_method": RNG.choice(["direct_deposit", "payroll_card", "cash", "cheque"]),
    }


def build_earnings(workers: list[dict]) -> list[dict]:
    rows: list[dict] = []
    eid = 1

    # W-0001: exactly 48 shifts; nets tuned so p20 ≈ 147 and mean ≈ 185
    w1 = workers[0]
    april = w0001_april_dates()
    rest = w0001_may_june_dates(48 - len(april))
    w1_dates = april + rest
    assert len(w1_dates) == 48

    # Build a net distribution: p20 ≈ 147, mean ~185, max day 236
    # 48 values: roughly sorted then shuffled onto dates
    nets: list[float] = []
    # 20th percentile of 48 → index ~9 (0-based) ≈ 147
    for i in range(48):
        if i < 10:
            nets.append(round(RNG.uniform(130, 155), 2))
        elif i < 35:
            nets.append(round(RNG.uniform(160, 205), 2))
        else:
            nets.append(round(RNG.uniform(205, 230), 2))
    nets[0] = 147.0
    nets[1] = 145.0
    nets[2] = 142.0
    nets[3] = 140.0
    nets[4] = 138.0
    nets[5] = 148.0
    nets[6] = 150.0
    nets[7] = 151.0
    nets[8] = 146.0
    nets[9] = 149.0
    nets[-1] = 236.0  # best day
    # Force mean near 185 so monthly ~2953 for ~16 work days
    target_mean = 185.0
    cur_mean = sum(nets) / len(nets)
    scale = target_mean / cur_mean
    nets = [round(min(236.0, max(120.0, n * scale)), 2) for n in nets]
    nets[nets.index(max(nets))] = 236.0
    # Re-pin p20 neighborhood after scale
    sorted_idx = sorted(range(48), key=lambda i: nets[i])
    for rank, idx in enumerate(sorted_idx[:10]):
        nets[idx] = round(135 + rank * 1.5 + RNG.uniform(0, 1), 2)
    # Ensure p20 (index 9 of sorted) ≈ 147
    ordered = sorted(nets)
    # Replace the 10th value (0-indexed 9) path by adjusting lowest cluster
    for j, idx in enumerate(sorted(range(48), key=lambda i: nets[i])[:10]):
        nets[idx] = round(138 + j * 1.2, 2)
    # Set exact p20: after sort, index 9
    low_idxs = sorted(range(48), key=lambda i: nets[i])[:10]
    for j, idx in enumerate(low_idxs):
        nets[idx] = [138.0, 140.0, 141.0, 142.0, 143.0, 144.0, 145.0, 146.0, 146.5, 147.0][j]
    # Keep max 236
    hi = max(range(48), key=lambda i: nets[i] if i not in low_idxs else -1)
    # put 236 on a non-low day
    for i in range(48):
        if i not in low_idxs:
            nets[i] = nets[i]
    nets[max(range(48), key=lambda i: 0 if i in set(low_idxs) else nets[i])] = 236.0

    RNG.shuffle(nets)
    # Ensure 236 exists
    if 236.0 not in nets:
        nets[nets.index(max(nets))] = 236.0

    for d, net in zip(w1_dates, nets):
        rows.append(
            make_shift(
                f"EARN-{eid:05d}",
                "W-0001",
                d,
                w1["primary_employer_id"],
                w1["typical_daily_net_cad"],
                w1["income_volatility"],
                w1["tip_share"],
                force_net=net,
            )
        )
        eid += 1

    # Remaining 12204 - 48 = 12156 shifts across 219 workers
    remaining = 12204 - 48
    # Distribute with slight variance; mean ~55.5 shifts / worker over 91 days
    quotas = []
    base = remaining // 219
    extra = remaining % 219
    for i in range(219):
        q = base + (1 if i < extra else 0)
        # jitter but keep sum
        quotas.append(q)

    # Adjust sum exactly
    assert sum(quotas) == remaining

    all_days = list(daterange(START, END_EARN))
    for wi, w in enumerate(workers[1:]):
        n = quotas[wi]
        # Sample work days biased to weekdays
        weights = [0.15 if d.weekday() == 6 else (0.7 if d.weekday() < 5 else 0.4) for d in all_days]
        # Without replacement weighted sample
        chosen: list[date] = []
        pool = all_days[:]
        wts = weights[:]
        for _ in range(n):
            total = sum(wts)
            r = RNG.random() * total
            acc = 0.0
            pick = 0
            for j, wt in enumerate(wts):
                acc += wt
                if acc >= r:
                    pick = j
                    break
            chosen.append(pool.pop(pick))
            wts.pop(pick)
        for d in sorted(chosen):
            rows.append(
                make_shift(
                    f"EARN-{eid:05d}",
                    w["worker_id"],
                    d,
                    w["primary_employer_id"],
                    w["typical_daily_net_cad"],
                    w["income_volatility"],
                    w["tip_share"],
                )
            )
            eid += 1

    assert len(rows) == 12204, len(rows)
    return rows


def build_obligations(workers: list[dict]) -> list[dict]:
    rows: list[dict] = []
    oid = 1

    # W-0001 exact obligations → sum 2285.99 ≈ 2286
    w1_obs = [
        ("Rent", "housing", 2056.0, "monthly", 1, 1, 1),
        ("Mobile phone", "phone", 66.0, "monthly", 1, 1, 1),
        ("Utilities", "utilities", 154.0, "monthly", 5, 1, 1),
        ("Streaming", "entertainment", 9.99, "monthly", 22, 1, 0),
    ]
    for name, cat, amt, freq, due, autopay, essential in w1_obs:
        rows.append(
            {
                "obligation_id": f"O-{oid:05d}",
                "worker_id": "W-0001",
                "name": name,
                "category": cat,
                "amount_cad": amt,
                "frequency": freq,
                "due_day_of_month": due,
                "autopay": autopay,
                "essential": essential,
            }
        )
        oid += 1

    # Need 849 total: 811 monthly, 38 biweekly
    # Already 4 monthly for W-0001 → 807 monthly + 38 biweekly across others = 845 more
    monthly_left = 811 - 4
    biweekly_left = 38
    assert monthly_left + biweekly_left == 845

    # ~3.85 more obligations per remaining worker on average
    other = workers[1:]
    # Assign biweekly to 38 distinct workers first
    biweekly_workers = RNG.sample(other, biweekly_left)
    biweekly_set = {w["worker_id"] for w in biweekly_workers}

    templates = [
        ("Rent", "housing", (900, 2200), 1, True),
        ("Utilities", "utilities", (80, 220), 5, True),
        ("Mobile phone", "phone", (40, 95), 1, True),
        ("Internet", "utilities", (60, 120), 15, True),
        ("Childcare", "childcare", (400, 1200), 1, True),
        ("Car payment", "debt_payment", (250, 550), 15, True),
        ("Credit card min", "debt_payment", (35, 150), 20, True),
        ("Streaming", "entertainment", (9.99, 24.99), 22, False),
        ("Gym", "entertainment", (20, 45), 8, False),
        ("Storage unit", "housing", (60, 140), 10, False),
    ]

    # Give each other worker ~3-4 monthly obligations
    monthly_pool: list[tuple[dict, tuple]] = []
    for w in other:
        k = RNG.randint(3, 5)
        picks = RNG.sample(templates, k=min(k, len(templates)))
        for t in picks:
            monthly_pool.append((w, t))

    RNG.shuffle(monthly_pool)
    # Trim/pad to exact monthly_left
    if len(monthly_pool) > monthly_left:
        monthly_pool = monthly_pool[:monthly_left]
    while len(monthly_pool) < monthly_left:
        w = RNG.choice(other)
        t = RNG.choice(templates)
        monthly_pool.append((w, t))

    for w, (name, cat, (lo, hi), due, essential_default) in monthly_pool:
        amt = round(RNG.uniform(lo, hi), 2)
        rows.append(
            {
                "obligation_id": f"O-{oid:05d}",
                "worker_id": w["worker_id"],
                "name": name,
                "category": cat,
                "amount_cad": amt,
                "frequency": "monthly",
                "due_day_of_month": due if due <= 28 else 28,
                "autopay": 1 if RNG.random() < 0.44 else 0,
                "essential": 1 if (essential_default and RNG.random() < 0.95) else (1 if RNG.random() < 0.5 else 0),
            }
        )
        oid += 1

    # 38 biweekly
    biweekly_names = [
        ("Support payment", "debt_payment", (150, 400)),
        ("Transit pass", "utilities", (50, 120)),
        ("Payday loan installment", "debt_payment", (80, 200)),
        ("Insurance premium", "utilities", (40, 110)),
    ]
    for w in biweekly_workers:
        name, cat, (lo, hi) = RNG.choice(biweekly_names)
        rows.append(
            {
                "obligation_id": f"O-{oid:05d}",
                "worker_id": w["worker_id"],
                "name": name,
                "category": cat,
                "amount_cad": round(RNG.uniform(lo, hi), 2),
                "frequency": "biweekly",
                "due_day_of_month": RNG.randint(1, 28),
                "autopay": 1 if RNG.random() < 0.44 else 0,
                "essential": 1 if RNG.random() < 0.90 else 0,
            }
        )
        oid += 1

    assert len(rows) == 849, len(rows)
    assert sum(1 for r in rows if r["frequency"] == "monthly") == 811
    assert sum(1 for r in rows if r["frequency"] == "biweekly") == 38
    return rows


def build_advances(workers: list[dict]) -> list[dict]:
    rows: list[dict] = []
    aid = 1

    # W-0001 real advances from SPEC §7
    w1_advances = [
        (datetime(2026, 4, 13, 18, 22, 0), 34.59, "shortfall"),
        (datetime(2026, 4, 27, 20, 53, 0), 71.34, "bill_due"),
        (datetime(2026, 4, 30, 19, 10, 0), 117.03, "bill_due"),
    ]
    for ts, amt, reason in w1_advances:
        fee = round(max(1.99, 0.0425 * amt), 2)
        rows.append(
            {
                "advance_id": f"A-{aid:05d}",
                "worker_id": "W-0001",
                "requested_at": iso(ts),
                "amount_cad": amt,
                "fee_cad": fee,
                "status": "repaid",
                "repaid_at": iso(ts + timedelta(days=RNG.randint(3, 12))),
                "repayment_source": "payroll",
                "reason_code": reason,
            }
        )
        aid += 1

    # Remaining to 535 including 15 cancelled
    need = 535 - 3
    cancelled_budget = 15
    # Spread across workers with higher rent burden more likely
    weights = []
    for w in workers:
        band_w = {"low": 0.5, "moderate": 1.0, "high": 1.6, "severe": 2.2}[w["rent_burden_band"]]
        weights.append(band_w)

    # Exclude W-0001 from random advances — SPEC §7 pins exactly three
    other_workers = workers[1:]
    other_weights = weights[1:]
    for _ in range(need):
        total = sum(other_weights)
        r = RNG.random() * total
        acc = 0.0
        wi = 0
        for j, wt in enumerate(other_weights):
            acc += wt
            if acc >= r:
                wi = j
                break
        w = other_workers[wi]
        day = START + timedelta(days=RNG.randint(0, (END_TXN - START).days))
        hour = RNG.randint(7, 22)
        minute = RNG.randint(0, 59)
        ts = datetime(day.year, day.month, day.day, hour, minute, 0)
        # Median advance ~3.3 hours work → ~$50–80; 93% under 6 hours
        amt = round(min(250.0, max(20.0, RNG.lognormvariate(math.log(55), 0.45))), 2)
        fee = round(max(1.99, 0.0425 * amt), 2)
        if RNG.random() < 0.17:
            fee = 0.0
        if cancelled_budget > 0 and RNG.random() < 0.04:
            status = "cancelled"
            cancelled_budget -= 1
            repaid_at = None
            repayment_source = None
        elif RNG.random() < 0.12:
            status = "outstanding"
            repaid_at = None
            repayment_source = None
        else:
            status = "repaid"
            repaid_at = iso(ts + timedelta(days=RNG.randint(2, 14)))
            repayment_source = RNG.choice(["payroll", "bank", "next_advance"])

        rows.append(
            {
                "advance_id": f"A-{aid:05d}",
                "worker_id": w["worker_id"],
                "requested_at": iso(ts),
                "amount_cad": amt,
                "fee_cad": fee,
                "status": status,
                "repaid_at": repaid_at,
                "repayment_source": repayment_source,
                "reason_code": RNG.choice(REASON_CODES),
            }
        )
        aid += 1

    # Force remaining cancelled count exactly 15
    cancelled = sum(1 for r in rows if r["status"] == "cancelled")
    if cancelled < 15:
        for r in rows:
            if r["worker_id"] == "W-0001":
                continue
            if r["status"] == "repaid" and cancelled < 15:
                r["status"] = "cancelled"
                r["repaid_at"] = None
                r["repayment_source"] = None
                cancelled += 1
    elif cancelled > 15:
        for r in rows:
            if r["status"] == "cancelled" and cancelled > 15:
                r["status"] = "repaid"
                r["repaid_at"] = r["requested_at"][:10] + "T12:00:00"
                r["repayment_source"] = "payroll"
                cancelled -= 1

    assert len(rows) == 535, len(rows)
    assert sum(1 for r in rows if r["status"] == "cancelled") == 15
    return rows


def build_transactions(
    workers: list[dict],
    earnings: list[dict],
    obligations: list[dict],
    advances: list[dict],
) -> list[dict]:
    """Build exactly 31726 transactions with running balances."""
    rows: list[dict] = []
    tid = 1

    earns_by_w: dict[str, list[dict]] = {w["worker_id"]: [] for w in workers}
    for e in earnings:
        earns_by_w[e["worker_id"]].append(e)

    obs_by_w: dict[str, list[dict]] = {w["worker_id"]: [] for w in workers}
    for o in obligations:
        obs_by_w[o["worker_id"]].append(o)

    adv_by_w: dict[str, list[dict]] = {w["worker_id"]: [] for w in workers}
    for a in advances:
        if a["status"] != "cancelled":
            adv_by_w[a["worker_id"]].append(a)

    target = 31726
    # Pre-build structural txns then fill with discretionary spend
    structural: list[dict] = []

    def add_txn(
        wid: str,
        ts: datetime,
        direction: str,
        amount: float,
        category: str,
        merchant: str,
        channel: str,
        essential: int,
        notes: str | None,
        buffer: list[dict],
    ):
        nonlocal tid
        buffer.append(
            {
                "txn_id": f"T-{tid:05d}",
                "worker_id": wid,
                "txn_ts": iso(ts),
                "direction": direction,
                "amount_cad": round(amount, 2),
                "category": category,
                "merchant_type": merchant,
                "channel": channel,
                "is_essential": essential,
                "running_balance_cad": 0.0,  # filled later
                "notes": notes,
            }
        )
        tid += 1

    for w in workers:
        wid = w["worker_id"]
        # Income from same-day paid earnings
        for e in earns_by_w[wid]:
            if int(e["paid_same_day"]) == 1:
                d = date.fromisoformat(e["work_date"])
                ts = datetime(d.year, d.month, d.day, RNG.randint(16, 21), RNG.randint(0, 59))
                add_txn(
                    wid,
                    ts,
                    "credit",
                    e["net_pay_cad"],
                    "income",
                    "employer",
                    "eft",
                    1,
                    f"earnings_id={e['earnings_id']}",
                    structural,
                )
            else:
                # Settles 2–4 days later
                d = date.fromisoformat(e["work_date"]) + timedelta(days=RNG.randint(2, 4))
                if d > END_TXN:
                    continue
                ts = datetime(d.year, d.month, d.day, RNG.randint(8, 11), RNG.randint(0, 59))
                add_txn(
                    wid,
                    ts,
                    "credit",
                    e["net_pay_cad"],
                    "income",
                    "employer",
                    "eft",
                    1,
                    f"earnings_id={e['earnings_id']}",
                    structural,
                )

        # Obligation debits on due days for Apr–Jun (and early Jul for monthly)
        for o in obs_by_w[wid]:
            if o["frequency"] == "monthly":
                for month in (4, 5, 6, 7):
                    if month == 7 and o["due_day_of_month"] > 5:
                        continue
                    try:
                        d = date(2026, month, o["due_day_of_month"])
                    except ValueError:
                        continue
                    if d < START or d > END_TXN:
                        continue
                    ts = datetime(d.year, d.month, d.day, 7, 30 if int(o["autopay"]) else RNG.randint(8, 20))
                    add_txn(
                        wid,
                        ts,
                        "debit",
                        o["amount_cad"],
                        o["category"],
                        "landlord" if o["category"] == "housing" else "utility",
                        "eft" if int(o["autopay"]) else "debit_card",
                        int(o["essential"]),
                        f"obligation_id={o['obligation_id']}",
                        structural,
                    )
            else:
                # biweekly: every 14 days from first due_day in April
                anchor = date(2026, 4, o["due_day_of_month"])
                d = anchor
                while d <= END_TXN:
                    ts = datetime(d.year, d.month, d.day, 8, 0)
                    add_txn(
                        wid,
                        ts,
                        "debit",
                        o["amount_cad"],
                        o["category"],
                        "transfer",
                        "eft",
                        int(o["essential"]),
                        f"obligation_id={o['obligation_id']}",
                        structural,
                    )
                    d += timedelta(days=14)

        # Advances as credits
        for a in adv_by_w[wid]:
            ts = datetime.fromisoformat(a["requested_at"])
            add_txn(
                wid,
                ts,
                "credit",
                a["amount_cad"],
                "advance",
                "transfer",
                "eft",
                0,
                f"advance_id={a['advance_id']}",
                structural,
            )
            if a["fee_cad"] and float(a["fee_cad"]) > 0:
                add_txn(
                    wid,
                    ts + timedelta(minutes=1),
                    "debit",
                    a["fee_cad"],
                    "advance_fee",
                    "transfer",
                    "eft",
                    0,
                    f"advance_id={a['advance_id']}",
                    structural,
                )

    # Fill remaining with discretionary / essential spend
    need = target - len(structural)
    assert need > 0, f"structural already {len(structural)} >= {target}"

    worker_ids = [w["worker_id"] for w in workers]
    for _ in range(need):
        wid = RNG.choice(worker_ids)
        day = START + timedelta(days=RNG.randint(0, (END_TXN - START).days))
        ts = datetime(day.year, day.month, day.day, RNG.randint(7, 22), RNG.randint(0, 59))
        essential = 1 if RNG.random() < 0.35 else 0
        if essential:
            cat = RNG.choice(["groceries", "transport", "health", "utilities"])
            amt = round(RNG.uniform(8, 85), 2)
        else:
            cat = RNG.choice(["food", "entertainment", "clothing", "other", "transport"])
            amt = round(RNG.uniform(5, 65), 2)
        # ~47% of rows carry obligation_id notes — only structural do; discretionary leave null
        add_txn(
            wid,
            ts,
            "debit",
            amt,
            cat,
            RNG.choice(MERCHANT_TYPES),
            RNG.choice(CHANNELS),
            essential,
            None,
            structural,
        )

    assert len(structural) == target, len(structural)

    # Assign running balances per worker chronologically
    by_w: dict[str, list[dict]] = {w["worker_id"]: [] for w in workers}
    for t in structural:
        by_w[t["worker_id"]].append(t)

    final_rows: list[dict] = []
    for wid, txns in by_w.items():
        txns.sort(key=lambda t: t["txn_ts"])
        # starting balance: median-ish ~$3500 with noise (SPEC mentions ~$3700)
        bal = round(RNG.uniform(800, 6500), 2)
        for t in txns:
            if t["direction"] == "credit":
                bal = round(bal + float(t["amount_cad"]), 2)
            else:
                bal = round(bal - float(t["amount_cad"]), 2)
            t["running_balance_cad"] = bal
            final_rows.append(t)

    # Re-number txn_ids in chronological global order for cleanliness
    final_rows.sort(key=lambda t: (t["txn_ts"], t["worker_id"]))
    for i, t in enumerate(final_rows, start=1):
        t["txn_id"] = f"T-{i:05d}"

    assert len(final_rows) == 31726
    return final_rows


def build_weekly_summary(
    workers: list[dict],
    earnings: list[dict],
    transactions: list[dict],
    advances: list[dict],
) -> list[dict]:
    """Exactly 3072 worker-weeks. buffer_days_estimate is intentionally corrupt."""
    # Weeks from 2026-03-30 (Mon) through covering July 5 → enough weeks
    # 220 workers * 14 weeks = 3080; we need 3072 → 13 weeks for most + some missing
    # 220 * 14 = 3080; drop 8 → 3072. Or 220 * 13 = 2860 + 212 = 3072.
    # Cleanest: 14 weeks starting Mon 2026-03-30, drop last 8 worker-weeks.
    week0 = date(2026, 3, 30)  # Monday
    n_weeks = 14
    week_starts = [week0 + timedelta(days=7 * i) for i in range(n_weeks)]

    earns_by_w = {w["worker_id"]: [] for w in workers}
    for e in earnings:
        earns_by_w[e["worker_id"]].append(e)

    tx_by_w = {w["worker_id"]: [] for w in workers}
    for t in transactions:
        tx_by_w[t["worker_id"]].append(t)

    adv_by_w = {w["worker_id"]: [] for w in workers}
    for a in advances:
        if a["status"] != "cancelled":
            adv_by_w[a["worker_id"]].append(a)

    rows: list[dict] = []
    for w in workers:
        wid = w["worker_id"]
        for ws in week_starts:
            we = ws + timedelta(days=6)
            income = sum(
                float(e["net_pay_cad"])
                for e in earns_by_w[wid]
                if ws <= date.fromisoformat(e["work_date"]) <= we
            )
            expense = 0.0
            essential_expense = 0.0
            ending = None
            for t in tx_by_w[wid]:
                td = datetime.fromisoformat(t["txn_ts"]).date()
                if ws <= td <= we:
                    if t["direction"] == "debit":
                        expense += float(t["amount_cad"])
                        if int(t["is_essential"]) == 1:
                            essential_expense += float(t["amount_cad"])
                    ending = float(t["running_balance_cad"])
            if ending is None:
                ending = round(RNG.uniform(500, 4000), 2)

            week_adv = [
                a
                for a in adv_by_w[wid]
                if ws <= datetime.fromisoformat(a["requested_at"]).date() <= we
            ]
            # CORRUPT buffer_days_estimate — do not use in product
            if RNG.random() < 0.107:  # ~330 nulls / 3072
                buf = None
            else:
                # wild range −1414 to 17569, mean~391, median~48
                if RNG.random() < 0.55:
                    buf = round(RNG.uniform(-50, 120), 2)
                elif RNG.random() < 0.85:
                    buf = round(RNG.uniform(120, 800), 2)
                else:
                    buf = round(RNG.uniform(-1414, 17569), 2)

            rows.append(
                {
                    "worker_id": wid,
                    "week_start": iso(ws),
                    "income_cad": round(income, 2),
                    "expense_cad": round(expense, 2),
                    "essential_expense_cad": round(essential_expense, 2),
                    "net_cashflow_cad": round(income - expense, 2),
                    "advances_count": len(week_adv),
                    "advances_amount_cad": round(sum(float(a["amount_cad"]) for a in week_adv), 2),
                    "advance_fees_cad": round(sum(float(a["fee_cad"] or 0) for a in week_adv), 2),
                    "ending_balance_cad": round(ending, 2),
                    "buffer_days_estimate": buf,
                    "negative_balance_flag": 1 if ending < 0 else 0,
                }
            )

    # 220 * 14 = 3080; drop 8 to hit 3072
    assert len(rows) == 3080
    drop = set(RNG.sample(range(len(rows)), 8))
    rows = [r for i, r in enumerate(rows) if i not in drop]
    assert len(rows) == 3072, len(rows)
    return rows


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    print("Generating workers…")
    workers = build_workers()
    print("Generating daily_earnings…")
    earnings = build_earnings(workers)
    print("Generating recurring_obligations…")
    obligations = build_obligations(workers)
    print("Generating earned_wage_advances…")
    advances = build_advances(workers)
    print("Generating transactions…")
    transactions = build_transactions(workers, earnings, obligations, advances)
    print("Generating weekly_cashflow_summary…")
    weekly = build_weekly_summary(workers, earnings, transactions, advances)

    write_csv(
        DATA / "workers.csv",
        [
            "worker_id",
            "city",
            "province",
            "occupation",
            "pay_type",
            "typical_daily_net_cad",
            "income_volatility",
            "tip_share",
            "household_size",
            "dependents",
            "has_bank_account",
            "uses_prepaid_card",
            "primary_employer_id",
            "tenure_months",
            "has_side_gig",
            "commute_mode",
            "rent_burden_band",
        ],
        workers,
    )
    write_csv(
        DATA / "daily_earnings.csv",
        [
            "earnings_id",
            "worker_id",
            "work_date",
            "employer_id",
            "shift_type",
            "hours_worked",
            "gross_pay_cad",
            "tips_cad",
            "deductions_cad",
            "net_pay_cad",
            "paid_same_day",
            "pay_method",
        ],
        earnings,
    )
    write_csv(
        DATA / "recurring_obligations.csv",
        [
            "obligation_id",
            "worker_id",
            "name",
            "category",
            "amount_cad",
            "frequency",
            "due_day_of_month",
            "autopay",
            "essential",
        ],
        obligations,
    )
    write_csv(
        DATA / "transactions.csv",
        [
            "txn_id",
            "worker_id",
            "txn_ts",
            "direction",
            "amount_cad",
            "category",
            "merchant_type",
            "channel",
            "is_essential",
            "running_balance_cad",
            "notes",
        ],
        transactions,
    )
    write_csv(
        DATA / "earned_wage_advances.csv",
        [
            "advance_id",
            "worker_id",
            "requested_at",
            "amount_cad",
            "fee_cad",
            "status",
            "repaid_at",
            "repayment_source",
            "reason_code",
        ],
        advances,
    )
    write_csv(
        DATA / "weekly_cashflow_summary.csv",
        [
            "worker_id",
            "week_start",
            "income_cad",
            "expense_cad",
            "essential_expense_cad",
            "net_cashflow_cad",
            "advances_count",
            "advances_amount_cad",
            "advance_fees_cad",
            "ending_balance_cad",
            "buffer_days_estimate",
            "negative_balance_flag",
        ],
        weekly,
    )

    counts = {
        "workers": len(workers),
        "daily_earnings": len(earnings),
        "recurring_obligations": len(obligations),
        "transactions": len(transactions),
        "earned_wage_advances": len(advances),
        "weekly_cashflow_summary": len(weekly),
    }
    expected = {
        "workers": 220,
        "daily_earnings": 12204,
        "recurring_obligations": 849,
        "transactions": 31726,
        "earned_wage_advances": 535,
        "weekly_cashflow_summary": 3072,
    }
    for k, v in expected.items():
        assert counts[k] == v, f"{k}: got {counts[k]}, expected {v}"
        print(f"  {k}: {counts[k]}")

    # Sanity: biweekly count + W-0001 committed
    bw = sum(1 for o in obligations if o["frequency"] == "biweekly")
    assert bw == 38, bw
    w1 = [o for o in obligations if o["worker_id"] == "W-0001"]
    committed = sum(float(o["amount_cad"]) for o in w1)
    print(f"  W-0001 obligations: {len(w1)}, committedMonthly={committed}")
    print(f"  biweekly rows: {bw}")
    print("Done.")


if __name__ == "__main__":
    main()
