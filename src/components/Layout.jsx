import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user'))
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [switchMode, setSwitchMode] = useState(localStorage.getItem('switchMode') || 'dc')
  const [switchCabang, setSwitchCabang] = useState(JSON.parse(localStorage.getItem('switchCabang') || 'null'))
  const [showSwitchModal, setShowSwitchModal] = useState(false)
  const [cabangList, setCabangList] = useState([])

  if (!user) { navigate('/'); return null }

  const isSuperDC = user.role === 'super_dc'
  const activeMode = isSuperDC ? switchMode : user.role

  const menuDC = [
    { label: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { label: 'Master Produk', path: '/master/produk', icon: '🥛' },
    { label: 'Master Cabang', path: '/master/cabang', icon: '🏪' },
    ...(isSuperDC ? [{ label: 'Master Pengguna', path: '/master/pengguna', icon: '👤' }] : []),
    { label: 'Delivery Order', path: '/do', icon: '🚚' },
    { label: 'Permintaan Barang', path: '/pb', icon: '📋' },
    { label: 'Transfer Stok', path: '/ts', icon: '🔄' },
    { label: 'Penjualan Harian', path: '/penjualan', icon: '🧾' },
    { label: 'Biaya', path: '/biaya', icon: '💸' },
    { label: 'Hutang Pedagang', path: '/hutang', icon: '💰' },
    { label: 'Komisi', path: '/komisi', icon: '📊' },
  ]

  const menuPedagang = [
    { label: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { label: 'Permintaan Barang', path: '/pb/pedagang', icon: '📋' },
    { label: 'Terima Barang', path: '/terima', icon: '📦' },
    { label: 'Transfer Stok', path: '/ts', icon: '🔄' },
    { label: 'Penjualan Harian', path: '/penjualan', icon: '🧾' },
    { label: 'Stok Saya', path: '/stok', icon: '📦' },
    { label: 'Hutang Saya', path: '/hutang', icon: '💰' },
    { label: 'Komisi Saya', path: '/komisi', icon: '📊' },
  ]

  const menu = activeMode === 'pedagang' ? menuPedagang : menuDC

  const handleSwitchMode = async (mode) => {
    if (mode === 'pedagang') {
      const { data } = await supabase.from('cabang').select('*').eq('is_aktif', true).order('kode_cabang')
      setCabangList(data || [])
      setShowSwitchModal(true)
    } else {
      setSwitchMode('dc')
      setSwitchCabang(null)
      localStorage.setItem('switchMode', 'dc')
      localStorage.removeItem('switchCabang')
      navigate('/dashboard')
    }
  }

  const handlePilihCabang = (cabang) => {
    setSwitchMode('pedagang')
    setSwitchCabang(cabang)
    localStorage.setItem('switchMode', 'pedagang')
    localStorage.setItem('switchCabang', JSON.stringify(cabang))
    setShowSwitchModal(false)
    navigate('/dashboard')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f0' }}>

      <div style={{
        width: sidebarOpen ? '220px' : '56px',
        background: 'white',
        borderRight: '1px solid #e0e0e0',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0, position: 'fixed',
        height: '100vh', overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.2s ease'
      }}>

        <div style={{ padding: '1rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {sidebarOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px' }}>🐄</span>
              <span style={{ fontSize: '15px', fontWeight: '500' }}>Mr.Moo</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px', borderRadius: '6px', color: '#888', marginLeft: sidebarOpen ? 'auto' : '0' }}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {isSuperDC && sidebarOpen && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
            <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mode aktif</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => handleSwitchMode('dc')}
                style={{ flex: 1, padding: '5px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', border: '1px solid', background: activeMode === 'dc' ? '#f0faf0' : 'white', borderColor: activeMode === 'dc' ? '#c0e0c0' : '#e0e0e0', color: activeMode === 'dc' ? '#2d7a2d' : '#888', fontWeight: activeMode === 'dc' ? '500' : '400' }}>
                DC
              </button>
              <button onClick={() => handleSwitchMode('pedagang')}
                style={{ flex: 1, padding: '5px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', border: '1px solid', background: activeMode === 'pedagang' ? '#e8f0ff' : 'white', borderColor: activeMode === 'pedagang' ? '#b0c8ff' : '#e0e0e0', color: activeMode === 'pedagang' ? '#3355cc' : '#888', fontWeight: activeMode === 'pedagang' ? '500' : '400' }}>
                Pedagang
              </button>
            </div>
            {activeMode === 'pedagang' && switchCabang && (
              <p style={{ fontSize: '11px', color: '#3355cc', margin: '6px 0 0' }}>📍 {switchCabang.kode_cabang} — {switchCabang.nama_cabang}</p>
            )}
          </div>
        )}

        <div style={{ padding: '0.75rem 0', flex: 1 }}>
          {sidebarOpen && (
            <p style={{ fontSize: '11px', color: '#aaa', padding: '0 1rem', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Menu</p>
          )}
          {menu.map(item => (
            <div key={item.path} onClick={() => item.path !== '#' && navigate(item.path)}
              title={!sidebarOpen ? item.label : ''}
              style={{
                padding: sidebarOpen ? '8px 1rem' : '8px',
                margin: '0 8px 2px', borderRadius: '8px',
                cursor: item.path !== '#' ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: '10px',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                background: location.pathname === item.path
                  ? (activeMode === 'pedagang' ? '#e8f0ff' : '#f0faf0')
                  : 'transparent',
                color: location.pathname === item.path
                  ? (activeMode === 'pedagang' ? '#3355cc' : '#2d7a2d')
                  : '#555',
                fontSize: '13px',
                fontWeight: location.pathname === item.path ? '500' : '400'
              }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </div>
          ))}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid #f0f0f0' }}>
          {sidebarOpen && (
            <>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px' }}>{user.username}</p>
              <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 10px', textTransform: 'uppercase' }}>{user.role}</p>
            </>
          )}
          <button onClick={() => {
            localStorage.removeItem('user')
            localStorage.removeItem('switchMode')
            localStorage.removeItem('switchCabang')
            navigate('/')
          }}
            style={{ width: '100%', padding: '7px', fontSize: '12px', border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', background: 'white', color: '#e05555' }}>
            {sidebarOpen ? 'Logout' : '🚪'}
          </button>
        </div>
      </div>

      <div style={{ marginLeft: sidebarOpen ? '220px' : '56px', flex: 1, padding: '1.5rem', transition: 'margin-left 0.2s ease' }}>
        {children}
      </div>

      {showSwitchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '380px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '15px' }}>Pilih cabang untuk mode pedagang</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cabangList.map(c => (
                <div key={c.id} onClick={() => handlePilihCabang(c)}
                  style={{ padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                  onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseOut={e => e.currentTarget.style.background = 'white'}>
                  <span style={{ fontWeight: '500' }}>{c.kode_cabang}</span> — {c.nama_cabang}
                </div>
              ))}
            </div>
            <button onClick={() => setShowSwitchModal(false)}
              style={{ width: '100%', marginTop: '1rem', padding: '8px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>
              Batal
            </button>
          </div>
        </div>
      )}

    </div>
  )
}