"""
Database Verification Script
Checks if all tables and columns are created correctly
"""
import sqlite3
import os

DB_PATH = "instance/zerosec.db"

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ {message}{RESET}")

def print_header(message):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{message}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

# Expected tables and their key columns
EXPECTED_SCHEMA = {
    "organisation": ["organization_id", "name", "created_at"],
    "departments": ["department_id", "organization_id", "name"],
    "users": ["user_id", "organization_id", "username", "email", "password_hash"],
    "roles": ["role_id", "organization_id", "name", "description"],
    "role_permissions": ["role_permission_id", "role_id", "permission"],
    "user_roles": ["user_role_id", "user_id", "role_id"],
    "clearance_levels": ["clearance_level_id", "organization_id", "name", "level"],
    "policies": ["policy_id", "organization_id", "policy_type", "config", "enabled"],
    "documents": ["document_id", "organization_id", "filename", "storage_ref", "sensitivity"],
    "uploads": ["upload_id", "organization_id", "user_id", "filename"],
    "canary_tokens": ["canary_token_id", "canary_id", "organization_id", "user_id", "filename", "token_hash", "is_triggered", "created_at"],
    "subscriptions": ["subscription_id", "organization_id", "plan_id", "status"],
    "plans": ["plan_id", "name", "description"],
    "usage_metrics": ["usage_metric_id", "subscription_id", "metric_type", "metric_value"],
    "audit_logs": ["audit_id", "organization_id", "user_id", "action", "target_type", "created_at"],
    "alerts": ["alert_id", "organization_id", "alert_type", "severity", "title", "status", "created_at"],
    "firewall_logs": ["log_id", "organization_id", "user_id", "query", "decision", "reason", "timestamp"],
    "rag_queries": ["query_id", "organization_id", "user_id", "question", "answer", "decision", "redacted", "timestamp", "response_time"]
}

def check_database_exists():
    """Check if database file exists"""
    print_header("1. Checking Database File")

    if os.path.exists(DB_PATH):
        size = os.path.getsize(DB_PATH)
        print_success(f"Database file exists: {DB_PATH}")
        print_info(f"Size: {size:,} bytes ({size/1024:.2f} KB)")
        return True
    else:
        print_error(f"Database file not found: {DB_PATH}")
        print_info("Run the backend first to create the database: python Backend/app.py")
        return False

def get_table_info(cursor, table_name):
    """Get columns for a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]

def check_tables():
    """Check if all expected tables exist with correct columns"""
    print_header("2. Checking Database Tables")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    existing_tables = {row[0] for row in cursor.fetchall()}

    print_info(f"Found {len(existing_tables)} tables in database\n")

    all_correct = True

    for table_name, expected_columns in EXPECTED_SCHEMA.items():
        if table_name in existing_tables:
            # Check columns
            actual_columns = get_table_info(cursor, table_name)
            missing_columns = set(expected_columns) - set(actual_columns)

            if missing_columns:
                print_error(f"{table_name}: Missing columns {missing_columns}")
                all_correct = False
            else:
                print_success(f"{table_name}: ✓ ({len(actual_columns)} columns)")
        else:
            print_error(f"{table_name}: Table does not exist!")
            all_correct = False

    # Check for unexpected tables
    expected_table_names = set(EXPECTED_SCHEMA.keys())
    unexpected_tables = existing_tables - expected_table_names
    if unexpected_tables:
        print_info(f"\nAdditional tables found: {unexpected_tables}")

    conn.close()
    return all_correct

def check_data_counts():
    """Check row counts in each table"""
    print_header("3. Checking Data Counts")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for table_name in EXPECTED_SCHEMA.keys():
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]

            if count > 0:
                print_success(f"{table_name}: {count} rows")
            else:
                print_info(f"{table_name}: 0 rows (empty)")
        except sqlite3.Error as e:
            print_error(f"{table_name}: Error - {e}")

    conn.close()

def check_default_data():
    """Check if default data was created"""
    print_header("4. Checking Default Data")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    checks = [
        ("Default Organization", "SELECT COUNT(*) FROM organisation WHERE name='Default Organization'", 1),
        ("Default Roles", "SELECT COUNT(*) FROM roles", 3),  # Admin, User, SecurityAdmin
        ("Clearance Levels", "SELECT COUNT(*) FROM clearance_levels", 5),  # Public, Internal, Confidential, Secret, Top Secret
        ("Plans", "SELECT COUNT(*) FROM plans", None),  # May vary
    ]

    for check_name, query, expected_count in checks:
        try:
            cursor.execute(query)
            count = cursor.fetchone()[0]

            if expected_count is None:
                print_info(f"{check_name}: {count} found")
            elif count >= expected_count:
                print_success(f"{check_name}: {count} found (expected {expected_count}+)")
            else:
                print_error(f"{check_name}: {count} found (expected {expected_count}+)")
        except sqlite3.Error as e:
            print_error(f"{check_name}: Error - {e}")

    conn.close()

def check_indexes():
    """Check if indexes are created"""
    print_header("5. Checking Database Indexes")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name")
    indexes = cursor.fetchall()

    if indexes:
        print_success(f"Found {len(indexes)} custom indexes")
        for idx_name, tbl_name in indexes:
            print_info(f"  {tbl_name}.{idx_name}")
    else:
        print_info("No custom indexes found (this is okay)")

    conn.close()

def main():
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}ZeroSec Database Verification{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

    # Step 1: Check database exists
    if not check_database_exists():
        return

    # Step 2: Check tables
    tables_ok = check_tables()

    # Step 3: Check data counts
    check_data_counts()

    # Step 4: Check default data
    check_default_data()

    # Step 5: Check indexes
    check_indexes()

    # Summary
    print_header("Summary")

    if tables_ok:
        print_success("✓ All expected tables and columns are present!")
        print_success("✓ Database schema is correct!")
        print_info("\nYou can now run the test suite: python test_all_features.py")
    else:
        print_error("✗ Some tables or columns are missing!")
        print_info("Try deleting the database and restarting the backend to recreate it.")

    print(f"\n{BLUE}{'='*60}{RESET}\n")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print_error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
