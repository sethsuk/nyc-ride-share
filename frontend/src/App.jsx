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
          <Route path="/" element={<HomeScreen />}/>
        </Routes>
      </Router>
    </>
  )
}

export default App
