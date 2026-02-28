import sqlite3
import os
import json

DB_PATH = os.path.join("backend", "dukansathi_offline.db")

def check_db():
    if not os.path.exists(DB_PATH):
        print(f"DB not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    tables = ["local_sales", "local_payments", "customers", "products"]
    
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
            count = cursor.fetchone()["count"]
            print(f"\n--- Table {table}: {count} records ---")
            
            if count > 0:
                cursor.execute(f"SELECT * FROM {table} ORDER BY id DESC LIMIT 5")
                rows = cursor.fetchall()
                for row in rows:
                    rd = dict(row)
                    # Try to parse items if it's sales or invoices
                    if 'items' in rd and isinstance(rd['items'], str):
                        try:
                            rd['items'] = json.loads(rd['items'])
                        except:
                            pass
                    print(f"  {rd}")
        except Exception as e:
            print(f"Error checking {table}: {e}")
            
    conn.close()

if __name__ == "__main__":
    check_db()
