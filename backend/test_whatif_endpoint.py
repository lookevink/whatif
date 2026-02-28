#!/usr/bin/env python3
"""
Test script for the What-If Scene API
"""

import requests
import json
import os
from datetime import datetime

# API base URL
BASE_URL = "http://localhost:8101"

# Check for Gemini API key
if not os.environ.get("GEMINI_API_KEY"):
    print("⚠️  Warning: GEMINI_API_KEY not set. AI features will use fallback mode.")
    print("   Set it with: export GEMINI_API_KEY='your-key-here'")
    print()

def test_preview_whatif():
    """Test the preview endpoint without creating a branch"""
    print("\n=== Testing Preview What-If ===")

    request_data = {
        "scene_id": "scene_001",
        "act": "act1",
        "what_if_text": "What if Captain Anderson reveals he knows a secret way out through the ice",
        "project_name": "default"
    }

    response = requests.post(
        f"{BASE_URL}/api/studio/whatif/scene/preview",
        json=request_data
    )

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Preview successful!")
        print(f"Original summary: {data['original_yaml'].get('summary', 'N/A')[:50]}...")
        print(f"Modified summary: {data['modified_yaml'].get('summary', 'N/A')[:50]}...")
        print(f"Generated {len(data['story_blocks'])} story blocks")
        print("\nStory blocks:")
        for block in data['story_blocks'][:3]:  # Show first 3 blocks
            print(f"  - {block['type']}: {block['content'][:50]}...")
    else:
        print(f"❌ Preview failed: {response.status_code}")
        print(response.text)

def test_create_whatif_scene():
    """Test creating a what-if branch with scene modifications"""
    print("\n=== Testing Create What-If Scene ===")

    request_data = {
        "scene_id": "scene_001",
        "act": "act1",
        "what_if_text": "What if Chief Officer Larsen confronts the captain about lying to the crew",
        "current_branch": "main",
        "project_name": "default"
    }

    response = requests.post(
        f"{BASE_URL}/api/studio/whatif/scene/create",
        json=request_data
    )

    if response.status_code == 200:
        data = response.json()
        print(f"✅ What-If scene created successfully!")
        print(f"Branch name: {data['branch_name']}")
        print(f"Scene ID: {data['scene_id']}")
        print(f"Commit hash: {data.get('commit_hash', 'N/A')}")
        print(f"Message: {data['message']}")
        print("\nModified YAML summary:")
        print(f"  {data['modified_yaml'].get('summary', 'N/A')[:100]}...")
        print(f"\nGenerated {len(data['story_blocks'])} story blocks")
    else:
        print(f"❌ Creation failed: {response.status_code}")
        print(response.text)

def test_get_scene_branches():
    """Test getting all branches for a scene"""
    print("\n=== Testing Get Scene Branches ===")

    scene_id = "scene_001"
    response = requests.get(f"{BASE_URL}/api/studio/whatif/scene/{scene_id}/branches")

    if response.status_code == 200:
        data = response.json()
        print(f"✅ Found {len(data['branches'])} branches for {scene_id}")
        for branch in data['branches']:
            current = " (current)" if branch['is_current'] else ""
            print(f"  - {branch['name']}{current}")
    else:
        print(f"❌ Failed to get branches: {response.status_code}")

def main():
    print("=" * 50)
    print("What-If Scene API Test Suite")
    print("=" * 50)

    # Test 1: Preview changes without creating branch
    test_preview_whatif()

    # Test 2: Create what-if scene with branch
    # Uncomment to test actual branch creation
    # test_create_whatif_scene()

    # Test 3: Get all branches for a scene
    test_get_scene_branches()

    print("\n" + "=" * 50)
    print("Test suite completed!")

if __name__ == "__main__":
    main()