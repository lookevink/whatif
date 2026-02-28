# whatif

Whatif is an AI-native local studio using a swarm to help independent filmmakers build worlds with git enabled version control, generative story board building, character development, and streamlined pipeline to video gen models.

As a filmmaker, all you have to do is ask "what if" and watch your intent be transformed into characters, story lines, and real scenes from your film.



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
