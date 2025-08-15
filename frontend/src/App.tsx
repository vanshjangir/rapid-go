import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Game from './pages/Game'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
import Spectate from './pages/Spectate.tsx'
import ReviewGame from './pages/ReviewGame'

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path = "/" element = {<Home />} />
          <Route path = "/game/:id" element = {<Game />} />
          <Route path = "/login" element = {<Login />} />
          <Route path = "/signup" element = {<Signup />} />
          <Route path = "/profile/:username" element = {<Profile />} />
          <Route path = "/review/:gameId" element = {<ReviewGame />} />
          <Route path = "/spectate/:gameId" element = {<Spectate />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
