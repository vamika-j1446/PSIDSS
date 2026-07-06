import os
import sys
import pandas as pd
import numpy as np
import sqlite3
import mysql.connector
from datetime import datetime

# Load .env file
def load_env(env_path):
    env = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

# Path configuration
project_dir = r"C:\Users\DELL\OneDrive\Desktop\CoPA"
env_path = os.path.join(project_dir, "backend", ".env")
env = load_env(env_path)

DB_TYPE = env.get("DB_TYPE", "sqlite")
DB_STORAGE = env.get("DB_STORAGE", os.path.join(project_dir, "backend", "database.sqlite"))
DB_HOST = env.get("DB_HOST", "localhost")
DB_USER = env.get("DB_USER", "root")
DB_PASSWORD = env.get("DB_PASSWORD", "vamika@123")
DB_NAME = env.get("DB_NAME", "port_db")

def get_connection():
    if DB_TYPE == "mysql":
        return mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
    else:
        # SQLite
        return sqlite3.connect(DB_STORAGE)

MAPPING = {
    'vcn': 'vcn',
    'vessel name': 'vessel_name',
    'berth': 'berth',
    'grt': 'grt',
    'commodity': 'commodity',
    'sor commodity': 'sor_commodity',
    'account code': 'account_code',
    'charge name': 'charge_name',
    'party code': 'party_code',
    'party name': 'party_name',
    'voyage type': 'voyage_type',
    'invoice no.': 'invoice_no',
    'invoice no': 'invoice_no',
    'invoice date': 'invoice_date',
    'invoice datetime': 'invoice_datetime',
    'voyage no.': 'voyage_no',
    'voyage no': 'voyage_no',
    'invoice amount': 'invoice_amount',
    'sor amount': 'sor_amount',
    'discount amount': 'discount_amount',
    'currency': 'currency',
    'unit quantity1': 'unit_quantity1',
    'unit quantity2': 'unit_quantity2',
    'unit rate': 'unit_rate',
    'exchange rate': 'exchange_rate',
    'nature of ship': 'nature_of_ship',
    'ata': 'ata',
    'invoice group': 'invoice_group',
    'sub group': 'sub_group',
    'vessel type': 'vessel_type',
    'commodity group': 'commodity_group',
    'reference no.': 'reference_no',
    'reference no': 'reference_no'
}

def parse_date(val):
    if pd.isna(val) or val is None:
        return None
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ('nan', 'none', 'null', ''):
        return None
    # If it's already in YYYY-MM-DD or YYYY-MM-DD HH:MM:SS format
    try:
        if len(val_str) == 10:
            datetime.strptime(val_str, '%Y-%m-%d')
            return val_str
        elif len(val_str) == 19:
            datetime.strptime(val_str, '%Y-%m-%d %H:%M:%S')
            return val_str
    except ValueError:
        pass
    
    # Try other formats
    for fmt in ('%d-%m-%Y %H:%M', '%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d-%m-%Y', '%Y-%m-%d', '%m/%d/%Y %I:%M:%S %p', '%m/%d/%Y'):
        try:
            return datetime.strptime(val_str, fmt).strftime('%Y-%m-%d %H:%M:%S')
        except ValueError:
            continue
    try:
        return pd.to_datetime(val_str).strftime('%Y-%m-%d %H:%M:%S')
    except:
        return None

def parse_float(val):
    if pd.isna(val) or val is None:
        return 0.0
    val_str = str(val).replace(',', '').strip()
    if not val_str or val_str.lower() in ('nan', 'none', 'null', ''):
        return 0.0
    try:
        return abs(float(val_str))
    except ValueError:
        return 0.0

def find_header_row(file_path):
    print(f"Scanning '{os.path.basename(file_path)}' for header row...")
    df = pd.read_excel(file_path, header=None, nrows=15)
    for idx, row in df.iterrows():
        row_str = [str(x).strip().lower() for x in row if pd.notna(x)]
        if 'vcn' in row_str:
            print(f"Found header row at index {idx}")
            return idx
    print("Warning: 'VCN' column not found in first 15 rows. Defaulting to index 0.")
    return 0

def ingest_file(file_path):
    start_time = datetime.now()
    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)
    
    header_idx = find_header_row(file_path)
    
    print("Reading excel data...")
    df = pd.read_excel(file_path, skiprows=header_idx)
    
    # Drop completely empty rows or rows where Invoice No is null
    inv_col = None
    for col in df.columns:
        if str(col).strip().lower() in ('invoice no.', 'invoice no'):
            inv_col = col
            break
    if inv_col is not None:
        df = df.dropna(subset=[inv_col], how='any')
        df = df[df[inv_col].astype(str).str.strip() != '']
        df = df[df[inv_col].astype(str).str.strip().str.lower() != 'nan']
    
    record_count = len(df)
    print(f"Processing {record_count} valid records...")
    
    # Map column names
    mapped_columns = {}
    for col in df.columns:
        col_clean = str(col).strip().lower()
        if col_clean in MAPPING:
            mapped_columns[col] = MAPPING[col_clean]
    
    df = df.rename(columns=mapped_columns)
    
    # Filter only columns that are mapped and exist in schema
    valid_cols = list(MAPPING.values())
    df = df[[c for c in df.columns if c in valid_cols]]
    
    # Perform conversions
    float_cols = ['grt', 'invoice_amount', 'sor_amount', 'discount_amount', 
                  'unit_quantity1', 'unit_quantity2', 'unit_rate', 'exchange_rate']
    date_cols = ['invoice_date', 'invoice_datetime', 'ata']
    
    for c in df.columns:
        if c in float_cols:
            df[c] = df[c].apply(parse_float)
        elif c in date_cols:
            df[c] = df[c].apply(parse_date)
        else:
            df[c] = df[c].fillna('').astype(str).str.strip()
            
    # Add report filename
    df['report_filename'] = filename
    
    # Extract starting year of fiscal year from filename (e.g., FinancialAnalysisReport 2021-2022.xlsx)
    def extract_fiscal_year_from_filename(fname):
        try:
            import re
            match = re.search(r'20\d{2}', fname)
            if match:
                return int(match.group())
        except:
            pass
        return None
    df['source_year'] = extract_fiscal_year_from_filename(filename)
    
    # Add timestamps
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    df['createdAt'] = now_str
    df['updatedAt'] = now_str
    
    # Connect and insert in chunks
    conn = get_connection()
    cursor = conn.cursor()
    
    # Delete existing records for this file to support overwrite
    print(f"Clearing old records for filename: {filename}")
    if DB_TYPE == "mysql":
        cursor.execute("DELETE FROM PortRecords WHERE report_filename = %s", (filename,))
        cursor.execute("DELETE FROM UploadedFiles WHERE filename = %s", (filename,))
    else:
        cursor.execute("DELETE FROM PortRecords WHERE report_filename = ?", (filename,))
        cursor.execute("DELETE FROM UploadedFiles WHERE filename = ?", (filename,))
    
    # Save upload record
    print(f"Saving UploadedFile log...")
    if DB_TYPE == "mysql":
        cursor.execute(
            "INSERT INTO UploadedFiles (filename, upload_date, record_count, file_size, createdAt, updatedAt) VALUES (%s, %s, %s, %s, %s, %s)",
            (filename, now_str, record_count, file_size, now_str, now_str)
        )
    else:
        cursor.execute(
            "INSERT INTO UploadedFiles (filename, upload_date, record_count, file_size, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
            (filename, now_str, record_count, file_size, now_str, now_str)
        )
    
    # Batch insert PortRecords
    columns = list(df.columns)
    placeholder = "%s" if DB_TYPE == "mysql" else "?"
    placeholders = ", ".join([placeholder] * len(columns))
    sql = f"INSERT INTO PortRecords ({', '.join(columns)}) VALUES ({placeholders})"
    
    records = df.to_numpy().tolist()
    
    print(f"Bulk inserting {len(records)} records in chunks of 5000...")
    chunk_size = 5000
    for i in range(0, len(records), chunk_size):
        chunk = records[i:i + chunk_size]
        cursor.executemany(sql, chunk)
        
    conn.commit()
    cursor.close()
    conn.close()
    
    elapsed = (datetime.now() - start_time).total_seconds()
    print(f"Successfully ingested {record_count} rows from {filename} in {elapsed:.2f} seconds!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ingest.py <excel_file_path>")
        sys.exit(1)
        
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' does not exist.")
        sys.exit(1)
        
    ingest_file(file_path)
