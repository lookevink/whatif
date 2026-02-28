# whatif

Whatif is an AI-native local studio using a swarm to help independent filmmakers build worlds with git enabled version control, generative story board building, character development, and streamlined pipeline to video gen models.

As a filmmaker, all you have to do is ask "what if" and watch your intent be transformed into characters, story lines, and real scenes from your film.

## Usage flow
1. [ingestion](docs/ingestion.md)
	1. character
	2. scenes
	3. events
	4. storylines
	5. any other state
2. enter interactive world
	1. pull from scene
	2. at a specific time
	3. where characters are there
	4. camera, scene, char can be changed
	5. can impersonate individual characters
3. make changes to the world
	1. tts control over the world "what if"
	2. the state changes based on director's what if
	3. this is the "fun" part as well, as it lets audience enter a world of the movie they just saw and explore "what if"
4. export scenes, including assets, prompts, etc
	1. can be consumed by video gen models like Veo to create clips



## Backend (FastAPI)

Python API backend in `backend/`.

- **Framework:** FastAPI
- **Entry:** `main.py` — app instance is `app`

### Run

```bash
cd backend
fastapi dev main.py --app app
```

Or with uvicorn:

```bash
cd backend
uvicorn main:app --reload
```

### Endpoints

- `GET /` — Hello World
- `GET /items/{item_id}` — Returns `item_id` and optional query param `q`

### Setup

```bash
cd backend
pip install -r requirements.txt
```

---

## Frontend (React + Vite)

React + TypeScript app in `frontend/`.

- **Framework:** React 19
- **Build:** Vite 7
- **Entry:** `src/main.tsx` → `src/App.tsx`

### Run

```bash
cd frontend
npm run dev
```

### Scripts

- `npm run dev` — Start dev server (HMR)
- `npm run build` — Type-check and build for production
- `npm run preview` — Preview production build
- `npm run lint` — Run ESLint

### Setup

```bash
cd frontend
npm install
```
