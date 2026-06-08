import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, ProductCard, StageBadge, MoqBar } from '../components/UI';
import { MARKETS } from '../lib/constants';
import { OrderDetailModal } from './AdminViews';

// ── MARKET CATALOG ─────────────────────────────────────────────────────────
export function MarketCatalog({ products, orders, onRefresh, toast }) {
  const { profile } = useAuth();
  const [orderModal, setOrderModal] = useState(null);
  const [sampleModal, setSampleModal] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  const market = profile?.market;
  const active = products.filter(p => p.status === 'active');
  const cats = ['All', ...Array.from(new Set(active.map(p => p.category)))];
  const filtered = active.filter(p =>
    (catFilter === 'All' || p.category === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const myOrders = orders.filter(o => o.market === market && o.type === 'standard');

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Catalog</div><div className="section-desc">{market} · Browse and order</div></div>
        <span className="badge badge-grey">{myOrders.length} order{myOrders.length !== 1 ? 's' : ''} placed</span>
      </div>
      <div className="filter-row">
        <input className="search-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        {cats.map(c => <span key={c} className={`filter-chip${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>{c}</span>)}
      </div>
      <div className="card-grid">
        {filtered.map(p => {
          const myOrder = myOrders.find(o => o.product_id === p.id);
          return (
            <ProductCard key={p.id} p={p} orders={orders.filter(o => o.type === 'standard')}>
              <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                {myOrder
                  ? <span className="badge badge-green">{Icon.check} Ordered</span>
                  : <button className="btn btn-primary btn-sm" onClick={() => setOrderModal(p)}>Place Order</button>
                }
                <button className="btn btn-secondary btn-sm" onClick={() => setSampleModal(p)}>{Icon.sample} Request Sample</button>
              </div>
            </ProductCard>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty" style={{ gridColumn: '1/-1' }}>
            <div className="empty-icon">◻</div>
            <div className="empty-title">No items found</div>
          </div>
        )}
      </div>
      {orderModal && <OrderModal product={orderModal} market={market} orders={orders} onClose={() => setOrderModal(null)} onRefresh={onRefresh} toast={toast} profile={profile} />}
      {sampleModal && <SampleModal product={sampleModal} market={market} onClose={() => setSampleModal(null)} onRefresh={onRefresh} toast={toast} profile={profile} />}
    </div>
  );
}

// ── PLACE ORDER MODAL ──────────────────────────────────────────────────────
function OrderModal({ product, market, orders, onClose, onRefresh, toast, profile }) {
  const [rows, setRows] = useState((product.product_variants || []).map(v => ({ variantId: v.id, qty: '' })));
  const [saving, setSaving] = useState(false);

  const setQty = (vid, val) => setRows(r => r.map(x => x.variantId === vid ? { ...x, qty: val } : x));

  const place = async () => {
    const toPlace = rows.filter(r => parseInt(r.qty) > 0);
    if (!toPlace.length) return;
    setSaving(true);
    // Check if this will hit MOQ
    for (const r of toPlace) {
      const currentQty = orders.filter(o => o.product_id === product.id && o.type === 'standard').reduce((s, o) => s + o.qty, 0);
      const newTotal = currentQty + parseInt(r.qty);
      const status = newTotal >= product.moq ? 'moq_reached' : 'collecting';
      await supabase.from('orders').insert({
        product_id: product.id,
        variant_id: r.variantId,
        market, qty: parseInt(r.qty),
        type: 'standard', status,
        placed_by: profile?.id,
        placed_at: new Date().toISOString(),
      });
      if (status === 'moq_reached') {
        await supabase.from('timeline_log').insert({ order_id: null, stage: 'moq_reached', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id, note: `MOQ reached for ${product.name}` });
      }
    }
    setSaving(false);
    toast('Order placed', 'success');
    onRefresh();
    onClose();
  };

  return (
    <Modal title={`Order — ${product.name}`} subtitle={`${market} · $${product.unit_price}/unit · MOQ ${product.moq}`} onClose={onClose}
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={place} disabled={saving}>{saving ? 'Placing…' : 'Place Order'}</button></>}
    >
      {product.production_lead_days && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 14, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)' }}>
          Reference only: ~{product.production_lead_days} days production · ~{product.shipping_lead_days} days shipping. No commitment.
        </div>
      )}
      <table style={{ width: '100%' }}>
        <thead><tr><th>Brand</th><th>SKU</th><th>MOQ</th><th>Ordered</th><th>Your Qty</th></tr></thead>
        <tbody>
          {(product.product_variants || []).map((v, i) => {
            const moq = v.moq_override || product.moq;
            const ordered = orders.filter(o => o.product_id === product.id && o.variant_id === v.id && o.type === 'standard').reduce((s, o) => s + o.qty, 0);
            const myOrder = orders.find(o => o.product_id === product.id && o.variant_id === v.id && o.market === market && o.type === 'standard');
            return (
              <tr key={v.id}>
                <td><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block' }} />{v.brand}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{v.sku}</td>
                <td>{moq}</td>
                <td>{ordered}</td>
                <td>{myOrder ? <span className="badge badge-grey">Placed: {myOrder.qty}</span> : <input type="number" min="1" placeholder="0" value={rows[i]?.qty || ''} onChange={e => setQty(v.id, e.target.value)} style={{ width: 80 }} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

// ── SAMPLE REQUEST MODAL ───────────────────────────────────────────────────
function SampleModal({ product, market, onClose, onRefresh, toast, profile }) {
  const [variantId, setVariantId] = useState(product.product_variants?.[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const place = async () => {
    setSaving(true);
    await supabase.from('orders').insert({
      product_id: product.id, variant_id: variantId, market, qty: parseInt(qty),
      type: 'sample', status: 'collecting', placed_by: profile?.id,
      placed_at: new Date().toISOString(),
    });
    setSaving(false);
    toast('Sample requested', 'success');
    onRefresh();
    onClose();
  };

  return (
    <Modal title="Request Sample" subtitle={product.name} onClose={onClose} narrow
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={place} disabled={saving}>{saving ? 'Sending…' : 'Request Sample'}</button></>}
    >
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="form-group">
          <label>Brand Variant</label>
          <select value={variantId} onChange={e => setVariantId(e.target.value)}>
            {(product.product_variants || []).map(v => <option key={v.id} value={v.id}>{v.brand} — {v.sku}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Quantity</label>
          <input type="number" min="1" max="10" value={qty} onChange={e => setQty(e.target.value)} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
        Sample requests are processed separately and don't count toward MOQ.
      </div>
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
    // Update shipment for this market
    const shipment = shipments.find(s => s.order_id === order.id && s.destination === market);
    if (shipment) await supabase.from('shipments').update({ status: 'delivered', confirmed_by: profile?.id }).eq('id', shipment.id);
    toast('Delivery confirmed ✓', 'success');
    onRefresh();
  };

  const totalValue = myOrders.reduce((s, o) => s + ((o.unit_cost || 0) * o.qty), 0);

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">My Orders</div><div className="section-desc">{market}</div></div>
        {totalValue > 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Value <strong>${totalValue.toFixed(2)}</strong></span>}
      </div>
      <div className="tabs">
        <div className={`tab${tab === 'standard' ? ' active' : ''}`} onClick={() => setTab('standard')}>Orders</div>
        <div className={`tab${tab === 'sample' ? ' active' : ''}`} onClick={() => setTab('sample')}>Samples</div>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Brand</th><th>Qty</th><th>Cost</th><th>Status</th><th>ETA</th><th></th></tr></thead>
          <tbody>
            {myOrders.length === 0 && <tr><td colSpan={7}><div className="empty"><div className="empty-icon">○</div><div className="empty-title">No orders yet</div><div className="empty-desc">Browse the catalog to place orders</div></div></td></tr>}
            {myOrders.map(o => {
              const shipment = shipments.find(s => s.order_id === o.id && s.destination === market);
              return (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.product?.name}</td>
                  <td>{o.variant && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: o.variant.color, display: 'inline-block' }} />{o.variant.brand}</span>}</td>
                  <td>{o.qty}</td>
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
        <OrderDetailModal
          order={selected}
          product={selected.product}
          shipments={shipments.filter(s => s.order_id === selected.id)}
          onClose={() => setSelected(null)}
          onRefresh={onRefresh}
          toast={toast}
          readOnly
        />
      )}
    </div>
  );
}
