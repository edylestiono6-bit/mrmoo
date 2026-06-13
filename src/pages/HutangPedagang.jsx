import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function HutangPedagang() {
  const [hutangData, setHutangData] = useState([])
  const [loading, setLoading] = useState(true)
  const user = JSON.parse(localStorage.getItem('user'))
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const switchMode = localStorage.getItem('switchMode') || 'dc'
  const activeCabangId = switchMode === 'pedagang' ? switchCabang?.id : null
  const isDC = user.role === 'dc' || user.role === 'super_dc'

  useEffect(() => { fetchHutang() }, [])

  const fetchHutang = async () => {
    setLoading(true)
    let query = supabase
      .from('hutang_pedagang')
      .select('*, cabang(kode_cabang, nama_cabang), penjualan_harian(nomor_pj, created_at)')
      .order('created_at', { ascending: false })

    if (switchMode === 'pedagang' && activeCabangId) {
      query = query.eq('cabang_id', activeCabangId)
    }

    const { data } = await query
    const grouped = {}
    data?.forEach(h => {
      const cid = h.cabang_id
      if (!grouped[cid]) {
        grouped[cid] = {
          cabang: h.cabang,
          cabang_id: cid,
          total_hutang: 0,
          total_terbayar: 0,
          items: []
        }
      }
      grouped[cid].total_hutang += Number(h.jumlah_hutang)
      grouped[cid].total_terbayar += Number(h.jumlah_terbayar)
      grouped[cid].items.push(h)
    })
    setHutangData(Object.values(grouped))
    setLoading(false)
  }

  const totalSemuaHutang = hutangData.reduce((acc, h) => acc + h.total_hutang - h.total_terbayar, 0)

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>
            {switchMode === 'pedagang' ? 'Hutang Saya' : 'Hutang Pedagang'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
            {switchMode === 'pedagang' ? `${switchCabang?.kode_cabang} — ${switchCabang?.nama_cabang}` : 'Semua cabang'}
          </p>
        </div>

        {isDC && switchMode === 'dc' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '1.5rem' }}>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total hutang aktif</p>
              <p style={{ fontSize: '20px', fontWeight: '500', margin: 0, color: '#cc2222' }}>
                Rp {totalSemuaHutang.toLocaleString('id-ID')}
              </p>
            </div>
            <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Pedagang berhutang</p>
              <p style={{ fontSize: '20px', fontWeight: '500', margin: 0 }}>
                {hutangData.filter(h => h.total_hutang - h.total_terbayar > 0).length} orang
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</div>
        ) : hutangData.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', color: '#888' }}>
            Tidak ada hutang 🎉
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hutangData.map(group => (
              <HutangGroup key={group.cabang_id} group={group} onRefresh={fetchHutang} isDC={isDC} switchMode={switchMode} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

function HutangGroup({ group, onRefresh, isDC, switchMode }) {
  const [expanded, setExpanded] = useState(true)
  const [showBayar, setShowBayar] = useState(false)
  const [selectedHutang, setSelectedHutang] = useState(null)
  const [jumlahBayar, setJumlahBayar] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const sisaHutang = group.total_hutang - group.total_terbayar

  const handleBayar = (item) => {
    setSelectedHutang(item)
    setJumlahBayar('')
    setError('')
    setShowBayar(true)
  }

  const handleSubmitBayar = async () => {
    if (!jumlahBayar || parseFloat(jumlahBayar) <= 0) {
      setError('Jumlah bayar wajib diisi!')
      return
    }
    const sisa = Number(selectedHutang.jumlah_hutang) - Number(selectedHutang.jumlah_terbayar)
    if (parseFloat(jumlahBayar) > sisa) {
      setError(`Jumlah bayar tidak boleh melebihi sisa hutang (Rp ${sisa.toLocaleString('id-ID')})`)
      return
    }

    setSaving(true); setError('')

    const newTerbayar = Number(selectedHutang.jumlah_terbayar) + parseFloat(jumlahBayar)
    const newSisa = Number(selectedHutang.jumlah_hutang) - newTerbayar
    const newStatus = newSisa <= 0 ? 'lunas' : 'belum_lunas'

    await supabase.from('hutang_pedagang').update({
      jumlah_terbayar: newTerbayar,
      status: newStatus
    }).eq('id', selectedHutang.id)

    setSaving(false)
    setShowBayar(false)
    setSelectedHutang(null)
    setJumlahBayar('')
    onRefresh()
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)}
        style={{ padding: '12px 16px', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '500', color: '#cc2222' }}>
            {group.cabang?.nama_cabang?.charAt(0)}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '500', margin: 0 }}>
              {group.cabang?.kode_cabang} — {group.cabang?.nama_cabang}
            </p>
            <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0' }}>
              {group.items.filter(i => i.status === 'belum_lunas').length} transaksi belum lunas
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '14px', fontWeight: '500', margin: 0, color: sisaHutang > 0 ? '#cc2222' : '#2d7a2d' }}>
            Rp {sisaHutang.toLocaleString('id-ID')}
          </p>
          <span style={{ fontSize: '12px', color: '#aaa' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderTop: '1px solid #f0f0f0', background: '#f9f9f9' }}>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Ref. PJ</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tanggal</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Jumlah hutang</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Terbayar</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Sisa</th>
              <th style={{ padding: '8px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Status</th>
              {switchMode === 'pedagang' && (
  <th style={{ padding: '8px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Aksi</th>
)}
            </tr>
          </thead>
          <tbody>
            {group.items.map((item, i) => {
              const sisa = Number(item.jumlah_hutang) - Number(item.jumlah_terbayar)
              return (
                <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', color: '#3355cc' }}>{item.penjualan_harian?.nomor_pj}</td>
                  <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>Rp {Number(item.jumlah_hutang).toLocaleString('id-ID')}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#2d7a2d' }}>Rp {Number(item.jumlah_terbayar).toLocaleString('id-ID')}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500', color: sisa > 0 ? '#cc2222' : '#2d7a2d' }}>
                    Rp {sisa.toLocaleString('id-ID')}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: item.status === 'lunas' ? '#f0faf0' : '#fff0f0', color: item.status === 'lunas' ? '#2d7a2d' : '#cc2222' }}>
                      {item.status === 'lunas' ? 'Lunas' : 'Belum lunas'}
                    </span>
                  </td>
                  {switchMode === 'pedagang' && (
  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
    {item.status === 'belum_lunas' && (
      <button onClick={() => handleBayar(item)}
        style={{ padding: '4px 12px', fontSize: '12px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '6px', color: '#2d7a2d', cursor: 'pointer' }}>
        Bayar
      </button>
    )}
  </td>
)}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {showBayar && selectedHutang && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', width: '380px' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '15px' }}>Bayar hutang</h3>

            <div style={{ background: '#fafafa', borderRadius: '8px', padding: '12px', marginBottom: '1rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>Ref. PJ</span>
                <span style={{ fontWeight: '500' }}>{selectedHutang.penjualan_harian?.nomor_pj}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>Total hutang</span>
                <span>Rp {Number(selectedHutang.jumlah_hutang).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>Sudah dibayar</span>
                <span style={{ color: '#2d7a2d' }}>Rp {Number(selectedHutang.jumlah_terbayar).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e0e0e0', paddingTop: '6px' }}>
                <span style={{ color: '#888', fontWeight: '500' }}>Sisa hutang</span>
                <span style={{ fontWeight: '500', color: '#cc2222' }}>
                  Rp {(Number(selectedHutang.jumlah_hutang) - Number(selectedHutang.jumlah_terbayar)).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Jumlah bayar (Rp)</label>
              <input type="number" value={jumlahBayar} onChange={e => setJumlahBayar(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
              <p style={{ fontSize: '11px', color: '#aaa', margin: '4px 0 0' }}>
                Bisa bayar sebagian atau lunas sekaligus
              </p>
            </div>

            {error && <p style={{ color: 'red', fontSize: '13px', margin: '0 0 1rem' }}>{error}</p>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowBayar(false); setSelectedHutang(null); setJumlahBayar(''); setError('') }}
                style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>
                Batal
              </button>
              <button onClick={handleSubmitBayar} disabled={saving}
                style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
                {saving ? 'Menyimpan...' : 'Konfirmasi bayar →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}