import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, ProductCard, StageBadge } from '../components/UI';
import { MARKETS } from '../lib/constants';
import { OrderDetailModal } from './AdminViews';
import { notifyUsers } from '../lib/db';

export function MarketCatalog({ products, orders, brands, onRefresh, toast }) {
  const { profile } = useAuth();
  const [editingOrder, setEditingOrder] = useState(null);
  const [sampleModal, setSampleModal] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [activeOnly, setActiveOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const market = profile?.market;
  const storageKey = `mstore_cart_${market}`;

  // Persist cart to localStorage so it survives tab switches / page focus loss
  const [cart, setCartRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });

  const setCart = (updater) => {
    setCartRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const visibleProducts = products.filter(p => activeOnly ? p.status === 'active' : p.status === 'active' || p.status === 'draft');
  const cats = ['All', ...Array.from(new Set(visibleProducts.map(p => p.category)))];
  const filtered = visibleProducts.filter(p =>
    (catFilter === 'All' || p.category === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const getPendingOrder = (productId, variantId) =>
    orders.find(o => o.product_id === productId && o.variant_id === variantId && o.market === market && o.type === 'standard' && o.status === 'collecting');

  const cartKey = (productId, variantId) => `${productId}__${variantId}`;
  const setQty = (productId, variantId, qty) => {
    const key = cartKey(productId, variantId);
    setCart(c => qty > 0 ? { ...c, [key]: qty } : Object.fromEntries(Object.entries(c).filter(([k]) => k !== key)));
  };

  // Enrich cart items for display
  const cartItems = Object.entries(cart).filter(([, qty]) => qty > 0).map(([key, qty]) => {
    const [productId, variantId] = key.split('__');
    const product = products.find(x => x.id === productId);
    const variant = product?.product_variants?.find(x => x.id === variantId);
    return { key, productId, variantId, qty, product, variant };
  });
  const cartCount = cartItems.length;
  const cartTotal = cartItems.reduce((sum, { qty, product }) => sum + (product ? product.unit_price * qty : 0), 0);

  const updatePendingQty = async (orderId, newQty) => {
    const order = orders.find(o => o.id === orderId);
    const product = products.find(p => p.id === order?.product_id);

    if (!order || !product) return;

    if (newQty <= 0) {
      if (!window.confirm('Remove this order line?')) return;
      await supabase.from('orders').delete().eq('id', orderId);
      toast('Order line removed', 'default');
      setEditingOrder(null);
      onRefresh();
      return;
    }

    // Calculate total across ALL variants of this product (collecting only), excluding this order
    const otherCollectingQty = orders
      .filter(o => o.product_id === order.product_id && o.type === 'standard' && o.status === 'collecting' && o.id !== orderId)
      .reduce((s, o) => s + o.qty, 0);
    const newTotal = otherCollectingQty + newQty;
    const newStatus = newTotal >= product.moq ? 'moq_reached' : 'collecting';

    // Update this order
    await supabase.from('orders').update({ qty: newQty, status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId);

    // If MOQ now reached, update ALL other collecting orders for same product to moq_reached too
    if (newStatus === 'moq_reached') {
      const otherCollecting = orders.filter(o => o.product_id === order.product_id && o.type === 'standard' && o.status === 'collecting' && o.id !== orderId);
      for (const o of otherCollecting) {
        await supabase.from('orders').update({ status: 'moq_reached', updated_at: new Date().toISOString() }).eq('id', o.id);
      }
      const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
      if (supplierUsers?.length) await notifyUsers(supplierUsers.map(u => u.id), 'moq_reached', 'MOQ Reached', `"${product.name}" has reached its MOQ.`, { product_id: order.product_id });
    }

    toast('Order updated', 'success');
    setEditingOrder(null);
    onRefresh();
  };

  const submitCart = async () => {
    if (cartCount === 0) return;
    setSubmitting(true);
    try {
      for (const { productId, variantId, qty, product } of cartItems) {
        if (!product) continue;
        const existing = getPendingOrder(productId, variantId);
        const currentQty = orders.filter(o => o.product_id === productId && o.type === 'standard' && o.status === 'collecting').reduce((s, o) => s + o.qty, 0);
        if (existing) {
          const newQty = existing.qty + qty;
          const newTotal = currentQty - existing.qty + newQty;
          const status = newTotal >= product.moq ? 'moq_reached' : 'collecting';
          await supabase.from('orders').update({ qty: newQty, status, updated_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          const newTotal = currentQty + qty;
          const status = newTotal >= product.moq ? 'moq_reached' : 'collecting';
          const { data: newOrder } = await supabase.from('orders').insert({
            product_id: productId, variant_id: variantId, market,
            qty, type: 'standard', status,
            placed_by: profile?.id, placed_at: new Date().toISOString(),
          }).select().single();
          if (newOrder) {
            await supabase.from('timeline_log').insert({ order_id: newOrder.id, stage: 'collecting', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
            if (status === 'moq_reached') {
              // Update ALL other collecting orders for same product to moq_reached
              const otherOrders = orders.filter(o => o.product_id === productId && o.type === 'standard' && o.status === 'collecting');
              for (const o of otherOrders) {
                await supabase.from('orders').update({ status: 'moq_reached', updated_at: new Date().toISOString() }).eq('id', o.id);
              }
              const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
              if (supplierUsers?.length) await notifyUsers(supplierUsers.map(u => u.id), 'moq_reached', 'MOQ Reached', `"${product.name}" has reached its MOQ.`, { product_id: productId, order_id: newOrder.id });
            }
          }
        }
      }
      toast(`${cartCount} order line${cartCount !== 1 ? 's' : ''} submitted`, 'success');
      // Explicitly clear both state and localStorage
      localStorage.removeItem(storageKey);
      setCartRaw({});
      setCartOpen(false);
      onRefresh();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
    setSubmitting(false);
  };

  return (
    <div style={{ paddingBottom: cartCount > 0 ? 140 : 0 }}>
      <div className="section-header">
        <div><div className="section-title">Catalog</div><div className="section-desc">{market} · Browse and order</div></div>
      </div>
      <div className="filter-row">
        <input className="search-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        {cats.map(c => <span key={c} className={`filter-chip${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>{c}</span>)}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} style={{ width: 'auto', cursor: 'pointer' }} />
          Active items only
        </label>
      </div>
      <div className="card-grid">
        {filtered.map(p => (
          <ProductCard key={p.id} p={p} orders={orders.filter(o => o.type === 'standard')}>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Order quantities</div>
              {p.product_variants?.filter(v => v.is_active !== false).map(v => {
                const key = cartKey(p.id, v.id);
                const newQty = cart[key] || '';
                const pendingOrder = getPendingOrder(p.id, v.id);
                const isEditing = editingOrder?.orderId === pendingOrder?.id;
                return (
                  <div key={v.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{v.brand}</span>
                      <input type="number" min="0" placeholder="0" value={newQty} onChange={e => setQty(p.id, v.id, parseInt(e.target.value) || 0)} style={{ width: 70, fontSize: 12, textAlign: 'center' }} />
                    </div>
                    {pendingOrder && (
                      <div style={{ marginLeft: 15, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--accent-warm)' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pending qty:</span>
                            <input
                              type="number" min="1"
                              value={editingOrder.newQty === 0 ? '' : editingOrder.newQty}
                              onChange={e => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                setEditingOrder(eo => ({ ...eo, newQty: isNaN(val) ? 0 : val }));
                              }}
                              style={{ width: 70, fontSize: 11, textAlign: 'center', padding: '3px 6px' }}
                              autoFocus
                              onFocus={e => e.target.select()}
                            />
                            <button className="btn btn-sm btn-success" style={{ padding: '3px 10px', fontSize: 10 }}
                              onClick={() => editingOrder.newQty > 0 && updatePendingQty(pendingOrder.id, editingOrder.newQty)}
                              disabled={!editingOrder.newQty || editingOrder.newQty <= 0}>
                              Save
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', fontSize: 10 }} onClick={() => setEditingOrder(null)}>Cancel</button>
                            <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => updatePendingQty(pendingOrder.id, 0)}>Remove</button>
                          </div>
                        ) : (
                          <>
                            <span style={{ background: '#FFFBEB', padding: '1px 7px', borderRadius: 999, border: '1px solid #FDE68A' }}>{pendingOrder.qty} pending</span>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '1px 6px', fontSize: 10, color: 'var(--accent-warm)' }} onClick={() => setEditingOrder({ orderId: pendingOrder.id, newQty: pendingOrder.qty })}>Edit</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setSampleModal(p)}>{Icon.sample} Request Sample</button>
            </div>
          </ProductCard>
        ))}
        {filtered.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}><div className="empty-icon">◻</div><div className="empty-title">No items found</div></div>}
      </div>

      {/* ── PERSISTENT CART BAR ── */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 'var(--sidebar-w)', right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 20px rgba(26,23,20,0.08)', zIndex: 100 }}>
          {/* Expandable item list */}
          {cartOpen && (
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', maxHeight: 240, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Order Summary</div>
              {cartItems.map(({ key, qty, product, variant }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  {product?.image_url && <img src={product.image_url} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{product?.name || '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: variant?.color, display: 'inline-block' }} />
                      {variant?.brand} · {variant?.sku}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    <div>{qty} units</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>${product ? (product.unit_price * qty).toFixed(2) : '—'}</div>
                  </div>
                  <button onClick={() => setQty(key.split('__')[0], key.split('__')[1], 0)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px', lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {/* Cart bar row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', gap: 16 }}>
            <button onClick={() => setCartOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--text-primary)', color: 'white', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{cartOpen ? '▾ Hide order' : '▸ Review order'}</span>
            </button>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
              Est. total <strong style={{ color: 'var(--text-primary)' }}>${cartTotal.toFixed(2)}</strong>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem(storageKey); setCartRaw({}); setCartOpen(false); }}>Clear</button>
            <button className="btn btn-primary" onClick={submitCart} disabled={submitting} style={{ minWidth: 140 }}>
              {submitting ? 'Submitting…' : `Submit Order`}
            </button>
          </div>
        </div>
      )}

      {sampleModal && <SampleModal product={sampleModal} market={market} onClose={() => setSampleModal(null)} onRefresh={onRefresh} toast={toast} profile={profile} />}
    </div>
  );
}


// ── SAMPLE REQUEST MODAL ───────────────────────────────────────────────────
function SampleModal({ product, market, onClose, onRefresh, toast, profile }) {
  const [variantId, setVariantId] = useState(product.product_variants?.[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const place = async () => {
    setSaving(true);
    const { data: newOrder } = await supabase.from('orders').insert({
      product_id: product.id, variant_id: variantId, market, qty: parseInt(qty),
      type: 'sample', status: 'collecting',
      placed_by: profile?.id, placed_at: new Date().toISOString(),
    }).select().single();

    await supabase.from('timeline_log').insert({ order_id: newOrder.id, stage: 'collecting', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });

    // Notify supplier
    const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
    if (supplierUsers?.length) {
      await notifyUsers(supplierUsers.map(u => u.id), 'sample_request', 'New Sample Request', `${market} requested ${qty} sample(s) of "${product.name}".`, { product_id: product.id, order_id: newOrder.id });
    }

    setSaving(false);
    toast('Sample requested', 'success');
    onRefresh();
    onClose();
  };

  return (
    <Modal title="Request Sample" subtitle={product.name} onClose={onClose} narrow
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={place} disabled={saving}>{saving ? 'Sending…' : 'Request Sample'}</button></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label>Brand Variant</label>
          <select value={variantId} onChange={e => setVariantId(e.target.value)}>
            {(product.product_variants || []).filter(v => v.is_active !== false).map(v => <option key={v.id} value={v.id}>{v.brand} — {v.sku}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Quantity</label>
          <input type="number" min="1" max="20" value={qty} onChange={e => setQty(e.target.value)} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>Sample requests are processed separately and don't count toward MOQ.</div>
    </Modal>
  );
}

// ── MARKET MY ORDERS ───────────────────────────────────────────────────────
export function MarketOrders({ products, orders, shipments, onRefresh, toast }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('standard');

  const market = profile?.market;
  const myOrders = orders.filter(o => o.market === market && o.type === tab).map(o => ({
    ...o,
    product: products.find(x => x.id === o.product_id),
    variant: products.find(x => x.id === o.product_id)?.product_variants?.find(v => v.id === o.variant_id),
  }));

  const confirmDelivery = async (order) => {
    await supabase.from('orders').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: 'delivered', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    const shipment = shipments.find(s => s.order_id === order.id && s.destination === market);
    if (shipment) await supabase.from('shipments').update({ status: 'delivered', confirmed_by: profile?.id }).eq('id', shipment.id);
    toast('Delivery confirmed ✓', 'success');
    onRefresh();
  };

  const groupedByProduct = myOrders.reduce((acc, o) => {
    const key = o.product_id;
    if (!acc[key]) acc[key] = { product: o.product, orders: [] };
    acc[key].orders.push(o);
    return acc;
  }, {});

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">My Orders</div><div className="section-desc">{market}</div></div>
      </div>
      <div className="tabs">
        <div className={`tab${tab === 'standard' ? ' active' : ''}`} onClick={() => setTab('standard')}>Orders</div>
        <div className={`tab${tab === 'sample' ? ' active' : ''}`} onClick={() => setTab('sample')}>Samples</div>
      </div>
      {myOrders.length === 0 && <div className="empty"><div className="empty-icon">○</div><div className="empty-title">No orders yet</div><div className="empty-desc">Browse the catalog to place orders</div></div>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Brand</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Status</th><th>ETA</th><th></th></tr></thead>
          <tbody>
            {myOrders.map(o => {
              const shipment = shipments.find(s => s.order_id === o.id && s.destination === market);
              return (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.product?.name}</td>
                  <td>{o.variant && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: o.variant.color, display: 'inline-block' }} />{o.variant.brand}</span>}</td>
                  <td>{o.qty}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{o.unit_cost ? `$${o.unit_cost}` : '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{o.unit_cost ? `$${(o.unit_cost * o.qty).toFixed(2)}` : '—'}</td>
                  <td><StageBadge status={o.status} type={o.type} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{shipment?.eta || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {o.status === 'arrived' && <button className="btn btn-sm btn-success" onClick={() => confirmDelivery(o)}>{Icon.check} Confirm Receipt</button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelected(o)}>{Icon.eye}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected && (
        <OrderDetailModal order={selected} product={selected.product} shipments={shipments.filter(s => s.order_id === selected.id)} onClose={() => setSelected(null)} onRefresh={onRefresh} toast={toast} readOnly />
      )}
    </div>
  );
}
// ── SUPPLIER CATALOG (read-only reference view) ────────────────────────────
export function SupplierCatalog({ products, orders }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [activeOnly, setActiveOnly] = useState(true);

  const visibleProducts = products.filter(p => activeOnly ? p.status === 'active' : true);
  const cats = ['All', ...Array.from(new Set(visibleProducts.map(p => p.category)))];
  const filtered = visibleProducts.filter(p =>
    (catFilter === 'All' || p.category === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Catalog</div><div className="section-desc">All merchandise items — reference view</div></div>
      </div>
      <div className="filter-row">
        <input className="search-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        {cats.map(c => <span key={c} className={`filter-chip${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>{c}</span>)}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} style={{ width: 'auto', cursor: 'pointer' }} />
          Active items only
        </label>
      </div>
      <div className="card-grid">
        {filtered.map(p => (
          <ProductCard key={p.id} p={p} orders={orders.filter(o => o.type === 'standard')} showStatus />
        ))}
        {filtered.length === 0 && (
          <div className="empty" style={{ gridColumn: '1/-1' }}>
            <div className="empty-icon">◻</div>
            <div className="empty-title">No items found</div>
          </div>
        )}
      </div>
    </div>
  );
}
