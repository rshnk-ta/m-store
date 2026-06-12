import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, ProductCard, StageBadge, LifecycleBar, Toast, Lightbox } from '../components/UI';
import { MARKETS, ORDER_STAGES, SAMPLE_STAGES, CATEGORIES } from '../lib/constants';
import { uploadImage, notifyUsers } from '../lib/db';

// ── ADMIN CATALOG ──────────────────────────────────────────────────────────
export function AdminCatalog({ products, orders, brands, onRefresh, toast }) {
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
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast('Delete failed: ' + error.message, 'error'); return; }
    toast('Product deleted', 'default');
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
            <div className="empty-desc">Approve submissions to populate the catalog</div>
          </div>
        )}
      </div>
      {modal && <ProductEditModal product={modal} brands={brands} onClose={() => setModal(null)} onSave={() => { setModal(null); onRefresh(); }} toast={toast} />}
    </div>
  );
}

// ── APPROVAL QUEUE ─────────────────────────────────────────────────────────
export function ApprovalQueue({ products, brands, onRefresh, toast }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(null);
  const [rejectComment, setRejectComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const pending = products.filter(p => p.status === 'pending_approval');

  const approve = async (p) => {
    setSaving(true);
    await supabase.from('products').update({ status: 'active', approved_by: profile.id, updated_at: new Date().toISOString() }).eq('id', p.id);
    // Notify submitter
    if (p.submitted_by) {
      await supabase.from('notifications').insert({ user_id: p.submitted_by, type: 'product_approved', title: 'Item Approved', message: `"${p.name}" has been approved and is now live in the catalog.`, product_id: p.id });
    }
    toast('Product approved and live', 'success');
    setSaving(false);
    onRefresh();
    setSelected(null);
  };

  const reject = async (p) => {
    if (!rejectComment.trim()) return;
    setSaving(true);
    await supabase.from('products').update({ status: 'rejected', rejection_comment: rejectComment, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (p.submitted_by) {
      await supabase.from('notifications').insert({ user_id: p.submitted_by, type: 'product_rejected', title: 'Item Rejected', message: `"${p.name}" was rejected. Reason: ${rejectComment}`, product_id: p.id });
    }
    toast('Product rejected', 'default');
    setSaving(false);
    setRejectComment('');
    onRefresh();
    setSelected(null);
  };

  if (pending.length === 0) return (
    <div>
      <div className="section-header"><div><div className="section-title">Pending Approval</div><div className="section-desc">New items from Supply Chain</div></div></div>
      <div className="empty"><div className="empty-icon">✓</div><div className="empty-title">All clear</div><div className="empty-desc">No items awaiting approval</div></div>
    </div>
  );

  return (
    <div>
      <div className="section-header"><div><div className="section-title">Pending Approval</div><div className="section-desc">{pending.length} item{pending.length !== 1 ? 's' : ''} awaiting review</div></div></div>
      {pending.map(p => (
        <div className="approval-card" key={p.id}>
          <div className="approval-card-header">
            {p.image_url
              ? <img className="approval-card-img" src={p.image_url} alt={p.name} style={{ cursor: 'zoom-in' }} onClick={() => setLightbox([p.image_url])} onError={e => e.target.style.display = 'none'} />
              : <div className="approval-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10 }}>No img</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, marginBottom: 2 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{p.category} · ${p.unit_price}/unit · MOQ {p.moq}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>~{p.production_lead_days}d production · ~{p.shipping_lead_days}d shipping</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignSelf: 'center' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelected(selected?.id === p.id ? null : p)}>{Icon.eye} Review</button>
              <button className="btn btn-sm btn-success" onClick={() => approve(p)} disabled={saving}>{Icon.check} Approve</button>
            </div>
          </div>

          {selected?.id === p.id && (
            <div style={{ padding: '16px 20px', background: 'var(--bg)' }}>
              {/* Variants with images */}
              {p.product_variants?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Brand Variants</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {p.product_variants.map(v => {
                      const imgs = v.variant_images?.map(vi => vi.image_url) || (v.image_url ? [v.image_url] : []);
                      return (
                        <div key={v.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <div style={{ position: 'relative', cursor: imgs.length > 0 ? 'zoom-in' : 'default' }} onClick={() => imgs.length > 0 && setLightbox(imgs)}>
                            {imgs.length > 0
                              ? <img src={imgs[0]} alt={v.brand} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                              : <div style={{ width: 80, height: 80, borderRadius: 'var(--radius-md)', background: v.color, opacity: 0.15, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 10 }}>No img</div>
                            }
                            {imgs.length > 1 && <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 9, padding: '1px 4px', borderRadius: 2 }}>+{imgs.length - 1}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: v.color, display: 'inline-block' }} />
                            {v.brand}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{v.sku}</div>
                        </div>
                      );
                    })}
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
      {lightbox && <Lightbox images={lightbox} startIndex={0} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ── ADMIN ORDERS ───────────────────────────────────────────────────────────
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
    { key: 'accepted', label: 'Accepted' },
    { key: 'in_production', label: 'In Production' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'delivered', label: 'Delivered' },
  ];

  const visible = enriched.filter(o => tab === 'all' ? true : o.status === tab);
  const moqCount = enriched.filter(o => o.status === 'moq_reached').length;

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Orders</div><div className="section-desc">Full order lifecycle</div></div>
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
          <thead><tr><th>Product</th><th>Brand</th><th>SKU</th><th>Market</th><th>Type</th><th>Qty</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={9}><div className="empty"><div className="empty-icon">○</div><div className="empty-title">No orders</div></div></td></tr>}
            {visible.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 500 }}>{o.product?.name || '—'}</td>
                <td>{o.variant && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: o.variant.color, display: 'inline-block' }} />{o.variant.brand}</span>}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'monospace' }}>{o.variant?.sku || '—'}</td>
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
        <OrderDetailModal order={selected} product={selected.product} shipments={shipments.filter(s => s.order_id === selected.id)} onClose={() => setSelected(null)} onRefresh={onRefresh} toast={toast} readOnly />
      )}
    </div>
  );
}

// ── ORDER DETAIL MODAL ─────────────────────────────────────────────────────
export function OrderDetailModal({ order, product, shipments, onClose, onRefresh, toast, readOnly }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState('overview');
  const variant = product?.product_variants?.find(v => v.id === order.variant_id);

  return (
    <Modal title={product?.name || 'Order Detail'} subtitle={`${order.market} · ${order.type === 'sample' ? 'Sample' : 'Standard'} · ${order.qty} units`} onClose={onClose} wide>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Order Progress</div>
        <LifecycleBar status={order.status} type={order.type} />
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {['overview', 'shipments', 'timeline'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</div>
        ))}
      </div>
      {tab === 'overview' && (
        <div>
          <div className="info-grid">
            <div className="info-item"><label>Brand</label><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: variant?.color, display: 'inline-block' }} />{variant?.brand || '—'}</span></div>
            <div className="info-item"><label>SKU</label><span>{variant?.sku || '—'}</span></div>
            <div className="info-item"><label>Quantity</label><span>{order.qty}</span></div>
            <div className="info-item"><label>Placed</label><span>{order.placed_at?.slice(0, 10)}</span></div>
            <div className="info-item"><label>Unit Cost</label><span>{order.unit_cost ? `$${order.unit_cost}` : '—'}</span></div>
            <div className="info-item"><label>Total Cost</label><span>{order.unit_cost ? `$${(order.unit_cost * order.qty).toFixed(2)}` : '—'}</span></div>
            <div className="info-item"><label>Payment Terms</label><span>{order.payment_terms || '—'}</span></div>
            <div className="info-item"><label>Est. Completion</label><span>{order.estimated_completion?.slice(0, 10) || '—'}</span></div>
            {order.type === 'sample' && <>
              <div className="info-item"><label>Sample Cost</label><span>{order.sample_cost ? `$${order.sample_cost}` : '—'}</span></div>
              <div className="info-item"><label>Sample ETA</label><span>{order.sample_eta || '—'}</span></div>
            </>}
          </div>
          {order.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', marginTop: 8 }}>{order.notes}</div>}
          {order.cancelled_reason && <div style={{ fontSize: 12, color: 'var(--red)', padding: '10px 12px', background: '#FEF2F2', borderRadius: 'var(--radius-md)', marginTop: 8 }}>Cancelled: {order.cancelled_reason}</div>}
        </div>
      )}
      {tab === 'shipments' && <ShipmentsTab order={order} shipments={shipments} onRefresh={onRefresh} toast={toast} readOnly={readOnly} profile={profile} />}
      {tab === 'timeline' && <TimelineTab orderId={order.id} />}
    </Modal>
  );
}

// ── SHIPMENTS TAB ──────────────────────────────────────────────────────────
export function ShipmentsTab({ order, shipments, onRefresh, toast, readOnly, profile }) {
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
            <div><span className="badge badge-grey" style={{ marginRight: 8 }}>{s.destination}</span><StageBadge status={s.status} /></div>
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
            <div className="info-item"><label>PO / Ref</label><span>{s.po_reference || '—'}</span></div>
            <div className="info-item"><label>ETD</label><span>{s.etd || '—'}</span></div>
            <div className="info-item"><label>ETA</label><span>{s.eta || '—'}</span></div>
            {s.actual_departure && <div className="info-item"><label>Actual Departure</label><span>{s.actual_departure}</span></div>}
            {s.actual_arrival && <div className="info-item"><label>Actual Arrival</label><span>{s.actual_arrival}</span></div>}
          </div>
          {s.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{s.notes}</div>}
        </div>
      ))}
      {!readOnly && !adding && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>{Icon.plus} Add Shipment</button>}
      {!readOnly && adding && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, marginTop: 10 }}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-group"><label>Destination</label><select value={form.destination} onChange={e => set('destination', e.target.value)}>{MARKETS.map(m => <option key={m}>{m}</option>)}</select></div>
            <div className="form-group"><label>Container No.</label><input value={form.container_no} onChange={e => set('container_no', e.target.value)} placeholder="CMAU1234567" /></div>
            <div className="form-group"><label>PO / Shipment Ref</label><input value={form.po_reference} onChange={e => set('po_reference', e.target.value)} placeholder="PO-2026-001" /></div>
            <div className="form-group"><label>ETD</label><input type="date" value={form.etd} onChange={e => set('etd', e.target.value)} /></div>
            <div className="form-group"><label>ETA</label><input type="date" value={form.eta} onChange={e => set('eta', e.target.value)} /></div>
            <div className="form-group full"><label>Notes</label><input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional…" /></div>
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
export function TimelineTab({ orderId }) {
  const [log, setLog] = useState([]);
  useEffect(() => {
    supabase.from('timeline_log').select('*').eq('order_id', orderId).order('created_at', { ascending: true })
      .then(({ data }) => setLog(data || []));
  }, [orderId]);

  if (log.length === 0) return <div className="empty" style={{ padding: '24px 0' }}><div className="empty-icon">○</div><div className="empty-title">No events yet</div></div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 1fr', gap: 12, padding: '0 0 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
        {['Stage', 'Planned', 'Actual', 'Variance'].map(h => (
          <div key={h} style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</div>
        ))}
      </div>
      {log.map((row, i) => {
        const allStages = [...ORDER_STAGES, ...SAMPLE_STAGES];
        const stageLabel = allStages.find(s => s.key === row.stage)?.label || row.stage;
        const planned = row.planned_date ? new Date(row.planned_date) : null;
        const actual = row.actual_date ? new Date(row.actual_date) : null;
        const diff = planned && actual ? Math.round((actual - planned) / 86400000) : null;
        return (
          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 1fr', gap: 12, padding: '10px 0', borderBottom: i < log.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 500 }}>{stageLabel}</div>
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

// ── PRODUCT EDIT MODAL (Admin) ─────────────────────────────────────────────
function ProductEditModal({ product, brands, onClose, onSave, toast }) {
  const [form, setForm] = useState({ ...product });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Variant active toggle
  const toggleVariant = async (variantId, isActive) => {
    await supabase.from('product_variants').update({ is_active: isActive }).eq('id', variantId);
    toast(`Variant ${isActive ? 'activated' : 'deactivated'}`, 'success');
    onSave();
  };

  const save = async () => {
    setSaving(true);
    const { product_variants, ...rest } = form;
    await supabase.from('products').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', product.id);
    toast('Product updated', 'success');
    setSaving(false);
    onSave();
  };

  return (
    <Modal title="Edit Product" onClose={onClose} wide
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button></>}
    >
      <div className="form-grid">
        <div className="form-group full"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="form-group"><label>Category</label><select value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="form-group"><label>Status</label><select value={form.status} onChange={e => set('status', e.target.value)}><option value="active">Active</option><option value="draft">Draft</option></select></div>
        <div className="form-group"><label>MOQ</label><input type="number" value={form.moq} onChange={e => set('moq', parseInt(e.target.value))} /></div>
        <div className="form-group"><label>Unit Price (USD)</label><input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', parseFloat(e.target.value))} /></div>
        <div className="form-group"><label>Production Lead (days)</label><input type="number" value={form.production_lead_days} onChange={e => set('production_lead_days', parseInt(e.target.value))} /></div>
        <div className="form-group"><label>Shipping Lead (days)</label><input type="number" value={form.shipping_lead_days} onChange={e => set('shipping_lead_days', parseInt(e.target.value))} /></div>
      </div>
      {product.product_variants?.length > 0 && (
        <>
          <div className="divider" />
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Variant Status</div>
          {product.product_variants.map(v => (
            <div className="variant-row" key={v.id} style={{ alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block' }} />
              <span style={{ flex: 1, fontSize: 12 }}><strong>{v.brand}</strong> — {v.sku}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={v.is_active !== false} onChange={e => toggleVariant(v.id, e.target.checked)} />
                {v.is_active !== false ? 'Active' : 'Inactive'}
              </label>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

// ── BRANDS MANAGER ─────────────────────────────────────────────────────────
export function BrandsManager({ brands, onRefresh, toast }) {
  const [form, setForm] = useState({ name: '', color: '#000000', abbreviation: '' });
  const [saving, setSaving] = useState(false);

  const addBrand = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const abbr = form.abbreviation || form.name.slice(0, 3).toUpperCase();
    const { error } = await supabase.from('brands').insert({ name: form.name, color: form.color, abbreviation: abbr, sort_order: brands.length });
    if (error) { toast('Error: ' + error.message, 'error'); } else { toast('Brand added', 'success'); onRefresh(); }
    setForm({ name: '', color: '#000000', abbreviation: '' });
    setSaving(false);
  };

  const toggleBrand = async (id, isActive) => {
    await supabase.from('brands').update({ is_active: isActive }).eq('id', id);
    toast(`Brand ${isActive ? 'activated' : 'deactivated'}`, 'success');
    onRefresh();
  };

  const updateColor = async (id, color) => {
    await supabase.from('brands').update({ color }).eq('id', id);
    onRefresh();
  };

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Brand Management</div><div className="section-desc">Manage brand list and colors</div></div>
      </div>
      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <table>
          <thead><tr><th>Brand</th><th>Abbreviation</th><th>Color</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {brands.map(b => (
              <tr key={b.id}>
                <td style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                  {b.name}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{b.abbreviation || '—'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={b.color} onChange={e => updateColor(b.id, e.target.value)} style={{ width: 32, height: 28, padding: 2, cursor: 'pointer' }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{b.color}</span>
                  </div>
                </td>
                <td><span className={`badge ${b.is_active ? 'badge-green' : 'badge-grey'}`}>{b.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button className={`btn btn-sm ${b.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleBrand(b.id, !b.is_active)}>
                    {b.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 520 }}>
        <div className="form-group" style={{ flex: 1 }}><label>Brand Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. NewBrand" /></div>
        <div className="form-group" style={{ width: 80 }}><label>Abbr (3 letters)</label><input value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value.toUpperCase().slice(0, 3) }))} placeholder="NBR" style={{ fontFamily: 'monospace' }} /></div>
        <div className="form-group"><label>Color</label><input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ width: 44, height: 36, padding: 2, cursor: 'pointer' }} /></div>
        <button className="btn btn-primary btn-sm" onClick={addBrand} disabled={saving || !form.name.trim()} style={{ marginBottom: 0 }}>{Icon.plus} Add</button>
      </div>
    </div>
  );
}

// ── NOTIFICATIONS PANEL ────────────────────────────────────────────────────
export function NotificationsPanel({ notifications, onRefresh }) {
  const markRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    onRefresh();
  };
  const markAllRead = async (userId) => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    onRefresh();
  };

  const unread = notifications.filter(n => !n.is_read);

  return (
    <Modal title="Notifications" subtitle={`${unread.length} unread`} onClose={() => {}} footer={null}>
      {unread.length > 0 && <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => markAllRead(notifications[0]?.user_id)}>Mark all read</button>}
      {notifications.length === 0 && <div className="empty" style={{ padding: '24px 0' }}><div className="empty-icon">○</div><div className="empty-title">All clear</div></div>}
      {notifications.map(n => (
        <div key={n.id} onClick={() => markRead(n.id)} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: n.is_read ? 0.5 : 1, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.is_read ? 'transparent' : 'var(--accent-warm)', marginTop: 5, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{n.message}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
      ))}
    </Modal>
  );
}
