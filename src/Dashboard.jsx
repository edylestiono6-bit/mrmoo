import Layout from './components/Layout'

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user'))

  return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Dashboard</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>Selamat datang, {user?.username}!</p>
        </div>
        <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', color: '#aaa' }}>
          🐄 Dashboard sedang dalam pengembangan
        </div>
      </div>
    </Layout>
  )
}