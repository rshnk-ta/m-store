import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import { CSS } from './lib/constants';
import { Icon, Toast, Spinner } from './components/UI';
import LoginScreen from './views/LoginScreen';
import { AdminCatalog, ApprovalQueue, AdminOrders } from './views/AdminViews';
import { SupplierSubmitItem, SupplierOrders, SupplierConsolidated, SupplierSamples } from './views/SupplierViews';
import { MarketCatalog, MarketOrders } from './views/MarketViews';

// ── NAV CONFIG ──────────────────────────────────────────────────────────────
const NAV = {
  admin: [
    { key: 'catalog',  label: 'Catalog',          icon: Icon.catalog },
    { key: 'approvals',label: 'Pending Approval',  icon: Icon.approve },
    { key: 'orders',   label: 'Orders',            icon: Icon.orders },
  ],
  market: [
    { key: 'catalog',   label: 'Catalog',    icon: Icon.catalog },
    { key: 'my-orders', label: 'My Orders',  icon: Icon.orders },
  ],
  supplier: [
    { key: 'consolidated', label: 'Consolidated',    icon: Icon.supply },
    { key: 'orders',       label: 'Orders',          icon: Icon.orders },
    { key: 'samples',      label: 'Samples',         icon: Icon.sample },
    { key: 'submit',       label: 'Submit New Item', icon: Icon.plus },
  ],
};

// ── ROOT APP ────────────────────────────────────────────────────────────────
export default function App() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState(null);
  const [toast, setToastState] = useState(null);

  const showToast = useCallback((message, type = 'default') => {
    setToastState({ message, type });
    setTimeout(() => setToastState(null), 3000);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const [{ data: prods }, { data: ords }, { data: ships }] = await Promise.all([
      supabase.from('products').select('*, product_variants(*)')
        .order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('placed_at', { ascending: false }),
      supabase.from('shipments').select('*').order('created_at', { ascending: false }),
    ]);
    setProducts(prods || []);
    setOrders(ords || []);
    setShipments(ships || []);
    setDataLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Set default page when profile loads
  useEffect(() => {
    if (profile && !page) {
      setPage(NAV[profile.role]?.[0]?.key || 'catalog');
    }
  }, [profile]);

  // Handle role change
  const role = profile?.role;
  useEffect(() => {
    if (role) setPage(NAV[role]?.[0]?.key);
  }, [role]);

  if (authLoading) return (
    <>
      <style>{CSS}</style>
      <div className="loading-screen">
        <div className="loading-logo">M-Store</div>
        <Spinner />
        <div className="loading-sub">Loading…</div>
      </div>
    </>
  );

  if (!user || !profile) return (
    <>
      <style>{CSS}</style>
      <LoginScreen />
    </>
  );

  if (dataLoading) return (
    <>
      <style>{CSS}</style>
      <div className="loading-screen">
        <div className="loading-logo">M-Store</div>
        <Spinner />
        <div className="loading-sub">Syncing with Supabase…</div>
      </div>
    </>
  );

  const nav = NAV[role] || [];
  const pendingCount = products.filter(p => p.status === 'pending_approval').length;
  const moqCount = orders.filter(o => o.status === 'moq_reached' && o.type === 'standard').length;

  const userInitials = profile.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const pageTitle = {
    catalog: 'Catalog', approvals: 'Pending Approval', orders: role === 'market' ? 'Orders' : 'Orders',
    'my-orders': 'My Orders', consolidated: 'Consolidated', submit: 'Submit New Item',
    samples: 'Samples',
  }[page] || '';

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <img src="/logo.png" alt="M-Store" style={{ width: 28, height: 28, borderRadius: 6 }} />
              <h1>M-Store</h1>
            </div>
            <span>Merch Order Platform</span>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">Navigation</div>
            {nav.map(n => {
              const badge = n.key === 'approvals' ? pendingCount : n.key === 'orders' && role === 'supplier' ? moqCount : 0;
              return (
                <div key={n.key} className={`nav-item${page === n.key ? ' active' : ''}`} onClick={() => setPage(n.key)}>
                  {n.icon} {n.label}
                  {badge > 0 && <span className={`nav-badge${page === n.key ? ' active' : ''}`}>{badge}</span>}
                </div>
              );
            })}
          </div>
          <div className="sidebar-footer">
            <div className="user-chip">
              <div className="user-avatar">{userInitials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-name">{profile.name}</div>
                <div className="user-role">
                  {role === 'admin' ? 'Admin · HoM' : role === 'market' ? `Market · ${profile.market}` : 'Supply Chain'}
                </div>
              </div>
            </div>
            <button className="sign-out-btn" onClick={signOut} style={{ marginTop: 8, width: '100%', textAlign: 'left' }}>Sign out</button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main">
          <header className="header">
            <div className="header-title">{pageTitle}</div>
            <div className="live-indicator"><div className="live-dot" />Live · Supabase</div>
            <span className="header-meta">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </header>
          <div className="content">
            {/* ADMIN */}
            {role === 'admin' && page === 'catalog'   && <AdminCatalog products={products} orders={orders} onRefresh={fetchAll} toast={showToast} />}
            {role === 'admin' && page === 'approvals' && <ApprovalQueue products={products} onRefresh={fetchAll} toast={showToast} />}
            {role === 'admin' && page === 'orders'    && <AdminOrders products={products} orders={orders} shipments={shipments} onRefresh={fetchAll} toast={showToast} />}
            {/* MARKET */}
            {role === 'market' && page === 'catalog'   && <MarketCatalog products={products} orders={orders} onRefresh={fetchAll} toast={showToast} />}
            {role === 'market' && page === 'my-orders' && <MarketOrders products={products} orders={orders} shipments={shipments} onRefresh={fetchAll} toast={showToast} />}
            {/* SUPPLIER */}
            {role === 'supplier' && page === 'consolidated' && <SupplierConsolidated products={products} orders={orders} onRefresh={fetchAll} toast={showToast} />}
            {role === 'supplier' && page === 'orders'       && <SupplierOrders products={products} orders={orders} shipments={shipments} onRefresh={fetchAll} toast={showToast} />}
            {role === 'supplier' && page === 'samples'      && <SupplierSamples products={products} orders={orders} onRefresh={fetchAll} toast={showToast} />}
            {role === 'supplier' && page === 'submit'       && <SupplierSubmitItem onRefresh={fetchAll} toast={showToast} />}
          </div>
        </div>
      </div>
    </>
  );
}
