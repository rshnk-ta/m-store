import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, ProductCard, StageBadge } from '../components/UI';
import { MARKETS } from '../lib/constants';
import { OrderDetailModal } from './AdminViews';
import { notifyUsers } from '../lib/db';

// ── MARKET CATALOG ─────────────────────────────────────────────────────────
// Cart model: { [productId__variantId]: desiredQty }
// desiredQty = what the market wants total (not a delta)
// On submit: if existing order → update qty; if no order → insert
// Cart shows each line with: previously submitted qty, new desired qty, and delta

export function MarketCatalog({ products, orders, brands, onRefresh, toast }) {
  const { profile } = useAuth();
  const [sampleModal, setSampleModal] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [activeOnly, setActiveOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const market = profile?.market;
  const storageKey = `mstore_v2_${market}`;

  // Cart stores DESIRED total qty per variant (not delta)
  // Pre-populate from existing pending orders on mount
  const [cart, setCartRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });

  // When orders load, sync cart with any existing pending orders
  // (so qty inputs always show current committed qty)
  useEffect(() => {
    if (!market || !orders.length) return;
    const pendingOrders = orders.filter(o => o.market === market && o.type === 'standard' && o.status === 'collecting');
    if (!pendingOrders.length) return;
    setCartRaw(prev => {
      const next = { ...prev };
      pendingOrders.forEach(o => {
        const key = `${o.product_id}__${o.variant_id}`;
        // Only pre-populate if not already set in cart (don't override user's in-progress changes)
        if (!(key in next)) next[key] = o.qty;
      });
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [orders, market]);

  const setCart = (updater) => {
    setCartRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearCart = () => {
    localStorage.removeItem(storageKey);
    setCartRaw({});
    setCartOpen(false);
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

  // Build cart summary: lines where desired qty differs from committed qty
  const cartLines = Object.entries(cart)
    .map(([key, desiredQty]) => {
      const [productId, variantId] = key.split('__');
      const product = products.find(x => x.id === productId);
      const variant = product?.product_variants?.find(x => x.id === variantId);
      const pendingOrder = getPendingOrder(productId, variantId);
      const committedQty = pendingOrder?.qty || 0;
      const delta = desiredQty - committedQty;
      return { key, productId, variantId, desiredQty, committedQty, delta, product, variant, pendingOrder };
    })
    .filter(line => line.delta !== 0 || line.desiredQty > 0); // show all lines with qty or changes

  // Only lines with actual changes need submitting
  const changedLines = cartLines.filter(l => l.delta !== 0);
  const hasChanges = changedLines.length > 0;

  const cartTotal = cartLines.reduce((sum, { desiredQty, product }) =>
    sum + (product ? product.unit_price * desiredQty : 0), 0);
  const cartDelta = changedLines.reduce((sum, { delta, product }) =>
    sum + (product ? product.unit_price * Math.abs(delta) : 0), 0);

  const submitCart = async () => {
    if (!hasChanges) return;
    setSubmitting(true);
    try {
      for (const { productId, variantId, desiredQty, committedQty, pendingOrder, product } of changedLines) {
        if (desiredQty <= 0 && pendingOrder) {
          // Remove order
          await supabase.from('orders').delete().eq('id', pendingOrder.id);
        } else if (pendingOrder) {
          // Update existing order qty
          await supabase.from('orders').update({ qty: desiredQty, updated_at: new Date().toISOString() }).eq('id', pendingOrder.id);
        } else {
          // Create new order
          const { data: newOrder } = await supabase.from('orders').insert({
            product_id: productId, variant_id: variantId, market,
            qty: desiredQty, type: 'standard', status: 'collecting',
            placed_by: profile?.id, placed_at: new Date().toISOString(),
          }).select().single();
          if (newOrder) {
            await supabase.from('timeline_log').insert({ order_id: newOrder.id, stage: 'collecting', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
          }
        }

        // Check if product MOQ is now reached (after this change)
        if (product && desiredQty > 0) {
          const allProductOrders = orders
            .filter(o => o.product_id === productId && o.type === 'standard' && o.status === 'collecting' && !(pendingOrder && o.id === pendingOrder.id))
            .reduce((s, o) => s + o.qty, 0) + (pendingOrder ? desiredQty : desiredQty);

          const wasReached = product.moq_reached;
          const nowReached = allProductOrders >= product.moq;

          if (nowReached && !wasReached) {
            await supabase.from('products').update({ moq_reached: true, moq_reached_at: new Date().toISOString() }).eq('id', productId);
            const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
            if (supplierUsers?.length) {
              await notifyUsers(supplierUsers.map(u => u.id), 'moq_reached', 'MOQ Reached', `"${product.name}" has reached its MOQ of ${product.moq} units.`, { product_id: productId });
            }
          } else if (!nowReached && wasReached) {
            // MOQ dropped below threshold (order reduced)
            await supabase.from('products').update({ moq_reached: false, moq_reached_at: null }).eq('id', productId);
          }
        }
      }
      toast(`Order updated — ${changedLines.length} line${changedLines.length !== 1 ? 's' : ''} saved`, 'success');
      clearCart();
      onRefresh();
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
    setSubmitting(false);
  };

  return (
    <div style={{ paddingBottom: hasChanges ? 140 : 0 }}>
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
        {filtered.map(p => {
          // Total collecting qty across all markets for MOQ bar
          const totalCollecting = orders
            .filter(o => o.product_id === p.id && o.type === 'standard' && o.status === 'collecting')
            .reduce((s, o) => s + o.qty, 0);
          const moqPct = Math.min(100, Math.round((totalCollecting / p.moq) * 100));
          const moqReached = p.moq_reached || moqPct >= 100;

          return (
            <ProductCard key={p.id} p={p} orders={orders.filter(o => o.type === 'standard')}>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Order quantities
                  {moqReached && <span className="badge badge-green" style={{ marginLeft: 8, verticalAlign: 'middle' }}>MOQ reached</span>}
                </div>
                {p.product_variants?.filter(v => v.is_active !== false).map(v => {
                  const key = cartKey(p.id, v.id);
                  const desiredQty = cart[key] ?? (getPendingOrder(p.id, v.id)?.qty || 0);
                  const committedQty = getPendingOrder(p.id, v.id)?.qty || 0;
                  const delta = desiredQty - committedQty;

                  return (
                    <div key={v.id} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{v.brand}</span>
                        <input
                          type="number" min="0" placeholder="0"
                          value={desiredQty || ''}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setQty(p.id, v.id, val);
                            if (val > 0 || committedQty > 0) setCartOpen(true);
                          }}
                          onFocus={e => e.target.select()}
                          style={{ width: 72, fontSize: 12, textAlign: 'center', borderColor: delta !== 0 ? 'var(--accent-warm)' : undefined }}
                        />
                      </div>
                      {/* Show delta if changed */}
                      {delta !== 0 && (
                        <div style={{ marginLeft: 15, marginTop: 3, fontSize: 10 }}>
                          <span style={{ color: delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                            {delta > 0 ? `+${delta}` : delta} from submitted
                          </span>
                          {committedQty > 0 && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>(was {committedQty})</span>}
                        </div>
                      )}
                      {/* Show committed qty if no change */}
                      {delta === 0 && committedQty > 0 && (
                        <div style={{ marginLeft: 15, marginTop: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                          {committedQty} submitted
                        </div>
                      )}
                    </div>
                  );
                })}
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setSampleModal(p)}>{Icon.sample} Request Sample</button>
              </div>
            </ProductCard>
          );
        })}
        {filtered.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}><div className="empty-icon">◻</div><div className="empty-title">No items found</div></div>}
      </div>

      {/* ── ORDER SUMMARY BAR ── */}
      {(hasChanges || cartLines.some(l => l.committedQty > 0)) && (
        <div style={{ position: 'fixed', bottom: 0, left: 'var(--sidebar-w)', right: 0, background: 'var(--surface)', borderTop: '2px solid var(--border)', boxShadow: '0 -4px 20px rgba(26,23,20,0.08)', zIndex: 100 }}>

          {/* Expandable order summary */}
          {cartOpen && (
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', maxHeight: 260, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Order Summary — {market}</div>
              {cartLines.map(({ key, desiredQty, committedQty, delta, product, variant }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  {product?.image_url && <img src={product.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{product?.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: variant?.color, display: 'inline-block' }} />
                      {variant?.brand} · {variant?.sku}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{desiredQty} units</div>
                    {delta !== 0 && (
                      <div style={{ fontSize: 10, color: delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                        {delta > 0 ? `+${delta}` : delta} units
                      </div>
                    )}
                    {delta === 0 && committedQty > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>no change</div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      ${product ? (product.unit_price * desiredQty).toFixed(2) : '—'}
                    </div>
                  </div>
                  <button onClick={() => setQty(key.split('__')[0], key.split('__')[1], committedQty)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px', lineHeight: 1, flexShrink: 0 }} title="Revert change">↺</button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total order value</span>
                <strong>${cartTotal.toFixed(2)}</strong>
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', gap: 16 }}>
            <button onClick={() => setCartOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', padding: 0 }}>
              {hasChanges && (
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-warm)', color: 'white', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {changedLines.length}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 500 }}>{cartOpen ? '▾ Hide summary' : '▸ Review order'}</span>
            </button>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
              {hasChanges
                ? <><span style={{ color: delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{changedLines.reduce((s, l) => s + l.delta, 0) > 0 ? '+' : ''}{changedLines.reduce((s, l) => s + l.delta, 0)} units</span> · Total <strong style={{ color: 'var(--text-primary)' }}>${cartTotal.toFixed(2)}</strong></>
                : <>Total <strong>${cartTotal.toFixed(2)}</strong></>
              }
            </div>
            {hasChanges && <button className="btn btn-ghost btn-sm" onClick={() => {
              // Revert all changes back to committed qty
              const reverted = {};
              cartLines.forEach(l => { if (l.committedQty > 0) reverted[l.key] = l.committedQty; });
              setCart(reverted);
            }}>Revert</button>}
            <button className="btn btn-primary" onClick={submitCart} disabled={submitting || !hasChanges} style={{ minWidth: 140 }}>
              {submitting ? 'Saving…' : hasChanges ? `Save Order` : 'No changes'}
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
