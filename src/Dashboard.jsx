import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Layout from './components/Layout'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalOmzet: 0, totalSetoran: 0, totalHutang: 0,
    doHariIni: [], pbPending: [], tsPending: [],
    penjualanHariIni: [], totalCupTerjual: 0
  })
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const user = JSON.parse(localStorage.getItem('user'))
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const switchMode = localStorage.getItem('switchMode') || 'dc'
  const activeCabangId = switchMode === 'pedagang' ? switchCabang?.id : null
  const isDC = user.role === 'dc' || user.role === 'super_dc'
  const navigate = useNavigate()

  useEffect(() => {
    fetchStats()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [switchMode, activeCabangId])

  const fetchStats = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    if (switchMode === 'pedagang' && activeCabangId) {
      const [pjRes, stokRes, hutangRes, doRes] = await Promise.all([
        supabase.from('penjualan_harian').select('*').eq('cabang_id', activeCabangId).gte('created_at', today),
        supabase.from('stok_cabang_batch').select('*, produk(nama_varian)').eq('cabang_id', activeCabangId).gt('qty_sisa', 0),
        supabase.from('hutang_pedagang').select('*').eq('cabang_id', activeCabangId).eq('status', 'belum_lunas'),
        supabase.from('delivery_order').select('*, cabang(nama_cabang)').eq('cabang_id', activeCabangId).eq('status', 'kirim')
      ])

      const totalOmzet = pjRes.data?.reduce((acc, p) => acc + Number(p.total_nilai), 0) || 0
      const totalSetoran = pjRes.data?.reduce((acc, p) => acc + Number(p.setoran), 0) || 0
      const totalHutang = hutangRes.data?.reduce((acc, h) => acc + Number(h.jumlah_hutang) - Number(h.jumlah_terbayar), 0) || 0

      const stokGrouped = {}
      stokRes.data?.forEach(b => {
        if (!stokGrouped[b.produk_id]) stokGrouped[b.produk_id] = { nama: b.produk?.nama_varian, qty: 0 }
        stokGrouped[b.produk_id].qty += b.qty_sisa
      })
      const totalStok = Object.values(stokGrouped).reduce((acc, s) => acc + s.qty, 0)

      setStats({
        totalOmzet, totalSetoran, totalHutang, totalStok,
        doMasuk: doRes.data || [],
        stokTop: Object.values(stokGrouped).sort((a, b) => b.qty - a.qty).slice(0, 5),
        penjualanHariIni: pjRes.data || []
      })
    } else {
      const [pjRes, doRes, pbRes, tsRes, hutangRes] = await Promise.all([
        supabase.from('penjualan_harian').select('*, cabang(kode_cabang, nama_cabang)').gte('created_at', today),
        supabase.from('delivery_order').select('*, cabang(kode_cabang, nama_cabang)').gte('created_at', today).order('created_at', { ascending: false }),
        supabase.from('permintaan_barang').select('*, cabang(kode_cabang, nama_cabang)').eq('status', 'request').order('created_at', { ascending: false }),
        supabase.from('transfer_stok').select('*, cabang_asal:cabang!transfer_stok_cabang_asal_id_fkey(kode_cabang, nama_cabang), cabang_tujuan:cabang!transfer_stok_cabang_tujuan_id_fkey(kode_cabang, nama_cabang)').eq('status', 'request').order('created_at', { ascending: false }),
        supabase.from('hutang_pedagang').select('*, cabang(kode_cabang, nama_cabang)').eq('status', 'belum_lunas')
      ])

      const totalOmzet = pjRes.data?.reduce((acc, p) => acc + Number(p.total_nilai), 0) || 0
      const totalSetoran = pjRes.data?.reduce((acc, p) => acc + Number(p.setoran), 0) || 0
      const totalHutang = hutangRes.data?.reduce((acc, h) => acc + Number(h.jumlah_hutang) - Number(h.jumlah_terbayar), 0) || 0
      const totalCupTerjual = pjRes.data?.reduce((acc, p) => acc + (p.total_nilai / 10000), 0) || 0

      setStats({
        totalOmzet, totalSetoran, totalHutang,
        doHariIni: doRes.data || [],
        pbPending: pbRes.data || [],
        tsPending: tsRes.data || [],
        penjualanHariIni: pjRes.data || []
      })
    }
    setLoading(false)
  }

  const statusBadge = (status) => {
    const map = {
      draft: { bg: '#f5f5f5', color: '#888', label: 'Draft' },
      kirim: { bg: '#e8f0ff', color: '#3355cc', label: 'Kirim' },
      diterima: { bg: '#f0faf0', color: '#2d7a2d', label: 'Diterima' },
      cancel: { bg: '#fff0f0', color: '#cc2222', label: 'Cancel' },
      lunas: { bg: '#f0faf0', color: '#2d7a2d', label: 'Lunas' },
      hutang: { bg: '#fff0f0', color: '#cc2222', label: 'Hutang' }
    }
    const s = map[status] || map.draft
    return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>{s.label}</span>
  }

  if (loading) return (
    <Layout>
      <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Memuat dashboard...</div>
    </Layout>
  )

  // DASHBOARD PEDAGANG
  if (switchMode === 'pedagang') return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Dashboard</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
            {switchCabang?.kode_cabang} — {switchCabang?.nama_cabang} · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {stats.doMasuk?.length > 0 && (
          <div onClick={() => navigate('/terima')}
            style={{ background: '#e8f0ff', border: '1px solid #b0c8ff', borderRadius: '12px', padding: '14px 16px', marginBottom: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🚚</span>
              <div>
                <p style={{ margin: 0, fontWeight: '500', fontSize: '14px', color: '#3355cc' }}>{stats.doMasuk.length} DO menunggu diterima!</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#3355cc' }}>Tap untuk terima barang</p>
              </div>
            </div>
            <span style={{ color: '#3355cc', fontSize: '18px' }}>›</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Omzet hari ini</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {stats.totalOmzet.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Setoran hari ini</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {stats.totalSetoran.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total stok</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>{stats.totalStok || 0} cup</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Hutang saya</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: stats.totalHutang > 0 ? '#cc2222' : '#2d7a2d' }}>
              Rp {stats.totalHutang.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 12px' }}>Stok terbanyak</p>
          {stats.stokTop?.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>Belum ada stok</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.stokTop?.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < stats.stokTop.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                  <span style={{ fontSize: '13px' }}>{s.nama}</span>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: s.qty <= 5 ? '#e05555' : '#2d7a2d' }}>{s.qty} cup</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 12px' }}>Penjualan hari ini</p>
          {stats.penjualanHariIni?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <p style={{ fontSize: '13px', color: '#aaa', margin: '0 0 10px' }}>Belum ada laporan penjualan</p>
              <button onClick={() => navigate('/penjualan')}
                style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', color: '#2d7a2d', cursor: 'pointer' }}>
                Input penjualan →
              </button>
            </div>
          ) : (
            stats.penjualanHariIni.map(pj => (
              <div key={pj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>{pj.nomor_pj}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>Setor: Rp {Number(pj.setoran).toLocaleString('id-ID')}</p>
                </div>
                {statusBadge(pj.status)}
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )

  // DASHBOARD DC
  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Dashboard</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total omzet hari ini</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {stats.totalOmzet.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total setoran</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {stats.totalSetoran.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Selisih belum setor</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: (stats.totalOmzet - stats.totalSetoran) > 0 ? '#cc2222' : '#2d7a2d' }}>
              Rp {(stats.totalOmzet - stats.totalSetoran).toLocaleString('id-ID')}
            </p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total hutang aktif</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: stats.totalHutang > 0 ? '#cc2222' : '#2d7a2d' }}>
              Rp {stats.totalHutang.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {(stats.pbPending?.length > 0 || stats.tsPending?.length > 0) && (
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 12px' }}>⏳ Pending approval</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.pbPending?.map(pb => (
                <div key={pb.id} onClick={() => navigate('/pb')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fff8e0', borderRadius: '8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📋</span>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#aa7700' }}>{pb.nomor_pb}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#aa7700' }}>{pb.cabang?.kode_cabang} — {pb.cabang?.nama_cabang}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#aa7700' }}>Permintaan Barang ›</span>
                </div>
              ))}
              {stats.tsPending?.map(ts => (
                <div key={ts.id} onClick={() => navigate('/ts')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fff8e0', borderRadius: '8px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🔄</span>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#aa7700' }}>{ts.nomor_ts}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#aa7700' }}>{ts.cabang_asal?.kode_cabang} → {ts.cabang_tujuan?.kode_cabang}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#aa7700' }}>Transfer Stok ›</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Status DO hari ini</p>
            <button onClick={() => navigate('/do')} style={{ fontSize: '12px', color: '#3355cc', background: 'none', border: 'none', cursor: 'pointer' }}>Lihat semua →</button>
          </div>
          {stats.doHariIni?.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>Belum ada DO hari ini</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.doHariIni?.slice(0, 5).map(doItem => (
                <div key={doItem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>{doItem.nomor_do}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{doItem.cabang?.kode_cabang} — {doItem.cabang?.nama_cabang}</p>
                  </div>
                  {statusBadge(doItem.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Penjualan per cabang hari ini</p>
            <button onClick={() => navigate('/penjualan')} style={{ fontSize: '12px', color: '#3355cc', background: 'none', border: 'none', cursor: 'pointer' }}>Lihat semua →</button>
          </div>
          {stats.penjualanHariIni?.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>Belum ada laporan penjualan hari ini</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.penjualanHariIni?.map(pj => (
                <div key={pj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>{pj.cabang?.kode_cabang} — {pj.cabang?.nama_cabang}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>
                      Omzet: Rp {Number(pj.total_nilai).toLocaleString('id-ID')} · Setor: Rp {Number(pj.setoran).toLocaleString('id-ID')}
                    </p>
                  </div>
                  {statusBadge(pj.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}