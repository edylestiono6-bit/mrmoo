import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function Biaya() {
  const [biayaList, setBiayaList] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [form, setForm] = useState({ keterangan: '', nominal: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const user = JSON.parse(localStorage.getItem('user'))
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const switchMode = localStorage.getItem('switchMode') || 'dc'
  const activeCabangId = switchMode === 'pedagang' ? switchCabang?.id : null
  const isDC = user.role === 'dc' || user.role === 'super_dc'

  useEffect(() => { fetchBiaya() }, [])

  const fetchBiaya = async () => {
    setLoading(true)
    let query = supabase
      .from('pengeluaran')
      .select('*, cabang(kode_cabang, nama_cabang), pengguna(username)')
      .order('created_at', { ascending: false })

    if (switchMode === 'pedagang' && activeCabangId) {
      query = query.eq('cabang_id', activeCabangId)
    }

    setBiayaList((await query).data || [])
    setLoading(false)
  }

  const totalBiaya = biayaList.reduce((acc, b) => acc + Number(b.nominal), 0)
  const totalDC = biayaList.filter(b => !b.cabang_id).reduce((acc, b) => acc + Number(b.nominal), 0)
  const totalCabang = biayaList.filter(b => b.cabang_id).reduce((acc, b) => acc + Number(b.nominal), 0)

  const handleSubmit = async () => {
    if (!form.keterangan || !form.nominal) { setError('Semua field wajib diisi!'); return }
    setSaving(true); setError('')

    await supabase.from('pengeluaran').insert({
      nomor_ba: '',
      pengguna_id: user.id,
      cabang_id: activeCabangId || null,
      keterangan: form.keterangan,
      nominal: parseFloat(form.nominal)
    })

    setSaving(false); setView('list')
    setForm({ keterangan: '', nominal: '' })
    fetchBiaya()
  }

  if (view === 'form') return (
    <Layout>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <button onClick={() => setView('list')} style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>← Kembali</button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Tambah Biaya</h2>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nomor BA</label>
              <input type="text" readOnly style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Tanggal</label>
              <input type="text" value={new Date().toLocaleDateString('id-ID')} readOnly
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
            </div>
            {switchMode === 'pedagang' && switchCabang && (
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Cabang</label>
                <input type="text" value={`${switchCabang.kode_cabang} — ${switchCabang.nama_cabang}`} readOnly
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Keterangan</label>
              <input type="text" value={form.keterangan} onChange={e => setForm({ ...form, keterangan: e.target.value })}
                placeholder="contoh: bayar kebersihan lingkungan"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nominal (Rp)</label>
              <input type="number" value={form.nominal} onChange={e => setForm({ ...form, nominal: e.target.value })}
                placeholder="0"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
          </div>

          {error && <p style={{ color: 'red', fontSize: '13px', margin: '1rem 0 0' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button onClick={() => setView('list')} style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>Batal</button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
              {saving ? 'Menyimpan...' : 'Simpan →'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Biaya Operasional</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{biayaList.length} transaksi</p>
          </div>
          <button onClick={() => setView('form')}
            style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            + Tambah biaya
          </button>
        </div>

        {isDC && switchMode === 'dc' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total semua biaya</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: '#cc2222' }}>Rp {totalBiaya.toLocaleString('id-ID')}</p>
            </div>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Biaya DC</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {totalDC.toLocaleString('id-ID')}</p>
            </div>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Biaya cabang</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {totalCabang.toLocaleString('id-ID')}</p>
            </div>
          </div>
        )}

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nomor BA</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tanggal</th>
                {isDC && switchMode === 'dc' && (
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Sumber</th>
                )}
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Keterangan</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Nominal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</td></tr>
              ) : biayaList.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada data</td></tr>
              ) : (
                biayaList.map((item, i) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.nomor_ba}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                    {isDC && switchMode === 'dc' && (
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: item.cabang_id ? '#f0f0ff' : '#f0faf0', color: item.cabang_id ? '#5555cc' : '#2d7a2d' }}>
                          {item.cabang_id ? `${item.cabang?.kode_cabang} — ${item.cabang?.nama_cabang}` : 'DC'}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: '10px 16px' }}>{item.keterangan}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#cc2222', fontWeight: '500' }}>
                      Rp {Number(item.nominal).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {biayaList.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '1px solid #e0e0e0', background: '#f9f9f9' }}>
                  <td colSpan={isDC && switchMode === 'dc' ? 4 : 3} style={{ padding: '10px 16px', fontWeight: '500' }}>Total</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500', color: '#cc2222' }}>
                    Rp {totalBiaya.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </Layout>
  )
}