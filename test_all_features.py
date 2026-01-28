"""
Comprehensive Test Script for ZeroSec Database Integration
Tests all features and endpoints to verify everything is working
"""
import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:5200"
TEST_USER = {
    "username": "testuser",
    "email": "test@zerosec.com",
    "password": "TestPassword123!",
    "organization_name": "Test Org"
}

# Color codes for terminal output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def print_test(test_name):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Testing: {test_name}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")

def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ {message}{RESET}")

def check_response(response, expected_status=200):
    """Check if response is successful"""
    if response.status_code == expected_status:
        print_success(f"Status: {response.status_code}")
        return True
    else:
        print_error(f"Status: {response.status_code}")
        print_error(f"Response: {response.text}")
        return False

# Global token storage
auth_token = None

def test_1_signup():
    """Test user registration"""
    print_test("1. User Signup")

    url = f"{BASE_URL}/api/auth/register"
    response = requests.post(url, json=TEST_USER)

    if check_response(response, 201):
        data = response.json()
        print_success(f"User created: {data.get('user', {}).get('username')}")
        print_info(f"Organization: {data.get('user', {}).get('organization_id')}")
        return True
    return False

def test_2_login():
    """Test user login"""
    print_test("2. User Login")
    global auth_token

    url = f"{BASE_URL}/api/auth/login"
    response = requests.post(url, json={
        "username": TEST_USER["username"],
        "password": TEST_USER["password"]
    })

    if check_response(response, 200):
        data = response.json()
        auth_token = data.get('access_token')
        print_success(f"Login successful!")
        print_info(f"Token: {auth_token[:50]}...")
        return True
    return False

def test_3_dashboard_metrics():
    """Test dashboard metrics endpoints"""
    print_test("3. Dashboard Metrics")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Test overview
    print_info("Testing /api/dashboard/overview")
    response = requests.get(f"{BASE_URL}/api/dashboard/overview", headers=headers)
    if check_response(response):
        data = response.json()
        print_success(f"Documents: {data.get('documents', {}).get('total_documents', 0)}")
        print_success(f"Users: {data.get('users', {}).get('total_users', 0)}")
        print_success(f"Policies: {data.get('policies', {}).get('total_policies', 0)}")

    # Test security metrics
    print_info("\nTesting /api/dashboard/security")
    response = requests.get(f"{BASE_URL}/api/dashboard/security", headers=headers)
    if check_response(response):
        data = response.json()
        print_success(f"Canary tokens: {data.get('total_canaries', 0)}")
        print_success(f"Triggered: {data.get('triggered_canaries', 0)}")

    return True

def test_4_policies():
    """Test policy management"""
    print_test("4. Policy Management")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Create a policy
    print_info("Creating a firewall policy")
    policy_data = {
        "policy_type": "firewall",
        "enabled": True,
        "config": {
            "block_prompt_injection": True,
            "sensitivity_threshold": 0.7
        }
    }
    response = requests.post(f"{BASE_URL}/api/policies", headers=headers, json=policy_data)

    if check_response(response, 201):
        data = response.json()
        policy_id = data.get('policy', {}).get('policy_id')
        print_success(f"Policy created: ID {policy_id}")

        # Get all policies
        print_info("\nGetting all policies")
        response = requests.get(f"{BASE_URL}/api/policies", headers=headers)
        if check_response(response):
            policies = response.json().get('policies', [])
            print_success(f"Found {len(policies)} policies")

        # Toggle policy
        print_info(f"\nToggling policy {policy_id}")
        response = requests.patch(f"{BASE_URL}/api/policies/{policy_id}/toggle", headers=headers)
        if check_response(response):
            print_success("Policy toggled successfully")

        return True
    return False

def test_5_roles():
    """Test RBAC role management"""
    print_test("5. RBAC Role Management")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Get all roles
    print_info("Getting all roles")
    response = requests.get(f"{BASE_URL}/api/roles", headers=headers)

    if check_response(response):
        roles = response.json().get('roles', [])
        print_success(f"Found {len(roles)} roles")
        for role in roles:
            print_info(f"  - {role['name']}: {len(role.get('permissions', []))} permissions")

        # Get available permissions
        print_info("\nGetting available permissions")
        response = requests.get(f"{BASE_URL}/api/permissions", headers=headers)
        if check_response(response):
            perms = response.json().get('permissions', [])
            print_success(f"Found {len(perms)} available permissions")

        return True
    return False

def test_6_alerts():
    """Test alert management"""
    print_test("6. Alert Management")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Get all alerts
    print_info("Getting all alerts")
    response = requests.get(f"{BASE_URL}/api/alerts", headers=headers)

    if check_response(response):
        alerts = response.json().get('alerts', [])
        print_success(f"Found {len(alerts)} alerts")

        # Get alert stats
        print_info("\nGetting alert statistics")
        response = requests.get(f"{BASE_URL}/api/alerts/stats", headers=headers)
        if check_response(response):
            stats = response.json()
            print_success(f"Total alerts: {stats.get('total_alerts', 0)}")
            print_success(f"Open alerts: {stats.get('open_alerts', 0)}")
            print_success(f"Critical alerts: {stats.get('critical_alerts', 0)}")

        return True
    return False

def test_7_rag_query():
    """Test RAG query with database logging"""
    print_test("7. RAG Query (Database Logging)")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Make a RAG query
    print_info("Making a RAG query")
    query_data = {"question": "What is ZeroSec?"}
    response = requests.post(f"{BASE_URL}/query", headers=headers, json=query_data)

    if check_response(response):
        data = response.json()
        print_success(f"Decision: {data.get('decision')}")
        print_success(f"Answer: {data.get('answer', '')[:100]}...")

        # Check if query was saved to database
        print_info("\nChecking RAG query history")
        time.sleep(1)  # Give database time to save
        response = requests.get(f"{BASE_URL}/api/rag/history?limit=1", headers=headers)
        if check_response(response):
            queries = response.json().get('queries', [])
            if queries:
                print_success("Query saved to database!")
                print_info(f"  Question: {queries[0].get('question')}")
                print_info(f"  Response time: {queries[0].get('response_time', 0):.3f}s")
            else:
                print_error("Query not found in database")

        return True
    return False

def test_8_rag_history():
    """Test RAG history endpoints"""
    print_test("8. RAG Query History")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Get query history
    print_info("Getting query history")
    response = requests.get(f"{BASE_URL}/api/rag/history", headers=headers)

    if check_response(response):
        queries = response.json().get('queries', [])
        print_success(f"Found {len(queries)} queries in history")

        # Get RAG stats
        print_info("\nGetting RAG statistics")
        response = requests.get(f"{BASE_URL}/api/rag/stats", headers=headers)
        if check_response(response):
            stats = response.json()
            print_success(f"Total queries: {stats.get('total_queries', 0)}")
            print_success(f"Redacted queries: {stats.get('redacted_queries', 0)}")
            print_success(f"Avg response time: {stats.get('avg_response_time', 0):.3f}s")

        return True
    return False

def test_9_firewall_logs():
    """Test firewall logs"""
    print_test("9. Firewall Logs")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Get firewall logs
    print_info("Getting firewall logs")
    response = requests.get(f"{BASE_URL}/api/firewall/logs", headers=headers)

    if check_response(response):
        logs = response.json().get('logs', [])
        print_success(f"Found {len(logs)} firewall logs")

        # Get firewall stats
        print_info("\nGetting firewall statistics")
        response = requests.get(f"{BASE_URL}/api/firewall/stats", headers=headers)
        if check_response(response):
            stats = response.json()
            print_success(f"Total queries: {stats.get('total_queries', 0)}")
            print_success(f"Blocked queries: {stats.get('blocked_queries', 0)}")
            print_success(f"Block rate: {stats.get('block_rate', 0):.2f}%")

        return True
    return False

def test_10_canary_tokens():
    """Test canary tokens"""
    print_test("10. Canary Tokens")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Get canary tokens
    print_info("Getting canary tokens")
    response = requests.get(f"{BASE_URL}/api/canary/tokens", headers=headers)

    if check_response(response):
        tokens = response.json().get('tokens', [])
        print_success(f"Found {len(tokens)} canary tokens")

        # Get triggered tokens
        print_info("\nGetting triggered canary tokens")
        response = requests.get(f"{BASE_URL}/api/canary/tokens/triggered", headers=headers)
        if check_response(response):
            triggered = response.json().get('triggered_tokens', [])
            print_success(f"Found {len(triggered)} triggered tokens")

        return True
    return False

def test_11_audit_logs():
    """Test audit logs"""
    print_test("11. Audit Logs")

    headers = {"Authorization": f"Bearer {auth_token}"}

    # Get audit logs
    print_info("Getting audit logs")
    response = requests.get(f"{BASE_URL}/api/audit-logs", headers=headers)

    if check_response(response):
        logs = response.json().get('audit_logs', [])
        print_success(f"Found {len(logs)} audit logs")

        # Show recent activity
        if logs:
            print_info("\nRecent activity:")
            for log in logs[:5]:
                print_info(f"  - {log.get('action')}: {log.get('target_type')} (User: {log.get('username', 'N/A')})")

        return True
    return False

def run_all_tests():
    """Run all tests"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}ZeroSec Database Integration Test Suite{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    print_info(f"Backend URL: {BASE_URL}")
    print_info("Starting tests...\n")

    results = []

    # Run tests in order
    tests = [
        ("Signup", test_1_signup),
        ("Login", test_2_login),
        ("Dashboard Metrics", test_3_dashboard_metrics),
        ("Policy Management", test_4_policies),
        ("RBAC Roles", test_5_roles),
        ("Alert System", test_6_alerts),
        ("RAG Query", test_7_rag_query),
        ("RAG History", test_8_rag_history),
        ("Firewall Logs", test_9_firewall_logs),
        ("Canary Tokens", test_10_canary_tokens),
        ("Audit Logs", test_11_audit_logs),
    ]

    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_error(f"Test failed with exception: {e}")
            results.append((test_name, False))
        time.sleep(0.5)  # Small delay between tests

    # Print summary
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Test Summary{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{test_name:.<40} {status}")

    print(f"\n{BLUE}{'='*60}{RESET}")
    if passed == total:
        print(f"{GREEN}✓ All tests passed! ({passed}/{total}){RESET}")
    else:
        print(f"{YELLOW}⚠ {passed}/{total} tests passed{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")

if __name__ == "__main__":
    try:
        run_all_tests()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Tests interrupted by user{RESET}")
    except Exception as e:
        print(f"\n{RED}Fatal error: {e}{RESET}")
