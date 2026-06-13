import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function StokSaya() {
  const [stokData, setStokData] = useState([])
  const [loading, setLoading] = useState(true)
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const activeCabangId = switchCabang?.id

  useEffect(() => { fetchStok() }, [])

  const fetchStok = async () => {
    setLoading(true)
    if (!activeCabangId) { setLoading(false); return }

    const { data } = await supabase
      .from('stok_cabang_batch')
      .select('*, produk(kode_barang, nama_varian, harga_jual)')
      .eq('cabang_id', activeCabangId)
      .gt('qty_sisa', 0)
      .order('tanggal_masuk', { ascending: true })

    const grouped = {}
    data?.forEach(batch => {
      const pid = batch.produk_id
      if (!grouped[pid]) {
        grouped[pid] = {
          produk: batch.produk,
          total_qty: 0,
          batches: []
        }
      }
      grouped[pid].total_qty += batch.qty_sisa
      grouped[pid].batches.push(batch)
    })

    setStokData(Object.values(grouped))
    setLoading(false)
  }

  if (!activeCabangId) return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', padding: '3rem' }}>
        <p style={{ fontSize: '16px', color: '#888' }}>⚠️ Pilih cabang dulu di mode pedagang!</p>
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Stok Saya</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
            {switchCabang?.kode_cabang} — {switchCabang?.nama_cabang}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '1.5rem' }}>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total varian</p>
            <p style={{ fontSize: '20px', fontWeight: '500', margin: 0 }}>{stokData.length}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total stok</p>
            <p style={{ fontSize: '20px', fontWeight: '500', margin: 0 }}>
              {stokData.reduce((acc, s) => acc + s.total_qty, 0)} cup
            </p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Nilai stok</p>
            <p style={{ fontSize: '20px', fontWeight: '500', margin: 0 }}>
              Rp {stokData.reduce((acc, s) => acc + (s.total_qty * (s.produk?.harga_jual || 0)), 0).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Kode</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nama varian</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Stok (cup)</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Harga jual</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Nilai stok</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</td></tr>
              ) : stokData.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada stok</td></tr>
              ) : (
                stokData.map((item, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.produk?.kode_barang}</td>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.produk?.nama_varian}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{
                        fontWeight: '500',
                        color: item.total_qty <= 5 ? '#e05555' : item.total_qty <= 15 ? '#aa7700' : '#2d7a2d'
                      }}>
                        {item.total_qty}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#888' }}>
                      Rp {Number(item.produk?.harga_jual || 0).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      Rp {(item.total_qty * (item.produk?.harga_jual || 0)).toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {stokData.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '1px solid #e0e0e0', background: '#f9f9f9' }}>
                  <td colSpan="4" style={{ padding: '10px 16px', fontWeight: '500' }}>Total</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500' }}>
                    Rp {stokData.reduce((acc, s) => acc + (s.total_qty * (s.produk?.harga_jual || 0)), 0).toLocaleString('id-ID')}
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