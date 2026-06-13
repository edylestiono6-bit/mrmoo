import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function MasterProduk() {
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState(null)
  const [form, setForm] = useState({ nama_varian: '', hpp: '', harga_jual: '', is_aktif: true })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchProduk() }, [])

  const fetchProduk = async () => {
    setLoading(true)
    const { data } = await supabase.from('produk').select('*').order('kode_barang', { ascending: true })
    setProduk(data || [])
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!form.nama_varian || !form.hpp || !form.harga_jual) { setError('Semua field wajib diisi!'); return }
    setSaving(true); setError('')
    if (editData) {
      await supabase.from('produk').update({
        nama_varian: form.nama_varian,
        hpp: parseFloat(form.hpp),
        harga_jual: parseFloat(form.harga_jual),
        is_aktif: form.is_aktif
      }).eq('id', editData.id)
    } else {
      await supabase.from('produk').insert({
        nama_varian: form.nama_varian,
        hpp: parseFloat(form.hpp),
        harga_jual: parseFloat(form.harga_jual),
        is_aktif: form.is_aktif,
        kode_barang: ''
      })
    }
    setSaving(false); setShowForm(false); setEditData(null)
    setForm({ nama_varian: '', hpp: '', harga_jual: '', is_aktif: true })
    fetchProduk()
  }

  const handleEdit = (item) => {
    setEditData(item)
    setForm({ nama_varian: item.nama_varian, hpp: item.hpp, harga_jual: item.harga_jual, is_aktif: item.is_aktif })
    setShowForm(true)
  }

  const handleToggleAktif = async (item) => {
    await supabase.from('produk').update({ is_aktif: !item.is_aktif }).eq('id', item.id)
    fetchProduk()
  }

  return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Master Produk</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{produk.length} varian terdaftar</p>
          </div>
          <button onClick={() => { setShowForm(true); setEditData(null); setForm({ nama_varian: '', hpp: '', harga_jual: '', is_aktif: true }) }}
            style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            + Tambah produk
          </button>
        </div>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '15px', fontWeight: '500' }}>{editData ? 'Edit produk' : 'Tambah produk baru'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Kode barang</label>
                <input type="text" value={editData ? editData.kode_barang : ''} readOnly
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nama varian</label>
                <input type="text" value={form.nama_varian} onChange={e => setForm({ ...form, nama_varian: e.target.value })} placeholder="Nama varian"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>HPP per cup (Rp)</label>
                <input type="number" value={form.hpp} onChange={e => setForm({ ...form, hpp: e.target.value })} placeholder="0"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Harga jual per cup (Rp)</label>
                <input type="number" value={form.harga_jual} onChange={e => setForm({ ...form, harga_jual: e.target.value })} placeholder="0"
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
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Kode</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nama varian</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>HPP</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Harga jual</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</td></tr>
              ) : produk.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada produk</td></tr>
              ) : (
                produk.map((item, i) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.kode_barang}</td>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.nama_varian}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>Rp {Number(item.hpp).toLocaleString('id-ID')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>Rp {Number(item.harga_jual).toLocaleString('id-ID')}</td>
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