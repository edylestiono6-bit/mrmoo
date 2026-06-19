import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function DeliveryOrder() {
  const [doList, setDoList] = useState([])
  const [cabang, setCabang] = useState([])
  const [produk, setProduk] = useState([])
  const [pbList, setPbList] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [detailData, setDetailData] = useState(null)
  const [form, setForm] = useState({ cabang_id: '', pb_id: '', metode: 'manual' })
  const [items, setItems] = useState([{ produk_id: '', qty_kirim: '' }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [alasanCancel, setAlasanCancel] = useState('')
  const [alasanLain, setAlasanLain] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    fetchAll()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [d, c, p, pb, doYangAdaPB] = await Promise.all([
      supabase.from('delivery_order').select('*, cabang(kode_cabang, nama_cabang), permintaan_barang(nomor_pb)').order('created_at', { ascending: false }),
      supabase.from('cabang').select('*').eq('is_aktif', true).order('kode_cabang'),
      supabase.from('produk').select('*').eq('is_aktif', true).order('kode_barang'),
      supabase.from('permintaan_barang').select('*, cabang(nama_cabang)').eq('status', 'approved').order('created_at', { ascending: false }),
      supabase.from('delivery_order').select('pb_id').not('pb_id', 'is', null)
    ])

    const pbIdYangSudahDipakai = doYangAdaPB.data?.map(d => d.pb_id) || []
    const pbBelumDipakai = pb.data?.filter(p => !pbIdYangSudahDipakai.includes(p.id)) || []

    setDoList(d.data || [])
    setCabang(c.data || [])
    setProduk(p.data || [])
    setPbList(pbBelumDipakai)
    setLoading(false)
  }

  const fetchDetail = async (doItem) => {
    const { data } = await supabase
      .from('delivery_order_detail')
      .select('*, produk(kode_barang, nama_varian)')
      .eq('do_id', doItem.id)
    setDetailData({ ...doItem, detail: data || [] })
    setView('detail')
  }

  const addItem = () => setItems([...items, { produk_id: '', qty_kirim: '' }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => { const n = [...items]; n[i][field] = val; setItems(n) }

  const handlePBChange = async (pbId) => {
    setForm({ ...form, pb_id: pbId, metode: pbId ? 'dari_pb' : 'manual' })
    if (pbId) {
      const { data } = await supabase.from('permintaan_barang_detail').select('*, produk(*)').eq('pb_id', pbId)
      if (data) setItems(data.map(d => ({ produk_id: d.produk_id, qty_kirim: d.qty_diminta })))
      const pb = pbList.find(p => p.id === pbId)
      if (pb) setForm(f => ({ ...f, pb_id: pbId, metode: 'dari_pb', cabang_id: pb.cabang_id }))
    } else {
      setItems([{ produk_id: '', qty_kirim: '' }])
    }
  }

  const handleSubmit = async (kirimSekarang = false) => {
    if (!form.cabang_id) { setError('Cabang wajib dipilih!'); return }
    if (items.some(i => !i.produk_id || !i.qty_kirim)) { setError('Semua baris produk wajib diisi!'); return }
    setSaving(true); setError('')

    const { data: newDO } = await supabase.from('delivery_order').insert({
      cabang_id: form.cabang_id,
      pb_id: form.pb_id || null,
      metode: form.metode,
      status: kirimSekarang ? 'kirim' : 'draft',
      nomor_do: ''
    }).select().single()

    if (newDO) {
      await supabase.from('delivery_order_detail').insert(
        items.map(item => {
          const p = produk.find(p => p.id === item.produk_id)
          return {
            do_id: newDO.id,
            produk_id: item.produk_id,
            hpp_saat_itu: p ? p.hpp : 0,
            qty_kirim: parseInt(item.qty_kirim),
            qty_diterima: 0
          }
        })
      )

      if (form.pb_id) {
        await supabase.from('permintaan_barang').update({ status: 'approved' }).eq('id', form.pb_id)
      }
    }

    setSaving(false); setView('list')
    setForm({ cabang_id: '', pb_id: '', metode: 'manual' })
    setItems([{ produk_id: '', qty_kirim: '' }])
    fetchAll()
  }

  const handleKirim = async (doItem) => {
    await supabase.from('delivery_order').update({ status: 'kirim' }).eq('id', doItem.id)
    fetchAll()
    fetchDetail({ ...doItem, status: 'kirim' })
  }

  const handleCancel = async () => {
    if (!alasanCancel) { alert('Pilih alasan cancel!'); return }
    const alasan = alasanCancel === 'lainnya' ? alasanLain : alasanCancel
    await supabase.from('delivery_order').update({ status: 'cancel', alasan_cancel: alasan }).eq('id', detailData.id)
    setShowCancel(false); setAlasanCancel(''); setAlasanLain('')
    fetchAll(); setView('list')
  }

  const statusBadge = (status) => {
    const map = {
      draft: { bg: '#f5f5f5', color: '#888', label: 'Draft' },
      kirim: { bg: '#e8f0ff', color: '#3355cc', label: 'Kirim' },
      diterima: { bg: '#f0faf0', color: '#2d7a2d', label: 'Diterima' },
      cancel: { bg: '#fff0f0', color: '#cc2222', label: 'Cancel' }
    }
    const s = map[status] || map.draft
    return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>{s.label}</span>
  }

  if (view === 'form') return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <button onClick={() => setView('list')} style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>← Kembali</button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Buat Delivery Order</h2>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nomor DO</label>
              <input type="text" readOnly style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Berdasarkan PB (opsional)</label>
              <select value={form.pb_id} onChange={e => handlePBChange(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                <option value="">Tidak (manual)</option>
                {pbList.map(pb => <option key={pb.id} value={pb.id}>{pb.nomor_pb} — {pb.cabang?.nama_cabang}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Cabang tujuan</label>
              <select value={form.cabang_id} onChange={e => setForm({ ...form, cabang_id: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }}>
                <option value="">Pilih cabang</option>
                {cabang.map(c => <option key={c.id} value={c.id}>{c.kode_cabang} — {c.nama_cabang}</option>)}
              </select>
            </div>
          </div>
        </div>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
            {items.map((item, i) => (
              <div key={i} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', color: '#666' }}>Produk {i + 1}</label>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} style={{ border: 'none', background: 'none', color: '#e05555', cursor: 'pointer', fontSize: '18px' }}>✕</button>
                  )}
                </div>
                <select value={item.produk_id} onChange={e => updateItem(i, 'produk_id', e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', marginBottom: '10px', boxSizing: 'border-box' }}>
                  <option value="">Pilih produk</option>
                  {produk.map(p => <option key={p.id} value={p.id}>{p.kode_barang} — {p.nama_varian}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '13px', color: '#666', flexShrink: 0 }}>Qty kirim:</label>
                  <input type="number" value={item.qty_kirim} onChange={e => updateItem(i, 'qty_kirim', e.target.value)} placeholder="0"
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '15px', textAlign: 'center' }} />
                  <span style={{ fontSize: '13px', color: '#888', flexShrink: 0 }}>cup</span>
                </div>
              </div>
            ))}
            <button onClick={addItem}
              style={{ padding: '12px', border: '1px dashed #e0e0e0', borderRadius: '12px', fontSize: '14px', cursor: 'pointer', background: 'white', color: '#888' }}>
              + Tambah produk
            </button>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888', width: '55%' }}>Produk</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888', width: '35%' }}>Qty kirim (cup)</th>
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
                      <input type="number" value={item.qty_kirim} onChange={e => updateItem(i, 'qty_kirim', e.target.value)} placeholder="0"
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
        )}

        {error && <p style={{ color: 'red', fontSize: '13px', margin: '0 0 1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setView('list')} style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>Batal</button>
          <button onClick={() => handleSubmit(false)} disabled={saving} style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>
            {saving ? 'Menyimpan...' : 'Simpan draft'}
          </button>
          <button onClick={() => handleSubmit(true)} disabled={saving}
            style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            {saving ? 'Menyimpan...' : 'Kirim sekarang →'}
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>{detailData.nomor_do}</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{detailData.cabang?.nama_cabang} · {new Date(detailData.created_at).toLocaleDateString('id-ID')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {statusBadge(detailData.status)}
            {detailData.status === 'draft' && (
              <>
                <button onClick={() => handleKirim(detailData)} style={{ padding: '7px 14px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', color: '#2d7a2d', cursor: 'pointer' }}>Kirim →</button>
                <button onClick={() => setShowCancel(true)} style={{ padding: '7px 14px', background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#e05555', cursor: 'pointer' }}>Cancel</button>
              </>
            )}
            {detailData.status === 'kirim' && (
              <button onClick={() => setShowCancel(true)} style={{ padding: '7px 14px', background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', color: '#e05555', cursor: 'pointer' }}>Cancel</button>
            )}
          </div>
        </div>

        {detailData.pb_id && (
          <div style={{ padding: '10px 16px', background: '#f0f8ff', border: '1px solid #d0e8ff', borderRadius: '8px', marginBottom: '1rem', fontSize: '13px', color: '#3355cc' }}>
            Berdasarkan PB: {detailData.permintaan_barang?.nomor_pb}
          </div>
        )}
        {detailData.status === 'cancel' && detailData.alasan_cancel && (
          <div style={{ padding: '10px 16px', background: '#fff0f0', border: '1px solid #ffd0d0', borderRadius: '8px', marginBottom: '1rem', fontSize: '13px', color: '#cc2222' }}>
            Alasan cancel: {detailData.alasan_cancel}
          </div>
        )}

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
            {detailData.detail?.map(item => (
              <div key={item.id} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{item.produk?.nama_varian}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{item.produk?.kode_barang}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>{item.qty_kirim} cup</p>
                  {detailData.status === 'diterima' && (
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: item.qty_diterima < item.qty_kirim ? '#e05555' : '#2d7a2d' }}>
                      Diterima: {item.qty_diterima}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
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
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: detailData.status === 'diterima' && item.qty_diterima < item.qty_kirim ? '#e05555' : '#2d7a2d' }}>
                      {detailData.status === 'diterima' ? item.qty_diterima : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showCancel && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '380px' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '15px' }}>Alasan cancel</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="radio" name="alasan" value="Salah input" onChange={e => setAlasanCancel(e.target.value)} /> Salah input
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="radio" name="alasan" value="lainnya" onChange={e => setAlasanCancel(e.target.value)} /> Lainnya
                </label>
                {alasanCancel === 'lainnya' && (
                  <input type="text" value={alasanLain} onChange={e => setAlasanLain(e.target.value)} placeholder="Tulis alasan..."
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', marginTop: '10px' }} />
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
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Delivery Order</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{doList.length} DO terdaftar</p>
          </div>
          <button onClick={() => setView('form')}
            style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            + Buat DO
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}>
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="kirim">Kirim</option>
            <option value="diterima">Diterima</option>
            <option value="cancel">Cancel</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {doList.filter(d => !filterStatus || d.status === filterStatus).length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', color: '#888' }}>Belum ada data</div>
            ) : doList.filter(d => !filterStatus || d.status === filterStatus).map(item => (
              <div key={item.id} onClick={() => fetchDetail(item)}
                style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{item.nomor_do}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#888' }}>{item.cabang?.kode_cabang} — {item.cabang?.nama_cabang}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#888' }}>{item.metode === 'dari_pb' ? 'Dari PB' : 'Manual'} · {new Date(item.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {statusBadge(item.status)}
                    <span style={{ color: '#aaa' }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nomor DO</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Cabang</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Metode</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tanggal</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}></th>
                </tr>
              </thead>
              <tbody>
                {doList.filter(d => !filterStatus || d.status === filterStatus).length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada data</td></tr>
                ) : doList.filter(d => !filterStatus || d.status === filterStatus).map((item, i) => (
                  <tr key={item.id} onClick={() => fetchDetail(item)}
                    style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.nomor_do}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.cabang?.kode_cabang} — {item.cabang?.nama_cabang}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.metode === 'dari_pb' ? 'Dari PB' : 'Manual'}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>{statusBadge(item.status)}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: '#aaa' }}>›</td>
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