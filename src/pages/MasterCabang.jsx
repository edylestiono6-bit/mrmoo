import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function MasterCabang() {
  const [cabang, setCabang] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState(null)
  const [form, setForm] = useState({ nama_cabang: '', alamat: '', tipe_upah: 'komisi', gaji_tetap: '', komisi_per_cup: '1000', is_aktif: true })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    fetchCabang()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchCabang = async () => {
    setLoading(true)
    const { data } = await supabase.from('cabang').select('*, pengguna(username)').order('kode_cabang', { ascending: true })
    setCabang(data || [])
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!form.nama_cabang || !form.komisi_per_cup) { setError('Nama cabang dan komisi wajib diisi!'); return }
    if (form.tipe_upah === 'gaji_komisi' && !form.gaji_tetap) { setError('Gaji tetap wajib diisi!'); return }
    setSaving(true); setError('')
    const payload = {
      nama_cabang: form.nama_cabang, alamat: form.alamat,
      tipe_upah: form.tipe_upah,
      gaji_tetap: form.tipe_upah === 'gaji_komisi' ? parseFloat(form.gaji_tetap) : 0,
      komisi_per_cup: parseFloat(form.komisi_per_cup), is_aktif: form.is_aktif
    }
    if (editData) {
      await supabase.from('cabang').update(payload).eq('id', editData.id)
    } else {
      await supabase.from('cabang').insert({ ...payload, kode_cabang: '' })
    }
    setSaving(false); setShowForm(false); setEditData(null)
    setForm({ nama_cabang: '', alamat: '', tipe_upah: 'komisi', gaji_tetap: '', komisi_per_cup: '1000', is_aktif: true })
    fetchCabang()
  }

  const handleEdit = (item) => {
    setEditData(item)
    setForm({ nama_cabang: item.nama_cabang, alamat: item.alamat || '', tipe_upah: item.tipe_upah, gaji_tetap: item.gaji_tetap || '', komisi_per_cup: item.komisi_per_cup, is_aktif: item.is_aktif })
    setShowForm(true)
  }

  const handleToggleAktif = async (item) => {
    await supabase.from('cabang').update({ is_aktif: !item.is_aktif }).eq('id', item.id)
    fetchCabang()
  }

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Master Cabang</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{cabang.length} cabang terdaftar</p>
          </div>
          <button onClick={() => { setShowForm(true); setEditData(null); setForm({ nama_cabang: '', alamat: '', tipe_upah: 'komisi', gaji_tetap: '', komisi_per_cup: '1000', is_aktif: true }) }}
            style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            + Tambah cabang
          </button>
        </div>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '15px', fontWeight: '500' }}>{editData ? 'Edit cabang' : 'Tambah cabang baru'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Kode cabang</label>
                <input type="text" value={editData ? editData.kode_cabang : ''} readOnly
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nama cabang</label>
                <input type="text" value={form.nama_cabang} onChange={e => setForm({ ...form, nama_cabang: e.target.value })} placeholder="Nama cabang"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: isMobile ? '1' : '1 / -1' }}>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Alamat</label>
                <input type="text" value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} placeholder="Alamat lengkap"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Tipe upah</label>
                <select value={form.tipe_upah} onChange={e => setForm({ ...form, tipe_upah: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                  <option value="komisi">Komisi saja</option>
                  <option value="gaji_komisi">Gaji + Komisi</option>
                </select>
              </div>
              {form.tipe_upah === 'gaji_komisi' && (
                <div>
                  <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Gaji tetap (Rp)</label>
                  <input type="number" value={form.gaji_tetap} onChange={e => setForm({ ...form, gaji_tetap: e.target.value })} placeholder="0"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
              )}
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Komisi per cup (Rp)</label>
                <input type="number" value={form.komisi_per_cup} onChange={e => setForm({ ...form, komisi_per_cup: e.target.value })} placeholder="1000"
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

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {cabang.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', color: '#888' }}>Belum ada cabang</div>
            ) : cabang.map(item => (
              <div key={item.id} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{item.nama_cabang}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{item.kode_cabang}</p>
                    {item.alamat && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#aaa' }}>{item.alamat}</p>}
                  </div>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: item.is_aktif ? '#f0faf0' : '#f5f5f5', color: item.is_aktif ? '#2d7a2d' : '#888' }}>
                    {item.is_aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#aaa' }}>Tipe upah</p>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: item.tipe_upah === 'gaji_komisi' ? '#f0f0ff' : '#f0faf0', color: item.tipe_upah === 'gaji_komisi' ? '#5555cc' : '#2d7a2d' }}>
                      {item.tipe_upah === 'gaji_komisi' ? 'Gaji + Komisi' : 'Komisi'}
                    </span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#aaa' }}>Komisi/cup</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: '500' }}>Rp {Number(item.komisi_per_cup).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEdit(item)} style={{ flex: 1, padding: '8px', fontSize: '13px', border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', background: 'white' }}>Edit</button>
                  <button onClick={() => handleToggleAktif(item)} style={{ flex: 1, padding: '8px', fontSize: '13px', border: '1px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', background: 'white', color: item.is_aktif ? '#e05555' : '#2d7a2d' }}>
                    {item.is_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Kode</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nama cabang</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Alamat</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tipe upah</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Komisi/cup</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {cabang.length === 0 ? (
                  <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada cabang</td></tr>
                ) : cabang.map((item, i) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.kode_cabang}</td>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.nama_cabang}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.alamat || '-'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: item.tipe_upah === 'gaji_komisi' ? '#f0f0ff' : '#f0faf0', color: item.tipe_upah === 'gaji_komisi' ? '#5555cc' : '#2d7a2d' }}>
                        {item.tipe_upah === 'gaji_komisi' ? 'Gaji + Komisi' : 'Komisi'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>Rp {Number(item.komisi_per_cup).toLocaleString('id-ID')}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}