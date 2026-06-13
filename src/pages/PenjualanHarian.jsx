import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import Layout from '../components/Layout'

export default function PenjualanHarian() {
  const [pjList, setPjList] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [detailData, setDetailData] = useState(null)
  const [items, setItems] = useState([])
  const [setoran, setSetoran] = useState('')
  const [biayaItems, setBiayaItems] = useState([])
  const [tarifKomisi, setTarifKomisi] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const user = JSON.parse(localStorage.getItem('user'))
  const switchCabang = JSON.parse(localStorage.getItem('switchCabang') || 'null')
  const switchMode = localStorage.getItem('switchMode') || 'dc'
  const activeCabangId = switchMode === 'pedagang' ? switchCabang?.id : null

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    let query = supabase
      .from('penjualan_harian')
      .select('*, cabang(kode_cabang, nama_cabang)')
      .order('created_at', { ascending: false })
    if (switchMode === 'pedagang' && activeCabangId) {
      query = query.eq('cabang_id', activeCabangId)
    }
    setPjList((await query).data || [])
    setLoading(false)
  }

  const fetchStok = async () => {
    if (!activeCabangId) return

    const [stokRes, cabangRes] = await Promise.all([
      supabase
        .from('stok_cabang_batch')
        .select('*, produk(id, kode_barang, nama_varian, harga_jual, hpp)')
        .eq('cabang_id', activeCabangId)
        .gt('qty_sisa', 0),
      supabase
        .from('cabang')
        .select('komisi_per_cup')
        .eq('id', activeCabangId)
        .single()
    ])

    setTarifKomisi(cabangRes.data?.komisi_per_cup || 0)

    const grouped = {}
    stokRes.data?.forEach(batch => {
      const pid = batch.produk_id
      if (!grouped[pid]) grouped[pid] = { produk_id: pid, produk: batch.produk, total_qty: 0 }
      grouped[pid].total_qty += batch.qty_sisa
    })
    const stokList = Object.values(grouped)
    setItems(stokList.map(s => ({ produk_id: s.produk_id, qty_terjual: '', stok: s.total_qty, produk: s.produk })))
  }

  const fetchDetail = async (pj) => {
    const { data: detail } = await supabase
      .from('penjualan_harian_detail')
      .select('*, produk(kode_barang, nama_varian)')
      .eq('pj_id', pj.id)
    const { data: komisiDetail } = await supabase
      .from('komisi')
      .select('*')
      .eq('pj_id', pj.id)
      .single()
    const { data: biayaDetail } = await supabase
      .from('pengeluaran')
      .select('*')
      .eq('cabang_id', pj.cabang_id)
      .gte('created_at', pj.created_at)
      .lte('created_at', new Date(new Date(pj.created_at).getTime() + 60000).toISOString())
    setDetailData({ ...pj, detail: detail || [], komisi: komisiDetail, biaya: biayaDetail || [] })
    setView('detail')
  }

  const totalNilai = items.reduce((acc, item) => {
    const qty = parseInt(item.qty_terjual) || 0
    return acc + (qty * (item.produk?.harga_jual || 0))
  }, 0)

  const totalCupTerjual = items.reduce((acc, item) => acc + (parseInt(item.qty_terjual) || 0), 0)
  const totalBiaya = biayaItems.reduce((acc, b) => acc + (parseFloat(b.nominal) || 0), 0)
  const totalKomisi = totalCupTerjual * tarifKomisi
  const harusSetor = totalNilai - totalBiaya - totalKomisi
  const selisih = harusSetor - (parseFloat(setoran) || 0)

  const addBiaya = () => setBiayaItems([...biayaItems, { keterangan: '', nominal: '' }])
  const removeBiaya = (i) => setBiayaItems(biayaItems.filter((_, idx) => idx !== i))
  const updateBiaya = (i, field, val) => { const n = [...biayaItems]; n[i][field] = val; setBiayaItems(n) }

  const handleSubmit = async () => {
    if (!activeCabangId) { setError('Pilih cabang dulu!'); return }
    const itemsTerjual = items.filter(i => parseInt(i.qty_terjual) > 0)
    if (itemsTerjual.length === 0) { setError('Minimal satu produk harus diisi qty terjualnya!'); return }
    if (!setoran) { setError('Setoran wajib diisi!'); return }
    setSaving(true); setError('')

    const setoranNum = parseFloat(setoran)
    const harusSetorNum = totalNilai - totalBiaya - totalKomisi
    const selisihNum = harusSetorNum - setoranNum

    const { data: newPJ } = await supabase.from('penjualan_harian').insert({
      nomor_pj: '',
      cabang_id: activeCabangId,
      total_nilai: totalNilai,
      setoran: setoranNum,
      selisih: selisihNum,
      status: selisihNum <= 0 ? 'lunas' : 'hutang'
    }).select().single()

    if (newPJ) {
      await supabase.from('penjualan_harian_detail').insert(
        itemsTerjual.map(item => ({
          pj_id: newPJ.id,
          produk_id: item.produk_id,
          qty_terjual: parseInt(item.qty_terjual),
          harga_jual_saat_itu: item.produk?.harga_jual || 0,
          hpp_saat_itu: item.produk?.hpp || 0,
          subtotal: parseInt(item.qty_terjual) * (item.produk?.harga_jual || 0),
          tanggal: new Date().toISOString().split('T')[0],
          jam: new Date().toTimeString().split(' ')[0]
        }))
      )

      for (const item of itemsTerjual) {
        let sisaKurangi = parseInt(item.qty_terjual)
        const { data: batches } = await supabase
          .from('stok_cabang_batch')
          .select('*')
          .eq('cabang_id', activeCabangId)
          .eq('produk_id', item.produk_id)
          .gt('qty_sisa', 0)
          .order('tanggal_masuk', { ascending: true })
        for (const batch of (batches || [])) {
          if (sisaKurangi <= 0) break
          const kurangi = Math.min(batch.qty_sisa, sisaKurangi)
          await supabase.from('stok_cabang_batch').update({ qty_sisa: batch.qty_sisa - kurangi }).eq('id', batch.id)
          sisaKurangi -= kurangi
        }
      }

      if (selisihNum > 0) {
        await supabase.from('hutang_pedagang').insert({
          cabang_id: activeCabangId,
          pj_id: newPJ.id,
          jumlah_hutang: selisihNum,
          jumlah_terbayar: 0,
          status: 'belum_lunas'
        })
      }

      await supabase.from('komisi').insert({
        nomor_komisi: '',
        cabang_id: activeCabangId,
        pj_id: newPJ.id,
        total_cup_terjual: totalCupTerjual,
        tarif_komisi_saat_itu: tarifKomisi,
        nominal_komisi: totalKomisi,
        tanggal: new Date().toISOString().split('T')[0]
      })

      const biayaTerisi = biayaItems.filter(b => b.keterangan && b.nominal)
      if (biayaTerisi.length > 0) {
        await supabase.from('pengeluaran').insert(
          biayaTerisi.map(b => ({
            nomor_ba: '',
            pengguna_id: user.id,
            cabang_id: activeCabangId,
            keterangan: b.keterangan,
            nominal: parseFloat(b.nominal)
          }))
        )
      }
    }

    setSaving(false); setView('list')
    setItems([]); setSetoran(''); setBiayaItems([])
    fetchAll()
  }

  const statusBadge = (status) => {
    const map = {
      lunas: { bg: '#f0faf0', color: '#2d7a2d', label: 'Lunas' },
      hutang: { bg: '#fff0f0', color: '#cc2222', label: 'Hutang' }
    }
    const s = map[status] || map.lunas
    return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: s.bg, color: s.color }}>{s.label}</span>
  }

  if (view === 'form') return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <button onClick={() => setView('list')} style={{ padding: '6px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>← Kembali</button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Input Penjualan Harian</h2>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Nomor PJ</label>
              <input type="text" readOnly style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Cabang</label>
              <input type="text" value={switchCabang ? `${switchCabang.kode_cabang} — ${switchCabang.nama_cabang}` : ''} readOnly
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Tanggal</label>
              <input type="text" value={new Date().toLocaleDateString('id-ID')} readOnly
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#aaa' }} />
            </div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888', width: '30%' }}>Produk</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888', width: '15%' }}>Stok</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888', width: '20%' }}>Qty terjual</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888', width: '20%' }}>Harga jual</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888', width: '15%' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const qty = parseInt(item.qty_terjual) || 0
                const subtotal = qty * (item.produk?.harga_jual || 0)
                return (
                  <tr key={i} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <p style={{ margin: 0, fontWeight: '500', fontSize: '13px' }}>{item.produk?.nama_varian}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#888' }}>{item.produk?.kode_barang}</p>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', color: item.stok <= 5 ? '#e05555' : '#888' }}>{item.stok}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <input type="number" value={item.qty_terjual}
                        onChange={e => { const n = [...items]; n[i].qty_terjual = e.target.value; setItems(n) }}
                        placeholder="0" min="0" max={item.stok}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', textAlign: 'center', boxSizing: 'border-box' }} />
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#888' }}>
                      Rp {Number(item.produk?.harga_jual || 0).toLocaleString('id-ID')}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: subtotal > 0 ? '500' : '400', color: subtotal > 0 ? '#2d7a2d' : '#aaa' }}>
                      {subtotal > 0 ? `Rp ${subtotal.toLocaleString('id-ID')}` : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid #e0e0e0', background: '#f9f9f9' }}>
                <td colSpan="2" style={{ padding: '10px 16px', color: '#888', fontSize: '12px' }}>
                  {totalCupTerjual > 0 && `${totalCupTerjual} cup terjual`}
                </td>
                <td colSpan="2" style={{ padding: '10px 16px', fontWeight: '500', textAlign: 'right' }}>Total nilai</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500' }}>
                  Rp {totalNilai.toLocaleString('id-ID')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Biaya operasional hari ini</p>
            <button onClick={addBiaya}
              style={{ padding: '5px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: 'white' }}>
              + Tambah biaya
            </button>
          </div>
          {biayaItems.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>Tidak ada biaya hari ini</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {biayaItems.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="text" value={b.keterangan} onChange={e => updateBiaya(i, 'keterangan', e.target.value)}
                    placeholder="Keterangan biaya"
                    style={{ flex: 2, padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} />
                  <input type="number" value={b.nominal} onChange={e => updateBiaya(i, 'nominal', e.target.value)}
                    placeholder="Nominal"
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }} />
                  <button onClick={() => removeBiaya(i)}
                    style={{ border: 'none', background: 'none', color: '#e05555', cursor: 'pointer', fontSize: '18px', padding: '0 4px' }}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#cc2222' }}>
                  Total biaya: Rp {totalBiaya.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          )}
        </div>

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Total nilai penjualan</label>
              <input type="text" value={`Rp ${totalNilai.toLocaleString('id-ID')}`} readOnly
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', fontWeight: '500' }} />
            </div>
            {totalBiaya > 0 && (
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Total biaya</label>
                <input type="text" value={`- Rp ${totalBiaya.toLocaleString('id-ID')}`} readOnly
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#cc2222', fontWeight: '500' }} />
              </div>
            )}
            {totalCupTerjual > 0 && (
              <div>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>
                  Komisi ({totalCupTerjual} cup × Rp {Number(tarifKomisi).toLocaleString('id-ID')})
                </label>
                <input type="text" value={`- Rp ${totalKomisi.toLocaleString('id-ID')}`} readOnly
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#cc2222', fontWeight: '500' }} />
              </div>
            )}
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Harus disetor ke DC</label>
              <input type="text" value={`Rp ${harusSetor.toLocaleString('id-ID')}`} readOnly
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: '#3355cc', fontWeight: '500' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Setoran aktual (Rp)</label>
              <input type="number" value={setoran} onChange={e => setSetoran(e.target.value)} placeholder="0"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Selisih</label>
              <input type="text" value={setoran ? `Rp ${selisih.toLocaleString('id-ID')}` : '-'} readOnly
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: selisih > 0 ? '#cc2222' : '#2d7a2d', fontWeight: '500' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '6px' }}>Status</label>
              <input type="text" value={setoran ? (selisih <= 0 ? 'Lunas ✓' : 'Hutang ⚠️') : '-'} readOnly
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f5f5f5', color: selisih <= 0 ? '#2d7a2d' : '#cc2222', fontWeight: '500' }} />
            </div>
          </div>
        </div>

        {error && <p style={{ color: 'red', fontSize: '13px', margin: '0 0 1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={() => setView('list')} style={{ padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>Batal</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
            {saving ? 'Menyimpan...' : 'Simpan →'}
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
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>{detailData.nomor_pj}</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
                {detailData.cabang?.nama_cabang} · {new Date(detailData.created_at).toLocaleDateString('id-ID')}
              </p>
            </div>
          </div>
          {statusBadge(detailData.status)}
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Kode</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nama barang</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Qty terjual</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detailData.detail?.map((item, i) => (
                <tr key={item.id} style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', color: '#888' }}>{item.produk?.kode_barang}</td>
                  <td style={{ padding: '10px 16px' }}>{item.produk?.nama_varian}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>{item.qty_terjual}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>Rp {Number(item.subtotal).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid #e0e0e0', background: '#f9f9f9' }}>
                <td colSpan="3" style={{ padding: '10px 16px', fontWeight: '500' }}>Total nilai</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '500' }}>Rp {Number(detailData.total_nilai).toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {detailData.komisi && (
          <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '13px', fontWeight: '500', margin: '0 0 8px' }}>Komisi</p>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '13px', color: '#888' }}>
              <span>{detailData.komisi.total_cup_terjual} cup</span>
              <span>×</span>
              <span>Rp {Number(detailData.komisi.tarif_komisi_saat_itu).toLocaleString('id-ID')}/cup</span>
              <span>=</span>
              <span style={{ fontWeight: '500', color: '#2d7a2d' }}>Rp {Number(detailData.komisi.nominal_komisi).toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

        <div style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Total nilai</p>
              <p style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>Rp {Number(detailData.total_nilai).toLocaleString('id-ID')}</p>
            </div>
            {detailData.komisi && (
              <div>
                <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Komisi</p>
                <p style={{ fontSize: '16px', fontWeight: '500', margin: 0, color: '#cc2222' }}>- Rp {Number(detailData.komisi.nominal_komisi).toLocaleString('id-ID')}</p>
              </div>
            )}
            <div>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Setoran</p>
              <p style={{ fontSize: '16px', fontWeight: '500', margin: 0 }}>Rp {Number(detailData.setoran).toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Selisih</p>
              <p style={{ fontSize: '16px', fontWeight: '500', margin: 0, color: detailData.selisih > 0 ? '#cc2222' : '#2d7a2d' }}>
                Rp {Number(detailData.selisih).toLocaleString('id-ID')}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#888', margin: '0 0 4px' }}>Status</p>
              <div style={{ marginTop: '4px' }}>{statusBadge(detailData.status)}</div>
            </div>
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
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>Penjualan Harian</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>{pjList.length} laporan penjualan</p>
          </div>
          {switchMode === 'pedagang' && activeCabangId && (
            <button onClick={() => { fetchStok(); setView('form') }}
              style={{ padding: '8px 16px', background: '#f0faf0', border: '1px solid #c0e0c0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#2d7a2d', cursor: 'pointer' }}>
              + Input penjualan
            </button>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}>
            <option value="">Semua status</option>
            <option value="lunas">Lunas</option>
            <option value="hutang">Hutang</option>
          </select>
        </div>

        <div style={{ border: '1px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Nomor PJ</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Cabang</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '400', color: '#888' }}>Tanggal</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Total nilai</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '400', color: '#888' }}>Setoran</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '400', color: '#888' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Memuat data...</td></tr>
              ) : pjList.filter(p => !filterStatus || p.status === filterStatus).length === 0 ? (
                <tr><td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Belum ada data</td></tr>
              ) : (
                pjList.filter(p => !filterStatus || p.status === filterStatus).map((item, i) => (
                  <tr key={item.id} onClick={() => fetchDetail(item)}
                    style={{ borderTop: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseOut={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafafa'}>
                    <td style={{ padding: '10px 16px', fontWeight: '500' }}>{item.nomor_pj}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{item.cabang?.kode_cabang} — {item.cabang?.nama_cabang}</td>
                    <td style={{ padding: '10px 16px', color: '#888' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>Rp {Number(item.total_nilai).toLocaleString('id-ID')}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>Rp {Number(item.setoran).toLocaleString('id-ID')}</td>
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