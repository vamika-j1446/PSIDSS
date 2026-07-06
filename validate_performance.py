import urllib.request
import json
import time

base_url = "http://localhost:5000"

def test_performance():
    print("=== PSIDSS Caching & Performance Validation ===")
    
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
        
    def measure_get(endpoint):
        req_get = urllib.request.Request(
            f"{base_url}{endpoint}",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Measure time
        start = time.perf_counter()
        with urllib.request.urlopen(req_get) as response:
            response.read()
        end = time.perf_counter()
        return (end - start) * 1000  # returns milliseconds

    endpoints = [
        "/api/dashboard/kpis",
        "/api/historical/trends",
        "/api/historical/customers",
        "/api/strategic/analysis",
        "/api/predictive/forecasts",
        "/api/recommendations"
    ]

    for ep in endpoints:
        print(f"\nTesting endpoint: {ep}")
        # First call (DB scan, populates cache)
        t1 = measure_get(ep)
        print(f"  First call (DB scan): {t1:.2f} ms")
        
        # Second call (should hit cache)
        t2 = measure_get(ep)
        print(f"  Second call (Cache hit): {t2:.2f} ms")
        
        speedup = t1 / t2 if t2 > 0 else 1
        print(f"  Speedup: {speedup:.1f}x faster")

if __name__ == "__main__":
    test_performance()
