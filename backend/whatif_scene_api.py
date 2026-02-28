"""
What-If Scene Branching API
Creates narrative branches and modifies scene YAML files using AI
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import yaml
import subprocess
import os
from datetime import datetime
import re
import asyncio
from pathlib import Path
from openai import OpenAI
import anthropic

app = FastAPI(title="WhatIf Scene API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI clients (choose one based on your preference)
try:
    # Try OpenAI first
    openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    ai_provider = "openai"
except:
    openai_client = None
    ai_provider = None

try:
    # Try Anthropic as fallback
    anthropic_client = anthropic.Client(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    if not ai_provider:
        ai_provider = "anthropic"
except:
    anthropic_client = None

class WhatIfSceneRequest(BaseModel):
    """Request model for what-if scene modification"""
    scene_id: str
    act: str
    what_if_text: str
    current_branch: Optional[str] = "main"
    project_name: Optional[str] = "default"

class SceneYAML(BaseModel):
    """Scene YAML structure"""
    act: str
    character_ids: List[str]
    heading: str
    id: str
    location_id: str
    scene_order: int
    summary: str
    dialogue: Optional[List[Dict[str, Any]]] = []
    actions: Optional[List[Dict[str, Any]]] = []
    camera: Optional[Dict[str, Any]] = {}

class StoryBlock(BaseModel):
    """Generated story block from scene"""
    type: str  # narrative, dialogue, action, transition
    content: str
    character: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

class WhatIfSceneResponse(BaseModel):
    """Response model for what-if scene modification"""
    success: bool
    branch_name: str
    scene_id: str
    modified_yaml: Dict[str, Any]
    story_blocks: List[Dict[str, Any]]
    commit_hash: Optional[str] = None
    message: str

@app.post("/api/studio/whatif/scene/create", response_model=WhatIfSceneResponse)
async def create_whatif_scene(request: WhatIfSceneRequest):
    """
    Create a what-if branch with AI-modified scene YAML and generate story blocks
    """
    try:
        # Step 1: Load current scene YAML
        scene_yaml = load_scene_yaml(request.scene_id, request.act, request.project_name)

        # Step 2: Generate descriptive branch name
        branch_name = generate_branch_name(request.scene_id, request.what_if_text)

        # Step 3: Create git branch
        create_branch_success = await create_git_branch(branch_name, request.current_branch)

        # Step 4: Use AI to modify scene YAML based on what-if text
        modified_yaml = await ai_modify_scene(scene_yaml, request.what_if_text)

        # Step 5: Save modified YAML to new branch
        save_path = save_modified_yaml(
            request.scene_id,
            request.act,
            request.project_name,
            modified_yaml
        )

        # Step 6: Generate story blocks from modified YAML
        story_blocks = generate_story_blocks(modified_yaml)

        # Step 7: Commit changes
        commit_hash = commit_whatif_changes(
            branch_name,
            request.what_if_text,
            [save_path]
        )

        return WhatIfSceneResponse(
            success=True,
            branch_name=branch_name,
            scene_id=request.scene_id,
            modified_yaml=modified_yaml,
            story_blocks=story_blocks,
            commit_hash=commit_hash,
            message=f"Successfully created what-if branch: {branch_name}"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def load_scene_yaml(scene_id: str, act: str, project_name: str) -> Dict[str, Any]:
    """Load the current scene YAML file"""
    scene_path = Path(f".studio/projects/{project_name}/scenes/{act}/{scene_id}/scene.yaml")

    if not scene_path.exists():
        raise HTTPException(status_code=404, detail=f"Scene file not found: {scene_path}")

    with open(scene_path, 'r') as f:
        return yaml.safe_load(f)

def generate_branch_name(scene_id: str, what_if_text: str) -> str:
    """Generate a descriptive branch name from the what-if text"""
    # Clean and simplify the what-if text
    cleaned = re.sub(r'[^\w\s]', '', what_if_text.lower())
    words = cleaned.split()[:4]  # Take first 4 words

    # Remove common words
    stop_words = ['what', 'if', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at']
    words = [w for w in words if w not in stop_words][:3]

    # Generate timestamp
    timestamp = datetime.now().strftime('%y%m%d_%H%M')

    # Construct branch name
    branch_base = '-'.join(words) if words else 'scenario'
    return f"whatif/{scene_id}/{branch_base}_{timestamp}"

async def create_git_branch(branch_name: str, base_branch: str = "main") -> bool:
    """Create a new git branch"""
    try:
        # Check current branch
        current = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True
        ).stdout.strip()

        # Switch to base branch if needed
        if current != base_branch:
            subprocess.run(["git", "checkout", base_branch], check=True)

        # Pull latest changes
        subprocess.run(["git", "pull", "origin", base_branch], capture_output=True)

        # Create and checkout new branch
        subprocess.run(["git", "checkout", "-b", branch_name], check=True)

        return True
    except subprocess.CalledProcessError as e:
        # Try to checkout if branch already exists
        try:
            subprocess.run(["git", "checkout", branch_name], check=True)
            return True
        except:
            raise Exception(f"Failed to create branch {branch_name}: {e}")

async def ai_modify_scene(scene_yaml: Dict[str, Any], what_if_text: str) -> Dict[str, Any]:
    """Use AI to modify the scene YAML based on what-if text"""

    # Create a deep copy of the scene
    modified_scene = json.loads(json.dumps(scene_yaml))

    # Prepare the prompt for AI
    prompt = f"""
    Given this scene YAML:
    {yaml.dump(scene_yaml, default_flow_style=False)}

    Apply this "what if" scenario: {what_if_text}

    Modify the scene YAML to reflect this change. You can modify:
    - summary: Update the scene summary
    - character_ids: Add or remove characters
    - location_id: Change location if needed
    - heading: Update the scene heading
    - Add dialogue array with character lines
    - Add actions array with character actions
    - Add camera object with shot information

    Return ONLY a valid YAML structure with your modifications.
    Ensure the YAML maintains the original structure but with your what-if changes applied.
    """

    try:
        if ai_provider == "openai" and openai_client:
            response = openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a screenplay editor that modifies scene descriptions based on 'what if' scenarios. Return only valid YAML."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            modified_yaml_text = response.choices[0].message.content

        elif ai_provider == "anthropic" and anthropic_client:
            response = anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1000,
                temperature=0.7,
                system="You are a screenplay editor that modifies scene descriptions based on 'what if' scenarios. Return only valid YAML.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            modified_yaml_text = response.content[0].text

        else:
            # Fallback: Simple rule-based modification
            return apply_simple_modifications(scene_yaml, what_if_text)

        # Parse the AI response as YAML
        # Clean the response to ensure it's valid YAML
        modified_yaml_text = modified_yaml_text.strip()
        if modified_yaml_text.startswith("```yaml"):
            modified_yaml_text = modified_yaml_text[7:]
        if modified_yaml_text.startswith("```"):
            modified_yaml_text = modified_yaml_text[3:]
        if modified_yaml_text.endswith("```"):
            modified_yaml_text = modified_yaml_text[:-3]

        modified_scene = yaml.safe_load(modified_yaml_text)

        # Ensure required fields are present
        if 'id' not in modified_scene:
            modified_scene['id'] = scene_yaml['id']
        if 'act' not in modified_scene:
            modified_scene['act'] = scene_yaml['act']

        return modified_scene

    except Exception as e:
        print(f"AI modification failed: {e}")
        # Fallback to simple modifications
        return apply_simple_modifications(scene_yaml, what_if_text)

def apply_simple_modifications(scene_yaml: Dict[str, Any], what_if_text: str) -> Dict[str, Any]:
    """Apply simple rule-based modifications when AI is not available"""
    modified = json.loads(json.dumps(scene_yaml))

    # Add what-if to summary
    original_summary = modified.get('summary', '')
    modified['summary'] = f"{original_summary} [WHAT-IF: {what_if_text}]"

    # Detect and apply simple changes
    what_if_lower = what_if_text.lower()

    # Character additions
    if 'enters' in what_if_lower or 'arrives' in what_if_lower:
        # Try to extract character name
        words = what_if_text.split()
        for i, word in enumerate(words):
            if word.lower() in ['enters', 'arrives'] and i > 0:
                potential_character = words[i-1].lower().replace(',', '').replace('.', '')
                if potential_character not in modified.get('character_ids', []):
                    modified.setdefault('character_ids', []).append(potential_character)
                break

    # Dialogue additions
    if 'says' in what_if_lower or 'tells' in what_if_lower:
        # Extract potential dialogue
        quote_match = re.search(r'"([^"]*)"', what_if_text)
        if quote_match:
            dialogue_text = quote_match.group(1)
            # Try to find who says it
            before_quote = what_if_text[:quote_match.start()].lower()
            speaker = 'unknown'
            for char_id in modified.get('character_ids', []):
                if char_id.lower() in before_quote:
                    speaker = char_id
                    break

            modified.setdefault('dialogue', []).append({
                'character': speaker,
                'line': dialogue_text
            })

    # Action additions
    action_words = ['moves', 'walks', 'runs', 'leaves', 'exits', 'fights', 'embraces']
    for action_word in action_words:
        if action_word in what_if_lower:
            modified.setdefault('actions', []).append({
                'description': what_if_text,
                'type': action_word
            })
            break

    # Camera changes
    camera_words = ['close-up', 'wide shot', 'zoom', 'pan', 'tracking shot']
    for camera_word in camera_words:
        if camera_word in what_if_lower:
            modified.setdefault('camera', {})['shot_type'] = camera_word
            break

    return modified

def save_modified_yaml(scene_id: str, act: str, project_name: str, modified_yaml: Dict[str, Any]) -> str:
    """Save the modified YAML to the scene directory"""
    scene_dir = Path(f".studio/projects/{project_name}/scenes/{act}/{scene_id}")
    scene_dir.mkdir(parents=True, exist_ok=True)

    scene_path = scene_dir / "scene.yaml"

    with open(scene_path, 'w') as f:
        yaml.dump(modified_yaml, f, default_flow_style=False, sort_keys=False)

    return str(scene_path)

def generate_story_blocks(modified_yaml: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate story blocks from the modified YAML"""
    blocks = []

    # Opening narrative block
    blocks.append({
        "type": "heading",
        "content": modified_yaml.get('heading', 'SCENE')
    })

    # Summary as narrative
    if 'summary' in modified_yaml:
        blocks.append({
            "type": "narrative",
            "content": modified_yaml['summary']
        })

    # Character entrance
    if 'character_ids' in modified_yaml and modified_yaml['character_ids']:
        characters = ', '.join([c.replace('_', ' ').title() for c in modified_yaml['character_ids']])
        blocks.append({
            "type": "action",
            "content": f"Present: {characters}"
        })

    # Add dialogue blocks
    if 'dialogue' in modified_yaml:
        for dialogue in modified_yaml['dialogue']:
            character = dialogue.get('character', 'UNKNOWN').replace('_', ' ').upper()
            line = dialogue.get('line', '')
            blocks.append({
                "type": "dialogue",
                "character": character,
                "content": line
            })

            # Add delivery/action if specified
            if 'delivery' in dialogue:
                blocks.append({
                    "type": "parenthetical",
                    "content": f"({dialogue['delivery']})"
                })

    # Add action blocks
    if 'actions' in modified_yaml:
        for action in modified_yaml['actions']:
            blocks.append({
                "type": "action",
                "content": action.get('description', action.get('type', 'Action'))
            })

    # Camera instructions
    if 'camera' in modified_yaml:
        camera_info = modified_yaml['camera']
        if 'shot_type' in camera_info:
            blocks.append({
                "type": "camera",
                "content": f"[{camera_info['shot_type'].upper()}]"
            })

    # Transition
    if not blocks:
        blocks.append({
            "type": "transition",
            "content": "CUT TO:"
        })

    return blocks

def commit_whatif_changes(branch_name: str, what_if_text: str, modified_files: List[str]) -> str:
    """Commit the what-if changes to git"""
    try:
        # Add modified files
        for file_path in modified_files:
            subprocess.run(["git", "add", file_path], check=True)

        # Create commit message
        commit_message = f"What-If: {what_if_text}\n\nBranch: {branch_name}\nGenerated by What-If Scene API"

        # Commit
        subprocess.run(
            ["git", "commit", "-m", commit_message],
            check=True
        )

        # Get commit hash
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True
        )

        return result.stdout.strip()[:8]

    except subprocess.CalledProcessError as e:
        print(f"Commit failed: {e}")
        return None

@app.get("/api/studio/whatif/scene/{scene_id}/branches")
async def get_scene_branches(scene_id: str):
    """Get all what-if branches for a specific scene"""
    try:
        # Get all branches matching the pattern
        result = subprocess.run(
            ["git", "branch", "-a"],
            capture_output=True,
            text=True
        )

        branches = []
        for line in result.stdout.split('\n'):
            line = line.strip().replace('* ', '')
            if f"whatif/{scene_id}/" in line:
                branch_name = line.split('/')[-1] if 'remotes/' in line else line
                branches.append({
                    "name": branch_name,
                    "full_name": line,
                    "is_current": line.startswith('*')
                })

        return {"scene_id": scene_id, "branches": branches}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/studio/whatif/scene/preview")
async def preview_whatif_changes(request: WhatIfSceneRequest):
    """Preview what-if changes without creating a branch"""
    try:
        # Load current scene YAML
        scene_yaml = load_scene_yaml(request.scene_id, request.act, request.project_name)

        # Use AI to modify scene YAML
        modified_yaml = await ai_modify_scene(scene_yaml, request.what_if_text)

        # Generate story blocks
        story_blocks = generate_story_blocks(modified_yaml)

        return {
            "original_yaml": scene_yaml,
            "modified_yaml": modified_yaml,
            "story_blocks": story_blocks,
            "changes_summary": analyze_changes(scene_yaml, modified_yaml)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def analyze_changes(original: Dict[str, Any], modified: Dict[str, Any]) -> Dict[str, List[str]]:
    """Analyze differences between original and modified YAML"""
    changes = {
        "added": [],
        "modified": [],
        "removed": []
    }

    # Check for additions and modifications
    for key, value in modified.items():
        if key not in original:
            changes["added"].append(f"{key}: {str(value)[:50]}...")
        elif original[key] != value:
            changes["modified"].append(f"{key}: {str(original[key])[:30]}... → {str(value)[:30]}...")

    # Check for removals
    for key in original:
        if key not in modified:
            changes["removed"].append(key)

    return changes

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8101)