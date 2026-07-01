import { useState } from 'react'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'

export default function App() {
  const [session, setSession] = useState(null) // { email, user, tasks }

  return session
    ? <Dashboard session={session} onLogout={() => setSession(null)} />
    : <LoginPage onLogin={setSession} />
}
