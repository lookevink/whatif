import './App.css'
import { Routes, Route } from 'react-router-dom'
import { SceneSelectPage } from './pages/SceneSelectPage'
import { SceneDetailPage } from './pages/SceneDetailPage'
import { CharacterGalleryPage } from './pages/CharacterGalleryPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<SceneSelectPage />} />
      <Route path="/scene/:sceneId" element={<SceneDetailPage />} />
      <Route path="/characters" element={<CharacterGalleryPage />} />
    </Routes>
  )
}

export default App
