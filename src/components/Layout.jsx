import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Layout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user'))
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (window.innerWidth < 768) return false
    return localStorage.getItem('sidebarOpen') !== 'false'
  })
  const [switchMode, setSwitchMode] = useState(localStorage.getItem('switchMode') || 'dc')
  const [switchCabang, setSwitchCabang] = useState(JSON.parse(localStorage.getItem('switchCabang') || 'null'))
  const [showSwitchModal, setShowSwitchModal] = useState(false)
  const [cabangList, setCabangList] = useState([])

  const toggleSidebar = (val) => {
    setSidebarOpen(val)
    if (!isMobile) localStorage.setItem('sidebarOpen', val)
  }

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) {
        const saved = localStorage.getItem('sidebarOpen')
        setSidebarOpen(saved !== 'false')
      } else {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  const handleNavigate = (path) => {
    navigate(path)
    if (isMobile) toggleSidebar(false)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f0' }}>

      {/* Overlay mobile */}
      {isMobile && sidebarOpen && (
        <div onClick={() => toggleSidebar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }} />
      )}

      {/* Sidebar */}
      <div style={{
        width: '240px',
        background: 'white',
        borderRight: '1px solid #e0e0e0',
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto', overflowX: 'hidden',
        zIndex: 95,
        transition: 'transform 0.25s ease',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'
      }}>

        <div style={{ padding: '1rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>🐄</span>
            <span style={{ fontSize: '15px', fontWeight: '500' }}>Mr.Moo</span>
          </div>
          {isMobile && (
            <button onClick={() => toggleSidebar(false)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#888', padding: '4px' }}>✕</button>
          )}
        </div>

        {isSuperDC && (
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
            <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mode aktif</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => handleSwitchMode('dc')}
                style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer', border: '1px solid', background: activeMode === 'dc' ? '#f0faf0' : 'white', borderColor: activeMode === 'dc' ? '#c0e0c0' : '#e0e0e0', color: activeMode === 'dc' ? '#2d7a2d' : '#888', fontWeight: activeMode === 'dc' ? '500' : '400' }}>
                DC
              </button>
              <button onClick={() => handleSwitchMode('pedagang')}
                style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '6px', cursor: 'pointer', border: '1px solid', background: activeMode === 'pedagang' ? '#e8f0ff' : 'white', borderColor: activeMode === 'pedagang' ? '#b0c8ff' : '#e0e0e0', color: activeMode === 'pedagang' ? '#3355cc' : '#888', fontWeight: activeMode === 'pedagang' ? '500' : '400' }}>
                Pedagang
              </button>
            </div>
            {activeMode === 'pedagang' && switchCabang && (
              <p style={{ fontSize: '11px', color: '#3355cc', margin: '6px 0 0' }}>📍 {switchCabang.kode_cabang} — {switchCabang.nama_cabang}</p>
            )}
          </div>
        )}

        <div style={{ padding: '0.75rem 0', flex: 1 }}>
          <p style={{ fontSize: '11px', color: '#aaa', padding: '0 1rem', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Menu</p>
          {menu.map(item => (
            <div key={item.path} onClick={() => handleNavigate(item.path)}
              style={{
                padding: '10px 1rem', margin: '0 8px 2px', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px',
                background: location.pathname === item.path ? (activeMode === 'pedagang' ? '#e8f0ff' : '#f0faf0') : 'transparent',
                color: location.pathname === item.path ? (activeMode === 'pedagang' ? '#3355cc' : '#2d7a2d') : '#555',
                fontSize: '14px', fontWeight: location.pathname === item.path ? '500' : '400'
              }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid #f0f0f0' }}>
          <p style={{ fontSize: '12px', color: '#888', margin: '0 0 2px' }}>{user.username}</p>
          <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 10px', textTransform: 'uppercase' }}>{user.role}</p>
          <button onClick={() => {
            localStorage.removeItem('user')
            localStorage.removeItem('switchMode')
            localStorage.removeItem('switchCabang')
            localStorage.removeItem('sidebarOpen')
            navigate('/')
          }}
            style={{ width: '100%', padding: '8px', fontSize: '13px', border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', background: 'white', color: '#e05555' }}>
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        marginLeft: !isMobile && sidebarOpen ? '240px' : '0',
        transition: 'margin-left 0.25s ease'
      }}>

        {/* Top navbar */}
        <div style={{
          background: 'white', borderBottom: '1px solid #e0e0e0',
          padding: '0 1rem', height: '52px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 80
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => toggleSidebar(!sidebarOpen)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '22px', color: '#555', padding: '4px', lineHeight: 1 }}>
              ☰
            </button>
            <span style={{ fontSize: '15px', fontWeight: '500' }}>Mr.Moo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeMode === 'pedagang' && switchCabang && (
              <span style={{ fontSize: '12px', color: '#3355cc', background: '#e8f0ff', padding: '3px 10px', borderRadius: '20px' }}>
                📍 {switchCabang.kode_cabang}
              </span>
            )}
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: activeMode === 'pedagang' ? '#e8f0ff' : '#f0faf0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '500', color: activeMode === 'pedagang' ? '#3355cc' : '#2d7a2d' }}>
              {user.username?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, padding: isMobile ? '1rem' : '1.5rem', overflowX: 'hidden' }}>
          {children}
        </div>
      </div>

      {/* Modal pilih cabang */}
      {showSwitchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '380px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '15px' }}>Pilih cabang untuk mode pedagang</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cabangList.map(c => (
                <div key={c.id} onClick={() => handlePilihCabang(c)}
                  style={{ padding: '12px 14px', border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
                  onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseOut={e => e.currentTarget.style.background = 'white'}>
                  <span style={{ fontWeight: '500' }}>{c.kode_cabang}</span> — {c.nama_cabang}
                </div>
              ))}
            </div>
            <button onClick={() => setShowSwitchModal(false)}
              style={{ width: '100%', marginTop: '1rem', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>
              Batal
            </button>
          </div>
        </div>
      )}

    </div>
  )
}