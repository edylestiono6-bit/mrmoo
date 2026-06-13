import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function TerimaBarang() {
  const [doList, setDoList] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [detailData, setDetailData] = useState(null)
  const [editQty, setEditQty] = useState({})
  const [saving, setSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const activeCabangId = switchCabang?.id

  useEffect(() => {
    fetchDO()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchDO = async () => {
    setLoading(true)
    if (!activeCabangId) { setLoading(false); return }
    const { data } = await supabase
      .from('delivery_order')
      .select('*, cabang(kode_cabang, nama_cabang), permintaan_barang(nomor_pb)')
      .eq('cabang_id', activeCabangId)
      .eq('status', 'kirim')
      .order('created_at', { ascending: false })
    setDoList(data || [])
    setLoading(false)
  }

  const fetchDetail = async (doItem) => {
    const { data } = await supabase
      .from('delivery_order_detail')
      .select('*, produk(kode_barang, nama_varian, hpp)')
      .eq('do_id', doItem.id)
    const qtyInit = {}
    data?.forEach(d => { qtyInit[d.id] = d.qty_kirim })
    setEditQty(qtyInit)
    setDetailData({ ...doItem, detail: data || [] })
    setView('detail')
  }

  const handleTerima = async () => {
    setSaving(true)
    const updates = detailData.detail.map(item => ({
      id: item.id,
      qty_diterima: parseInt(editQty[item.id] || item.qty_kirim)
    }))

    for (const u of updates) {
      await supabase.from('delivery_order_detail').update({ qty_diterima: u.qty_diterima }).eq('id', u.id)
    }

    await supabase.from('delivery_order').update({ status: 'diterima' }).eq('id', detailData.id)

    for (const item of detailData.detail) {
      const qtySisa = parseInt(editQty[item.id] || item.qty_kirim)
      const qtySelisih = item.qty_kirim - qtySisa

      await supabase.from('stok_cabang_batch').insert({
        cabang_id: activeCabangId,
        produk_id: item.produk_id,
        do_id: detailData.id,
        hpp_saat_itu: item.produk?.hpp || 0,
        qty_masuk: qtySisa,
        qty_sisa: qtySisa,
        tanggal_masuk: new Date().toISOString().split('T')[0]
      })

      if (qtySelisih > 0) {
        const { data: newRetur } = await supabase.from('retur').insert({
          do_id: detailData.id,
          cabang_id: activeCabangId,
          nomor_retur: ''
        }).select().single()

        if (newRetur) {
          await supabase.from('retur_detail').insert({
            retur_id: newRetur.id,
            produk_id: item.produk_id,
            qty_kirim: item.qty_kirim,
            qty_diterima: qtySisa,
            qty_retur: qtySelisih,
            hpp_saat_itu: item.produk?.hpp || 0
          })
        }
      }
    }

    setSaving(false)
    setView('list')
    fetchDO()
  }

  const totalSelisih = detailData?.detail?.reduce((acc, item) => {
    const diterima = parseInt(editQty[item.id] || item.qty_kirim)
    return acc + (item.qty_kirim - diterima)
  }, 0)

  if (!activeCabangId) return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', padding: '3rem' }}>
        <p style={{ fontSize: '16px', color: '#888' }}>⚠️ Pilih cabang dulu di mode pedagang!</p>
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
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
                {detailData.cabang?.nama_cabang} · {new Date(detailData.created_at).toLocaleDateString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
            {detailData.detail?.map((item) => {
              const diterima = parseInt(editQty[item.id] ?? item.qty_kirim)
              const selisih = item.qty_kirim - diterima
              return (
                <div key={item.id} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{item.produk?.nama_varian}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{item.produk?.kode_barang}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Dikirim: {item.qty_kirim} cup</p>
                      {selisih > 0 && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#e05555' }}>Selisih: -{selisih}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontSize: '13px', color: '#666', flexShrink: 0 }}>Qty diterima:</label>
                    <input type="number"
                      value={editQty[item.id] ?? item.qty_kirim}
                      onChange={e => setEditQty({ ...editQty, [item.id]: e.target.value })}
                      min="0" max={item.qty_kirim}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '15px', textAlign: 'center' }} />
                    <span style={{ fontSize: '13px', color: '#888', flexShrink: 0 }}>cup</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9f9f9' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Kode</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nama barang</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Qty kirim</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Qty diterima</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {detailData.detail?.map((item, i) => {
                  const diterima = parseInt(editQty[item.id] ?? item.qty_kirim)
                  const selisih = item.qty_kirim - diterima
                  return (
                    <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '10px 16px', color: '#888' }}>{item.produk?.kode_barang}</td>
                      <td style={{ padding: '10px 16px' }}>{item.produk?.nama_varian}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: '#888' }}>{item.qty_kirim}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <input type="number" value={editQty[item.id] ?? item.qty_kirim}
                          onChange={e => setEditQty({ ...editQty, [item.id]: e.target.value })}
                          min="0" max={item.qty_kirim}
                          style={{ width: '80px', padding: '6px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', textAlign: 'center', display: 'block', margin: '0 auto' }} />
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: selisih > 0 ? '#e05555' : '#2d7a2d', fontWeight: selisih > 0 ? '500' : '400' }}>
                        {selisih > 0 ? `-${selisih}` : '✓'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalSelisih > 0 && (
          <div style={{ padding: '10px 16px', background: '#fff8e0', border: '1px solid #ffe0a0', borderRadius: '8px', marginBottom: '1rem', fontSize: '13px', color: '#aa7700' }}>
            ⚠️ Ada selisih {totalSelisih} cup — akan otomatis dibuat dokumen Retur
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setView('list')} style={{ padding: '10px 20px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', background: 'white' }}>Batal</button>
          <button onClick={handleTerima} disabled={saving}
            style={{ padding: '10px 20px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '14px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            {saving ? 'Menyimpan...' : 'Konfirmasi terima →'}
          </button>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Terima Barang</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>DO yang siap diterima</p>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</div>
        ) : doList.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', color: '#888' }}>
            Tidak ada DO yang perlu diterima
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {doList.map(item => (
              <div key={item.id} onClick={() => fetchDetail(item)}
                style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '14px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{item.nomor_do}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#888' }}>{item.metode === 'dari_pb' ? 'Dari PB' : 'Manual'}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#888' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '20px', background: '#e8f0ff', color: '#3355cc' }}>Siap diterima</span>
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
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Metode</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tanggal</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}></th>
                </tr>
              </thead>
              <tbody>
                {doList.map((item, i) => (
                  <tr key={item.id} onClick={() => fetchDetail(item)}
                    style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.nomor_do}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.metode === 'dari_pb' ? 'Dari PB' : 'Manual'}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
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