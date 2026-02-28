# Scene Configuration — 3D Viewer, Camera, Lighting, Blocking

This document describes the standard YAML files per scene and how to manipulate characters and the 3D view.

---

## How to manipulate the scene

| Action | How |
|--------|-----|
| **Move characters** | Click and drag a character in the 3D viewer. They move on the ground plane (XZ). |
| **Rotate / zoom camera** | Drag on empty space to rotate; scroll to zoom. |
| **Save arrangement** | Click **Save Arrangement** to write current character positions to `blocking.yaml`. |
| **Adjust camera** | Edit `camera.yaml` → `viewer` section, or move the camera in the viewer and save. |
| **Use Inspector** | Click **Show Inspector** for full mesh transform controls (move/rotate/scale). |

---

## Scene folder structure

Each scene lives under `scenes/{act}/{scene_id}/` and may include:

| File | Purpose |
|------|---------|
| `scene.yaml` | Core metadata (location, characters, summary) |
| `dialogue.json` | Dialogue lines |
| `directions.md` | Stage directions |
| `camera.yaml` | Shot list and optional 3D viewer camera |
| `lighting.yaml` | Lighting setup (key, fill, hemisphere) |
| `blocking.yaml` | Character positions and movements |
| `audio.yaml` | Audio cues |

---

## 3D viewer camera (`camera.yaml`)

Add a `viewer` section to control the initial ArcRotate camera in the Babylon 3D viewer:

```yaml
# camera.yaml
viewer:
  alpha: -1.57      # Horizontal angle (radians). Default: -π/2
  beta: 1.05        # Vertical angle (radians). Default: π/3
  radius: 12        # Distance from target. Default: 12
  target: [0, 0, 0] # Camera look-at point [x, y, z]

shots:
  - id: shot_001
    type: establishing
    subject: location
```

- **alpha**: Rotation around the target (0 = front, -π/2 = left side).
- **beta**: Tilt (π/2 = top-down, 0 = horizontal).
- **radius**: Zoom distance; higher = wider view.
- **target**: World position the camera orbits around.

Users can still drag/scroll to adjust the camera; this sets the initial view.

---

## Lighting (`lighting.yaml`)

The 3D viewer uses `lighting.yaml` for key light, fill light, and hemisphere (ambient). See the data-loader defaults and existing scenes for the expected structure.

---

## Blocking (`blocking.yaml`)

Character positions can be defined in `blocking.yaml` via `space.key_positions` and `blocking` (character movements). The 3D viewer applies this after loading characters. Use **Save Arrangement** in the viewer to write current positions back to this file.

---

## If characters are clustered

1. Ensure `blocking.yaml` lists all characters with distinct positions (see above).
2. Or delete/rename `blocking.yaml` temporarily — the viewer will use the default spread.
3. Move characters by drag, then click **Save Arrangement** to write correct positions.

## Summary

- **Move characters**: Click and drag in the 3D viewer.
- **Camera angle**: Edit `camera.yaml` → `viewer` section.
- **Lighting**: Edit `lighting.yaml`.
- **Character positions**: Edit `blocking.yaml` or drag in the viewer and click **Save Arrangement**.
