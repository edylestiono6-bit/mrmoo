import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function Komisi() {
  const [komisiData, setKomisiData] = useState([])
  const [loading, setLoading] = useState(true)
  const [bulan, setBulan] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const user = JSON.parse(localStorage.getItem('user'))
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const switchMode = localStorage.getItem('switchMode') || 'dc'
  const activeCabangId = switchMode === 'pedagang' ? switchCabang?.id : null
  const isDC = user.role === 'dc' || user.role === 'super_dc'

  useEffect(() => { fetchKomisi() }, [bulan])

  const fetchKomisi = async () => {
    setLoading(true)
    const startDate = `${bulan}-01`
    const [tahun, bln] = bulan.split('-')
    const lastDay = new Date(parseInt(tahun), parseInt(bln), 0).getDate()
    const endDate = `${bulan}-${lastDay}`

    let query = supabase
      .from('komisi')
      .select('id, nomor_komisi, cabang_id, total_cup_terjual, tarif_komisi_saat_itu, nominal_komisi, tanggal, cabang(kode_cabang, nama_cabang), penjualan_harian(nomor_pj)')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false })

    if (switchMode === 'pedagang' && activeCabangId) {
      query = query.eq('cabang_id', activeCabangId)
    }

    const { data, error } = await query
    console.log('komisi data:', data)
    console.log('komisi error:', error)

    if (error) { setLoading(false); return }

    const grouped = {}
    data?.forEach(k => {
      const cid = k.cabang_id
      if (!grouped[cid]) {
        grouped[cid] = {
          cabang: k.cabang,
          cabang_id: cid,
          total_cup: 0,
          total_komisi: 0,
          items: []
        }
      }
      grouped[cid].total_cup += k.total_cup_terjual
      grouped[cid].total_komisi += Number(k.nominal_komisi)
      grouped[cid].items.push(k)
    })

    setKomisiData(Object.values(grouped))
    setLoading(false)
  }

  const totalKomisiSemua = komisiData.reduce((acc, k) => acc + k.total_komisi, 0)
  const totalCupSemua = komisiData.reduce((acc, k) => acc + k.total_cup, 0)

  const bulanOptions = () => {
    const options = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
      options.push({ val, label })
    }
    return options
  }

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>
              {switchMode === 'pedagang' ? 'Komisi Saya' : 'Komisi Pedagang'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
              {switchMode === 'pedagang' ? `${switchCabang?.kode_cabang} — ${switchCabang?.nama_cabang}` : 'Semua cabang'}
            </p>
          </div>
          <select value={bulan} onChange={e => setBulan(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}>
            {bulanOptions().map(o => (
              <option key={o.val} value={o.val}>{o.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '1.5rem' }}>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total komisi</p>
            <p style={{ fontSize: '20px', fontWeight: '500', margin: 0, color: '#2d7a2d' }}>
              Rp {totalKomisiSemua.toLocaleString('id-ID')}
            </p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total cup terjual</p>
            <p style={{ fontSize: '20px', fontWeight: '500', margin: 0 }}>{totalCupSemua.toLocaleString('id-ID')} cup</p>
          </div>
          {isDC && switchMode === 'dc' && (
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Pedagang aktif</p>
              <p style={{ fontSize: '20px', fontWeight: '500', margin: 0 }}>{komisiData.length} orang</p>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</div>
        ) : komisiData.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', color: '#888' }}>
            Belum ada data komisi bulan ini
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {komisiData.map((group) => (
              <KomisiGroup key={group.cabang_id} group={group} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

function KomisiGroup({ group }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)}
        style={{ padding: '12px 16px', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f0faf0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: '#2d7a2d' }}>
            {group.cabang?.nama_cabang?.charAt(0)}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '500', margin: 0 }}>
              {group.cabang?.kode_cabang} — {group.cabang?.nama_cabang}
            </p>
            <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>
              {group.total_cup.toLocaleString('id-ID')} cup · {group.items.length} hari
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', margin: 0, color: '#2d7a2d' }}>
            Rp {group.total_komisi.toLocaleString('id-ID')}
          </p>
          <span style={{ fontSize: '12px', color: '#aaa' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderTop: '1px solid #f0f0f0', background: '#f9f9f9' }}>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>No. KMS</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tanggal</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Ref. PJ</th>
              <th style={{ padding: '8px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Cup terjual</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Tarif/cup</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Komisi</th>
            </tr>
          </thead>
          <tbody>
            {group.items.map((item, i) => (
              <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '10px 16px', color: '#888' }}>{item.nomor_komisi}</td>
                <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(item.tanggal).toLocaleDateString('id-ID')}</td>
                <td style={{ padding: '10px 16px', color: '#3355cc' }}>{item.penjualan_harian?.nomor_pj}</td>
                <td style={{ padding: '10px 16px', textAlign: 'center' }}>{item.total_cup_terjual}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', color: '#888' }}>
                  Rp {Number(item.tarif_komisi_saat_itu).toLocaleString('id-ID')}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500', color: '#2d7a2d' }}>
                  Rp {Number(item.nominal_komisi).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid #e0e0e0', background: '#f9f9f9' }}>
              <td colSpan="3" style={{ padding: '10px 16px', fontWeight: '500' }}>Total bulan ini</td>
              <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '500' }}>{group.total_cup}</td>
              <td></td>
              <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500', color: '#2d7a2d' }}>
                Rp {group.total_komisi.toLocaleString('id-ID')}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}