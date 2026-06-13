import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import MasterProduk from './pages/MasterProduk.jsx'
import MasterCabang from './pages/MasterCabang.jsx'
import MasterPengguna from './pages/MasterPengguna.jsx'
import DeliveryOrder from './pages/DeliveryOrder.jsx'
import PermintaanBarang from './pages/PermintaanBarang.jsx'
import PermintaanBarangPedagang from './pages/PermintaanBarangPedagang.jsx'
import TerimaBarang from './pages/TerimaBarang.jsx'
import TransferStok from './pages/TransferStok.jsx'
import StokSaya from './pages/StokSaya.jsx'
import PenjualanHarian from './pages/PenjualanHarian.jsx'
import Biaya from './pages/Biaya.jsx'
import HutangPedagang from './pages/HutangPedagang.jsx'
import Komisi from './pages/Komisi.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/master/produk" element={<MasterProduk />} />
        <Route path="/master/cabang" element={<MasterCabang />} />
        <Route path="/master/pengguna" element={<MasterPengguna />} />
        <Route path="/do" element={<DeliveryOrder />} />
        <Route path="/pb" element={<PermintaanBarang />} />
        <Route path="/pb/pedagang" element={<PermintaanBarangPedagang />} />
        <Route path="/terima" element={<TerimaBarang />} />
        <Route path="/ts" element={<TransferStok />} />
        <Route path="/stok" element={<StokSaya />} />
        <Route path="/penjualan" element={<PenjualanHarian />} />
        <Route path="/biaya" element={<Biaya />} />
        <Route path="/hutang" element={<HutangPedagang />} />
        <Route path="/komisi" element={<Komisi />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)