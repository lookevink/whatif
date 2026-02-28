# Asset Placement Plan — Manual GLB Loading

This document describes where to place character and environment GLB files, how to configure YAML, and what the frontend expects.

---

## 1. File Structure

### Characters

```
.studio/projects/default/
  characters/
    victor/
      profile.yaml
      assets/
        visual.yaml      ← Add this (references the GLB path)
        victor.glb       ← Put your character GLB here
    elizabeth/
      profile.yaml
      assets/
        visual.yaml
        elizabeth.glb
    creature/
      profile.yaml
      assets/
        visual.yaml
        creature.glb
```

### Environments / Locations

```
.studio/projects/default/
  world/
    locations/
      cave/
        description.yaml
        assets/
          visual.yaml    ← Add this
          cave.glb       ← Put your environment GLB here
```

---

## 2. YAML Configuration

### Character: `characters/{id}/assets/visual.yaml`

```yaml
# characters/victor/assets/visual.yaml
appearance:
  age_apparent: mid_20s
  build: average
  height: "5'10"
  hair: "Dark"
  eyes: "Brown"
  skin_tone: "Medium"

glbModel: characters/victor/assets/victor.glb
```

**Key field**: `glbModel` — project-relative path to the GLB file.

### Location: `world/locations/{id}/assets/visual.yaml`

```yaml
# world/locations/cave/assets/visual.yaml
skybox: null

glbModel: world/locations/cave/assets/cave.glb
```

**Key field**: `glbModel` — project-relative path to the GLB file.

---

## 3. Path Format

- **In YAML**: Use project-relative paths:
  - Character: `characters/victor/assets/victor.glb`
  - Location: `world/locations/cave/assets/cave.glb`

- **How it's used**: The frontend converts these to API URLs:
  - `/api/studio/projects/default/files/characters/victor/assets/victor.glb`
  - `/api/studio/projects/default/files/world/locations/cave/assets/cave.glb`

---

## 4. Scene 215 Example (Victor, Elizabeth, Creature, Cave)

Scene `act2/scene_215` uses:
- **Characters**: victor, elizabeth, creature
- **Location**: cave

### Files to Create

| Path | Purpose |
|------|---------|
| `characters/victor/assets/visual.yaml` | Links Victor to victor.glb |
| `characters/victor/assets/victor.glb` | Character model (you add the file) |
| `characters/elizabeth/assets/visual.yaml` | Links Elizabeth to elizabeth.glb |
| `characters/elizabeth/assets/elizabeth.glb` | Character model |
| `characters/creature/assets/visual.yaml` | Links Creature to creature.glb |
| `characters/creature/assets/creature.glb` | Character model |
| `world/locations/cave/assets/visual.yaml` | Links Cave to cave.glb |
| `world/locations/cave/assets/cave.glb` | Environment model |

---

## 5. Manual Workflow

1. **Add GLB files** to the `assets/` folders (e.g. `characters/victor/assets/victor.glb`)
2. **Create visual.yaml** in the same `assets/` folder with `glbModel` pointing to the file
3. **Refresh** the 3D viewer — the frontend loads scene data and resolves GLBs automatically

---

## 6. Frontend Readiness Checklist

| Component | Status |
|-----------|--------|
| Babylon viewer loads `character.glbPath` | ✅ Ready |
| Babylon viewer loads `location.glbPath` | ✅ Ready |
| Data loader loads location `assets/visual.yaml` | ✅ Ready |
| Data loader loads character `assets/visual.yaml` | 🔧 Added in this plan |
| Scene → CharacterModel passes `glbPath` | 🔧 Added in this plan |
| Scene → LocationModel passes `glbPath` | 🔧 Added in this plan |
| Backend serves binary `.glb` files | 🔧 Added in this plan |

---

## 7. Minimum visual.yaml (Characters)

If you only need the GLB and no appearance metadata:

```yaml
glbModel: characters/victor/assets/victor.glb
```

Same pattern for locations:

```yaml
glbModel: world/locations/cave/assets/cave.glb
```
