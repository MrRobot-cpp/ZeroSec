import sqlite3
import os

try:
    db_path = 'instance/zerosec.db'
    if not os.path.exists(db_path):
        with open('debug_output.txt', 'w') as f:
            f.write(f'Database not found at {db_path}')
    else:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        # Check AuditLogs
        cursor.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10")
        logs = cursor.fetchall()
        
        # Check Organization
        cursor.execute("SELECT * FROM organisation")
        orgs = cursor.fetchall()
        
        with open('debug_output.txt', 'w') as f:
            f.write(f'Tables: {tables}\n')
            f.write(f'Audit Logs: {logs}\n')
            f.write(f'Organisations: {orgs}\n')
        
        conn.close()
except Exception as e:
    with open('debug_output.txt', 'w') as f:
            f.write(f'Error: {str(e)}')
