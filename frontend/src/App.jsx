import { useState } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import './styles.css'

function App() {
  const { token, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('hydra_theme') === 'dark');

  const toggleTheme = () => {
    const nextTheme = !darkMode;
    setDarkMode(nextTheme);
    localStorage.setItem('hydra_theme', nextTheme ? 'dark' : 'light');
  };

  return (
    <div className={`app-shell${darkMode ? ' dark-mode' : ''}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Hydra home">
          <span className="brand-mark">H</span>
          <span>hydra</span>
        </a>
        <div className="topbar-actions">
          <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`} aria-pressed={darkMode}>
            <span className="theme-icon">{darkMode ? '☼' : '◐'}</span>
            {darkMode ? 'Light mode' : 'Dark mode'}
          </button>
          {token && (
            <span className="status-chip"><span className="status-dot" /> Workspace live</span>
          )}
          {token && <button className="ghost-button" onClick={logout}>Sign out</button>}
        </div>
      </header>
      <main className={token ? 'workspace' : 'auth-main'}>
        {token ? <Dashboard notifications={[]} /> : <Login />}
      </main>
    </div>
  )
}

export default App
