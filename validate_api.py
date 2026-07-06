import urllib.request
import urllib.parse
import json

base_url = "http://localhost:5000"

def test_api():
    print("=== PSIDSS API Validation ===")
    
    # 1. Login
    login_data = json.dumps({"username": "viewer", "password": "viewer123"}).encode('utf-8')
    req = urllib.request.Request(
        f"{base_url}/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        with urllib.request.urlopen(req) as res:
            login_res = json.loads(res.read().decode('utf-8'))
            token = login_res["token"]
            role = login_res["user"]["role"]
            print(f"[SUCCESS] Login successful! User role: {role}")
    except Exception as e:
        print(f"[FAIL] Login failed: {e}")
        return

    # Helper function for authenticated GET requests
    def test_get(endpoint):
        req_get = urllib.request.Request(
            f"{base_url}{endpoint}",
            headers={"Authorization": f"Bearer {token}"}
        )
        try:
            with urllib.request.urlopen(req_get) as response:
                data = json.loads(response.read().decode('utf-8'))
                print(f"[SUCCESS] GET {endpoint} - Status Code: 200")
                return data
        except Exception as e:
            print(f"[FAIL] GET {endpoint} failed: {e}")
            return None

    # 2. Test KPIs
    kpis = test_get("/api/dashboard/kpis")
    if kpis:
        print(f"         Total Revenue: {kpis.get('totalRevenue')}")
        print(f"         Total Vessels: {kpis.get('totalVessels')}")
        print(f"         Total GRT: {kpis.get('totalGRT')}")
        print(f"         Total Customers: {kpis.get('totalCustomers')}")
        print(f"         Total Berths: {kpis.get('totalBerths')}")
        
    # 3. Test Historical Trends
    trends = test_get("/api/historical/trends")
    if trends:
        print(f"         Yearly trend points: {len(trends.get('yearly', []))}, Monthly trend points: {len(trends.get('monthly', []))}")
        
    # 4. Test Customer Shares
    cust = test_get("/api/historical/customers")
    if cust:
        print(f"         Top Customer: {cust[0]['name']} ({cust[0]['value']})")
        
    # 5. Test Berth Traffic
    berths = test_get("/api/historical/berths")
    if berths:
        print(f"         Total Berths Analyzed: {len(berths)}")
        
    # 6. Test Strategic Risks
    strategic = test_get("/api/strategic/analysis")
    if strategic:
        print(f"         Top Customer Revenue Share: {strategic.get('concentration', {}).get('top1Share')}%")
        print(f"         HHI Index: {strategic.get('concentration', {}).get('hhi')}")
        print(f"         Total Risks Flagged: {len(strategic.get('risks', []))}")
        for risk in strategic.get('risks', []):
            print(f"          - [{risk.get('level')}] {risk.get('category')}: {risk.get('message')}")
            
    # 7. Test Predictions / Forecasts
    forecasts = test_get("/api/predictive/forecasts")
    if forecasts:
        print(f"         Forecast Records Found: {len(forecasts.get('revenue', [])) + len(forecasts.get('commodity', [])) + len(forecasts.get('customer', [])) + len(forecasts.get('berth', []))}")
        
    # 8. Test Recommendations
    recs = test_get("/api/recommendations")
    if recs:
        print(f"         Recommendations Generated: {len(recs)}")
        for rec in recs[:3]:
            print(f"          - [{rec.get('category')}] {rec.get('title')}")

    # 9. Test Uploaded Sheets
    sheets = test_get("/api/reports")
    if sheets:
        print(f"         Uploaded Excel files count: {len(sheets)}")

if __name__ == "__main__":
    test_api()
