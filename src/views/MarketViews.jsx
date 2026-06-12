import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, ProductCard, StageBadge } from '../components/UI';
import { MARKETS } from '../lib/constants';
import { OrderDetailModal } from './AdminViews';
import { notifyUsers } from '../lib/db';

// ── MARKET CATALOG ─────────────────────────────────────────────────────────
export function MarketCatalog({ products, orders, brands, onRefresh, toast }) {
  const { profile } = useAuth();
  const [cart, setCart] = useState({}); // { [productId_variantId]: qty }
  const [sampleModal, setSampleModal] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [submitting, setSubmitting] = useState(false);

  const market = profile?.market;
  const active = products.filter(p => p.status === 'active');
  const cats = ['All', ...Array.from(new Set(active.map(p => p.category)))];
  const filtered = active.filter(p =>
    (catFilter === 'All' || p.category === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const cartKey = (productId, variantId) => `${productId}__${variantId}`;
  const setQty = (productId, variantId, qty) => {
    const key = cartKey(productId, variantId);
    setCart(c => qty > 0 ? { ...c, [key]: qty } : Object.fromEntries(Object.entries(c).filter(([k]) => k !== key)));
  };

  const cartCount = Object.values(cart).filter(q => q > 0).length;
  const cartTotal = Object.entries(cart).reduce((sum, [key, qty]) => {
    const [productId] = key.split('__');
    const p = products.find(x => x.id === productId);
    return sum + (p ? p.unit_price * qty : 0);
  }, 0);

  const submitCart = async () => {
    if (cartCount === 0) return;
    setSubmitting(true);
    try {
      for (const [key, qty] of Object.entries(cart)) {
        if (qty <= 0) continue;
        const [productId, variantId] = key.split('__');
        const product = products.find(x => x.id === productId);
        if (!product) continue;

        // Check total orders including this one
        const currentQty = orders.filter(o => o.product_id === productId && o.type === 'standard').reduce((s, o) => s + o.qty, 0);
        const newTotal = currentQty + qty;
        const status = newTotal >= product.moq ? 'moq_reached' : 'collecting';

        const { data: newOrder } = await supabase.from('orders').insert({
          product_id: productId, variant_id: variantId, market,
          qty, type: 'standard', status,
          placed_by: profile?.id, placed_at: new Date().toISOString(),
        }).select().single();

        // Log timeline
        await supabase.from('timeline_log').insert({ order_id: newOrder.id, stage: 'collecting', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });

        // Notify supplier if MOQ reached
        if (status === 'moq_reached') {
          const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
          if (supplierUsers?.length) {
            await notifyUsers(supplierUsers.map(u => u.id), 'moq_reached', 'MOQ Reached', `"${product.name}" has reached its MOQ and is ready for acceptance.`, { product_id: productId, order_id: newOrder.id });
          }
        }
      }
      toast(`${cartCount} order${cartCount !== 1 ? 's' : ''} placed`, 'success');
      setCart({});
      onRefresh();
    } catch (e) {
      toast('Error placing orders: ' + e.message, 'error');
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Catalog</div><div className="section-desc">{market} · Browse and order</div></div>
      </div>
      <div className="filter-row">
        <input className="search-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        {cats.map(c => <span key={c} className={`filter-chip${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>{c}</span>)}
      </div>
      <div className="card-grid">
        {filtered.map(p => (
          <ProductCard key={p.id} p={p} orders={orders.filter(o => o.type === 'standard')}>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Order quantities</div>
              {p.product_variants?.filter(v => v.is_active !== false).map(v => {
                const key = cartKey(p.id, v.id);
                const qty = cart[key] || '';
                return (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{v.brand}</span>
                    <input
                      type="number" min="0" placeholder="0"
                      value={qty}
                      onChange={e => setQty(p.id, v.id, parseInt(e.target.value) || 0)}
                      style={{ width: 70, fontSize: 12, textAlign: 'center' }}
                    />
                  </div>
                );
              })}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setSampleModal(p)}>{Icon.sample} Request Sample</button>
            </div>
          </ProductCard>
        ))}
        {filtered.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}><div className="empty-icon">◻</div><div className="empty-title">No items found</div></div>}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="cart-bar">
          <div className="cart-summary">
            {Icon.cart} <strong>{cartCount}</strong> line{cartCount !== 1 ? 's' : ''} · est. <strong>${cartTotal.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setCart({})}>Clear</button>
            <button className="btn btn-primary btn-sm" onClick={submitCart} disabled={submitting}>
              {submitting ? 'Submitting…' : `Submit ${cartCount} Order${cartCount !== 1 ? 's' : ''}`}
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
