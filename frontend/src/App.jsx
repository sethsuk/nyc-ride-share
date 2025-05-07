import { useState } from 'react'
import HomeScreen from './pages/homeScreen.jsx';
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Router>
        <Routes>
<<<<<<< HEAD
          <Route path="/" element={<HomeScreen />}/>
=======
          <Route path="/" element={<HomeScreen />} />
>>>>>>> 399ee00 (implemented all backend endpoints)
        </Routes>
      </Router>
    </>
  )
}

export default App
