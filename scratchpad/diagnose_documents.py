#!/usr/bin/env python3
"""
Diagnostic script to test document retrieval flow
"""
import requests
import json
import sys

API_BASE_URL = "http://localhost:5200"

def diagnose():
    print("=== ZeroSec Document Flow Diagnosis ===\n")

    # Step 1: Test backend connectivity
    print("Step 1: Testing backend connectivity...")
    try:
        response = requests.get(f"{API_BASE_URL}/", timeout=2)
        print("OK: Backend is responding (status {})".format(response.status_code))
    except Exception as e:
        print("FAILED: Backend not responding: {}".format(str(e)))
        print("Make sure backend is running: python3 -m backend.app")
        return False

    # Step 2: Login
    print("\nStep 2: Logging in as admin...")
    try:
        response = requests.post(
            f"{API_BASE_URL}/api/auth/login",
            json={"username": "admin", "password": "admin123"},
            headers={"Content-Type": "application/json"}
        )

        if response.status_code != 200:
            print("FAILED: Login failed with status {}".format(response.status_code))
            print("Response: {}".format(response.text))
            return False

        data = response.json()
        token = data.get('access_token')
        user_data = data.get('user', {})

        print("OK: Login successful")
        print("   Token: {}...".format(token[:50]))
        print("   User ID: {}".format(user_data.get('user_id')))
        print("   Organization ID: {}".format(user_data.get('organization_id')))

    except Exception as e:
        print("FAILED: Login error: {}".format(str(e)))
        return False

    # Step 3: Get documents list
    print("\nStep 3: Fetching documents list...")
    try:
        response = requests.get(
            f"{API_BASE_URL}/api/documents",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )

        if response.status_code != 200:
            print("FAILED: Documents list failed with status {}".format(response.status_code))
            print("Response: {}".format(response.text))
            return False

        data = response.json()
        documents = data.get('documents', [])

        print("OK: Got {} documents".format(len(documents)))

        if not documents:
            print("WARNING: No documents in database!")
            print("Need to upload a document first")
            return False

        # Print first few documents
        for i, doc in enumerate(documents[:3]):
            print("   Document {}: id={}, name={}".format(i+1, doc.get('id'), doc.get('name')))

        # Use first document for testing
        test_doc_id = documents[0].get('id')

    except Exception as e:
        print("FAILED: Get documents error: {}".format(str(e)))
        return False

    # Step 4: Get document details
    print("\nStep 4: Fetching document details (id={})...".format(test_doc_id))
    try:
        response = requests.get(
            f"{API_BASE_URL}/api/documents/{test_doc_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )

        print("   Status: {}".format(response.status_code))
        print("   Response: {}".format(response.text[:200]))

        if response.status_code != 200:
            print("FAILED: Document details failed with status {}".format(response.status_code))
            error_data = response.json()
            print("   Error: {}".format(error_data.get('error')))
            return False

        print("OK: Document details retrieved successfully")
        return True

    except Exception as e:
        print("FAILED: Get document error: {}".format(str(e)))
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = diagnose()
    sys.exit(0 if success else 1)
