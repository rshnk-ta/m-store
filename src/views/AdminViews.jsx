import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, ProductCard, ImageUpload, StageBadge, Toast, MoqBar } from '../components/UI';
import { BRANDS, BRAND_COLORS, MARKETS, ORDER_STAGES } from '../lib/constants';

function uid() { return crypto.randomUUID(); }

// ── ADMIN CATALOG ──────────────────────────────────────────────────────────
export function AdminCatalog({ products, orders, onRefresh, toast }) {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [modal, setModal] = useState(null);

  const cats = ['All', ...Array.from(new Set(products.filter(p => p.status === 'active').map(p => p.category)))];
  const active = products.filter(p =>
    p.status === 'active' &&
    (catFilter === 'All' || p.category === catFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Catalog</div><div className="section-desc">Active merchandise items</div></div>
      </div>
      <div className="filter-row">
        <input className="search-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        {cats.map(c => <span key={c} className={`filter-chip${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>{c}</span>)}
      </div>
      <div className="card-grid">
        {active.map(p => (
          <ProductCard key={p.id} p={p} orders={orders} showStatus>
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(p)}>{Icon.edit} Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p.id)}>{Icon.trash}</button>
            </div>
          </ProductCard>
        ))}
        {active.length === 0 && (
          <div className="empty" style={{ gridColumn: '1/-1' }}>
            <div className="empty-icon">◻</div>
            <div className="empty-title">No active items</div>
            <div className="empty-desc">Approve submissions to add items to the catalog</div>
          </div>
        )}
      </div>
      {modal && <ProductEditModal product={modal} onClose={() => setModal(null)} onSave={() => { setModal(null); onRefresh(); }} toast={toast} />}
    </div>
  );
}

// ── APPROVAL QUEUE ─────────────────────────────────────────────────────────
export function ApprovalQueue({ products, onRefresh, toast }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(null);
  const [rejectComment, setRejectComment] = useState('');
  const [saving, setSaving] = useState(false);

  const pending = products.filter(p => p.status === 'pending_approval');

  const approve = async (p) => {
    setSaving(true);
    await supabase.from('products').update({ status: 'active', approved_by: profile.id }).eq('id', p.id);
    toast('Product approved and live in catalog', 'success');
    setSaving(false);
    onRefresh();
    setSelected(null);
  };

  const reject = async (p) => {
    if (!rejectComment.trim()) return;
    setSaving(true);
    await supabase.from('products').update({ status: 'rejected', rejection_comment: rejectComment }).eq('id', p.id);
    toast('Product rejected', 'default');
    setSaving(false);
    setRejectComment('');
    onRefresh();
    setSelected(null);
  };

  if (pending.length === 0) return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Pending Approval</div><div className="section-desc">New items submitted by Supply Chain</div></div>
      </div>
      <div className="empty"><div className="empty-icon">✓</div><div className="empty-title">All clear</div><div className="empty-desc">No items awaiting approval</div></div>
    </div>
  );

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Pending Approval</div><div className="section-desc">{pending.length} item{pending.length !== 1 ? 's' : ''} awaiting review</div></div>
      </div>
      {pending.map(p => (
        <div className="approval-card" key={p.id}>
          <div className="approval-card-header">
            {p.image_url
              ? <img className="approval-card-img" src={p.image_url} alt={p.name} onError={e => e.target.style.display = 'none'} />
              : <div className="approval-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10 }}>No img</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{p.category} · ${p.unit_price}/unit · MOQ {p.moq}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                ~{p.production_lead_days}d production · ~{p.shipping_lead_days}d shipping
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'center' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelected(selected?.id === p.id ? null : p)}>{Icon.eye} Review</button>
              <button className="btn btn-sm btn-success" onClick={() => approve(p)} disabled={saving}>{Icon.check} Approve</button>
            </div>
          </div>
          {selected?.id === p.id && (
            <div style={{ padding: '16px 20px', background: 'var(--bg)' }}>
              {p.product_variants?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Brand Variants</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.product_variants.map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 999, fontSize: 11 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.color, display: 'inline-block' }} />
                        {v.brand} — {v.sku}
                        {v.moq_override && <span style={{ color: 'var(--text-muted)' }}>(MOQ: {v.moq_override})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Rejection reason (required to reject)</label>
                  <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="Explain what needs to be changed…" style={{ minHeight: 56 }} />
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => reject(p)} disabled={saving || !rejectComment.trim()}>Reject</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── ADMIN ORDERS VIEW ──────────────────────────────────────────────────────
export function AdminOrders({ products, orders, shipments, onRefresh, toast }) {
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);

  const enriched = orders.map(o => {
    const p = products.find(x => x.id === o.product_id);
    const v = p?.product_variants?.find(x => x.id === o.variant_id);
    return { ...o, product: p, variant: v };
  });

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'moq_reached', label: 'MOQ Reached' },
    { key: 'in_production', label: 'In Production' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const visible = enriched.filter(o => tab === 'all' ? true : o.status === tab);
  const moqCount = enriched.filter(o => o.status === 'moq_reached').length;
  const totalValue = orders.reduce((s, o) => s + ((o.unit_cost || 0) * o.qty), 0);

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Orders</div><div className="section-desc">All market orders — full lifecycle</div></div>
        {totalValue > 0 && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Confirmed value <strong>${totalValue.toLocaleString('en', { minimumFractionDigits: 2 })}</strong></span>}
      </div>
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{orders.filter(o => o.type === 'standard').length}</div></div>
        <div className="stat-card"><div className="stat-label">MOQ Reached</div><div className="stat-value" style={{ color: 'var(--accent-warm)' }}>{moqCount}</div></div>
        <div className="stat-card"><div className="stat-label">In Production</div><div className="stat-value">{orders.filter(o => o.status === 'in_production').length}</div></div>
        <div className="stat-card"><div className="stat-label">Samples</div><div className="stat-value">{orders.filter(o => o.type === 'sample').length}</div></div>
      </div>
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'moq_reached' && moqCount > 0 && <span className="badge badge-amber" style={{ marginLeft: 6, padding: '1px 6px' }}>{moqCount}</span>}
          </div>
        ))}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Brand</th><th>Market</th><th>Type</th><th>Qty</th><th>Status</th><th>Placed</th><th></th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={8}><div className="empty"><div className="empty-icon">○</div><div className="empty-title">No orders</div></div></td></tr>}
            {visible.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 500 }}>{o.product?.name || '—'}</td>
                <td>
                  {o.variant && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.variant.color, display: 'inline-block' }} />
                    {o.variant.brand}
                  </span>}
                </td>
                <td><span className="badge badge-grey">{o.market}</span></td>
                <td><span className={`badge ${o.type === 'sample' ? 'badge-blue' : 'badge-grey'}`}>{o.type}</span></td>
                <td>{o.qty}</td>
                <td><StageBadge status={o.status} type={o.type} /></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{o.placed_at?.slice(0, 10)}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(o)}>{Icon.eye}</button></td>
              </tr>
            ))}
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

// ── ORDER DETAIL MODAL (shared, read-only for admin) ───────────────────────
export function OrderDetailModal({ order, product, shipments, onClose, onRefresh, toast, readOnly }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    unit_cost: order.unit_cost || '',
    payment_terms: order.payment_terms || '',
    notes: order.notes || '',
    estimated_completion: order.estimated_completion?.slice(0, 10) || '',
  });

  const variant = product?.product_variants?.find(v => v.id === order.variant_id);

  const updateOrder = async (updates) => {
    setSaving(true);
    await supabase.from('orders').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', order.id);
    // Log timeline
    if (updates.status) {
      await supabase.from('timeline_log').insert({
        order_id: order.id, stage: updates.status,
        actual_date: new Date().toISOString().slice(0, 10),
        created_by: profile?.id,
      });
    }
    setSaving(false);
    toast('Order updated', 'success');
    onRefresh();
    onClose();
  };

  return (
    <Modal title={product?.name || 'Order Detail'} subtitle={`${order.market} · ${order.type === 'sample' ? 'Sample' : 'Standard'} · ${order.qty} units`} onClose={onClose} wide>
      {/* Lifecycle bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Order Progress</div>
        {/* Lifecycle imported from UI */}
        <LifecycleBarInline status={order.status} type={order.type} />
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {['overview', 'shipments', 'timeline'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</div>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="info-grid">
            <div className="info-item"><label>Brand</label><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: variant?.color, display: 'inline-block' }} />{variant?.brand}</span></div>
            <div className="info-item"><label>SKU</label><span>{variant?.sku || '—'}</span></div>
            <div className="info-item"><label>Quantity</label><span>{order.qty}</span></div>
            <div className="info-item"><label>Placed</label><span>{order.placed_at?.slice(0, 10)}</span></div>
            <div className="info-item"><label>Unit Cost</label><span>{order.unit_cost ? `$${order.unit_cost}` : '—'}</span></div>
            <div className="info-item"><label>Total Cost</label><span>{order.unit_cost ? `$${(order.unit_cost * order.qty).toFixed(2)}` : '—'}</span></div>
            <div className="info-item"><label>Payment Terms</label><span>{order.payment_terms || '—'}</span></div>
            <div className="info-item"><label>Est. Completion</label><span>{order.estimated_completion?.slice(0, 10) || '—'}</span></div>
          </div>
          {order.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', marginTop: 8 }}>{order.notes}</div>}
        </div>
      )}

      {tab === 'shipments' && (
        <ShipmentsTab order={order} shipments={shipments} onRefresh={onRefresh} toast={toast} readOnly={readOnly} profile={profile} />
      )}

      {tab === 'timeline' && (
        <TimelineTab orderId={order.id} />
      )}
    </Modal>
  );
}

function LifecycleBarInline({ status, type }) {
  // Re-import here to avoid circular dep
  const { LifecycleBar } = require('../components/UI');
  return <LifecycleBar status={status} type={type} />;
}

// ── SHIPMENTS TAB ──────────────────────────────────────────────────────────
function ShipmentsTab({ order, shipments, onRefresh, toast, readOnly, profile }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ destination: MARKETS[0], container_no: '', po_reference: '', etd: '', eta: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addShipment = async () => {
    setSaving(true);
    await supabase.from('shipments').insert({ ...form, order_id: order.id, status: 'pending' });
    setSaving(false);
    setAdding(false);
    setForm({ destination: MARKETS[0], container_no: '', po_reference: '', etd: '', eta: '', notes: '' });
    toast('Shipment added', 'success');
    onRefresh();
  };

  const updateShipmentStatus = async (id, status) => {
    const updates = { status };
    if (status === 'dispatched') updates.actual_departure = new Date().toISOString().slice(0, 10);
    if (status === 'arrived') updates.actual_arrival = new Date().toISOString().slice(0, 10);
    await supabase.from('shipments').update(updates).eq('id', id);
    toast('Shipment updated', 'success');
    onRefresh();
  };

  return (
    <div>
      {shipments.length === 0 && <div className="empty" style={{ padding: '24px 0' }}><div className="empty-icon">◻</div><div className="empty-title">No shipments yet</div></div>}
      {shipments.map(s => (
        <div className="shipment-card" key={s.id}>
          <div className="shipment-card-header">
            <div>
              <span className="badge badge-grey" style={{ marginRight: 8 }}>{s.destination}</span>
              <StageBadge status={s.status} />
            </div>
            {!readOnly && (
              <div style={{ display: 'flex', gap: 6 }}>
                {s.status === 'pending' && <button className="btn btn-sm btn-secondary" onClick={() => updateShipmentStatus(s.id, 'dispatched')}>Mark Dispatched</button>}
                {s.status === 'dispatched' && <button className="btn btn-sm btn-secondary" onClick={() => updateShipmentStatus(s.id, 'in_transit')}>In Transit</button>}
                {s.status === 'in_transit' && <button className="btn btn-sm btn-secondary" onClick={() => updateShipmentStatus(s.id, 'arrived')}>Arrived at Port</button>}
              </div>
            )}
          </div>
          <div className="info-grid">
            <div className="info-item"><label>Container No.</label><span>{s.container_no || '—'}</span></div>
            <div className="info-item"><label>PO / Shipment Ref</label><span>{s.po_reference || '—'}</span></div>
            <div className="info-item"><label>ETD</label><span>{s.etd || '—'}</span></div>
            <div className="info-item"><label>ETA</label><span>{s.eta || '—'}</span></div>
            {s.actual_departure && <div className="info-item"><label>Actual Departure</label><span>{s.actual_departure}</span></div>}
            {s.actual_arrival && <div className="info-item"><label>Actual Arrival</label><span>{s.actual_arrival}</span></div>}
          </div>
          {s.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{s.notes}</div>}
        </div>
      ))}
      {!readOnly && !adding && (
        <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>{Icon.plus} Add Shipment</button>
      )}
      {!readOnly && adding && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, marginTop: 10 }}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group"><label>Destination</label><select value={form.destination} onChange={e => set('destination', e.target.value)}>{MARKETS.map(m => <option key={m}>{m}</option>)}</select></div>
            <div className="form-group"><label>Container No.</label><input value={form.container_no} onChange={e => set('container_no', e.target.value)} placeholder="CMAU1234567" /></div>
            <div className="form-group"><label>PO / Shipment Ref</label><input value={form.po_reference} onChange={e => set('po_reference', e.target.value)} placeholder="PO-2026-001" /></div>
            <div className="form-group"><label>ETD</label><input type="date" value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
            <div className="form-group"><label>ETA</label><input type="date" value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
            <div className="form-group full"><label>Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…" /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={addShipment} disabled={saving}>Save Shipment</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TIMELINE TAB ───────────────────────────────────────────────────────────
function TimelineTab({ orderId }) {
  const [log, setLog] = useState([]);
  useEffect(() => {
    supabase.from('timeline_log').select('*').eq('order_id', orderId).order('created_at', { ascending: true })
      .then(({ data }) => setLog(data || []));
  }, [orderId]);

  if (log.length === 0) return <div className="empty" style={{ padding: '24px 0' }}><div className="empty-icon">○</div><div className="empty-title">No timeline events yet</div></div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr', gap: 12, padding: '0 0 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        {['Stage', 'Planned Date', 'Actual Date', 'Variance'].map(h => (
          <div key={h} style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</div>
        ))}
      </div>
      {log.map((row, i) => {
        const planned = row.planned_date ? new Date(row.planned_date) : null;
        const actual = row.actual_date ? new Date(row.actual_date) : null;
        const diff = planned && actual ? Math.round((actual - planned) / 86400000) : null;
        return (
          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr', gap: 12, padding: '10px 0', borderBottom: i < log.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 500 }}>{ORDER_STAGES.find(s => s.key === row.stage)?.label || row.stage}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.planned_date || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.actual_date || '—'}</div>
            <div>
              {diff !== null
                ? <span className={`badge ${diff <= 0 ? 'badge-green' : diff <= 7 ? 'badge-amber' : 'badge-red'}`}>
                    {diff === 0 ? 'On time' : diff > 0 ? `+${diff}d late` : `${Math.abs(diff)}d early`}
                  </span>
                : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PRODUCT EDIT MODAL ────────────────────────────────────────────────────
function ProductEditModal({ product, onClose, onSave, toast }) {
  const [form, setForm] = useState({ ...product });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { product_variants, ...rest } = form;
    await supabase.from('products').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', product.id);
    toast('Product updated', 'success');
    setSaving(false);
    onSave();
  };

  return (
    <Modal title="Edit Product" onClose={onClose}
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}
    >
      <div className="form-grid">
        <div className="form-group full"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="form-group"><label>Category</label><input value={form.category} onChange={e => set('category', e.target.value)} /></div>
        <div className="form-group"><label>Status</label><select value={form.status} onChange={e => set('status', e.target.value)}><option value="active">Active</option><option value="draft">Draft</option></select></div>
        <div className="form-group"><label>MOQ</label><input type="number" value={form.moq} onChange={e => set('moq', parseInt(e.target.value))} /></div>
        <div className="form-group"><label>Unit Price (USD)</label><input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', parseFloat(e.target.value))} /></div>
        <div className="form-group"><label>Production Lead (days)</label><input type="number" value={form.production_lead_days} onChange={e => set('production_lead_days', parseInt(e.target.value))} /></div>
        <div className="form-group"><label>Shipping Lead (days)</label><input type="number" value={form.shipping_lead_days} onChange={e => set('shipping_lead_days', parseInt(e.target.value))} /></div>
      </div>
    </Modal>
  );
}
