import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function TransferStok() {
  const [tsList, setTsList] = useState([])
  const [cabang, setCabang] = useState([])
  const [produk, setProduk] = useState([])
  const [stokBatch, setStokBatch] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [detailData, setDetailData] = useState(null)
  const [form, setForm] = useState({ cabang_tujuan_id: '' })
  const [items, setItems] = useState([{ produk_id: '', qty_kirim: '' }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [alasanCancel, setAlasanCancel] = useState('')
  const [alasanLain, setAlasanLain] = useState('')
  const [editQty, setEditQty] = useState({})
  const user = JSON.parse(localStorage.getItem('user'))
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const switchMode = localStorage.getItem('switchMode') || 'dc'
  const activeCabangId = switchMode === 'pedagang' ? switchCabang?.id : null
  const isSuperDC = user.role === 'super_dc'
  const isDC = user.role === 'dc' || isSuperDC

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    let tsQuery = supabase
      .from('transfer_stok')
      .select('*, cabang_asal:cabang!transfer_stok_cabang_asal_id_fkey(kode_cabang, nama_cabang), cabang_tujuan:cabang!transfer_stok_cabang_tujuan_id_fkey(kode_cabang, nama_cabang)')
      .order('created_at', { ascending: false })

    if (switchMode === 'pedagang' && activeCabangId) {
      tsQuery = tsQuery.or(`cabang_asal_id.eq.${activeCabangId},cabang_tujuan_id.eq.${activeCabangId}`)
    }

    const [ts, c, p] = await Promise.all([
      tsQuery,
      supabase.from('cabang').select('*').eq('is_aktif', true).order('kode_cabang'),
      supabase.from('produk').select('*').eq('is_aktif', true).order('kode_barang')
    ])

    setTsList(ts.data || [])
    setCabang(c.data || [])
    setProduk(p.data || [])
    setLoading(false)
  }

  const fetchStokCabang = async () => {
    if (!activeCabangId) return
    const { data } = await supabase
      .from('stok_cabang_batch')
      .select('*, produk(kode_barang, nama_varian)')
      .eq('cabang_id', activeCabangId)
      .gt('qty_sisa', 0)
    setStokBatch(data || [])
  }

  const fetchDetail = async (ts) => {
    const { data } = await supabase
      .from('transfer_stok_detail')
      .select('*, produk(kode_barang, nama_varian)')
      .eq('ts_id', ts.id)
    const qtyInit = {}
    data?.forEach(d => { qtyInit[d.id] = d.qty_kirim })
    setEditQty(qtyInit)
    setDetailData({ ...ts, detail: data || [] })
    setView('detail')
  }

  const getStokProduk = (produkId) => {
    const batches = stokBatch.filter(b => b.produk_id === produkId)
    return batches.reduce((acc, b) => acc + b.qty_sisa, 0)
  }

  const addItem = () => setItems([...items, { produk_id: '', qty_kirim: '' }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => { const n = [...items]; n[i][field] = val; setItems(n) }

  const handleSubmit = async () => {
    if (!form.cabang_tujuan_id) { setError('Cabang tujuan wajib dipilih!'); return }
    if (!activeCabangId) { setError('Pilih cabang dulu di mode pedagang!'); return }
    if (items.some(i => !i.produk_id || !i.qty_kirim)) { setError('Semua baris produk wajib diisi!'); return }
    setSaving(true); setError('')

    const { data: newTS } = await supabase.from('transfer_stok').insert({
      cabang_asal_id: activeCabangId,
      cabang_tujuan_id: form.cabang_tujuan_id,
      status: 'request',
      nomor_ts: ''
    }).select().single()

    if (newTS) {
      await supabase.from('transfer_stok_detail').insert(
        items.map(item => {
          const p = produk.find(p => p.id === item.produk_id)
          return {
            ts_id: newTS.id,
            produk_id: item.produk_id,
            hpp_saat_itu: p ? p.hpp : 0,
            qty_kirim: parseInt(item.qty_kirim),
            qty_diterima: 0
          }
        })
      )
    }

    setSaving(false); setView('list')
    setForm({ cabang_tujuan_id: '' })
    setItems([{ produk_id: '', qty_kirim: '' }])
    fetchAll()
  }

  const handleApprove = async () => {
    await supabase.from('transfer_stok').update({ status: 'approved' }).eq('id', detailData.id)
    fetchAll(); setView('list')
  }

  const handleReject = async () => {
    await supabase.from('transfer_stok').update({ status: 'rejected' }).eq('id', detailData.id)
    fetchAll(); setView('list')
  }

  const handleKirim = async () => {
    await supabase.from('transfer_stok').update({ status: 'kirim' }).eq('id', detailData.id)
    fetchAll(); fetchDetail({ ...detailData, status: 'kirim' })
  }

  const handleTerima = async () => {
  setSaving(true)

  for (const item of detailData.detail) {
    const qtyDiterima = parseInt(editQty[item.id] || item.qty_kirim)
    
    // Update qty_diterima di detail
    await supabase.from('transfer_stok_detail')
      .update({ qty_diterima: qtyDiterima })
      .eq('id', item.id)

    // 1. KURANGI stok cabang asal dulu (FIFO)
    let sisaKurangi = parseInt(item.qty_kirim)
    const { data: batches } = await supabase
      .from('stok_cabang_batch')
      .select('*')
      .eq('cabang_id', detailData.cabang_asal_id)
      .eq('produk_id', item.produk_id)
      .gt('qty_sisa', 0)
      .order('tanggal_masuk', { ascending: true })

    for (const batch of (batches || [])) {
      if (sisaKurangi <= 0) break
      const kurangi = Math.min(batch.qty_sisa, sisaKurangi)
      await supabase.from('stok_cabang_batch')
        .update({ qty_sisa: batch.qty_sisa - kurangi })
        .eq('id', batch.id)
      sisaKurangi -= kurangi
    }

    // 2. BARU tambah stok cabang tujuan
    await supabase.from('stok_cabang_batch').insert({
      cabang_id: detailData.cabang_tujuan_id,
      produk_id: item.produk_id,
      hpp_saat_itu: item.hpp_saat_itu,
      qty_masuk: qtyDiterima,
      qty_sisa: qtyDiterima,
      tanggal_masuk: new Date().toISOString().split('T')[0]
    })
  }

  await supabase.from('transfer_stok')
    .update({ status: 'diterima' })
    .eq('id', detailData.id)
  
  setSaving(false)
  setView('list')
  fetchAll()
}

  const handleCancel = async () => {
    if (!alasanCancel) { alert('Pilih alasan cancel!'); return }
    const alasan = alasanCancel === 'lainnya' ? alasanLain : alasanCancel
    await supabase.from('transfer_stok').update({ status: 'cancel', alasan_cancel: alasan }).eq('id', detailData.id)
    setShowCancel(false); setAlasanCancel(''); setAlasanLain('')
    fetchAll(); setView('list')
  }

  const statusBadge = (status) => {
    const map = {
      request: { bg: '#fff8e0', color: '#aa7700', label: 'Request' },
      approved: { bg: '#e8f0ff', color: '#3355cc', label: 'Approved' },
      rejected: { bg: '#fff0f0', color: '#cc2222', label: 'Rejected' },
      kirim: { bg: '#f0f8ff', color: '#3355cc', label: 'Kirim' },
      diterima: { bg: '#f0faf0', color: '#2d7a2d', label: 'Diterima' },
      cancel: { bg: '#fff0f0', color: '#cc2222', label: 'Cancel' }
    }
    const s = map[status] || map.request
    return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>{s.label}</span>
  }

  if (view === 'form') return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <button onClick={() => setView('list')} style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>← Kembali</button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Buat Transfer Stok</h2>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nomor TS</label>
              <input type="text" readOnly style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Dari cabang</label>
              <input type="text" value={switchCabang ? `${switchCabang.kode_cabang} — ${switchCabang.nama_cabang}` : ''} readOnly
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Ke cabang</label>
              <select value={form.cabang_tujuan_id} onChange={e => setForm({ ...form, cabang_tujuan_id: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                <option value="">Pilih cabang tujuan</option>
                {cabang.filter(c => c.id !== activeCabangId).map(c => (
                  <option key={c.id} value={c.id}>{c.kode_cabang} — {c.nama_cabang}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888', width: '40%' }}>Produk</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888', width: '20%' }}>Stok saya</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888', width: '30%' }}>Qty transfer</th>
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
                  <td style={{ padding: '8px 16px', textAlign: 'center', color: '#888' }}>
                    {item.produk_id ? getStokProduk(item.produk_id) : '-'}
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <input type="number" value={item.qty_kirim} onChange={e => updateItem(i, 'qty_kirim', e.target.value)} placeholder="0"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', textAlign: 'center', boxSizing: 'border-box' }} />
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} style={{ border: 'none', background: 'none', color: '#e05555', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                    )}
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
          <button onClick={handleSubmit} disabled={saving}
            style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>{detailData.nomor_ts}</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
                {detailData.cabang_asal?.nama_cabang} → {detailData.cabang_tujuan?.nama_cabang} · {new Date(detailData.created_at).toLocaleDateString('id-ID')}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {statusBadge(detailData.status)}
            {detailData.status === 'request' && isDC && (
              <>
                <button onClick={handleApprove} style={{ padding: '7px 14px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', color: '#2d7a2d', cursor: 'pointer' }}>Approve</button>
                <button onClick={handleReject} style={{ padding: '7px 14px', background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#e05555', cursor: 'pointer' }}>Reject</button>
              </>
            )}
            {detailData.status === 'approved' && switchMode === 'pedagang' && detailData.cabang_asal_id === activeCabangId && (
              <button onClick={handleKirim} style={{ padding: '7px 14px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', color: '#2d7a2d', cursor: 'pointer' }}>Kirim →</button>
            )}
            {detailData.status === 'kirim' && switchMode === 'pedagang' && detailData.cabang_tujuan_id === activeCabangId && (
              <button onClick={handleTerima} disabled={saving} style={{ padding: '7px 14px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', color: '#2d7a2d', cursor: 'pointer' }}>
                {saving ? 'Menyimpan...' : 'Konfirmasi terima →'}
              </button>
            )}
            {['request', 'approved', 'kirim'].includes(detailData.status) && (
              <button onClick={() => setShowCancel(true)} style={{ padding: '7px 14px', background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#e05555', cursor: 'pointer' }}>Cancel</button>
            )}
          </div>
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Kode</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nama barang</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Qty kirim</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Qty diterima</th>
              </tr>
            </thead>
            <tbody>
              {detailData.detail?.map((item, i) => (
                <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', color: '#888' }}>{item.produk?.kode_barang}</td>
                  <td style={{ padding: '10px 16px' }}>{item.produk?.nama_varian}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{item.qty_kirim}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    {detailData.status === 'kirim' && detailData.cabang_tujuan_id === activeCabangId ? (
                      <input type="number" value={editQty[item.id] ?? item.qty_kirim}
                        onChange={e => setEditQty({ ...editQty, [item.id]: e.target.value })}
                        min="0" max={item.qty_kirim}
                        style={{ width: '80px', padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', textAlign: 'center', display: 'block', margin: '0 auto' }} />
                    ) : (
                      <span style={{ color: item.qty_diterima > 0 ? '#2d7a2d' : '#aaa' }}>
                        {detailData.status === 'diterima' ? item.qty_diterima : '-'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showCancel && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '380px' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '15px' }}>Alasan cancel</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="radio" name="alasan" value="Salah input" onChange={e => setAlasanCancel(e.target.value)} /> Salah input
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="radio" name="alasan" value="lainnya" onChange={e => setAlasanCancel(e.target.value)} /> Lainnya
                </label>
                {alasanCancel === 'lainnya' && (
                  <input type="text" value={alasanLain} onChange={e => setAlasanLain(e.target.value)} placeholder="Tulis alasan..."
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', marginTop: '8px' }} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowCancel(false); setAlasanCancel(''); setAlasanLain('') }}
                  style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>Batal</button>
                <button onClick={handleCancel}
                  style={{ padding: '8px 16px', background: '#fff0f0', border: '1px solid #ffd0d0', borderRadius: '8px', fontSize: '13px', color: '#cc2222', cursor: 'pointer' }}>Konfirmasi cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Transfer Stok</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{tsList.length} transfer terdaftar</p>
          </div>
          {switchMode === 'pedagang' && activeCabangId && (
            <button onClick={() => { fetchStokCabang(); setView('form') }}
              style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
              + Buat TS
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
            <option value="kirim">Kirim</option>
            <option value="diterima">Diterima</option>
            <option value="cancel">Cancel</option>
          </select>
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nomor TS</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Dari</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Ke</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tanggal</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</td></tr>
              ) : tsList.filter(t => !filterStatus || t.status === filterStatus).length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada data</td></tr>
              ) : (
                tsList.filter(t => !filterStatus || t.status === filterStatus).map((item, i) => (
                  <tr key={item.id} onClick={() => fetchDetail(item)}
                    style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.nomor_ts}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.cabang_asal?.kode_cabang} — {item.cabang_asal?.nama_cabang}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.cabang_tujuan?.kode_cabang} — {item.cabang_tujuan?.nama_cabang}</td>
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