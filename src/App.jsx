import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

export default function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('pengguna')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('is_aktif', true)
      .single()

    if (error || !data) {
      setError('Username atau password salah')
      setLoading(false)
      return
    }

    localStorage.setItem('user', JSON.stringify(data))

    if (data.role === 'pedagang') {
      const { data: cabangData } = await supabase
        .from('cabang')
        .select('*')
        .eq('pengguna_id', data.id)
        .single()

      if (cabangData) {
        localStorage.setItem('switchMode', 'pedagang')
        localStorage.setItem('switchCabang', JSON.stringify(cabangData))
      }
    } else {
      localStorage.setItem('switchMode', 'dc')
      localStorage.removeItem('switchCabang')
    }

    setLoading(false)
    navigate('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '0.5px solid #e0e0e0',
        padding: '2rem',
        width: '340px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '52px', height: '52px',
            borderRadius: '12px',
            background: '#f0faf0',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '28px'
          }}>🐄</div>
          <p style={{ fontSize: '20px', fontWeight: '500', margin: '0 0 4px' }}>Mr.Moo</p>
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Sistem distribusi & penjualan</p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Username</label>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px', fontSize: '14px',
              boxSizing: 'border-box', outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Password</label>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid #e0e0e0',
              borderRadius: '8px', fontSize: '14px',
              boxSizing: 'border-box', outline: 'none'
            }}
          />
        </div>

        {error && (
          <p style={{ fontSize: '13px', color: 'red', margin: '0 0 1rem', textAlign: 'center' }}>
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '10px',
            background: '#f0faf0',
            border: '1px solid #c0e0c0',
            borderRadius: '8px',
            fontSize: '14px', fontWeight: '500',
            color: '#2d7a2d', cursor: 'pointer'
          }}
        >
          {loading ? 'Loading...' : 'Masuk →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#aaa', marginTop: '1.25rem' }}>
          Lupa password? Hubungi admin DC
        </p>
      </div>
    </div>
  )
}       