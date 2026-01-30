import requests
import json
import random
import string
import time

API_BASE_URL = "http://localhost:5200"

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase, k=length))

def run_reproduction():
    print("=== Reproduction Script: Missing Default Roles ===\n")

    # Generate random credentials
    rand = generate_random_string()
    username = f"admin_{rand}"
    email = f"admin_{rand}@example.com"
    password = "SecurePassword123!"
    org_name = f"Org_{rand}"

    print(f"Test Configuration:")
    print(f" - Username: {username}")
    print(f" - Email: {email}")
    print(f" - Organization: {org_name}")

    # Step 1: Register
    print("\nStep 1: Registering new organization...")
    payload = {
        "username": username,
        "email": email,
        "password": password,
        "organization_name": org_name,
        "planId": 1  # Assuming 1 is Free plan
    }
    
    try:
        response = requests.post(f"{API_BASE_URL}/api/auth/register", json=payload)
        if response.status_code != 201:
            print(f"FAILED: Registration failed with {response.status_code}")
            print(response.text)
            return False
        print("OK: Registration successful")
    except Exception as e:
        print(f"FAILED: Registration error: {e}")
        return False

    # Step 2: Login
    print("\nStep 2: Logging in...")
    try:
        resp = requests.post(f"{API_BASE_URL}/api/auth/login", json={
            "username": username,
            "password": password
        })
        if resp.status_code != 200:
            print(f"FAILED: Login failed with {resp.status_code}")
            return False
            
        data = resp.json()
        token = data.get("access_token")
        user = data.get("user", {})
        roles = user.get("roles", [])
        
        print(f"OK: Login successful. Token obtained.")
        print(f"User Roles in Login Response: {roles}")
        
    except Exception as e:
        print(f"FAILED: Login error: {e}")
        return False

    # Step 3: Verify Roles via API
    print("\nStep 3: Checking roles via /api/roles and /api/auth/me...")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Check current user info
    try:
        me_resp = requests.get(f"{API_BASE_URL}/api/auth/me", headers=headers)
        if me_resp.status_code == 200:
            me_data = me_resp.json().get("user", {})
            me_roles = me_data.get("roles", [])
            print(f"Current User Roles: {me_roles}")
            
            if not me_roles:
                print(">>> ISSUE REPRODUCED: User has NO roles assigned!")
            else:
                print(f"User has roles: {me_roles}")
        else:
            print(f"Failed to get /me info: {me_resp.status_code}")
    except Exception as e:
        print(f"Error checking /me: {e}")

    # Check available roles in org
    try:
        roles_resp = requests.get(f"{API_BASE_URL}/api/roles", headers=headers)
        if roles_resp.status_code == 200:
            roles_data = roles_resp.json().get("roles", [])
            role_names = [r["name"] for r in roles_data]
            print(f"Available Roles in Org: {role_names}")
            
            expected_roles = ["Super Admin", "Admin", "User", "Read Only", "Security Admin"]
            missing_roles = [r for r in expected_roles if r not in role_names]
            
            if missing_roles:
                print(f">>> ISSUE REPRODUCED: Missing default roles: {missing_roles}")
                return False
            else:
                print("All default roles exist.")
                
            # Check permissions of the first role (Super Admin likely)
            first_role_permissions = roles_data[0].get('permissions', [])
            print(f"Permissions for {roles_data[0]['name']}: {first_role_permissions}")
            
            required_generic = {'admin', 'read', 'create', 'update', 'delete'}
            has_generic = any(p in required_generic for p in first_role_permissions)
            
            if not has_generic:
                 print(f">>> ISSUE REPRODUCED: Role exists but missing generic permissions (admin, read, etc) required by Frontend!")
                 return False
            else:
                 print("SUCCESS: Role has generic permissions required by Frontend.")
        else:
            print(f"Failed to list roles: {roles_resp.status_code}")
    except Exception as e:
        print(f"Error checking roles: {e}")

    return True

if __name__ == "__main__":
    run_reproduction()
