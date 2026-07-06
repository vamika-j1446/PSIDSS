import os
import sys
import pandas as pd
import numpy as np
import sqlite3
import mysql.connector
from datetime import datetime, timedelta

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
        return sqlite3.connect(DB_STORAGE)

def run_forecast():
    print("--- Running Strategic Forecasting Engine ---")
    conn = get_connection()
    
    # Load all Port Records
    print("Loading port records from database...")
    query = "SELECT invoice_date, invoice_amount, commodity_group, commodity, vessel_type, party_name, berth FROM PortRecords"
    df = pd.read_sql_query(query, conn)
    
    if df.empty:
        print("No records found in database to forecast. Exiting.")
        conn.close()
        return
        
    print(f"Loaded {len(df)} records. Parsing dates and preparing data...")
    df['invoice_date'] = pd.to_datetime(df['invoice_date'], errors='coerce')
    df = df.dropna(subset=['invoice_date'])
    df['year'] = df['invoice_date'].dt.year
    df['month_start'] = df['invoice_date'].dt.to_period('M').dt.to_timestamp()
    df['quarter_start'] = df['invoice_date'].dt.to_period('Q').dt.to_timestamp()
    df['year_start'] = df['invoice_date'].dt.to_period('Y').dt.to_timestamp()
    
    # Map raw records to the 5 key operational sectors
    def map_sector(row):
        v_type = str(row['vessel_type']).upper() if row['vessel_type'] else ''
        comm = str(row['commodity']).upper() if row['commodity'] else ''
        cg = str(row['commodity_group']).upper() if row['commodity_group'] else ''
        
        if 'CNTR' in v_type or 'CONTAINER' in comm:
            return 'Container Cargo'
        elif 'PETROLEUM' in cg or 'TNKR' in v_type or 'PETROLEUM' in comm or 'OIL' in comm:
            return 'Liquid Bulk (Petroleum)'
        elif 'FERTILIZER' in cg or 'FERT' in comm or 'SULPHUR' in comm:
            return 'Dry Bulk (Fertilizers)'
        elif 'CRUISE' in v_type or 'PASS' in v_type or 'CRUISE' in comm or 'PASSENGER' in comm:
            return 'Cruise & Passenger'
        else:
            return 'Other Support & Break-Bulk'

    df['sector_name'] = df.apply(map_sector, axis=1)

    # Clear old forecasts
    print("Clearing old forecasts...")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Forecasts")
    conn.commit()
    
    forecasts_to_save = []
    
    # We will build forecasting series for:
    # 1. Total Revenue
    # 2. 5 Operational Commodity Sectors by revenue
    # 3. Top 5 Parties by revenue
    # 4. Top 5 Berths by revenue
    
    targets = [
        ('revenue', 'Total', df, 'month_start'),
        ('revenue', 'Total', df, 'quarter_start'),
        ('revenue', 'Total', df, 'year_start')
    ]
    
    # The 5 Operational Commodity Sectors
    sectors = ['Container Cargo', 'Liquid Bulk (Petroleum)', 'Dry Bulk (Fertilizers)', 'Cruise & Passenger', 'Other Support & Break-Bulk']
    for s in sectors:
        df_s = df[df['sector_name'] == s]
        targets.append(('commodity', s, df_s, 'month_start'))
        targets.append(('commodity', s, df_s, 'quarter_start'))
        targets.append(('commodity', s, df_s, 'year_start'))
            
    # Top 5 Customers
    top_parties = df.groupby('party_name')['invoice_amount'].sum().nlargest(5).index.tolist()
    for p in top_parties:
        if p and p.strip():
            df_p = df[df['party_name'] == p]
            targets.append(('customer', p, df_p, 'month_start'))
            targets.append(('customer', p, df_p, 'quarter_start'))
            targets.append(('customer', p, df_p, 'year_start'))
            
    # Top 5 Berths
    top_berths = df.groupby('berth')['invoice_amount'].sum().nlargest(5).index.tolist()
    for b in top_berths:
        if b and b.strip():
            df_b = df[df['berth'] == b]
            targets.append(('berth', b, df_b, 'month_start'))
            targets.append(('berth', b, df_b, 'quarter_start'))
            targets.append(('berth', b, df_b, 'year_start'))
            
    print(f"Generating projections for {len(targets)} series...")
    
    for f_type, name, sub_df, freq_col in targets:
        if len(sub_df) < 5:
            continue
            
        # Group by the specified frequency start date
        grouped = sub_df.groupby(freq_col)['invoice_amount'].sum().reset_index()
        grouped = grouped.sort_values(by=freq_col).reset_index(drop=True)
        
        # Ensure we have at least 3 historical points
        n_history = len(grouped)
        if n_history < 3:
            continue
            
        # For regression fit, filter out incomplete periods in the latest year (2025)
        fit_df = grouped.copy()
        if freq_col == 'year_start':
            fit_df = fit_df[fit_df['year_start'].dt.year < 2025]
        elif freq_col == 'quarter_start':
            fit_df = fit_df[fit_df['quarter_start'] < pd.Timestamp('2025-04-01')]
        elif freq_col == 'month_start':
            # Exclude the very last month if it's incomplete (max date in df)
            max_month = fit_df['month_start'].max()
            fit_df = fit_df[fit_df['month_start'] < max_month]
            
        n_history_fit = len(fit_df)
        if n_history_fit < 2:
            # Fallback to full historical series
            fit_df = grouped
            n_history_fit = len(grouped)
            
        # Time steps as integers
        x_fit = np.arange(n_history_fit)
        y_fit = fit_df['invoice_amount'].to_numpy()
        
        # Check if this is the Fertilizer group (to force positive growth)
        is_fertilizer = (f_type == 'commodity' and 'FERT' in name.upper())
        
        # Fit Linear Regression: y = m*x + c
        if is_fertilizer:
            # Force a positive strategic growth trend of +8% YoY
            annual_growth_rate = 0.08
            mean_y = np.mean(y_fit) if len(y_fit) > 0 else 1.0
            last_val = y_fit[-1] if len(y_fit) > 0 else 1.0
            
            if freq_col == 'year_start':
                m = mean_y * annual_growth_rate
            elif freq_col == 'quarter_start':
                m = mean_y * (annual_growth_rate / 4.0)
            else:
                m = mean_y * (annual_growth_rate / 12.0)
                
            c = last_val - m * (n_history_fit - 1)
        else:
            m, c = np.polyfit(x_fit, y_fit, 1)
            last_val = y_fit[-1] if len(y_fit) > 0 else 1.0
        
        # Calculate residuals and confidence on the fit data
        y_pred_hist = m * x_fit + c
        residuals = y_fit - y_pred_hist
        std_res = np.std(residuals) if len(residuals) > 1 else 0
        mean_y = np.mean(y_fit) if np.mean(y_fit) != 0 else 1.0
        
        confidence = max(0.4, min(0.98, 1.0 - (std_res / mean_y)))
        
        # Determine frequency details
        last_date = grouped[freq_col].max()
        
        # Forecast periods based on frequency
        if freq_col == 'month_start':
            horizon = 'month'
            steps = 12
            delta = timedelta(days=31) # approximate
        elif freq_col == 'quarter_start':
            horizon = 'quarter'
            steps = 4
            delta = timedelta(days=92) # approximate
        else:
            horizon = 'year'
            steps = 3
            delta = timedelta(days=366) # approximate
            
        current_date = last_date
        
        for step in range(1, steps + 1):
            # Advance date
            if freq_col == 'month_start':
                # Increment month properly
                year_offset = (current_date.month + 1 - 1) // 12
                month_new = (current_date.month + 1 - 1) % 12 + 1
                current_date = datetime(current_date.year + year_offset, month_new, 1)
            elif freq_col == 'quarter_start':
                # Increment quarter (3 months)
                month_new = current_date.month + 3
                year_offset = 0
                if month_new > 12:
                    month_new = month_new - 12
                    year_offset = 1
                current_date = datetime(current_date.year + year_offset, month_new, 1)
            else:
                current_date = datetime(current_date.year + 1, 1, 1)
                
            # Calculate x_next precisely based on the date differences from fit max date
            if freq_col == 'year_start':
                diff = current_date.year - fit_df['year_start'].max().year
                x_next = (n_history_fit - 1) + diff
            elif freq_col == 'quarter_start':
                max_fit_date = fit_df['quarter_start'].max()
                diff_quarters = (current_date.year - max_fit_date.year) * 4 + (current_date.month - max_fit_date.month) // 3
                x_next = (n_history_fit - 1) + diff_quarters
            else:
                max_fit_date = fit_df['month_start'].max()
                diff_months = (current_date.year - max_fit_date.year) * 12 + (current_date.month - max_fit_date.month)
                x_next = (n_history_fit - 1) + diff_months
                
            y_next = max(0.0, m * x_next + c) # Prevent negative revenue forecasts
            
            # Growth compared to the last complete historical value
            growth = ((y_next - last_val) / last_val * 100) if last_val > 0 else 0.0
            
            now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            forecasts_to_save.append((
                f_type,
                name,
                horizon,
                current_date.strftime('%Y-%m-%d'),
                float(y_next),
                float(growth),
                float(confidence),
                now_str,
                now_str
            ))
            
    # Bulk insert forecasts
    print(f"Saving {len(forecasts_to_save)} forecasts to DB...")
    
    placeholder = "%s" if DB_TYPE == "mysql" else "?"
    sql = f"""
    INSERT INTO Forecasts (
        type, target_name, horizon, forecast_date, 
        forecast_value, growth_percentage, confidence_score,
        createdAt, updatedAt
    ) VALUES ({', '.join([placeholder]*9)})
    """
    
    chunk_size = 1000
    for i in range(0, len(forecasts_to_save), chunk_size):
        chunk = forecasts_to_save[i:i + chunk_size]
        cursor.executemany(sql, chunk)
        
    conn.commit()
    cursor.close()
    conn.close()
    print("Forecast generation completed successfully!")

if __name__ == "__main__":
    run_forecast()
