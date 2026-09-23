import { useAuth } from './context/AuthContext.jsx'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'

function App() {
  const { token, logout } = useAuth();

  return (
    <div>
      <header style={{ padding: '10px', background: '#333', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
        <h1>Hydra</h1>
        {token && <button onClick={logout}>Logout</button>}
      </header>
      <main style={{ padding: '20px' }}>
        {token ? <Dashboard notifications={[]} /> : <Login />}
      </main>
    </div>
  )
}

export default App
