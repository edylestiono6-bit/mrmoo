import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Layout from './components/Layout'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [statsHariIni, setStatsHariIni] = useState({ totalOmzet: 0, totalSetoran: 0, totalHutang: 0, totalBiaya: 0, totalKomisi: 0 })
  const [aksiDC, setAksiDC] = useState({ pbPending: [], tsPending: [], doDraft: [] })
  const [aksiPedagang, setAksiPedagang] = useState({ doMasuk: [], tsPerluKirim: [], tsPerluTerima: [], hutangAktif: [] })
  const [stokTop, setStokTop] = useState([])
  const [penjualanHariIni, setPenjualanHariIni] = useState([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const user = JSON.parse(localStorage.getItem('user'))
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const switchMode = localStorage.getItem('switchMode') || 'dc'
  const activeCabangId = switchMode === 'pedagang' ? switchCabang?.id : null
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [switchMode, activeCabangId])

  const fetchData = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    if (switchMode === 'pedagang' && activeCabangId) {
      const [doRes, tsRes, hutangRes, pjRes, stokRes, komisiRes, biayaRes] = await Promise.all([
        supabase.from('delivery_order').select('*, cabang(nama_cabang)').eq('cabang_id', activeCabangId).eq('status', 'kirim'),
        supabase.from('transfer_stok').select('*, cabang_asal:cabang!transfer_stok_cabang_asal_id_fkey(kode_cabang, nama_cabang), cabang_tujuan:cabang!transfer_stok_cabang_tujuan_id_fkey(kode_cabang, nama_cabang)').or(`cabang_asal_id.eq.${activeCabangId},cabang_tujuan_id.eq.${activeCabangId}`).in('status', ['approved', 'kirim']),
        supabase.from('hutang_pedagang').select('*').eq('cabang_id', activeCabangId).eq('status', 'belum_lunas'),
        supabase.from('penjualan_harian').select('*').eq('cabang_id', activeCabangId).gte('created_at', today),
        supabase.from('stok_cabang_batch').select('*, produk(nama_varian)').eq('cabang_id', activeCabangId).gt('qty_sisa', 0),
        supabase.from('komisi').select('*').eq('cabang_id', activeCabangId).eq('tanggal', today),
        supabase.from('pengeluaran').select('*').eq('cabang_id', activeCabangId).gte('created_at', today)
      ])

      const tsPerluKirim = tsRes.data?.filter(ts => ts.status === 'approved' && ts.cabang_asal_id === activeCabangId) || []
      const tsPerluTerima = tsRes.data?.filter(ts => ts.status === 'kirim' && ts.cabang_tujuan_id === activeCabangId) || []

      const totalOmzet = pjRes.data?.reduce((acc, p) => acc + Number(p.total_nilai), 0) || 0
      const totalSetoran = pjRes.data?.reduce((acc, p) => acc + Number(p.setoran), 0) || 0
      const totalHutang = hutangRes.data?.reduce((acc, h) => acc + Number(h.jumlah_hutang) - Number(h.jumlah_terbayar), 0) || 0
      const totalKomisi = komisiRes.data?.reduce((acc, k) => acc + Number(k.nominal_komisi), 0) || 0
      const totalBiaya = biayaRes.data?.reduce((acc, b) => acc + Number(b.nominal), 0) || 0
      const totalStok = 0
      const grouped = {}
      stokRes.data?.forEach(b => {
        if (!grouped[b.produk_id]) grouped[b.produk_id] = { nama: b.produk?.nama_varian, qty: 0 }
        grouped[b.produk_id].qty += b.qty_sisa
      })
      const totalStokQty = Object.values(grouped).reduce((acc, s) => acc + s.qty, 0)

      setAksiPedagang({ doMasuk: doRes.data || [], tsPerluKirim, tsPerluTerima, hutangAktif: hutangRes.data || [] })
      setStatsHariIni({ totalOmzet, totalSetoran, totalHutang, totalKomisi, totalBiaya, totalStok: totalStokQty })
      setStokTop(Object.values(grouped).sort((a, b) => b.qty - a.qty).slice(0, 5))
      setPenjualanHariIni(pjRes.data || [])

    } else {
      const [pbRes, tsRes, doRes, pjRes, hutangRes, komisiRes, biayaRes] = await Promise.all([
        supabase.from('permintaan_barang').select('*, cabang(kode_cabang, nama_cabang)').eq('status', 'request').order('created_at', { ascending: false }),
        supabase.from('transfer_stok').select('*, cabang_asal:cabang!transfer_stok_cabang_asal_id_fkey(kode_cabang, nama_cabang), cabang_tujuan:cabang!transfer_stok_cabang_tujuan_id_fkey(kode_cabang, nama_cabang)').eq('status', 'request').order('created_at', { ascending: false }),
        supabase.from('delivery_order').select('*, cabang(kode_cabang, nama_cabang)').eq('status', 'draft').order('created_at', { ascending: false }),
        supabase.from('penjualan_harian').select('*, cabang(kode_cabang, nama_cabang)').gte('created_at', today).order('created_at', { ascending: false }),
        supabase.from('hutang_pedagang').select('*').eq('status', 'belum_lunas'),
        supabase.from('komisi').select('*').eq('tanggal', today),
        supabase.from('pengeluaran').select('*').gte('created_at', today)
      ])

      const totalOmzet = pjRes.data?.reduce((acc, p) => acc + Number(p.total_nilai), 0) || 0
      const totalSetoran = pjRes.data?.reduce((acc, p) => acc + Number(p.setoran), 0) || 0
      const totalHutang = hutangRes.data?.reduce((acc, h) => acc + Number(h.jumlah_hutang) - Number(h.jumlah_terbayar), 0) || 0
      const totalKomisi = komisiRes.data?.reduce((acc, k) => acc + Number(k.nominal_komisi), 0) || 0
      const totalBiaya = biayaRes.data?.reduce((acc, b) => acc + Number(b.nominal), 0) || 0

      // Kumulatif per cabang
      const pjGrouped = {}
      pjRes.data?.forEach(pj => {
        const cid = pj.cabang_id
        if (!pjGrouped[cid]) {
          pjGrouped[cid] = {
            cabang_id: cid,
            cabang: pj.cabang,
            total_nilai: 0,
            setoran: 0,
            status: 'lunas'
          }
        }
        pjGrouped[cid].total_nilai += Number(pj.total_nilai)
        pjGrouped[cid].setoran += Number(pj.setoran)
        if (pj.status === 'hutang') pjGrouped[cid].status = 'hutang'
      })

      setAksiDC({ pbPending: pbRes.data || [], tsPending: tsRes.data || [], doDraft: doRes.data || [] })
      setStatsHariIni({ totalOmzet, totalSetoran, totalHutang, totalKomisi, totalBiaya })
      setPenjualanHariIni(Object.values(pjGrouped))
    }

    setLoading(false)
  }

  const statusBadge = (status) => {
    const map = {
      draft: { bg: '#f5f5f5', color: '#888', label: 'Draft' },
      kirim: { bg: '#e8f0ff', color: '#3355cc', label: 'Kirim' },
      diterima: { bg: '#f0faf0', color: '#2d7a2d', label: 'Diterima' },
      lunas: { bg: '#f0faf0', color: '#2d7a2d', label: 'Lunas' },
      hutang: { bg: '#fff0f0', color: '#cc2222', label: 'Hutang' },
      approved: { bg: '#f0f0ff', color: '#5555cc', label: 'Approved' },
      request: { bg: '#fff8e0', color: '#aa7700', label: 'Request' }
    }
    const s = map[status] || map.draft
    return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>{s.label}</span>
  }

  const ActionCard = ({ icon, title, subtitle, onClick, color = '#aa7700', bg = '#fff8e0', border = '#ffe0a0' }) => (
    <div onClick={onClick}
      style={{ background: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <div>
          <p style={{ margin: 0, fontWeight: '500', fontSize: '13px', color }}>{title}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color }}>{subtitle}</p>
        </div>
      </div>
      <span style={{ color, fontSize: '16px' }}>›</span>
    </div>
  )

  if (loading) return (
    <Layout>
      <div style={{ padding: '3rem', textAlign: 'center', color: '#888' }}>Memuat dashboard...</div>
    </Layout>
  )

  // DASHBOARD PEDAGANG
  if (switchMode === 'pedagang') {
    const harusSetor = statsHariIni.totalOmzet - statsHariIni.totalBiaya - statsHariIni.totalKomisi
    const belumSetor = harusSetor - statsHariIni.totalSetoran

    return (
      <Layout>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Dashboard</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
              {switchCabang?.kode_cabang} — {switchCabang?.nama_cabang} · {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* AKSI */}
          {(aksiPedagang.doMasuk.length > 0 || aksiPedagang.tsPerluKirim.length > 0 || aksiPedagang.tsPerluTerima.length > 0 || aksiPedagang.hutangAktif.length > 0) && (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '12px', fontWeight: '500', color: '#888', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Perlu tindakan</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aksiPedagang.doMasuk.map(do_ => (
                  <ActionCard key={do_.id} icon="🚚"
                    title={`DO ${do_.nomor_do} menunggu diterima`}
                    subtitle="Tap untuk konfirmasi penerimaan barang"
                    onClick={() => navigate('/terima')}
                    color="#3355cc" bg="#e8f0ff" border="#b0c8ff" />
                ))}
                {aksiPedagang.tsPerluKirim.map(ts => (
                  <ActionCard key={ts.id} icon="📤"
                    title={`${ts.nomor_ts} siap dikirim`}
                    subtitle={`Transfer ke ${ts.cabang_tujuan?.nama_cabang} — klik Kirim`}
                    onClick={() => navigate('/ts')}
                    color="#2d7a2d" bg="#f0faf0" border="#c0e0c0" />
                ))}
                {aksiPedagang.tsPerluTerima.map(ts => (
                  <ActionCard key={ts.id} icon="📥"
                    title={`${ts.nomor_ts} menunggu diterima`}
                    subtitle={`Transfer dari ${ts.cabang_asal?.nama_cabang}`}
                    onClick={() => navigate('/ts')}
                    color="#3355cc" bg="#e8f0ff" border="#b0c8ff" />
                ))}
                {aksiPedagang.hutangAktif.length > 0 && (
                  <ActionCard icon="💰"
                    title={`${aksiPedagang.hutangAktif.length} hutang belum lunas`}
                    subtitle={`Total: Rp ${aksiPedagang.hutangAktif.reduce((acc, h) => acc + Number(h.jumlah_hutang) - Number(h.jumlah_terbayar), 0).toLocaleString('id-ID')}`}
                    onClick={() => navigate('/hutang')}
                    color="#cc2222" bg="#fff0f0" border="#ffd0d0" />
                )}
              </div>
            </div>
          )}

          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Omzet hari ini</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {statsHariIni.totalOmzet.toLocaleString('id-ID')}</p>
            </div>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Komisi hari ini</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: '#2d7a2d' }}>Rp {statsHariIni.totalKomisi.toLocaleString('id-ID')}</p>
            </div>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Biaya hari ini</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: '#cc2222' }}>Rp {statsHariIni.totalBiaya.toLocaleString('id-ID')}</p>
            </div>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Harus disetor</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: '#3355cc' }}>Rp {harusSetor.toLocaleString('id-ID')}</p>
            </div>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Sudah disetor</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {statsHariIni.totalSetoran.toLocaleString('id-ID')}</p>
            </div>
            <div style={{ background: belumSetor > 0 ? '#fff0f0' : '#f0faf0', border: `1px solid ${belumSetor > 0 ? '#ffd0d0' : '#c0e0c0'}`, borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Sisa belum setor</p>
              <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: belumSetor > 0 ? '#cc2222' : '#2d7a2d' }}>
                Rp {belumSetor.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          {/* STOK */}
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Stok saat ini</p>
              <button onClick={() => navigate('/stok')} style={{ fontSize: '12px', color: '#3355cc', background: 'none', border: 'none', cursor: 'pointer' }}>Lihat semua →</button>
            </div>
            {stokTop.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>Belum ada stok</p>
            ) : stokTop.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < stokTop.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <span style={{ fontSize: '13px' }}>{s.nama}</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: s.qty <= 5 ? '#e05555' : '#2d7a2d' }}>{s.qty} cup</span>
              </div>
            ))}
          </div>

          {/* PENJUALAN */}
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Penjualan hari ini</p>
              <button onClick={() => navigate('/penjualan')} style={{ fontSize: '12px', color: '#3355cc', background: 'none', border: 'none', cursor: 'pointer' }}>Lihat semua →</button>
            </div>
            {penjualanHariIni.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <p style={{ fontSize: '13px', color: '#aaa', margin: '0 0 10px' }}>Belum ada laporan penjualan</p>
                <button onClick={() => navigate('/penjualan')}
                  style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', color: '#2d7a2d', cursor: 'pointer' }}>
                  Input penjualan →
                </button>
              </div>
            ) : penjualanHariIni.map(pj => (
              <div key={pj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '500' }}>{pj.nomor_pj}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>Setor: Rp {Number(pj.setoran).toLocaleString('id-ID')}</p>
                </div>
                {statusBadge(pj.status)}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  // DASHBOARD DC
  const belumSetorDC = statsHariIni.totalOmzet - statsHariIni.totalBiaya - statsHariIni.totalKomisi - statsHariIni.totalSetoran

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Dashboard</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '1.5rem' }}>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total omzet</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {statsHariIni.totalOmzet.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total komisi</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: '#2d7a2d' }}>Rp {statsHariIni.totalKomisi.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total biaya</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: '#cc2222' }}>Rp {statsHariIni.totalBiaya.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total setoran masuk</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>Rp {statsHariIni.totalSetoran.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total hutang aktif</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: statsHariIni.totalHutang > 0 ? '#cc2222' : '#2d7a2d' }}>
              Rp {statsHariIni.totalHutang.toLocaleString('id-ID')}
            </p>
          </div>
          <div style={{ background: belumSetorDC > 0 ? '#fff0f0' : '#f0faf0', border: `1px solid ${belumSetorDC > 0 ? '#ffd0d0' : '#c0e0c0'}`, borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Sisa belum setor</p>
            <p style={{ fontSize: '18px', fontWeight: '500', margin: 0, color: belumSetorDC > 0 ? '#cc2222' : '#2d7a2d' }}>
              Rp {belumSetorDC.toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {/* AKSI */}
        {(aksiDC.pbPending.length > 0 || aksiDC.tsPending.length > 0 || aksiDC.doDraft.length > 0) && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '12px', fontWeight: '500', color: '#888', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Perlu tindakan</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {aksiDC.pbPending.map(pb => (
                <ActionCard key={pb.id} icon="📋"
                  title={`${pb.nomor_pb} — ${pb.cabang?.nama_cabang}`}
                  subtitle="Permintaan Barang menunggu approval"
                  onClick={() => navigate('/pb')} />
              ))}
              {aksiDC.tsPending.map(ts => (
                <ActionCard key={ts.id} icon="🔄"
                  title={`${ts.nomor_ts} — ${ts.cabang_asal?.kode_cabang} → ${ts.cabang_tujuan?.kode_cabang}`}
                  subtitle="Transfer Stok menunggu approval"
                  onClick={() => navigate('/ts')} />
              ))}
              {aksiDC.doDraft.map(do_ => (
                <ActionCard key={do_.id} icon="🚚"
                  title={`${do_.nomor_do} — ${do_.cabang?.nama_cabang}`}
                  subtitle="Delivery Order masih Draft — segera kirim"
                  onClick={() => navigate('/do')}
                  color="#3355cc" bg="#e8f0ff" border="#b0c8ff" />
              ))}
            </div>
          </div>
        )}

        {/* PENJUALAN PER CABANG */}
        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '14px', fontWeight: '500', margin: 0 }}>Penjualan per cabang hari ini</p>
            <button onClick={() => navigate('/penjualan')} style={{ fontSize: '12px', color: '#3355cc', background: 'none', border: 'none', cursor: 'pointer' }}>Lihat semua →</button>
          </div>
          {penjualanHariIni.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>Belum ada laporan penjualan hari ini</p>
          ) : penjualanHariIni.map((pj, i) => (
            <div key={pj.cabang_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < penjualanHariIni.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
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

        {/* RINGKASAN */}
        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', margin: '0 0 8px' }}>Ringkasan hari ini</p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#888' }}>
            <span>✅ {penjualanHariIni.filter(p => p.status === 'lunas').length} cabang lunas</span>
            <span>⚠️ {penjualanHariIni.filter(p => p.status === 'hutang').length} cabang hutang</span>
            <span>📋 {penjualanHariIni.length} cabang lapor</span>
          </div>
        </div>
      </div>
    </Layout>
  )
}