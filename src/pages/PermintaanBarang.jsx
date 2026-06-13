import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function PermintaanBarang() {
  const [pbList, setPbList] = useState([])
  const [produk, setProduk] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [detailData, setDetailData] = useState(null)
  const [items, setItems] = useState([{ produk_id: '', qty_diminta: '' }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const user = JSON.parse(localStorage.getItem('user'))

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    let query = supabase.from('permintaan_barang').select('*, cabang(kode_cabang, nama_cabang)').order('created_at', { ascending: false })
    setPbList((await query).data || [])
    setProduk((await supabase.from('produk').select('*').eq('is_aktif', true).order('kode_barang')).data || [])
    setLoading(false)
  }

  const fetchDetail = async (pb) => {
    const { data } = await supabase.from('permintaan_barang_detail').select('*, produk(kode_barang, nama_varian)').eq('pb_id', pb.id)
    setDetailData({ ...pb, detail: data || [] })
    setView('detail')
  }

  const addItem = () => setItems([...items, { produk_id: '', qty_diminta: '' }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => { const n = [...items]; n[i][field] = val; setItems(n) }

  const handleSubmit = async () => {
    if (items.some(i => !i.produk_id || !i.qty_diminta)) { setError('Semua baris produk wajib diisi!'); return }
    setSaving(true); setError('')

    const cabangData = await supabase.from('cabang').select('id').eq('pengguna_id', user.id).single()
    if (!cabangData.data) { setError('Akun tidak terhubung ke cabang!'); setSaving(false); return }

    const { data: newPB } = await supabase.from('permintaan_barang').insert({
      cabang_id: cabangData.data.id,
      status: 'request',
      nomor_pb: ''
    }).select().single()

    if (newPB) {
      await supabase.from('permintaan_barang_detail').insert(
        items.map(item => ({ pb_id: newPB.id, produk_id: item.produk_id, qty_diminta: parseInt(item.qty_diminta) }))
      )
    }

    setSaving(false); setView('list')
    setItems([{ produk_id: '', qty_diminta: '' }])
    fetchAll()
  }

  const handleApprove = async (pb) => {
    await supabase.from('permintaan_barang').update({ status: 'approved' }).eq('id', pb.id)
    fetchAll(); fetchDetail({ ...pb, status: 'approved' })
  }

  const handleReject = async (pb) => {
    await supabase.from('permintaan_barang').update({ status: 'rejected' }).eq('id', pb.id)
    fetchAll(); setView('list')
  }

  const statusBadge = (status) => {
    const map = {
      request: { bg: '#fff8e0', color: '#aa7700', label: 'Request' },
      approved: { bg: '#f0faf0', color: '#2d7a2d', label: 'Approved' },
      rejected: { bg: '#fff0f0', color: '#cc2222', label: 'Rejected' }
    }
    const s = map[status] || map.request
    return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>{s.label}</span>
  }

  if (view === 'form') return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <button onClick={() => setView('list')} style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>← Kembali</button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Buat Permintaan Barang</h2>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nomor PB</label>
            <input type="text" readOnly style={{ width: '200px', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888', width: '55%' }}>Produk</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888', width: '35%' }}>Qty diminta (cup)</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888', width: '10%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 16px' }}>
                    <select value={item.produk_id} onChange={e => updateItem(i, 'produk_id', e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px' }}>
                      <option value="">Pilih produk</option>
                      {produk.map(p => <option key={p.id} value={p.id}>{p.kode_barang} — {p.nama_varian}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <input type="number" value={item.qty_diminta} onChange={e => updateItem(i, 'qty_diminta', e.target.value)} placeholder="0"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', textAlign: 'center', boxSizing: 'border-box' }} />
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                    {items.length > 1 && <button onClick={() => removeItem(i)} style={{ border: 'none', background: 'none', color: '#e05555', cursor: 'pointer', fontSize: '16px' }}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
            <button onClick={addItem} style={{ padding: '6px 14px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>+ Tambah baris</button>
          </div>
        </div>

        {error && <p style={{ color: 'red', fontSize: '13px', margin: '0 0 1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setView('list')} style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>Batal</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            {saving ? 'Menyimpan...' : 'Kirim request →'}
          </button>
        </div>
      </div>
    </Layout>
  )

  if (view === 'detail' && detailData) return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setView('list')} style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>← Kembali</button>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>{detailData.nomor_pb}</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{detailData.cabang?.nama_cabang} · {new Date(detailData.created_at).toLocaleDateString('id-ID')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {statusBadge(detailData.status)}
            {detailData.status === 'request' && (user.role === 'dc' || user.role === 'super_dc') && (
              <>
                <button onClick={() => handleApprove(detailData)} style={{ padding: '7px 14px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', color: '#2d7a2d', cursor: 'pointer' }}>Approve</button>
                <button onClick={() => handleReject(detailData)} style={{ padding: '7px 14px', background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#e05555', cursor: 'pointer' }}>Reject</button>
              </>
            )}
          </div>
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Kode</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nama barang</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Qty diminta</th>
              </tr>
            </thead>
            <tbody>
              {detailData.detail?.map((item, i) => (
                <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', color: '#888' }}>{item.produk?.kode_barang}</td>
                  <td style={{ padding: '10px 16px' }}>{item.produk?.nama_varian}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{item.qty_diminta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Permintaan Barang</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{pbList.length} PB terdaftar</p>
          </div>
          {user.role === 'pedagang' && (
            <button onClick={() => setView('form')}
              style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
              + Buat PB
            </button>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}>
            <option value="">Semua status</option>
            <option value="request">Request</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nomor PB</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Cabang</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tanggal</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</td></tr>
              ) : pbList.filter(p => !filterStatus || p.status === filterStatus).length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada data</td></tr>
              ) : (
                pbList.filter(p => !filterStatus || p.status === filterStatus).map((item, i) => (
                  <tr key={item.id} onClick={() => fetchDetail(item)}
                    style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.nomor_pb}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.cabang?.kode_cabang} — {item.cabang?.nama_cabang}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>{statusBadge(item.status)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#aaa' }}>›</td>
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