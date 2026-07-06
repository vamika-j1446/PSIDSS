import urllib.request
import json
import time

base_url = "http://localhost:5000"

def test_year_filter():
    print("=== PSIDSS Year Filter API Validation ===")
    
    # 1. Login to get JWT token
    login_data = json.dumps({"username": "viewer", "password": "viewer123"}).encode('utf-8')
    req = urllib.request.Request(
        f"{base_url}/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    with urllib.request.urlopen(req) as res:
        login_res = json.loads(res.read().decode('utf-8'))
        token = login_res["token"]
        
    def query_api(endpoint):
        req_get = urllib.request.Request(
            f"{base_url}{endpoint}",
            headers={"Authorization": f"Bearer {token}"}
        )
        start = time.perf_counter()
        with urllib.request.urlopen(req_get) as response:
            res_json = json.loads(response.read().decode('utf-8'))
        end = time.perf_counter()
        elapsed_ms = (end - start) * 1000
        return res_json, elapsed_ms

    # Test for 2024
    print("\n[TEST] Querying 2024 dashboard KPIs...")
    kpis_2024, t_2024 = query_api("/api/dashboard/kpis?year=2024")
    print(f"       Status: 200 OK")
    print(f"       Response Time: {t_2024:.2f} ms (Target < 20ms)")
    print(f"       2024 Total Revenue: Rs. {kpis_2024.get('totalRevenue'):,.2f}")
    
    # Test for 2018
    print("\n[TEST] Querying 2018 dashboard KPIs...")
    kpis_2018, t_2018 = query_api("/api/dashboard/kpis?year=2018")
    print(f"       Status: 200 OK")
    print(f"       Response Time: {t_2018:.2f} ms (Target < 20ms)")
    print(f"       2018 Total Revenue: Rs. {kpis_2018.get('totalRevenue'):,.2f}")
    
    # Test for All Years
    print("\n[TEST] Querying All Years dashboard KPIs...")
    kpis_all, t_all = query_api("/api/dashboard/kpis?year=All")
    print(f"       Status: 200 OK")
    print(f"       Response Time: {t_all:.2f} ms (Target < 20ms)")
    print(f"       All Years Total Revenue: Rs. {kpis_all.get('totalRevenue'):,.2f}")

    # Top customer shares in 2024
    print("\n[TEST] Querying 2024 Customer Shares...")
    custs_2024, t_cust = query_api("/api/historical/customers?year=2024")
    print(f"       Status: 200 OK")
    print(f"       Response Time: {t_cust:.2f} ms")
    if custs_2024:
        print(f"       Top Customer in 2024: {custs_2024[0]['name']} (Revenue: Rs. {custs_2024[0]['value']:,.2f}, Share: {custs_2024[0]['percentage']}%)")

    # Strategic risks in 2024
    print("\n[TEST] Querying 2024 Strategic Risks...")
    strat_2024, t_strat = query_api("/api/strategic/analysis?year=2024")
    print(f"       Status: 200 OK")
    print(f"       Response Time: {t_strat:.2f} ms")
    if strat_2024:
        print(f"       2024 HHI Index: {strat_2024.get('concentration', {}).get('hhi')}")
        print(f"       2024 Flagged Risks: {len(strat_2024.get('risks', []))}")
        for r in strat_2024.get('risks', []):
            print(f"        - [{r.get('level')}] {r.get('category')}: {r.get('message')}")

if __name__ == "__main__":
    test_year_filter()
