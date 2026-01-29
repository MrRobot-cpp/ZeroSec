#!/usr/bin/env python3
"""
Test script to diagnose policies endpoint issue
"""
import requests
import json

API_BASE_URL = "http://localhost:5200"

def test_policies_flow():
    print("=== Testing Policies Endpoint ===\n")

    # Step 1: Login
    print("1. Logging in...")
    login_response = requests.post(
        f"{API_BASE_URL}/api/auth/login",
        json={"username": "admin", "password": "admin123"},
        headers={"Content-Type": "application/json"}
    )

    if login_response.status_code != 200:
        print("FAILED: Login failed: {}".format(login_response.status_code))
        print(login_response.text)
        return

    login_data = login_response.json()
    token = login_data.get('access_token')
    print("OK: Login successful")
    print("   Token: {}...".format(token[:50]))
    print("   User ID: {}".format(login_data.get('user', {}).get('user_id')))

    # Step 2: Test policies endpoint
    print("\n2. Fetching policies...")
    policies_response = requests.get(
        "{}/api/policies".format(API_BASE_URL),
        headers={
            "Authorization": "Bearer {}".format(token),
            "Content-Type": "application/json"
        }
    )

    print("   Status: {}".format(policies_response.status_code))
    print("   Response: {}".format(policies_response.text))

    if policies_response.status_code == 200:
        policies_data = policies_response.json()
        print("OK: Policies endpoint successful")
        print("   Policies count: {}".format(len(policies_data.get('policies', []))))
        if policies_data.get('policies'):
            print("   First policy: {}".format(json.dumps(policies_data['policies'][0], indent=2)))
    else:
        print("FAILED: Policies endpoint failed: {}".format(policies_response.status_code))
        try:
            error_data = policies_response.json()
            print("   Error details: {}".format(error_data))
        except:
            print("   Raw response: {}".format(policies_response.text))

if __name__ == "__main__":
    try:
        test_policies_flow()
    except Exception as e:
        print("FAILED: Error: {}".format(e))
        import traceback
        traceback.print_exc()
