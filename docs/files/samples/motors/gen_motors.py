#!/usr/bin/env python3
"""FDH Motors (fictional) demo pack -> schema FDH_DEMO.MOTORS (automaker series).
Deterministic: random.Random(20261025) per section, Decimal amounts, 2 dp ROUND_HALF_UP, EUR.
Reads ../fact_actuals.csv and ../fact_budget.csv read-only; never writes outside this folder.
Writes CSVs here and check_figures.txt."""
import csv, os, random, datetime as dt
from decimal import Decimal as D, ROUND_HALF_UP
from collections import defaultdict

OUT = os.path.dirname(os.path.abspath(__file__))
SAMPLE = os.path.dirname(OUT)
q2 = lambda x: D(x).quantize(D("0.01"), ROUND_HALF_UP)
CHECKS = []
def chk(*a): CHECKS.append(" ".join(str(x) for x in a))
def w(name, hdr, rows):
    with open(os.path.join(OUT, name), "w", newline="") as f:
        c = csv.writer(f, lineterminator="\n"); c.writerow(hdr); c.writerows(rows)
def wd(d): return d + dt.timedelta(days=(0 if d.weekday() < 5 else 7 - d.weekday()))

# =================== 13-week cash (CASH_OPENING, CASH_FLOW, CASH_SCENARIO, LIQUIDITY_FLOOR) ===================
def build_cash():
    R = random.Random(20261025)
    AS_OF, OPEN, FLOOR = dt.date(2026, 9, 7), D("4000000.00"), D("1500000.00")
    SCEN = [("base", D("1.00"), D("1.00")), ("down", D("0.90"), D("1.05")), ("up", D("1.08"), D("0.97"))]
    wk_start = lambda n: AS_OF + dt.timedelta(weeks=n - 1)
    flows = []  # [flow_type, category, counterparty, due, expected, amount]
    custs = [f"CUST-{i:02d} (fictional dealer)" for i in range(1, 7)]
    supps = [f"SUPP-{i:02d} (fictional supplier)" for i in range(1, 9)]
    for n in range(1, 14):
        ws = wk_start(n)
        for k in range(4):
            d = ws + dt.timedelta(days=R.randint(0, 4))
            flows.append(["RECEIPT", "receipts_customers", custs[R.randrange(6)], d, d, q2(D(R.randint(22000000, 28000000)) / 100)])
        if n % 2 == 0:
            d = ws + dt.timedelta(days=2); flows.append(["RECEIPT", "receipts_other", "OTHER-01 (fictional)", d, d, q2(D(R.randint(3000000, 6000000)) / 100)])
        for k in range(4):
            d = ws + dt.timedelta(days=R.randint(0, 4))
            flows.append(["DISBURSEMENT", "payments_suppliers", supps[R.randrange(8)], d, d, q2(D(R.randint(15000000, 19000000)) / 100)])
        d = ws + dt.timedelta(days=3)
        flows.append(["DISBURSEMENT", "capex", f"PRJ{(n % 6) + 1:02d} (capex project)", d, d, q2(D(R.randint(4000000, 9000000)) / 100)])
        d = ws + dt.timedelta(days=1)
        flows.append(["DISBURSEMENT", "it_services", "SUPP-IT (fictional)", d, d, q2(D(R.randint(1000000, 2500000)) / 100)])
    for d in (dt.date(2026, 9, 30), dt.date(2026, 10, 30), dt.date(2026, 11, 30)):   # payroll on real pay date
        flows.append(["DISBURSEMENT", "payroll", "PAYROLL (fictional)", d, d, D("610000.00")])
    for d in (dt.date(2026, 9, 10), dt.date(2026, 10, 12), dt.date(2026, 11, 10)):  # rent
        flows.append(["DISBURSEMENT", "rent", "LANDLORD-01 (fictional)", d, d, D("85000.00")])
    flows.append(["DISBURSEMENT", "tax", "TAX OFFICE (fictional)", dt.date(2026, 9, 10), dt.date(2026, 9, 10), D("95000.00")])
    TAX_IDX = len(flows); flows.append(["DISBURSEMENT", "tax", "TAX OFFICE (fictional)", dt.date(2026, 10, 28), dt.date(2026, 10, 28), D("0")])
    # seed: late customer receipt, due 2026-09-01 (before as-of), expected 2026-09-09 (week 1), not received in week 1
    LATE_IDX = len(flows); flows.append(["RECEIPT", "receipts_customers", "CUST-04 (fictional dealer)", dt.date(2026, 9, 1), dt.date(2026, 9, 9), D("180000.00")])
    # seed: customer refund = negative receipt, week 6
    REF_IDX = len(flows); flows.append(["RECEIPT", "receipts_customers", "CUST-02 (fictional dealer)", dt.date(2026, 10, 14), dt.date(2026, 10, 14), D("-45000.00")])
    flows.sort(key=lambda f: (f[4], f[0], f[1], f[2], f[5]))
    def week(d): return (d - AS_OF).days // 7 + 1
    def path(tax, rm, dm):
        rec, dis = defaultdict(D), defaultdict(D)
        for f in flows:
            amt = tax if f[1] == "tax" and f[3] == dt.date(2026, 10, 28) else f[5]
            (rec if f[0] == "RECEIPT" else dis)[week(f[4])] += amt
        bal, out = OPEN, []
        for n in range(1, 14): bal = q2(bal + rec[n] * rm - dis[n] * dm); out.append(bal)
        return out
    SPIKE = week(dt.date(2026, 10, 28))
    tax = None
    for t in range(100000, 3000001, 10000):
        T = D(t); p = {s: path(T, rm, dm) for s, rm, dm in SCEN}
        first = lambda v: next((i + 1 for i, b in enumerate(v) if b < FLOOR), None)
        if first(p["down"]) == SPIKE and first(p["base"]) is None and first(p["up"]) is None:
            tax = q2(T + 250000); break   # middle of the valid band, not the edge
    p = {s: path(tax, rm, dm) for s, rm, dm in SCEN}
    first = lambda v: next((i + 1 for i, b in enumerate(v) if b < FLOOR), None)
    assert first(p["down"]) == SPIKE and first(p["base"]) is None and first(p["up"]) is None, "re-tune tax"
    for f in flows:
        if f[1] == "tax" and f[3] == dt.date(2026, 10, 28): f[5] = tax
    rows, R2 = [], random.Random(1907)
    ids = {}
    for i, f in enumerate(flows, 1):
        fid = f"CF{i:04d}"; ids[id(f)] = fid
        rows.append([fid, f[0], f[1], f[2], f[3].isoformat(), f[4].isoformat(), "", "FORECAST", f[5]])
    late_id = [r[0] for r in rows if r[4] == "2026-09-01"][0]
    refund_id = [r[0] for r in rows if D(r[8]) < 0][0]
    act = []
    for r in rows:
        e = dt.date.fromisoformat(r[5])
        if week(e) != 1 or r[0] == late_id: continue
        f = D(1) + D(R2.randint(-200, 200)) / D(10000)
        a = q2(D(r[8]) * f)
        ad = min(e + dt.timedelta(days=R2.randint(0, 1)), AS_OF + dt.timedelta(days=6))
        act.append([r[0], r[1], r[2], r[3], r[4], r[5], ad.isoformat(), "ACTUAL", a])
    # seed a >5% overrun on one week-1 supplier payment (urgent extra delivery)
    sp = [a for a in act if a[2] == "payments_suppliers"][0]; sp[8] = q2(D(sp[8]) * D("1.12"))
    w("cash_flow.csv", ["flow_id", "flow_type", "category", "counterparty", "invoice_due_date", "expected_cash_date", "actual_cash_date", "version", "amount"], rows + act)
    w("cash_opening.csv", ["as_of_date", "balance"], [[AS_OF.isoformat(), OPEN]])
    w("cash_scenario.csv", ["scenario", "receipt_mult", "disburse_mult"], [[s, rm, dm] for s, rm, dm in SCEN])
    w("liquidity_floor.csv", ["floor_amount"], [[FLOOR]])
    return dict(late_id=late_id, refund_id=refund_id, spike=SPIKE, tax=tax, sup_id=sp[0])


ACT = [f"{y}-{m:02d}" for y, m in [(2025,10),(2025,11),(2025,12)] + [(2026,m) for m in range(1,9)]]
BUD = ACT + ["2026-09"]
PLANTS = ["P100", "P200", "P300"]

# =================== Plants, models, markets, mapping, production, sales ===================
def build_a1():
    R = random.Random(20261026)
    w("dim_plant.csv", ["plant", "plant_name", "region"], [
        ["P100", "Northfield Assembly (fictional)", "Region North (placeholder)"],
        ["P200", "Riverbend Assembly (fictional)", "Region Central (placeholder)"],
        ["P300", "Lakeside Assembly (fictional)", "Region South (placeholder)"]])
    w("dim_model.csv", ["model", "model_name", "lifecycle_status", "launch_period", "end_period"], [
        ["M-A", "Model Aster (fictional)", "CONTINUING", "2024-01", ""],
        ["M-B", "Model Birch (fictional)", "CONTINUING", "2024-06", ""],
        ["M-C", "Model Cedar (fictional)", "NEW", "2026-03", ""]])
    w("dim_market.csv", ["market", "market_name", "region"], [
        ["MK1", "Market One (placeholder)", "Region North (placeholder)"],
        ["MK2", "Market Two (placeholder)", "Region Central (placeholder)"],
        ["MK3", "Market Three (placeholder)", "Region South (placeholder)"]])
    MAP = [("CC1000","P100","1.00"),("CC1010","P200","1.00"),("CC2000","P300","1.00"),
           ("CC3000","P100","0.50"),("CC3000","P200","0.30"),("CC3000","P300","0.20"),
           ("CC3010","P100","1.00"),("CC4000","P100","0.60"),("CC4000","P200","0.40"),
           ("CC4010","P200","1.00"),("CC5000","P200","1.00"),("CC5010","P300","1.00"),("CC6000","P100","1.00")]
    w("map_cost_center_plant.csv", ["cost_center", "plant", "alloc_pct"], MAP)
    base = {("P100","M-A"):120,("P100","M-B"):80,("P200","M-A"):150,("P200","M-B"):60,("P300","M-A"):40,("P300","M-B"):110}
    prod = {}; rows = []
    for (pl, m), b in base.items():
        for per in BUD:
            u = b + R.randint(-8, 8); prod[(pl,m,per,"Budget")] = u; rows.append([pl,m,per,"Budget",u])
        for per in ACT:
            u = prod[(pl,m,per,"Budget")] + R.randint(-12, 8)
            if (pl, m, per) == ("P300","M-A","2026-03"): u = 0        # seed: 0 units, cost goes to M-B
            prod[(pl,m,per,"Actual")] = u; rows.append([pl,m,per,"Actual",u])
    for per in [x for x in ACT if x >= "2026-03"]:                     # M-C new, actual only, P200
        u = 25 + R.randint(0, 10) if per > "2026-03" else 18; prod[("P200","M-C",per,"Actual")] = u; rows.append(["P200","M-C",per,"Actual",u])
    rows.sort(); w("fact_production.csv", ["plant", "model", "period", "version", "units_produced"], rows)
    PRICE = {"M-A": D("3200"), "M-B": D("4400"), "M-C": D("5000")}
    MKF = {"MK1": D("1.00"), "MK2": D("0.97"), "MK3": D("1.03")}
    SH = {"MK1": D("0.45"), "MK2": D("0.35"), "MK3": D("0.20")}
    sales = {}; rows = []
    def add(m, mk, per, ver, units, pf):
        rev = q2(units * PRICE[m] * MKF[mk] * pf); sales[(m,mk,per,ver)] = (units, rev); rows.append([m,mk,per,ver,units,rev])
    for ver, pers in (("Budget", BUD), ("Actual", ACT)):
        for per in pers:
            for m in ("M-A", "M-B"):
                tot = sum(prod.get((pl,m,per,ver), 0) for pl in PLANTS)
                if ver == "Actual" and per == "2026-03": tot = int(tot * (D("0.88") if m == "M-A" else D("1.12")))  # seed mix shift
                mks = ["MK1","MK2","MK3"] if not (m == "M-B" and ver == "Actual") else ["MK1","MK2"]   # seed: M-B x MK3 budget-only
                shs = {k: SH[k] for k in mks}; st = sum(shs.values())
                left = tot
                for i, mk in enumerate(mks):
                    u = left if i == len(mks)-1 else int(tot * shs[mk] / st); left -= u
                    pf = D(1) if ver == "Budget" else D(1) + D(R.randint(-200, 200)) / D(10000)
                    add(m, mk, per, ver, u, pf)
            if ver == "Actual" and per >= "2026-03":
                tot = prod[("P200","M-C",per,"Actual")]; u1 = int(tot * D("0.6"))
                add("M-C","MK1",per,ver,u1,D(1)); add("M-C","MK2",per,ver,tot-u1,D(1))
    rows.sort(); w("fact_vehicle_sales.csv", ["model", "market", "period", "version", "units_sold", "net_revenue"], rows)
    return MAP, prod, sales

# =================== Capex ===================
def build_a2():
    R = random.Random(20261027)
    P = [  # id, name, plant, owner_role, budget, status, approver, closed, closed_period, actual_ratio, open_ratio
     ("PRJ01","Paint shop robots (fictional)","P300","PLANT_P300_MGR","1200000.00","APPROVED","CAPEX_COMMITTEE",False,"","0.62","0.20"),
     ("PRJ02","Body tooling M-B (fictional)","P100","PLANT_P100_MGR","900000.00","APPROVED","CAPEX_COMMITTEE",False,"","0.55","0.25"),
     ("PRJ03","Battery line upgrade (fictional)","P200","PLANT_P200_MGR","1500000.00","APPROVED","CAPEX_COMMITTEE",False,"","1.12","0.00"),
     ("PRJ04","MES upgrade (fictional)","P100","IT_PROJECTS_LEAD","600000.00","APPROVED","CAPEX_COMMITTEE",False,"","0.48","0.30"),
     ("PRJ05","Press line retrofit (fictional)","P200","PLANT_P200_MGR","800000.00","APPROVED","CAPEX_COMMITTEE",False,"","0.80","0.30"),
     ("PRJ06","Warehouse racking (fictional)","P300","PLANT_P300_MGR","300000.00","APPROVED","CAPEX_COMMITTEE",False,"","0.70","0.10"),
     ("PRJ07","Test rig M-C (fictional)","P200","ENGINEERING_LEAD","500000.00","APPROVED","CAPEX_COMMITTEE",False,"","0.85","0.18"),
     ("PRJ08","Energy metering (fictional)","P100","FACILITIES_LEAD","250000.00","APPROVED","CAPEX_COMMITTEE",False,"","0.40","0.20"),
     ("PRJ09","Paint booth filters (fictional)","P300","PLANT_P300_MGR","150000.00","PENDING","",False,"","0.30","0.00"),
     ("PRJ10","Network refresh (fictional)","P200","IT_PROJECTS_LEAD","400000.00","APPROVED","IT_PROJECTS_LEAD",False,"","0.50","0.20"),
     ("PRJ11","Forklift fleet (fictional)","P100","FACILITIES_LEAD","350000.00","APPROVED","CAPEX_COMMITTEE",True,"2026-05","0.96","0.00"),
     ("PRJ12","Quality cameras (fictional)","P300","ENGINEERING_LEAD","450000.00","APPROVED","CAPEX_COMMITTEE",False,"","0.35","0.15")]
    pr, cm, ac = [], [], []; inv = po = 0; summ = {}
    for i, (pid, nm, pl, own, bud, st, apr, closed, cper, ar, orr) in enumerate(P):
        b = D(bud); A = q2(b * D(ar)); O = q2(b * D(orr))
        pr.append([pid, nm, pl, own, b, st, apr, (f"2025-09-{10+i:02d} 10:00:00" if apr else ""), "TRUE" if closed else "FALSE", cper])
        pers = [x for x in ACT if (not closed or x <= cper)]
        if pid == "PRJ09": pers = ["2026-06", "2026-07"]
        n = 2 if pid == "PRJ09" else R.randint(4, 6)
        sel = sorted(R.sample(pers, n))
        if pid == "PRJ11": sel = sorted(R.sample([x for x in pers if x < cper], n - 1)) + ["2026-07"]   # seed: late invoice after close
        wts = [R.randint(5, 15) for _ in sel]; amts = [q2(A * x / sum(wts)) for x in wts]; amts[-1] += A - sum(amts)
        for per, a in zip(sel, amts): inv += 1; ac.append([f"INV{inv:04d}", pid, per, a])
        # closed POs cover invoiced spend; OPEN POs = remaining commitment
        k = 2 if A > 0 else 0
        for j in range(k):
            po += 1; part = q2(A / 2) if j == 0 else A - q2(A / 2); cm.append([f"PO{po:04d}", pid, sel[0] if j == 0 else sel[-1], part, "CLOSED"])
        if O > 0:
            for j in range(2):
                po += 1; part = q2(O * D("0.6")) if j == 0 else O - q2(O * D("0.6")); cm.append([f"PO{po:04d}", pid, "2026-08", part, "OPEN"])
        summ[pid] = (b, A, O, st, apr == own, closed)
    w("capex_project.csv", ["project_id","project_name","plant","owner_role","budget_amount","approval_status","approved_by_role","approved_at","closed","closed_period"], pr)
    w("capex_commit.csv", ["po_id","project_id","period","amount","status"], cm)
    w("capex_actual.csv", ["invoice_id","project_id","period","amount"], ac)
    roles = sorted({x[3] for x in P} | {"CAPEX_COMMITTEE", "GL_ACCOUNTANT"})
    w("motors_recipients.csv", ["role","email","display_name"], [[r, r.lower().replace("_", ".") + "@example.com", r.title().replace("_", " ") + " (Example)"] for r in roles])
    return summ

# =================== Parts, BOM, standard cost, purchases ===================
PARTS = [("M-A","Model Aster vehicle","VEH","EA"),("M-B","Model Birch vehicle","VEH","EA"),
 ("A-BODY-A","Body M-A","ASSY","EA"),("A-BODY-B","Body M-B","ASSY","EA"),("A-PT-A","Powertrain M-A","ASSY","EA"),
 ("A-PT-B","Powertrain M-B","ASSY","EA"),("A-INT-A","Interior M-A","ASSY","EA"),("A-INT-B","Interior M-B","ASSY","EA"),
 ("A-ELEC","Electrics module (shared)","ASSY","EA"),
 ("P-STEEL","Steel coil","PART","KG"),("P-ALU","Aluminium extrusion","PART","KG"),("P-PANEL-A","Door panel set M-A","PART","EA"),
 ("P-PANEL-B","Door panel set M-B","PART","EA"),("P-GLASS","Glass set","PART","EA"),("P-PAINT","Paint","PART","L"),
 ("P-MOTOR-A","Motor 90 kW","PART","EA"),("P-MOTOR-B","Motor 150 kW","PART","EA"),("P-CELL-01","Battery cell gen 1","PART","EA"),
 ("P-CELL-02","Battery cell gen 2","PART","EA"),("P-INV","Inverter","PART","EA"),("P-SEAT-A","Seat set M-A","PART","EA"),
 ("P-SEAT-B","Seat set M-B","PART","EA"),("P-DASH","Dashboard","PART","EA"),("P-TRIM-B","Trim kit M-B","PART","EA"),
 ("P-HARN-01","Wiring harness (shared)","PART","EA"),("P-ECU-01","Control unit (shared)","PART","EA"),("P-SCREEN","Display","PART","EA")]
BOM = [("M-A","A-BODY-A","1","2024-01-01",""),("M-A","A-PT-A","1","2024-01-01",""),("M-A","A-INT-A","1","2024-01-01",""),("M-A","A-ELEC","1","2024-01-01",""),
 ("M-B","A-BODY-B","1","2024-01-01",""),("M-B","A-PT-B","1","2024-01-01",""),("M-B","A-INT-B","1","2024-01-01",""),("M-B","A-ELEC","1","2024-01-01",""),
 ("A-BODY-A","P-STEEL","380","2024-01-01",""),("A-BODY-A","P-PANEL-A","1","2024-01-01",""),("A-BODY-A","P-GLASS","1","2024-01-01",""),("A-BODY-A","P-PAINT","11","2024-01-01",""),
 ("A-BODY-B","P-STEEL","460","2024-01-01",""),("A-BODY-B","P-ALU","60","2024-01-01",""),("A-BODY-B","P-PANEL-B","1","2024-01-01",""),("A-BODY-B","P-GLASS","1","2024-01-01",""),("A-BODY-B","P-PAINT","14","2024-01-01",""),
 ("A-PT-A","P-MOTOR-A","1","2024-01-01",""),("A-PT-A","P-CELL-01","72","2024-01-01",""),("A-PT-A","P-INV","1","2024-01-01",""),
 ("A-PT-B","P-MOTOR-B","1","2024-01-01",""),("A-PT-B","P-CELL-01","110","2024-01-01","2026-03-31"),("A-PT-B","P-CELL-02","96","2026-04-01",""),("A-PT-B","P-INV","1","2024-01-01",""),
 ("A-INT-A","P-SEAT-A","1","2024-01-01",""),("A-INT-A","P-DASH","1","2024-01-01",""),
 ("A-INT-B","P-SEAT-B","1","2024-01-01",""),("A-INT-B","P-DASH","1","2024-01-01",""),("A-INT-B","P-TRIM-B","1","2024-01-01",""),
 ("A-ELEC","P-HARN-01","1","2024-01-01",""),("A-ELEC","P-ECU-01","2","2024-01-01",""),("A-ELEC","P-SCREEN","1","2024-01-01","")]
STD0 = {"P-STEEL":"1.10","P-ALU":"3.40","P-PANEL-A":"310.00","P-PANEL-B":"420.00","P-GLASS":"240.00","P-PAINT":"18.50",
        "P-MOTOR-A":"1350.00","P-MOTOR-B":"1980.00","P-CELL-01":"48.00","P-CELL-02":"51.00","P-INV":"620.00","P-SEAT-A":"540.00",
        "P-SEAT-B":"760.00","P-DASH":"380.00","P-TRIM-B":"260.00","P-HARN-01":"295.00","P-ECU-01":"140.00","P-SCREEN":"210.00"}
MISSING_STD = ("P-TRIM-B", "2026-05")
def std_cost(part, per):
    v = D(STD0[part])
    if part in ("P-STEEL", "P-ALU") and per >= "2026-01": v = q2(v * D("1.02"))   # Jan revaluation
    return v
def explode(model, per):
    d = dt.date.fromisoformat(per + "-01"); out = defaultdict(D)
    def go(item, mult):
        for pa, ch, q, vf, vt in BOM:
            if pa != item or dt.date.fromisoformat(vf) > d or (vt and dt.date.fromisoformat(vt) < d): continue
            if ch.startswith("P-"): out[ch] += mult * D(q)
            else: go(ch, mult * D(q))
    go(model, D(1)); return out
def build_a3(prod):
    R = random.Random(20261028)
    w("dim_part.csv", ["part","part_name","part_type","uom"], PARTS)
    w("bom.csv", ["parent_part","child_part","qty_per","valid_from","valid_to"], BOM)
    rows = [[p, per, std_cost(p, per)] for p in STD0 for per in BUD if (p, per) != MISSING_STD]
    w("std_cost.csv", ["part","period","std_cost"], rows)
    PP = ["2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"]; rows = []
    for per in PP:
        for pl in PLANTS:
            need = defaultdict(D)
            for m in ("M-A","M-B"):
                for part, q in explode(m, per).items(): need[part] += q * prod[(pl, m, per, "Actual")]
            for part in sorted(need):
                qty = need[part]
                if qty == 0: continue
                if (pl, part, per) == ("P300","P-PANEL-B","2026-03"): qty = q2(qty * D("1.08"))   # seed over-consumption
                price = std_cost(part, per) * (D(1) + D(R.randint(-100, 100)) / D(10000))
                if (part, per) == ("P-ECU-01","2026-03"): price = std_cost(part, per) * D("1.30")    # seed price spike
                rows.append([part, pl, per, q2(qty), q2(price) if part not in ("P-STEEL","P-ALU") else price.quantize(D("0.0001"), ROUND_HALF_UP)])
    w("part_purchase.csv", ["part","plant","period","qty","unit_price"], rows)

# =================== ERP GL extract, close tasks, control tables ===================
def load_actuals():
    with open(os.path.join(SAMPLE, "fact_actuals.csv")) as f: return list(csv.DictReader(f))
def stats_flags(lines):
    import statistics
    g = defaultdict(list)
    for l in lines: g[(l["account"], l["cost_center"])].append(l)
    zf, iq = set(), set()
    for k, ls in g.items():
        v = [float(l["amount"]) for l in ls]
        if len(v) >= 3:
            mu, sd = statistics.mean(v), statistics.stdev(v)
            if sd > 0: zf |= {l["key"] for l in ls if abs((float(l["amount"]) - mu) / sd) > 3}
            q1, _, q3 = statistics.quantiles(v, n=4, method="inclusive"); r = q3 - q1
            iq |= {l["key"] for l in ls if float(l["amount"]) < q1 - 1.5 * r or float(l["amount"]) > q3 + 1.5 * r}
    return zf, iq
def build_erp():
    R = random.Random(20261029)
    fa = [r for r in load_actuals() if r["version"] == "Actual" and r["period"] <= "2026-03"]
    groups = sorted({(r["cost_center"], r["account"]) for r in fa})
    nlines = {g: R.randint(3, 6) for g in groups}
    OUT_G, OUT_P = ("CC3010", "620000"), "2026-02"        # seed 10x: group normally 10 lines/cell, one cell posted as 1 line
    nlines[OUT_G] = 10
    SEAS_G, SEAS_P = ("CC6000", "600000"), "2025-12"      # legit seasonal: annual bonus accrual posted as 1 line
    ROUND_C = ("CC1010", "400000", "2026-03")             # seed round amount line 25,000.00
    WSIGN_C = ("CC5000", "500000", "2026-01")             # seed wrong-sign line on an expense account
    WEEKEND_C = ("CC3000", "630000", "2026-03")           # seed Saturday posting
    SUBTLE_C = ("CC3010", "620000", "2025-11")            # seed: IQR catches, z misses
    cells = {(r["cost_center"], r["account"], r["period"]): D(r["amount"]) for r in fa}
    def split(total, n):
        wts = [R.randint(85, 115) for _ in range(n)]; a = [q2(total * x / sum(wts)) for x in wts]; a[-1] += total - sum(a); return a
    lines, seeds = [], {}
    for (cc, acct, per), amt in sorted(cells.items(), key=lambda x: (x[0][2], x[0][0], x[0][1])):
        g = (cc, acct); n = nlines[g]
        if (g, per) in ((OUT_G, OUT_P), (SEAS_G, SEAS_P)): amts = [amt]
        else: amts = split(amt, n)
        if (cc, acct, per) == ROUND_C: amts = [D("25000.00")] + split(amt - D("25000.00"), n - 1)
        if (cc, acct, per) == WSIGN_C: x = D("-1840.25"); amts = [x] + split(amt - x, n - 1)
        y, m = map(int, per.split("-")); days = [dt.date(y, m, d) for d in range(1, 29) if dt.date(y, m, d).weekday() < 5]
        doc = f"FDH1-{per.replace('-', '')}-{cc}-{acct}"
        for i, a in enumerate(amts, 1):
            pd_ = R.choice(days)
            if (cc, acct, per) == WEEKEND_C and i == 1:
                pd_ = next(dt.date(y, m, d) for d in range(14, 21) if dt.date(y, m, d).weekday() == 5)
            lines.append(dict(doc_id=doc, line_no=i, company_code="FDH1", posting_date=pd_.isoformat(), period=per,
                              cost_center=cc, account=acct, amount=a, currency="EUR", key=f"{doc}/{i}"))
    # subtle seed: within one cell, shift value onto line 1 until IQR flags it while |z| stays <= 3
    assert all(c in cells for c in (ROUND_C, WSIGN_C, WEEKEND_C, SUBTLE_C, OUT_G + (OUT_P,), SEAS_G + (SEAS_P,)))
    sub = [l for l in lines if (l["cost_center"], l["account"], l["period"]) == SUBTLE_C]
    tot = sum(l["amount"] for l in sub); found = None
    for share in range(15, 95):
        a1 = q2(tot * share / 100); rest = split(tot - a1, len(sub) - 1)
        for l, a in zip(sub, [a1] + rest): l["amount"] = a
        zf, iq = stats_flags(lines)
        if sub[0]["key"] in iq and sub[0]["key"] not in zf: found = share; break
    assert found, "subtle seed not found"
    k = lambda c, i=1: f"FDH1-{c[2].replace('-', '')}-{c[0]}-{c[1]}/{i}"
    seeds = {"S1_10x": k((OUT_G[0], OUT_G[1], OUT_P)), "S2_round_25000": k(ROUND_C), "S3_weekend": k(WEEKEND_C),
             "S4_wrong_sign": k(WSIGN_C), "S5_subtle_iqr_only": k(SUBTLE_C), "LEGIT_seasonal": k((SEAS_G[0], SEAS_G[1], SEAS_P))}
    H = ["doc_id","line_no","company_code","posting_date","period","cost_center","account","amount","currency"]
    w("erp_gl_extract.csv", H, [[l[h] for h in H] for l in lines])
    m3 = [[l[h] for h in H] for l in lines if l["period"] == "2026-03"]
    t3 = sum(r[7] for r in m3)
    w("erp_gl_extract_2026-03.csv", H, m3 + [["TRAILER", len(m3), t3, "", "", "", "", "", ""]])
    drop = next(i for i, r in enumerate(m3) if f"{r[0]}/{r[1]}" not in seeds.values() and r[5] == "CC4000")
    dropped = m3[drop]
    w("erp_gl_extract_2026-03_dropped.csv", H, m3[:drop] + m3[drop+1:] + [["TRAILER", len(m3), t3, "", "", "", "", "", ""]])
    # close tasks for close 2026-03 (workdays Mon-Fri, no holiday calendar)
    WD = {1: "2026-04-01", 2: "2026-04-02", 3: "2026-04-03", 4: "2026-04-06", 5: "2026-04-07", 6: "2026-04-08", 7: "2026-04-09"}
    T = [("Lock AP sub-ledger","AP_LEAD",1),("Lock AR sub-ledger","AR_LEAD",1),("Bank reconciliation","TREASURY_ANALYST",1),
         ("Run ERP GL extract","ERP_ADMIN",1),("Load extract to Snowflake","DATA_ENGINEER",2),("Control totals file vs Snowflake","FIN_SYSTEMS_LEAD",2),
         ("Payroll accrual","PAYROLL_LEAD",2),("Capex accruals","CAPEX_CONTROLLER",2),("Inventory count review","PLANT_CONTROLLER",2),
         ("Standard cost revaluation","COST_ACCOUNTANT",3),("PPV and usage variance review","COST_ACCOUNTANT",3),("Intercompany matching","GL_ACCOUNTANT",3),
         ("Fixed asset depreciation run","GL_ACCOUNTANT",3),("Journal anomaly review","GL_ACCOUNTANT",3),("Load actuals to Jedox","FIN_SYSTEMS_LEAD",4),
         ("Control totals Snowflake vs Jedox","FIN_SYSTEMS_LEAD",4),("Plant cost allocation","PLANT_CONTROLLER",4),("Cost per vehicle review","PLANT_CONTROLLER",4),
         ("Tax provision","TAX_LEAD",4),("Cash forecast refresh","TREASURY_ANALYST",5),("Plan vs actual commentary","FPA_LEAD",5),
         ("Management pack draft","FPA_LEAD",6),("Evidence pack export","FIN_SYSTEMS_LEAD",6),("CFO review","CFO_OFFICE",7),("Close sign-off","CONTROLLER",7)]
    LATE = {"Standard cost revaluation": 1, "Intercompany matching": 2, "Plan vs actual commentary": 1}
    BLOCKED = "Tax provision"
    ct = []
    for i, (nm, role, d) in enumerate(T, 1):
        if nm == BLOCKED: st, ca = "BLOCKED", ""
        else:
            st = "DONE"; due = dt.date.fromisoformat(WD[d])
            cd = due + dt.timedelta(days=LATE.get(nm, 0)); cd = wd(cd) if LATE.get(nm) else due
            ca = f"{cd.isoformat()} {R.randint(9,17):02d}:{R.choice(['05','20','35','50'])}:00"
        ct.append([f"CT{i:02d}", "2026-03", nm, role, d, WD[d], st, ca])
    w("close_task.csv", ["task_id","period","task_name","owner_role","due_workday","due_date","status","completed_at"], ct)
    return lines, seeds, dict(m3_rows=len(m3), m3_total=t3, dropped=f"{dropped[0]}/{dropped[1]}", dropped_amt=dropped[7], subtle_share=found)

if __name__ == "__main__":
    print(build_cash())
    MAP, prod, sales = build_a1()
    build_a2()
    build_a3(prod)
    lines, seeds, info = build_erp()
    print(seeds, info)
