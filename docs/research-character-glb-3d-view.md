# Research: Character GLB Storage and Retrieval in 3D View

**Date**: 2025-02-28  
**Topic**: How characters are stored and retrieved in the 3D view; loading character GLB files

---

## Research Question

How does the codebase currently store and retrieve characters in the 3D view? What exists for loading character GLB files?

---

## Summary

The 3D viewer uses Babylon.js and supports loading character GLB models via `CharacterModel.glbPath`, but the full pipeline is **incomplete**. The type definitions and Babylon loader exist, but:

1. **Character visual data** (including `glbModel`) is **never loaded** from disk in the data-loader
2. **Scene-to-CharacterModel conversion** does not pass `glbPath` (or `glbModel`) through
3. The **backend envision step** does not write `glbModel` to character visual files
4. **No characters in the default project** have `assets/visual.yaml` (the expected location for `glbModel`)
5. The **file-serving API** uses `read_text()` and would corrupt binary GLB files

When `glbPath` is absent, the viewer falls back to capsule placeholders.

---

## Detailed Findings

### 1. Data Types and Model Structure

**Scene/CharacterRef** (`frontend/src/lib/studio/types.ts:63-70`):
- `Scene.characters` is `CharacterRef[]`
- `CharacterRef` has `visual?: CharacterVisual`
- `CharacterVisual` has `glbModel?: string` (line 124)

**CharacterModel** (runtime model for 3D viewer, `frontend/src/lib/studio/types.ts:387-395`):
```typescript
export interface CharacterModel {
  id: string;
  name: string;
  glbPath?: string;  // Used by Babylon to load GLB
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  animation?: string;
  fallbackModel?: string;
}
```

`CharacterModel.glbPath` is the field that feeds into the 3D loader. The domain model uses `CharacterVisual.glbModel`; the viewer model uses `glbPath`.

---

### 2. Character Loading in Data Loader

**`StudioDataLoader.loadCharacter()`** (`frontend/src/lib/studio/data-loader.ts:137-176`):
- Loads `profile.yaml` and `voice.yaml` from `characters/{characterId}/`
- Does **not** load `assets/visual.yaml`
- Returns `CharacterProfile`, which has no `visual` or `glbModel` field

**`loadSceneCharacters()`** (lines 313-354):
- Calls `loadCharacter()` per character
- Merges result with `id` into scene.characters
- Characters in `scene.characters` therefore never receive `visual` or `glbModel`

**Comparison with locations** (lines 207-214):
- `loadLocation()` does load `world/locations/{id}/assets/visual.yaml`
- Reads `visual.glbModel` into `location.glbModel`
- Character loading has no equivalent step

---

### 3. Scene → CharacterModel Conversion (Missing glbPath)

**StudioApp** (`frontend/src/StudioApp.tsx:39-45`):
```typescript
const characters: CharacterModel[] = scene.characters?.map((char, idx) => ({
  id: typeof char === 'string' ? char : char.id,
  name: typeof char === 'string' ? char : char.name,
  position: { x: idx * 2 - 2, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  fallbackModel: 'capsule'
})) || [];
```

**SceneDetailPage** (`frontend/src/pages/SceneDetailPage.tsx:39-46`): same pattern.

Neither sets `glbPath`. Even if `scene.characters` had `visual.glbModel`, it would not be passed into `CharacterModel.glbPath`.

---

### 4. Babylon 3D Viewer — GLB Loading

**`BabylonSceneViewer`** (`frontend/src/components/studio/BabylonSceneViewer.tsx`):
- Uses `@babylonjs/loaders/glTF` for GLB
- `loadCharacter()` (lines 253-291):
  - If `character.glbPath` is set, calls `BABYLON.SceneLoader.AppendAsync('', character.glbPath, babylonScene)`
  - Applies position/rotation from `CharacterModel`
  - Enables shadows on meshes
  - On error or missing path, calls `createFallbackCharacter()` (capsule + nameplate)

**`createFallbackCharacter()`** (lines 314-343):
- Builds a capsule mesh when no GLB is available or load fails

---

### 5. Backend / Envision

**`EnvisionCharacterVisual`** (`backend/ingestion/schemas.py:347-351`):
```python
class EnvisionCharacterVisual(BaseModel):
    character_id: str
    appearance: dict[str, Any] = Field(default_factory=dict)
    wardrobe: dict[str, Any] = Field(default_factory=dict)
```

No `glbModel` field.

**Envision output** (`backend/ingestion/envision.py:169-176`):
- Writes `characters/{id}/assets/visual.yaml`
- Contents: `appearance`, `wardrobe`, `reference_images`, `consistency_anchor`
- Does not write `glbModel`

Per docs (`docs/ingestion.md:594-622`), the intended schema for `characters/{id}/assets/visual.yaml` includes `reference_images` and `consistency_anchor`, but not `glbModel`. The frontend `CharacterVisual` type does define `glbModel`, so the schema supports it; the envision step just never populates it.

---

### 6. Project Structure — Default Project

The default project (`.studio/projects/default`) has many characters, e.g.:
- `characters/victor/`, `characters/elizabeth/`, etc.
- Each has `profile.yaml`, `arc.yaml`, `knowledge.yaml`, `voice.yaml`, etc.
- **None** have `assets/visual.yaml`

So no character visuals (and no GLB paths) exist in the current project layout.

---

### 7. File Serving for GLB

**API route** (`backend/main.py:128-143`):
```python
@app.get("/api/studio/projects/{project_name}/files/{file_path:path}")
def api_studio_file(project_name: str, file_path: str):
    content = resolved.read_text(encoding="utf-8")  # Binary would be corrupted
    return PlainTextResponse(content, ...)
```

- Uses `read_text()` for all files
- GLB is binary; serving it via `read_text()` would corrupt the data
- No `FileResponse` or binary handling for `.glb`

**Data loader URL conversion** (`frontend/src/lib/studio/data-loader.ts:275-281`):
- `toFileUrl()` turns project-relative paths into URLs like:
  - `/api/studio/projects/default/files/characters/victor/model.glb`
- The route would match, but the response would be incorrect for binary GLB

---

## Architecture Diagram

```
Scene (from API)
    characters: CharacterRef[]  ──► StudioApp / SceneDetailPage
        (id, name, profile, [visual?])         │
                                               │ map() → CharacterModel[]
                                               │ (glbPath never set)
                                               ▼
                                    BabylonSceneViewer
                                    characters: CharacterModel[]
                                               │
                     character.glbPath? ───────┤
                          │                    │
                          ├─ yes ─► BABYLON.SceneLoader.AppendAsync(glbPath)
                          │
                          └─ no  ─► createFallbackCharacter() (capsule)
```

---

## Gaps for Loading Character GLB

| Layer | Current State | Needed for GLB |
|-------|---------------|----------------|
| **Storage** | `characters/{id}/assets/visual.yaml` with `glbModel` | Populate `glbModel` with path to GLB |
| **Data loader** | Only loads `profile.yaml`, `voice.yaml` | Also load `assets/visual.yaml` and merge into `CharacterRef.visual` |
| **Conversion** | Scene → CharacterModel ignores visual | Map `char.visual?.glbModel` → `CharacterModel.glbPath` |
| **Path resolution** | `toFileUrl()` for YAML/JSON | Ensure GLB path is resolvable (relative to project root or API) |
| **Backend API** | Serves files as text | Add binary handling for `.glb` (e.g. `FileResponse`) |
| **Envision** | Outputs appearance/wardrobe only | Optionally emit `glbModel` path when a GLB exists |

---

## Code References

| File | Lines | Description |
|------|-------|-------------|
| `frontend/src/lib/studio/types.ts` | 105-126, 387-395 | `CharacterVisual`, `CharacterModel` |
| `frontend/src/components/studio/BabylonSceneViewer.tsx` | 253-291, 314-343 | `loadCharacter()`, `createFallbackCharacter()` |
| `frontend/src/lib/studio/data-loader.ts` | 137-176, 313-354 | `loadCharacter()`, `loadSceneCharacters()` — no visual loading |
| `frontend/src/StudioApp.tsx` | 39-45 | Scene → CharacterModel mapping (no glbPath) |
| `frontend/src/pages/SceneDetailPage.tsx` | 39-51 | Same mapping |
| `backend/ingestion/envision.py` | 169-176 | Writes `characters/{id}/assets/visual.yaml` (no glbModel) |
| `backend/main.py` | 128-143 | File serving via `read_text()` (binary unsafe) |

---

## Related Patterns (Locations)

Locations show a working pattern for GLB:

1. **Storage**: `world/locations/{id}/assets/visual.yaml` with `glbModel`
2. **Loading**: `loadLocation()` reads this into `location.glbModel`
3. **Viewer**: `LocationModel.glbPath` is used in `loadLocation()` for the 3D scene

The same pattern could be applied to characters: store path in visual YAML, load in data-loader, map to `CharacterModel.glbPath`, and ensure the API serves binary GLB correctly.
