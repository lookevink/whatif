"""
What-If Intent Processing API
Handles voice transcription analysis and scene modifications
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import subprocess
import os
from datetime import datetime
import re

app = FastAPI(title="WhatIf Studio API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WhatIfContext(BaseModel):
    characters: List[str]
    location: Optional[str]
    currentDialogue: Optional[List[Dict[str, Any]]]

class WhatIfAnalyzeRequest(BaseModel):
    query: str
    sceneId: str
    branch: str
    context: WhatIfContext

class Intent(BaseModel):
    type: str
    target: Dict[str, str]
    modification: Dict[str, Any]
    confidence: float
    originalQuery: str

class SceneModification(BaseModel):
    sceneId: str
    branch: str
    description: str
    changes: Dict[str, Any]
    impact: List[str]

class WhatIfApplyRequest(BaseModel):
    sceneId: str
    branch: str
    description: str
    changes: Dict[str, Any]
    impact: List[str]

@app.post("/api/studio/whatif/analyze")
async def analyze_whatif(request: WhatIfAnalyzeRequest):
    """
    Analyze a what-if query and generate intent + modifications
    """
    try:
        # Parse the query to understand intent
        intent = parse_intent(request.query, request.context)

        # Generate scene modifications based on intent
        modification = generate_modification(
            intent,
            request.sceneId,
            request.branch
        )

        return {
            "intent": intent.dict(),
            "modification": modification.dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def parse_intent(query: str, context: WhatIfContext) -> Intent:
    """
    Parse natural language query into structured intent
    """
    query_lower = query.lower()

    # Determine intent type
    intent_type = "dialogue"  # default
    if any(word in query_lower for word in ["camera", "shot", "zoom", "angle", "perspective"]):
        intent_type = "camera"
    elif any(word in query_lower for word in ["emotion", "feel", "mood", "angry", "sad", "happy"]):
        intent_type = "emotion"
    elif any(word in query_lower for word in ["move", "walk", "leave", "enter", "exit", "action"]):
        intent_type = "action"
    elif any(word in query_lower for word in ["says", "tell", "reveal", "speak", "dialogue"]):
        intent_type = "dialogue"
    elif any(word in query_lower for word in ["earlier", "later", "before", "after", "timing"]):
        intent_type = "timeline"

    # Extract target entity
    target_entity = "scene"
    for character in context.characters:
        if character.lower() in query_lower:
            target_entity = character
            break

    # Determine property
    property_map = {
        "dialogue": "speech",
        "action": "movement",
        "emotion": "emotional_state",
        "camera": "shot_type",
        "timeline": "timing"
    }
    target_property = property_map.get(intent_type, "state")

    # Determine action
    action = "modify"
    if "remove" in query_lower or "delete" in query_lower:
        action = "remove"
    elif "add" in query_lower or "insert" in query_lower:
        action = "add"
    elif "replace" in query_lower or "change" in query_lower:
        action = "replace"

    return Intent(
        type=intent_type,
        target={
            "entity": target_entity,
            "property": target_property
        },
        modification={
            "action": action,
            "value": extract_value(query, intent_type),
            "context": f"Scene context with {len(context.characters)} characters"
        },
        confidence=calculate_confidence(query, intent_type),
        originalQuery=query
    )

def extract_value(query: str, intent_type: str) -> Any:
    """
    Extract the value/content from the query based on intent type
    """
    if intent_type == "dialogue":
        # Extract quoted text or everything after "says"
        quoted = re.findall(r'"([^"]*)"', query)
        if quoted:
            return quoted[0]

        # Look for text after key words
        patterns = [
            r"says?\s+(.+)",
            r"tells?\s+\w+\s+(.+)",
            r"reveals?\s+(.+)"
        ]
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return match.group(1).strip()

    elif intent_type == "emotion":
        emotions = ["angry", "sad", "happy", "confused", "betrayed", "shocked", "calm"]
        for emotion in emotions:
            if emotion in query.lower():
                return emotion

    elif intent_type == "camera":
        shots = ["close-up", "wide", "medium", "overhead", "pov", "tracking"]
        for shot in shots:
            if shot in query.lower():
                return shot

    return query  # Default to full query

def calculate_confidence(query: str, intent_type: str) -> float:
    """
    Calculate confidence score based on query clarity
    """
    confidence = 0.5  # Base confidence

    # Boost for specific keywords
    if intent_type == "dialogue" and ("says" in query.lower() or "tells" in query.lower()):
        confidence += 0.2

    # Boost for quoted content
    if '"' in query:
        confidence += 0.15

    # Boost for character names mentioned
    character_names = ["marcus", "jane", "detective", "cole"]
    if any(name in query.lower() for name in character_names):
        confidence += 0.1

    # Length penalty for very short queries
    if len(query.split()) < 5:
        confidence -= 0.1

    return min(max(confidence, 0.1), 1.0)

def generate_modification(intent: Intent, scene_id: str, branch: str) -> SceneModification:
    """
    Generate scene modifications based on intent
    """
    # Generate branch name
    branch_name = create_branch_name(intent, scene_id)

    # Build changes based on intent type
    changes = {}

    if intent.type == "dialogue":
        changes["dialogue"] = [{
            "type": intent.modification["action"],
            "characterId": intent.target["entity"],
            "newLine": intent.modification["value"],
            "delivery": "determined"
        }]

    elif intent.type == "action":
        changes["blocking"] = [{
            "characterId": intent.target["entity"],
            "action": intent.modification["value"],
            "timing": "immediate"
        }]

    elif intent.type == "emotion":
        changes["emotion"] = [{
            "characterId": intent.target["entity"],
            "emotion": intent.modification["value"],
            "intensity": 0.8
        }]

    elif intent.type == "camera":
        changes["camera"] = [{
            "shotId": f"shot_{datetime.now().strftime('%H%M%S')}",
            "property": "type",
            "newValue": intent.modification["value"]
        }]

    # Determine impact
    impact = analyze_impact(intent, changes)

    return SceneModification(
        sceneId=scene_id,
        branch=branch_name,
        description=intent.originalQuery,
        changes=changes,
        impact=impact
    )

def create_branch_name(intent: Intent, scene_id: str) -> str:
    """
    Create a git branch name from intent
    """
    # Simplify the query for branch name
    simplified = re.sub(r'[^\w\s]', '', intent.originalQuery.lower())
    words = simplified.split()[:3]

    timestamp = datetime.now().strftime('%y%m%d-%H%M')
    return f"whatif/{scene_id}/{'-'.join(words)}-{timestamp}"

def analyze_impact(intent: Intent, changes: Dict) -> List[str]:
    """
    Analyze the potential impact of the changes
    """
    impact = []

    if "dialogue" in changes:
        impact.append("Character dialogue modified")
        impact.append("Scene pacing may change")
        if intent.target["entity"] != "scene":
            impact.append(f"{intent.target['entity']}'s arc affected")

    if "action" in changes:
        impact.append("Character blocking changed")
        impact.append("Visual composition altered")

    if "emotion" in changes:
        impact.append("Emotional dynamics shifted")
        impact.append("Performance notes updated")

    if "camera" in changes:
        impact.append("Visual storytelling changed")
        impact.append("Shot composition modified")

    return impact if impact else ["Scene modified"]

@app.post("/api/studio/whatif/apply")
async def apply_whatif(request: WhatIfApplyRequest):
    """
    Apply the what-if modifications by creating a git branch and modifying files
    """
    try:
        project_path = os.environ.get("WHATIF_PROJECT_PATH", "../")

        # Create git branch
        branch_created = create_git_branch(request.branch, project_path)

        # Apply modifications to scene files
        files_modified = apply_scene_modifications(
            request.sceneId,
            request.changes,
            project_path
        )

        # Commit changes
        commit_hash = commit_changes(
            request.description,
            files_modified,
            project_path
        )

        return {
            "success": True,
            "branch": request.branch,
            "commit": commit_hash,
            "filesModified": files_modified
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def create_git_branch(branch_name: str, project_path: str) -> bool:
    """
    Create a new git branch
    """
    try:
        # Check if branch exists
        result = subprocess.run(
            ["git", "branch", "--list", branch_name],
            cwd=project_path,
            capture_output=True,
            text=True
        )

        if result.stdout.strip():
            # Branch exists, switch to it
            subprocess.run(
                ["git", "checkout", branch_name],
                cwd=project_path,
                check=True
            )
        else:
            # Create new branch
            subprocess.run(
                ["git", "checkout", "-b", branch_name],
                cwd=project_path,
                check=True
            )

        return True
    except subprocess.CalledProcessError as e:
        raise Exception(f"Failed to create branch: {e}")

def apply_scene_modifications(scene_id: str, changes: Dict, project_path: str) -> List[str]:
    """
    Apply modifications to scene YAML files
    """
    import yaml

    modified_files = []

    # Determine act from scene_id
    scene_num = int(re.findall(r'\d+', scene_id)[0]) if re.findall(r'\d+', scene_id) else 1
    act = "act1" if scene_num <= 4 else "act2" if scene_num <= 9 else "act3"

    scene_path = os.path.join(project_path, "scenes", act, scene_id)

    # Modify dialogue.json if dialogue changes exist
    if "dialogue" in changes:
        dialogue_file = os.path.join(scene_path, "dialogue.json")
        try:
            with open(dialogue_file, 'r') as f:
                dialogue = json.load(f)

            for change in changes["dialogue"]:
                if change["type"] == "add":
                    dialogue.append({
                        "character": change["characterId"],
                        "line": change["newLine"],
                        "delivery": change.get("delivery", "")
                    })

            with open(dialogue_file, 'w') as f:
                json.dump(dialogue, f, indent=2)

            modified_files.append(dialogue_file)
        except FileNotFoundError:
            # Create new dialogue file
            dialogue = []
            for change in changes["dialogue"]:
                dialogue.append({
                    "character": change["characterId"],
                    "line": change["newLine"],
                    "delivery": change.get("delivery", "")
                })

            os.makedirs(scene_path, exist_ok=True)
            with open(dialogue_file, 'w') as f:
                json.dump(dialogue, f, indent=2)

            modified_files.append(dialogue_file)

    # Modify camera.yaml if camera changes exist
    if "camera" in changes:
        camera_file = os.path.join(scene_path, "camera.yaml")
        try:
            with open(camera_file, 'r') as f:
                camera = yaml.safe_load(f)

            if not camera:
                camera = {"shots": []}

            for change in changes["camera"]:
                camera["shots"].append({
                    "id": change["shotId"],
                    "type": change["newValue"],
                    "generated": True
                })

            with open(camera_file, 'w') as f:
                yaml.dump(camera, f)

            modified_files.append(camera_file)
        except FileNotFoundError:
            pass

    return modified_files

def commit_changes(description: str, files: List[str], project_path: str) -> str:
    """
    Commit the changes to git
    """
    try:
        # Add files
        for file in files:
            subprocess.run(
                ["git", "add", file],
                cwd=project_path,
                check=True
            )

        # Commit
        commit_message = f"What-if: {description}\n\n🤖 Generated by Voice What-If"
        result = subprocess.run(
            ["git", "commit", "-m", commit_message],
            cwd=project_path,
            capture_output=True,
            text=True,
            check=True
        )

        # Get commit hash
        commit_hash = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=project_path,
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()

        return commit_hash[:7]
    except subprocess.CalledProcessError as e:
        raise Exception(f"Failed to commit changes: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)