#!/usr/bin/env python3
"""
Test script for user management endpoints
"""
import requests
import json

API_BASE_URL = "http://localhost:5200"

def test_users_flow():
    print("=== Testing User Management Endpoints ===\n")

    # Step 1: Login
    print("Step 1: Logging in as admin...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code != 200:
            print("FAILED: Login failed: {}".format(response.status_code))
            print(response.text)
            return

        data = response.json()
        token = data.get('access_token')
        print("OK: Login successful")
        print("   Token: {}...".format(token[:50]))

    except Exception as e:
        print("FAILED: Login error: {}".format(str(e)))
        return

    # Step 2: Get users list
    print("\nStep 2: Getting users list...")
    try:
        response = requests.get(
            f"{API_BASE_URL}/api/users",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )

        if response.status_code != 200:
            print("FAILED: Get users failed: {}".format(response.status_code))
            print(response.text)
            return

        data = response.json()
        users = data.get('users', [])
        print("OK: Got {} users".format(len(users)))
        for user in users:
            print("   - {}: {} ({})".format(user.get('username'), user.get('email'), user.get('status')))

    except Exception as e:
        print("FAILED: Get users error: {}".format(str(e)))
        return

    # Step 3: Create a new user
    print("\nStep 3: Creating a new user...")
    try:
        new_user_data = {
            "username": "testuser",
            "email": "testuser@zerosec.local",
            "password": "TestPassword123",
            "status": "Active"
        }

        response = requests.post(
            f"{API_BASE_URL}/api/users",
            json=new_user_data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )

        print("   Status: {}".format(response.status_code))
        print("   Response: {}".format(response.text[:300]))

        if response.status_code != 201:
            print("FAILED: Create user failed: {}".format(response.status_code))
            return

        created_user = response.json().get('user', {})
        print("OK: User created successfully")
        print("   User ID: {}".format(created_user.get('user_id')))
        print("   Username: {}".format(created_user.get('username')))

    except Exception as e:
        print("FAILED: Create user error: {}".format(str(e)))
        import traceback
        traceback.print_exc()
        return

    # Step 4: Test login with new user
    print("\nStep 4: Testing login with new user...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/auth/login",
            json={"username": "testuser", "password": "TestPassword123"},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code != 200:
            print("FAILED: Login with new user failed: {}".format(response.status_code))
            print(response.text)
            return

        new_token = response.json().get('access_token')
        print("OK: New user login successful")
        print("   Token: {}...".format(new_token[:50]))

    except Exception as e:
        print("FAILED: New user login error: {}".format(str(e)))
        return

    print("\n=== All tests passed! ===")

if __name__ == "__main__":
    try:
        test_users_flow()
    except Exception as e:
        print("FAILED: {}".format(str(e)))
        import traceback
        traceback.print_exc()
