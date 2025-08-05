import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Game from './pages/Game'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Profile from './pages/Profile'
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
          <Route path = "/review/:gameid" element = {<ReviewGame />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
