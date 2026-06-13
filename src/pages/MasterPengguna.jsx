import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function MasterPengguna() {
  const [pengguna, setPengguna] = useState([])
  const [cabang, setCabang] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState(null)
  const [form, setForm] = useState({ nama: '', cabang_id: '', role: 'pedagang', password: '', is_aktif: true })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [p, c] = await Promise.all([
      supabase.from('pengguna').select('*').order('created_at', { ascending: false }),
      supabase.from('cabang').select('*').eq('is_aktif', true).order('kode_cabang')
    ])
    setPengguna(p.data || [])
    setCabang(c.data || [])
    setLoading(false)
  }

  const generateUsername = (nama, cabangId) => {
    if (!nama || !cabangId) return ''
    const cabangData = cabang.find(c => c.id === cabangId)
    if (!cabangData) return ''
    const namaBersih = nama.toLowerCase().replace(/\s+/g, '')
    const cabangBersih = cabangData.nama_cabang.toLowerCase().replace(/\s+/g, '')
    return `${namaBersih}_${cabangBersih}`
  }

  const handleSubmit = async () => {
    if (!form.nama || !form.role || !form.password) { setError('Semua field wajib diisi!'); return }
    if (form.role === 'pedagang' && !form.cabang_id) { setError('Cabang wajib dipilih untuk pedagang!'); return }
    setSaving(true); setError('')

    const username = form.role === 'pedagang'
      ? generateUsername(form.nama, form.cabang_id)
      : form.nama.toLowerCase().replace(/\s+/g, '')

    const payload = {
      username,
      password: form.password,
      role: form.role,
      is_aktif: form.is_aktif
    }

    if (editData) {
      await supabase.from('pengguna').update(payload).eq('id', editData.id)
      if (form.role === 'pedagang' && form.cabang_id) {
        await supabase.from('cabang').update({ pengguna_id: editData.id }).eq('id', form.cabang_id)
      }
    } else {
      const { data: newUser } = await supabase.from('pengguna').insert(payload).select().single()
      if (form.role === 'pedagang' && form.cabang_id && newUser) {
        await supabase.from('cabang').update({ pengguna_id: newUser.id }).eq('id', form.cabang_id)
      }
    }

    setSaving(false); setShowForm(false); setEditData(null)
    setForm({ nama: '', cabang_id: '', role: 'pedagang', password: '', is_aktif: true })
    fetchData()
  }

  const handleEdit = (item) => {
    setEditData(item)
    setForm({ nama: item.username, cabang_id: '', role: item.role, password: item.password, is_aktif: item.is_aktif })
    setShowForm(true)
  }

  const handleToggleAktif = async (item) => {
    await supabase.from('pengguna').update({ is_aktif: !item.is_aktif }).eq('id', item.id)
    fetchData()
  }

  const usernamePreview = generateUsername(form.nama, form.cabang_id)

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Master Pengguna</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{pengguna.length} pengguna terdaftar</p>
          </div>
          <button onClick={() => { setShowForm(true); setEditData(null); setForm({ nama: '', cabang_id: '', role: 'pedagang', password: '', is_aktif: true }) }}
            style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            + Tambah pengguna
          </button>
        </div>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '15px', fontWeight: '500' }}>{editData ? 'Edit pengguna' : 'Tambah pengguna baru'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Role</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, cabang_id: '' })}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                  <option value="pedagang">Pedagang</option>
                  <option value="dc">DC</option>
                  <option value="super_dc">Super DC</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nama</label>
                <input type="text" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama lengkap"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              {form.role === 'pedagang' && (
                <div>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Cabang</label>
                  <select value={form.cabang_id} onChange={e => setForm({ ...form, cabang_id: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                    <option value="">Pilih cabang</option>
                    {cabang.map(c => <option key={c.id} value={c.id}>{c.kode_cabang} — {c.nama_cabang}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Username</label>
                <input type="text" value={editData ? editData.username : usernamePreview} readOnly
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
                <p style={{ fontSize: '11px', color: '#aaa', margin: '4px 0 0' }}>Auto-generate dari nama + cabang</p>
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Password</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Password"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Status</label>
                <select value={form.is_aktif} onChange={e => setForm({ ...form, is_aktif: e.target.value === 'true' })}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>
            </div>
            {error && <p style={{ color: 'red', fontSize: '13px', margin: '0 0 1rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditData(null); setError('') }}
                style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>Batal</button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        )}

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Username</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Role</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Dibuat</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</td></tr>
              ) : pengguna.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada pengguna</td></tr>
              ) : (
                pengguna.map((item, i) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.username}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                        background: item.role === 'super_dc' ? '#fff0f0' : item.role === 'dc' ? '#f0f0ff' : '#f0faf0',
                        color: item.role === 'super_dc' ? '#cc2222' : item.role === 'dc' ? '#5555cc' : '#2d7a2d' }}>
                        {item.role === 'super_dc' ? 'Super DC' : item.role === 'dc' ? 'DC' : 'Pedagang'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: item.is_aktif ? '#f0faf0' : '#f5f5f5', color: item.is_aktif ? '#2d7a2d' : '#888' }}>
                        {item.is_aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => handleEdit(item)} style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Edit</button>
                        <button onClick={() => handleToggleAktif(item)} style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', background: 'white', color: item.is_aktif ? '#e05555' : '#2d7a2d' }}>
                          {item.is_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}