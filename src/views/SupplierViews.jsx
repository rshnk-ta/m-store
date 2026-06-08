import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, StageBadge, ImageUpload, Toast } from '../components/UI';
import { BRANDS, BRAND_COLORS, MARKETS, ORDER_STAGES } from '../lib/constants';
import { OrderDetailModal } from './AdminViews';

// ── SUBMIT NEW ITEM ────────────────────────────────────────────────────────
export function SupplierSubmitItem({ onRefresh, toast }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    name: '', category: '', moq: '', unit_price: '', status: 'pending_approval',
    production_lead_days: 30, shipping_lead_days: 45,
  });
  const [variants, setVariants] = useState([]);
  const [vForm, setVForm] = useState({ brand: BRANDS[0], sku: '', moq_override: '' });
  const [imageFile, setImageFile] = useState(null);
  const [variantImages, setVariantImages] = useState({});
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1); // 1=details, 2=variants

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addVariant = () => {
    if (!vForm.sku.trim()) return;
    setVariants(v => [...v, { tempId: Math.random().toString(36).slice(2), brand: vForm.brand, sku: vForm.sku, color: BRAND_COLORS[vForm.brand], moq_override: vForm.moq_override ? parseInt(vForm.moq_override) : null }]);
    setVForm({ brand: BRANDS[0], sku: '', moq_override: '' });
  };

  const removeVariant = (tempId) => setVariants(v => v.filter(x => x.tempId !== tempId));

  const uploadImage = async (file, path) => {
    const { data, error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (error) return null;
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
    return publicUrl;
  };

  const submit = async () => {
    if (!form.name || !form.moq || !form.unit_price) return;
    setSaving(true);
    try {
      // Upload main image
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, `products/${Date.now()}_${imageFile.name}`);
      }

      // Insert product
      const { data: product, error } = await supabase.from('products').insert({
        ...form,
        moq: parseInt(form.moq),
        unit_price: parseFloat(form.unit_price),
        production_lead_days: parseInt(form.production_lead_days),
        shipping_lead_days: parseInt(form.shipping_lead_days),
        image_url: imageUrl,
        submitted_by: profile?.id,
      }).select().single();

      if (error) throw error;

      // Insert variants
      for (const v of variants) {
        let vImageUrl = null;
        if (variantImages[v.tempId]) {
          vImageUrl = await uploadImage(variantImages[v.tempId], `variants/${Date.now()}_${variantImages[v.tempId].name}`);
        }
        await supabase.from('product_variants').insert({
          product_id: product.id,
          brand: v.brand, sku: v.sku, color: v.color,
          moq_override: v.moq_override || null,
          image_url: vImageUrl,
        });
      }

      toast('Item submitted for approval', 'success');
      setForm({ name: '', category: '', moq: '', unit_price: '', status: 'pending_approval', production_lead_days: 30, shipping_lead_days: 45 });
      setVariants([]);
      setImageFile(null);
      setVariantImages({});
      setStep(1);
      onRefresh();
    } catch (e) {
      toast('Error submitting item: ' + e.message, 'error');
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Submit New Item</div><div className="section-desc">New catalog item for HoM approval</div></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className={`filter-chip${step === 1 ? ' active' : ''}`} onClick={() => setStep(1)}>1 · Details</span>
          <span className={`filter-chip${step === 2 ? ' active' : ''}`} onClick={() => setStep(2)}>2 · Variants</span>
        </div>
      </div>

      {step === 1 && (
        <div className="card" style={{ padding: 24, maxWidth: 640 }}>
          <div className="form-grid">
            <div className="form-group full"><label>Product Name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ceramic Mug" /></div>
            <div className="form-group"><label>Category</label><input value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Drinkware" /></div>
            <div className="form-group"><label>Default MOQ</label><input type="number" value={form.moq} onChange={e => set('moq', e.target.value)} placeholder="500" /></div>
            <div className="form-group"><label>Unit Price (USD)</label><input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="2.80" /></div>
            <div className="form-group"><label>Production Lead (days)</label><input type="number" value={form.production_lead_days} onChange={e => set('production_lead_days', e.target.value)} /></div>
            <div className="form-group"><label>Shipping Lead (days)</label><input type="number" value={form.shipping_lead_days} onChange={e => set('shipping_lead_days', e.target.value)} /></div>
            <ImageUpload onChange={setImageFile} label="Default Product Image" />
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setStep(2)} disabled={!form.name || !form.moq}>Next: Add Variants →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: 24, maxWidth: 760 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Add one variant per brand. Each can have its own image and optional MOQ override.
          </div>
          {variants.map(v => (
            <div className="variant-row" key={v.tempId}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: v.color, border: '2px solid white', boxShadow: '0 0 0 1px var(--border)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12 }}><strong>{v.brand}</strong> — {v.sku}{v.moq_override ? ` (MOQ: ${v.moq_override})` : ''}</span>
              {variantImages[v.tempId] && <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ Image</span>}
              <label style={{ fontSize: 10, color: 'var(--blue)', cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                {Icon.upload}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setVariantImages(prev => ({ ...prev, [v.tempId]: e.target.files[0] }))} />
              </label>
              <button className="btn btn-ghost btn-sm" onClick={() => removeVariant(v.tempId)} style={{ color: 'var(--red)', padding: 4 }}>{Icon.trash}</button>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 120px auto', gap: 8, marginTop: 12 }}>
            <select value={vForm.brand} onChange={e => setVForm(f => ({ ...f, brand: e.target.value }))}>{BRANDS.map(b => <option key={b}>{b}</option>)}</select>
            <input value={vForm.sku} onChange={e => setVForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU e.g. MUG-BRH-001" />
            <input type="number" value={vForm.moq_override} onChange={e => setVForm(f => ({ ...f, moq_override: e.target.value }))} placeholder="MOQ override" />
            <button className="btn btn-secondary btn-sm" onClick={addVariant}>{Icon.plus} Add</button>
          </div>
          <div className="divider" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving || variants.length === 0}>
              {saving ? 'Submitting…' : `Submit for Approval (${variants.length} variant${variants.length !== 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SUPPLIER ORDERS (accept + manage) ─────────────────────────────────────
export function SupplierOrders({ products, orders, shipments, onRefresh, toast }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState('moq_reached');
  const [selected, setSelected] = useState(null);
  const [acceptModal, setAcceptModal] = useState(null);

  const enriched = orders.filter(o => o.type === 'standard').map(o => {
    const p = products.find(x => x.id === o.product_id);
    const v = p?.product_variants?.find(x => x.id === o.variant_id);
    return { ...o, product: p, variant: v };
  });

  const tabs = [
    { key: 'moq_reached', label: 'Awaiting Acceptance' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'in_production', label: 'In Production' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'delivered', label: 'Done' },
  ];

  const visible = enriched.filter(o => tab === 'delivered' ? ['arrived', 'delivered'].includes(o.status) : o.status === tab);

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Orders</div><div className="section-desc">Manage incoming orders from all markets</div></div>
      </div>
      <div className="tabs">
        {tabs.map(t => {
          const count = enriched.filter(o => t.key === 'delivered' ? ['arrived', 'delivered'].includes(o.status) : o.status === t.key).length;
          return (
            <div key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              {count > 0 && <span className={`badge ${tab === t.key ? '' : 'badge-grey'}`} style={{ marginLeft: 6, padding: '1px 6px', background: tab === t.key ? 'rgba(255,255,255,0.2)' : undefined, color: tab === t.key ? 'white' : undefined }}>{count}</span>}
            </div>
          );
        })}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Brand</th><th>Market</th><th>Qty</th><th>Unit Cost</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={7}><div className="empty"><div className="empty-icon">○</div><div className="empty-title">Nothing here</div></div></td></tr>}
            {visible.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 500 }}>{o.product?.name}</td>
                <td>
                  {o.variant && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.variant.color, display: 'inline-block' }} />{o.variant.brand}
                  </span>}
                </td>
                <td><span className="badge badge-grey">{o.market}</span></td>
                <td>{o.qty}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{o.unit_cost ? `$${o.unit_cost}` : '—'}</td>
                <td><StageBadge status={o.status} /></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {o.status === 'moq_reached' && <button className="btn btn-sm btn-success" onClick={() => setAcceptModal(o)}>{Icon.check} Accept</button>}
                    {o.status === 'accepted' && <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(o.id, 'in_production', onRefresh, toast, profile)}>Start Production</button>}
                    {o.status === 'in_production' && <button className="btn btn-sm btn-secondary" onClick={() => setSelected(o)}>Dispatch →</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected(o)}>{Icon.eye}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {acceptModal && (
        <AcceptModal order={acceptModal} onClose={() => setAcceptModal(null)} onRefresh={onRefresh} toast={toast} profile={profile} />
      )}
      {selected && (
        <OrderDetailModal
          order={selected}
          product={selected.product}
          shipments={shipments.filter(s => s.order_id === selected.id)}
          onClose={() => setSelected(null)}
          onRefresh={onRefresh}
          toast={toast}
          readOnly={false}
        />
      )}
    </div>
  );
}

async function updateStatus(orderId, status, onRefresh, toast, profile) {
  await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
  await supabase.from('timeline_log').insert({ order_id: orderId, stage: status, actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
  toast('Status updated', 'success');
  onRefresh();
}

// ── ACCEPT MODAL ───────────────────────────────────────────────────────────
function AcceptModal({ order, onClose, onRefresh, toast, profile }) {
  const [form, setForm] = useState({ unit_cost: '', payment_terms: '', estimated_completion: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const accept = async () => {
    if (!form.unit_cost) return;
    setSaving(true);
    await supabase.from('orders').update({
      status: 'accepted',
      unit_cost: parseFloat(form.unit_cost),
      payment_terms: form.payment_terms,
      estimated_completion: form.estimated_completion || null,
      notes: form.notes,
      accepted_by: profile?.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await supabase.from('timeline_log').insert({
      order_id: order.id, stage: 'accepted',
      planned_date: form.estimated_completion || null,
      actual_date: new Date().toISOString().slice(0, 10),
      created_by: profile?.id,
    });
    toast('Order accepted', 'success');
    setSaving(false);
    onRefresh();
    onClose();
  };

  return (
    <Modal title="Accept Order" subtitle={`Confirm cost & terms before accepting`} onClose={onClose} narrow
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-success btn-sm" onClick={accept} disabled={saving || !form.unit_cost}>{saving ? 'Saving…' : 'Accept Order'}</button></>}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {order.qty} units · {order.market}
      </div>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="form-group"><label>Confirmed Unit Cost (USD) *</label><input type="number" step="0.01" value={form.unit_cost} onChange={e => set('unit_cost', e.target.value)} placeholder="e.g. 2.50" autoFocus /></div>
        <div className="form-group"><label>Payment Terms</label><input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="e.g. 30% deposit, 70% before shipment" /></div>
        <div className="form-group"><label>Estimated Completion Date</label><input type="date" value={form.estimated_completion} onChange={e => set('estimated_completion', e.target.value)} /></div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" /></div>
      </div>
    </Modal>
  );
}

// ── SUPPLIER CONSOLIDATED VIEW ────────────────────────────────────────────
export function SupplierConsolidated({ products, orders, onRefresh, toast }) {
  const activeProducts = products.filter(p => p.status === 'active' && orders.some(o => o.product_id === p.id && o.type === 'standard'));

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Consolidated View</div><div className="section-desc">Total demand per item across all markets</div></div>
      </div>
      {activeProducts.length === 0 && <div className="empty"><div className="empty-icon">○</div><div className="empty-title">No orders yet</div></div>}
      {activeProducts.map(p => {
        const productOrders = orders.filter(o => o.product_id === p.id && o.type === 'standard');
        const totalQty = productOrders.reduce((s, o) => s + o.qty, 0);
        const pct = Math.min(100, Math.round((totalQty / p.moq) * 100));
        const reached = pct >= 100;
        return (
          <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500 }}>{p.name}</span>
                  {reached && <span className="badge badge-amber">{Icon.flag} MOQ Reached</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.category} · ${p.unit_price}/unit · MOQ {p.moq}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400 }}>{totalQty.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>total units</div>
              </div>
            </div>
            <div style={{ padding: '0 20px 4px' }}>
              <MoqBar product={p} orders={orders.filter(o => o.type === 'standard')} />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Brand</th><th>SKU</th><th>Variant MOQ</th>{MARKETS.map(m => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  {p.product_variants?.map(v => {
                    const byMarket = MARKETS.reduce((acc, m) => {
                      acc[m] = productOrders.filter(o => o.variant_id === v.id && o.market === m).reduce((s, o) => s + o.qty, 0);
                      return acc;
                    }, {});
                    const total = Object.values(byMarket).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={v.id}>
                        <td><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ background: v.color, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /><strong>{v.brand}</strong></span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{v.sku}</td>
                        <td style={{ fontSize: 11 }}>{v.moq_override || p.moq}</td>
                        {MARKETS.map(m => <td key={m} style={{ color: byMarket[m] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{byMarket[m] || '—'}</td>)}
                        <td style={{ fontWeight: 500 }}>{total || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SAMPLES VIEW ───────────────────────────────────────────────────────────
export function SupplierSamples({ products, orders, onRefresh, toast }) {
  const { profile } = useAuth();
  const samples = orders.filter(o => o.type === 'sample').map(o => ({
    ...o,
    product: products.find(x => x.id === o.product_id),
    variant: products.find(x => x.id === o.product_id)?.product_variants?.find(v => v.id === o.variant_id),
  }));

  const advance = async (order) => {
    const next = {
      collecting: 'accepted',
      accepted: 'dispatched',
      dispatched: 'delivered',
    }[order.status];
    if (!next) return;
    await supabase.from('orders').update({ status: next, updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: next, actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    toast('Sample updated', 'success');
    onRefresh();
  };

  const nextLabel = { collecting: 'Acknowledge', accepted: 'Mark Dispatched', dispatched: 'Mark Received' };

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Samples</div><div className="section-desc">Sample requests from market managers</div></div>
      </div>
      {samples.length === 0 && <div className="empty"><div className="empty-icon">◻</div><div className="empty-title">No sample requests</div></div>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Brand</th><th>Market</th><th>Qty</th><th>Status</th><th>Requested</th><th></th></tr></thead>
          <tbody>
            {samples.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 500 }}>{o.product?.name}</td>
                <td>{o.variant && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: o.variant.color, display: 'inline-block' }} />{o.variant.brand}</span>}</td>
                <td><span className="badge badge-grey">{o.market}</span></td>
                <td>{o.qty}</td>
                <td><StageBadge status={o.status} type="sample" /></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{o.placed_at?.slice(0, 10)}</td>
                <td>{o.status !== 'delivered' && <button className="btn btn-sm btn-secondary" onClick={() => advance(o)}>{nextLabel[o.status]}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Re-export MoqBar for use in consolidated
import { MoqBar } from '../components/UI';
