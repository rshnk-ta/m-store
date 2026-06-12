import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { useAuth } from './hooks/useAuth';
import { CSS } from './lib/constants';
import { Icon, Toast, Spinner } from './components/UI';
import { NotificationsPanel } from './views/AdminViews';
import LoginScreen from './views/LoginScreen';
import { AdminCatalog, ApprovalQueue, AdminOrders, BrandsManager } from './views/AdminViews';
import { SupplierSubmitItem, SupplierOrders, SupplierConsolidated, SupplierSamples, SupplierSubmissions } from './views/SupplierViews';
import { MarketCatalog, MarketOrders } from './views/MarketViews';

const NAV = {
  admin: [
    { key: 'catalog',   label: 'Catalog',          icon: Icon.catalog },
    { key: 'approvals', label: 'Pending Approval',  icon: Icon.approve },
    { key: 'orders',    label: 'Orders',            icon: Icon.orders },
    { key: 'brands',    label: 'Brands',            icon: Icon.brands },
  ],
  market: [
    { key: 'catalog',   label: 'Catalog',    icon: Icon.catalog },
    { key: 'my-orders', label: 'My Orders',  icon: Icon.orders },
  ],
  supplier: [
    { key: 'consolidated', label: 'Consolidated',    icon: Icon.supply },
    { key: 'orders',       label: 'Orders',          icon: Icon.orders },
    { key: 'samples',      label: 'Samples',         icon: Icon.sample },
    { key: 'submissions',  label: 'My Submissions',  icon: Icon.inbox },
    { key: 'submit',       label: 'Submit New Item', icon: Icon.plus },
  ],
};

const PAGE_TITLES = {
  catalog: 'Catalog', approvals: 'Pending Approval', orders: 'Orders',
  'my-orders': 'My Orders', consolidated: 'Consolidated', submit: 'Submit New Item',
  samples: 'Samples', submissions: 'My Submissions', brands: 'Brand Management',
};

export default function App() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [brands, setBrands] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [page, setPage] = useState(null);
  const [toast, setToastState] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const showToast = useCallback((message, type = 'default') => {
    setToastState({ message, type });
    setTimeout(() => setToastState(null), 3500);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    const [{ data: prods }, { data: ords }, { data: ships }, { data: brnds }, { data: notifs }] = await Promise.all([
      supabase.from('products').select('*, product_variants(*, variant_images(*))').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('placed_at', { ascending: false }),
      supabase.from('shipments').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*').order('sort_order'),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ]);
    setProducts(prods || []);
    setOrders(ords || []);
    setShipments(ships || []);
    setBrands(brnds || []);
    setNotifications(notifs || []);
    setDataLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (profile && !page) setPage(NAV[profile.role]?.[0]?.key || 'catalog');
  }, [profile]);

  useEffect(() => {
    if (profile?.role) setPage(NAV[profile.role]?.[0]?.key);
  }, [profile?.role]);

  if (authLoading) return (
    <>
      <style>{CSS}</style>
      <div className="loading-screen"><div className="loading-logo">M-Store</div><Spinner /><div className="loading-sub">Loading…</div></div>
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
      <div className="loading-screen"><div className="loading-logo">M-Store</div><Spinner /><div className="loading-sub">Syncing…</div></div>
    </>
  );

  const role = profile.role;
  const nav = NAV[role] || [];
  const pendingCount = products.filter(p => p.status === 'pending_approval').length;
  const moqCount = orders.filter(o => o.status === 'moq_reached' && o.type === 'standard').length;
  const sampleCount = orders.filter(o => o.type === 'sample' && o.status === 'collecting').length;
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const userInitials = profile.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <>
      <style>{CSS}</style>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <img src="/logo.png" alt="M-Store" style={{ width: 28, height: 28, borderRadius: 6 }} onError={e => e.target.style.display = 'none'} />
              <h1>M-Store</h1>
            </div>
            <span>Merch Order Platform</span>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">Navigation</div>
            {nav.map(n => {
              const badge = n.key === 'approvals' ? pendingCount
                : n.key === 'orders' && role === 'supplier' ? moqCount
                : n.key === 'samples' ? sampleCount
                : 0;
              return (
                <div key={n.key} className={`nav-item${page === n.key ? ' active' : ''}`} onClick={() => setPage(n.key)}>
                  {n.icon} {n.label}
                  {badge > 0 && <span className={`nav-badge${page === n.key ? ' active' : ''}`}>{badge}</span>}
                </div>
              );
            })}
          </div>
          <div className="sidebar-footer">
            <div className="user-chip" style={{ marginBottom: 10 }}>
              <div className="user-avatar">{userInitials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-name">{profile.name}</div>
                <div className="user-role">{role === 'admin' ? 'Admin · HoM' : role === 'market' ? `${profile.market}` : 'Supply Chain'}</div>
              </div>
              <button onClick={() => setShowNotifications(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: unreadCount > 0 ? 'var(--accent-warm)' : 'var(--text-muted)', position: 'relative', padding: 4 }}>
                {Icon.bell}
                {unreadCount > 0 && <span style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', border: '1px solid white' }} />}
              </button>
            </div>
            <button className="sign-out-btn" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        <div className="main">
          <header className="header">
            <div className="header-title">{PAGE_TITLES[page] || ''}</div>
            <div className="live-indicator"><div className="live-dot" />Live</div>
            <span className="header-meta">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </header>
          <div className="content">
            {role === 'admin' && page === 'catalog'   && <AdminCatalog products={products} orders={orders} brands={brands} onRefresh={fetchAll} toast={showToast} />}
            {role === 'admin' && page === 'approvals' && <ApprovalQueue products={products} brands={brands} onRefresh={fetchAll} toast={showToast} />}
            {role === 'admin' && page === 'orders'    && <AdminOrders products={products} orders={orders} shipments={shipments} onRefresh={fetchAll} toast={showToast} />}
            {role === 'admin' && page === 'brands'    && <BrandsManager brands={brands} onRefresh={fetchAll} toast={showToast} />}
            {role === 'market' && page === 'catalog'   && <MarketCatalog products={products} orders={orders} brands={brands} onRefresh={fetchAll} toast={showToast} />}
            {role === 'market' && page === 'my-orders' && <MarketOrders products={products} orders={orders} shipments={shipments} onRefresh={fetchAll} toast={showToast} />}
            {role === 'supplier' && page === 'consolidated' && <SupplierConsolidated products={products} orders={orders} onRefresh={fetchAll} toast={showToast} />}
            {role === 'supplier' && page === 'orders'       && <SupplierOrders products={products} orders={orders} shipments={shipments} onRefresh={fetchAll} toast={showToast} />}
            {role === 'supplier' && page === 'samples'      && <SupplierSamples products={products} orders={orders} onRefresh={fetchAll} toast={showToast} />}
            {role === 'supplier' && page === 'submissions'  && <SupplierSubmissions products={products} brands={brands} onRefresh={fetchAll} toast={showToast} />}
            {role === 'supplier' && page === 'submit'       && <SupplierSubmitItem brands={brands} onRefresh={fetchAll} toast={showToast} />}
          </div>
        </div>
      </div>
      {showNotifications && (
        <div className="modal-backdrop" onClick={() => setShowNotifications(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', right: 20, bottom: 80, width: 360, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', maxHeight: '60vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500 }}>Notifications</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{unreadCount} unread</span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 && <div className="empty" style={{ padding: '24px' }}><div className="empty-icon">○</div><div className="empty-title">All clear</div></div>}
              {notifications.map(n => (
                <div key={n.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', opacity: n.is_read ? 0.5 : 1, cursor: 'pointer' }}
                  onClick={async () => { await supabase.from('notifications').update({ is_read: true }).eq('id', n.id); fetchAll(); }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? 'transparent' : 'var(--accent-warm)', marginTop: 5, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
