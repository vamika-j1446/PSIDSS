import os
import shutil
import subprocess

src_dir = r"C:\Users\DELL\OneDrive\Documents\Port_Project"
dest_dir = r"C:\Users\DELL\OneDrive\Desktop\CoPA\backend\uploads"
project_dir = r"C:\Users\DELL\OneDrive\Desktop\CoPA"

os.makedirs(dest_dir, exist_ok=True)

# Find all Excel files
files = sorted([f for f in os.listdir(src_dir) if f.startswith("FinancialAnalysisReport") and f.endswith(".xlsx")])

print(f"Found {len(files)} files to ingest:")
for f in files:
    print(f" - {f}")

for f in files:
    src_file = os.path.join(src_dir, f)
    dest_file = os.path.join(dest_dir, f)
    
    print(f"\n>>> Copying {f} to uploads...")
    shutil.copy2(src_file, dest_file)
    
    # Run ingest.py
    ingest_script = os.path.join(project_dir, "scripts", "ingest.py")
    print(f">>> Ingesting {f}...")
    subprocess.run(["python", ingest_script, dest_file], check=True)
    
print("\n>>> Ingestion of all files complete!")

# Run forecast.py
forecast_script = os.path.join(project_dir, "scripts", "forecast.py")
print(">>> Generating forecasts...")
subprocess.run(["python", forecast_script], check=True)
print(">>> Forecast generation complete!")
