import './App.css'
import { Routes, Route } from 'react-router-dom'
import { SceneSelectPage } from './pages/SceneSelectPage'
import { SceneDetailPage } from './pages/SceneDetailPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<SceneSelectPage />} />
      <Route path="/scene/:sceneId" element={<SceneDetailPage />} />
    </Routes>
  )
}

export default App
