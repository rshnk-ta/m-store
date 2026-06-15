import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, StageBadge, MultiImageUpload } from '../components/UI';
import { CATEGORIES, CATEGORY_ABBR } from '../lib/constants';
import { OrderDetailModal, ShipmentsTab, TimelineTab } from './AdminViews';
import { uploadImage, notifyUsers } from '../lib/db';

// ── SKU GENERATOR ──────────────────────────────────────────────────────────
function generateSku(brandAbbr, categoryAbbr, existingVariants) {
  if (!brandAbbr || !categoryAbbr) return '';
  const prefix = `${brandAbbr}_${categoryAbbr}`;
  const existing = existingVariants.filter(v => (v.sku || '').startsWith(prefix));
  const maxSerial = existing.reduce((max, v) => {
    const parts = v.sku.split('_');
    const serial = parseInt(parts[parts.length - 1]) || 0;
    return Math.max(max, serial);
  }, 0);
  return `${prefix}_${String(maxSerial + 1).padStart(3, '0')}`;
}

// ── VARIANT FORM ───────────────────────────────────────────────────────────
function VariantForm({ brands, category, existingVariants = [], onAdd }) {
  const [vForm, setVForm] = useState({ brand: brands[0]?.name || '', sku: '', imageFiles: [] });
  const [imagePreviews, setImagePreviews] = useState([]);

  // Auto-generate SKU on mount
  useEffect(() => {
    if (brands[0] && category) {
      const brand = brands[0];
      const catAbbr = CATEGORY_ABBR[category] || 'XX';
      const brandAbbr = brand.abbreviation || brand.name.slice(0, 3).toUpperCase();
      const sku = generateSku(brandAbbr, catAbbr, existingVariants);
      setVForm(f => ({ ...f, brand: brand.name, sku }));
    }
  }, []);

  const handleBrandChange = (brandName) => {
    const brand = brands.find(b => b.name === brandName);
    const catAbbr = CATEGORY_ABBR[category] || 'XX';
    const brandAbbr = brand?.abbreviation || brandName.slice(0, 3).toUpperCase();
    const sku = generateSku(brandAbbr, catAbbr, existingVariants);
    setVForm(f => ({ ...f, brand: brandName, sku }));
  };

  const handleImages = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setVForm(f => ({ ...f, imageFiles: [...f.imageFiles, ...files] }));
    setImagePreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (i) => {
    setVForm(f => ({ ...f, imageFiles: f.imageFiles.filter((_, idx) => idx !== i) }));
    setImagePreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleAdd = () => {
    if (!vForm.sku.trim() || !vForm.brand) return;
    const brand = brands.find(b => b.name === vForm.brand);
    onAdd({
      tempId: Math.random().toString(36).slice(2),
      brand: vForm.brand,
      sku: vForm.sku,
      color: brand?.color || '#000000',
      imageFiles: vForm.imageFiles,
    });
    // Reset form and auto-generate next SKU for next variant
    const catAbbr = CATEGORY_ABBR[category] || 'XX';
    const allExisting = [...existingVariants, { sku: vForm.sku }];
    const nextBrand = brands.find(b => b.name !== vForm.brand) || brands[0];
    const nextAbbr = nextBrand?.abbreviation || nextBrand?.name.slice(0, 3).toUpperCase() || '';
    const nextSku = generateSku(nextAbbr, catAbbr, allExisting);
    setVForm({ brand: nextBrand?.name || brands[0]?.name || '', sku: nextSku, imageFiles: [] });
    setImagePreviews([]);
  };

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Add Variant</div>
      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginBottom: 12 }}>
        <div className="form-group">
          <label>Brand</label>
          <select value={vForm.brand} onChange={e => handleBrandChange(e.target.value)}>
            {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>SKU (auto-generated, editable)</label>
          <input
            value={vForm.sku}
            onChange={e => setVForm(f => ({ ...f, sku: e.target.value }))}
            placeholder="e.g. BRH_DW_001"
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>
      </div>
      <div className="form-group full" style={{ marginBottom: 12 }}>
        <label>Variant Images (optional)</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {imagePreviews.map((src, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={src} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
              <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--red)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
            </div>
          ))}
          <label style={{ width: 56, height: 56, border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', gap: 2 }}>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImages} />
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 9 }}>Add</span>
          </label>
        </div>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={handleAdd} disabled={!vForm.sku.trim()}>{Icon.plus} Add Variant</button>
    </div>
  );
}

// ── SUBMIT NEW ITEM ────────────────────────────────────────────────────────
export function SupplierSubmitItem({ brands, onRefresh, toast }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({ name: '', category: CATEGORIES[0], moq: '', unit_price: '', production_lead_days: 30, shipping_lead_days: 45 });
  const [variants, setVariants] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.moq || !form.unit_price) return;
    setSaving(true);
    try {
      let imageUrl = null;
      if (imageFile) imageUrl = await uploadImage(imageFile, 'products');

      const { data: product, error } = await supabase.from('products').insert({
        name: form.name, category: form.category,
        moq: parseInt(form.moq), unit_price: parseFloat(form.unit_price),
        production_lead_days: parseInt(form.production_lead_days),
        shipping_lead_days: parseInt(form.shipping_lead_days),
        status: 'pending_approval', image_url: imageUrl, submitted_by: profile?.id,
      }).select().single();
      if (error) throw error;

      for (const v of variants) {
        const { data: variant } = await supabase.from('product_variants').insert({
          product_id: product.id, brand: v.brand, sku: v.sku, color: v.color,
        }).select().single();
        if (!variant) continue;

        // Upload images only if present — image is optional
        const files = v.imageFiles?.filter(f => f instanceof File) || [];
        for (let i = 0; i < files.length; i++) {
          const url = await uploadImage(files[i], 'variants');
          if (url) {
            await supabase.from('variant_images').insert({ variant_id: variant.id, image_url: url, sort_order: i });
            // Set first as main image_url
            if (i === 0) await supabase.from('product_variants').update({ image_url: url }).eq('id', variant.id);
          }
        }
      }

      // Notify admins
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      if (admins?.length) await notifyUsers(admins.map(u => u.id), 'product_pending', 'New Item for Approval', `"${form.name}" has been submitted for catalog approval.`, { product_id: product.id });

      toast(`Submitted with ${variants.length} variant${variants.length !== 1 ? 's' : ''}`, 'success');
      setForm({ name: '', category: CATEGORIES[0], moq: '', unit_price: '', production_lead_days: 30, shipping_lead_days: 45 });
      setVariants([]); setImageFile(null); setStep(1);
      onRefresh();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setSaving(false);
  };

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">Submit New Item</div><div className="section-desc">For HoM approval before going live</div></div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className={`filter-chip${step === 1 ? ' active' : ''}`} onClick={() => setStep(1)}>1 · Details</span>
          <span className={`filter-chip${step === 2 ? ' active' : ''}`} onClick={() => setStep(2)}>2 · Variants {variants.length > 0 && `(${variants.length})`}</span>
        </div>
      </div>

      {step === 1 && (
        <div className="card" style={{ padding: 24, maxWidth: 640 }}>
          <div className="form-grid">
            <div className="form-group full"><label>Product Name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ceramic Mug" autoFocus /></div>
            <div className="form-group"><label>Category</label><select value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div className="form-group"><label>MOQ (shared across all brands)</label><input type="number" value={form.moq} onChange={e => set('moq', e.target.value)} placeholder="500" /></div>
            <div className="form-group"><label>Unit Price (USD)</label><input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="2.80" /></div>
            <div className="form-group"><label>Production Lead (days)</label><input type="number" value={form.production_lead_days} onChange={e => set('production_lead_days', e.target.value)} /></div>
            <div className="form-group"><label>Shipping Lead (days)</label><input type="number" value={form.shipping_lead_days} onChange={e => set('shipping_lead_days', e.target.value)} /></div>
            <div className="form-group full">
              <label>Default Product Image</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--bg)' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setImageFile(e.target.files[0])} />
                {imageFile
                  ? <><img src={URL.createObjectURL(imageFile)} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius)' }} /><span style={{ fontSize: 11, color: 'var(--green)' }}>✓ {imageFile.name}</span></>
                  : <><span style={{ color: 'var(--text-muted)' }}>{Icon.upload}</span><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click to upload</span></>
                }
              </label>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setStep(2)} disabled={!form.name || !form.moq || !form.unit_price}>Next: Add Brand Variants →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: 24, maxWidth: 760 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Add one variant per brand. Images are optional but recommended. MOQ <strong>{form.moq}</strong> shared across all variants.
          </div>
          {variants.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>No variants yet</div>}
          {variants.map((v, idx) => (
            <div key={v.tempId} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12 }}><strong>{v.brand}</strong> — {v.sku}</span>
              {/* Inline image upload for this variant */}
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
                  const files = Array.from(e.target.files);
                  setVariants(vs => vs.map((x, i) => i === idx ? { ...x, imageFiles: [...(x.imageFiles || []), ...files] } : x));
                }} />
                {v.imageFiles?.filter(f => f instanceof File).length > 0
                  ? <span style={{ color: 'var(--green)' }}>✓ {v.imageFiles.filter(f => f instanceof File).length} image{v.imageFiles.filter(f => f instanceof File).length !== 1 ? 's' : ''} · Change</span>
                  : <span style={{ color: 'var(--text-muted)', padding: '3px 8px', border: '1px dashed var(--border-strong)', borderRadius: 4 }}>{Icon.upload} Add image</span>
                }
              </label>
              <button className="btn btn-ghost btn-sm" onClick={() => setVariants(vs => vs.filter((_, i) => i !== idx))} style={{ color: 'var(--red)', padding: 4 }}>{Icon.trash}</button>
            </div>
          ))}

          <VariantForm brands={brands} category={form.category} existingVariants={variants} onAdd={(v) => setVariants(prev => [...prev, v])} />

          <div className="divider" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving || variants.length === 0}>
              {saving ? 'Submitting…' : `Submit for Approval (${variants.length} variant${variants.length !== 1 ? 's' : ''})`}
            </button>
            {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Uploading, please wait…</span>}
            <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => {
              if (window.confirm('Reset the entire form?')) {
                setForm({ name: '', category: CATEGORIES[0], moq: '', unit_price: '', production_lead_days: 30, shipping_lead_days: 45 });
                setVariants([]); setImageFile(null); setStep(1);
              }
            }}>Reset Form</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MY SUBMISSIONS ─────────────────────────────────────────────────────────
export function SupplierSubmissions({ products, brands, onRefresh, toast }) {
  const { profile } = useAuth();
  const [editModal, setEditModal] = useState(null);
  const myItems = products.filter(p => p.submitted_by === profile?.id);

  return (
    <div>
      <div className="section-header"><div><div className="section-title">My Submissions</div><div className="section-desc">Items you've submitted</div></div></div>
      {myItems.length === 0 && <div className="empty"><div className="empty-icon">◻</div><div className="empty-title">No submissions yet</div></div>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Category</th><th>MOQ</th><th>Price</th><th>Variants</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {myItems.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.name}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{p.category}</td>
                <td>{p.moq}</td>
                <td>${p.unit_price}</td>
                <td>{p.product_variants?.length || 0}</td>
                <td>
                  <span className={`badge ${p.status === 'active' ? 'badge-green' : p.status === 'pending_approval' ? 'badge-amber' : p.status === 'rejected' ? 'badge-red' : 'badge-grey'}`}>
                    {p.status === 'pending_approval' ? 'Pending' : p.status}
                  </span>
                </td>
                <td>
                  {(p.status === 'pending_approval' || p.status === 'rejected') && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditModal(p)}>{Icon.edit} Edit</button>
                  )}
                  {p.status === 'rejected' && p.rejection_comment && (
                    <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>Reason: {p.rejection_comment}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editModal && <SupplierEditModal product={editModal} brands={brands} onClose={() => setEditModal(null)} onSave={() => { setEditModal(null); onRefresh(); }} toast={toast} />}
    </div>
  );
}

// ── EDIT MODAL ─────────────────────────────────────────────────────────────
function SupplierEditModal({ product, brands, onClose, onSave, toast }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({ name: product.name, category: product.category, moq: product.moq, unit_price: product.unit_price, production_lead_days: product.production_lead_days, shipping_lead_days: product.shipping_lead_days });
  const [variants, setVariants] = useState((product.product_variants || []).map(v => ({ ...v, isExisting: true, toDelete: false })));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await supabase.from('products').update({ ...form, moq: parseInt(form.moq), unit_price: parseFloat(form.unit_price), status: 'pending_approval', updated_at: new Date().toISOString() }).eq('id', product.id);
      for (const v of variants.filter(x => x.isExisting && x.toDelete)) await supabase.from('product_variants').delete().eq('id', v.id);
      for (const v of variants.filter(x => !x.isExisting)) {
        const { data: newV } = await supabase.from('product_variants').insert({ product_id: product.id, brand: v.brand, sku: v.sku, color: v.color }).select().single();
        if (newV) {
          const files = (v.imageFiles || []).filter(f => f instanceof File);
          for (let i = 0; i < files.length; i++) {
            const url = await uploadImage(files[i], 'variants');
            if (url) {
              await supabase.from('variant_images').insert({ variant_id: newV.id, image_url: url, sort_order: i });
              if (i === 0) await supabase.from('product_variants').update({ image_url: url }).eq('id', newV.id);
            }
          }
        }
      }
      // Notify admins
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      if (admins?.length) await notifyUsers(admins.map(u => u.id), 'product_pending', 'Item Updated — Needs Approval', `"${form.name}" has been updated and resubmitted.`, { product_id: product.id });
      toast('Updated and resubmitted', 'success');
      onSave();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setSaving(false);
  };

  return (
    <Modal title="Edit Item" subtitle="Changes will resubmit for HoM approval" onClose={onClose} wide
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & Resubmit'}</button></>}
    >
      <div className="form-grid">
        <div className="form-group full"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
        <div className="form-group"><label>Category</label><select value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="form-group"><label>MOQ</label><input type="number" value={form.moq} onChange={e => set('moq', e.target.value)} /></div>
        <div className="form-group"><label>Unit Price</label><input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} /></div>
        <div className="form-group"><label>Production Lead (days)</label><input type="number" value={form.production_lead_days} onChange={e => set('production_lead_days', e.target.value)} /></div>
        <div className="form-group"><label>Shipping Lead (days)</label><input type="number" value={form.shipping_lead_days} onChange={e => set('shipping_lead_days', e.target.value)} /></div>
      </div>
      <div className="divider" />
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Variants</div>
      {variants.filter(v => v.isExisting).map(v => (
        <div className="variant-row" key={v.id} style={{ opacity: v.toDelete ? 0.4 : 1 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block' }} />
          <span style={{ flex: 1, fontSize: 12 }}><strong>{v.brand}</strong> — {v.sku}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setVariants(vs => vs.map(x => x.id === v.id ? { ...x, toDelete: !x.toDelete } : x))} style={{ color: v.toDelete ? 'var(--green)' : 'var(--red)', fontSize: 10, padding: '4px 8px' }}>
            {v.toDelete ? 'Undo' : 'Remove'}
          </button>
        </div>
      ))}
      {variants.filter(v => !v.isExisting).map(v => (
        <div className="variant-row" key={v.tempId}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block' }} />
          <span style={{ flex: 1, fontSize: 12 }}><strong>{v.brand}</strong> — {v.sku} <span style={{ color: 'var(--blue)', fontSize: 10 }}>New</span></span>
          <button className="btn btn-ghost btn-sm" onClick={() => setVariants(vs => vs.filter(x => x.tempId !== v.tempId))} style={{ color: 'var(--red)', padding: 4 }}>{Icon.trash}</button>
        </div>
      ))}
      <VariantForm brands={brands} category={form.category} existingVariants={variants} onAdd={(v) => setVariants(prev => [...prev, { ...v, isExisting: false }])} />
    </Modal>
  );
}

// ── SUPPLIER ORDERS ────────────────────────────────────────────────────────
export function SupplierOrders({ products, orders, shipments, onRefresh, toast }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState('moq_reached');
  const [selected, setSelected] = useState(null);
  const [acceptModal, setAcceptModal] = useState(null);

  // Group standard orders by product to show consolidated view per item
  const productGroups = {};
  orders.filter(o => o.type === 'standard').forEach(o => {
    const p = products.find(x => x.id === o.product_id);
    const v = p?.product_variants?.find(x => x.id === o.variant_id);
    if (!productGroups[o.product_id]) productGroups[o.product_id] = { product: p, orders: [] };
    productGroups[o.product_id].orders.push({ ...o, product: p, variant: v });
  });

  const statusGroups = {
    moq_reached: Object.values(productGroups).filter(g => g.orders.some(o => o.status === 'moq_reached')),
    accepted: Object.values(productGroups).filter(g => g.orders.some(o => o.status === 'accepted')),
    in_production: Object.values(productGroups).filter(g => g.orders.some(o => o.status === 'in_production')),
    dispatched: Object.values(productGroups).filter(g => g.orders.some(o => o.status === 'dispatched')),
    delivered: Object.values(productGroups).filter(g => g.orders.some(o => ['arrived','delivered'].includes(o.status))),
  };

  const tabs = [
    { key: 'moq_reached', label: 'Awaiting Acceptance' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'in_production', label: 'In Production' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'delivered', label: 'Done' },
  ];

  const visible = statusGroups[tab] || [];

  const advanceAllOrders = async (productId, status) => {
    const productOrders = orders.filter(o => o.product_id === productId && o.type === 'standard');
    for (const o of productOrders) {
      await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', o.id);
      await supabase.from('timeline_log').insert({ order_id: o.id, stage: status, actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    }
    // Notify market managers
    const placedByIds = [...new Set(productOrders.map(o => o.placed_by).filter(Boolean))];
    const product = products.find(x => x.id === productId);
    if (placedByIds.length) {
      await notifyUsers(placedByIds, 'order_update', `Order Update`, `Your order for "${product?.name}" is now: ${status.replace(/_/g, ' ')}.`, { product_id: productId });
    }
    toast('Status updated', 'success');
    onRefresh();
  };

  return (
    <div>
      <div className="section-header"><div><div className="section-title">Orders</div><div className="section-desc">Grouped by product — all markets</div></div></div>
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {statusGroups[t.key]?.length > 0 && <span className="badge badge-amber" style={{ marginLeft: 6, padding: '1px 6px' }}>{statusGroups[t.key].length}</span>}
          </div>
        ))}
      </div>

      {visible.length === 0 && <div className="empty"><div className="empty-icon">○</div><div className="empty-title">Nothing here</div></div>}

      {visible.map(({ product, orders: grpOrders }) => {
        const totalQty = grpOrders.reduce((s, o) => s + o.qty, 0);
        const repOrder = grpOrders[0];
        return (
          <div key={product?.id} className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              {product?.image_url && <img src={product.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500 }}>{product?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{grpOrders.length} market order{grpOrders.length !== 1 ? 's' : ''} · {totalQty} total units</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {tab === 'moq_reached' && <button className="btn btn-sm btn-success" onClick={() => setAcceptModal(grpOrders)}>{Icon.check} Accept All</button>}
                {tab === 'accepted' && <button className="btn btn-sm btn-secondary" onClick={() => advanceAllOrders(product?.id, 'in_production')}>Start Production</button>}
                {tab === 'in_production' && <button className="btn btn-sm btn-secondary" onClick={() => setSelected(repOrder)}>Manage Dispatch →</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(repOrder)}>{Icon.eye}</button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ padding: '6px 18px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left' }}>Market</th><th style={{ padding: '6px 18px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left' }}>Brand</th><th style={{ padding: '6px 18px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left' }}>Qty</th><th style={{ padding: '6px 18px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left' }}>Status</th></tr></thead>
              <tbody>
                {grpOrders.map(o => (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 18px', fontSize: 12 }}><span className="badge badge-grey">{o.market}</span></td>
                    <td style={{ padding: '8px 18px', fontSize: 12 }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: o.variant?.color, display: 'inline-block' }} />{o.variant?.brand}</span></td>
                    <td style={{ padding: '8px 18px', fontSize: 12 }}>{o.qty}</td>
                    <td style={{ padding: '8px 18px' }}><StageBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {acceptModal && <AcceptModal orders={acceptModal} products={products} onClose={() => setAcceptModal(null)} onRefresh={onRefresh} toast={toast} profile={profile} />}
      {selected && (
        <OrderDetailModal order={selected} product={selected.product} shipments={shipments.filter(s => s.order_id === selected.id)} onClose={() => setSelected(null)} onRefresh={onRefresh} toast={toast} readOnly={false} />
      )}
    </div>
  );
}

// ── ACCEPT MODAL ───────────────────────────────────────────────────────────
function AcceptModal({ orders, products, onClose, onRefresh, toast, profile }) {
  const [form, setForm] = useState({ unit_cost: '', payment_terms: '', estimated_completion: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const product = products.find(x => x.id === orders[0]?.product_id);
  const totalQty = orders.reduce((s, o) => s + o.qty, 0);

  const accept = async () => {
    if (!form.unit_cost) return;
    setSaving(true);
    const unitCost = parseFloat(form.unit_cost);
    const catalogPrice = product?.unit_price || 0;
    const needsCostApproval = catalogPrice > 0 && unitCost > catalogPrice * 1.05;

    for (const o of orders) {
      await supabase.from('orders').update({
        status: needsCostApproval ? 'accepted' : 'accepted',
        unit_cost: unitCost,
        payment_terms: form.payment_terms,
        estimated_completion: form.estimated_completion || null,
        notes: form.notes,
        accepted_by: profile?.id,
        accepted_at: new Date().toISOString(),
        cost_approval_status: needsCostApproval ? 'pending' : null,
        updated_at: new Date().toISOString(),
      }).eq('id', o.id);
      await supabase.from('timeline_log').insert({ order_id: o.id, stage: 'accepted', planned_date: form.estimated_completion || null, actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    }

    // Notify all market managers who placed orders
    const placedByIds = [...new Set(orders.map(o => o.placed_by).filter(Boolean))];
    const msg = needsCostApproval
      ? `Your order for "${product?.name}" has been accepted at $${unitCost}/unit. Note: this is more than 5% above the catalog price ($${catalogPrice}) — your approval is required.`
      : `Your order for "${product?.name}" has been accepted at $${unitCost}/unit. Est. completion: ${form.estimated_completion || 'TBD'}.`;
    await notifyUsers(placedByIds, needsCostApproval ? 'cost_approval_required' : 'order_accepted', needsCostApproval ? 'Cost Approval Required' : 'Order Accepted', msg, { product_id: product?.id });

    toast(needsCostApproval ? 'Order accepted — cost approval sent to markets' : 'Order accepted', 'success');
    setSaving(false);
    onRefresh();
    onClose();
  };

  return (
    <Modal title="Accept Order" subtitle={`${product?.name} · ${totalQty} total units across ${orders.length} market${orders.length !== 1 ? 's' : ''}`} onClose={onClose}
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-success btn-sm" onClick={accept} disabled={saving || !form.unit_cost}>{saving ? 'Saving…' : 'Accept Order'}</button></>}
    >
      {product && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, padding: '8px 12px', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)' }}>Catalog price: <strong>${product.unit_price}</strong>. If confirmed unit cost is &gt;5% higher, markets will need to re-approve.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group"><label>Confirmed Unit Cost (USD) *</label><input type="number" step="0.01" value={form.unit_cost} onChange={e => set('unit_cost', e.target.value)} placeholder="e.g. 2.50" autoFocus /></div>
        <div className="form-group"><label>Payment Terms</label><input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="e.g. 30% deposit, 70% before shipment" /></div>
        <div className="form-group"><label>Estimated Completion Date</label><input type="date" value={form.estimated_completion} onChange={e => set('estimated_completion', e.target.value)} /></div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" /></div>
      </div>
    </Modal>
  );
}

// ── SUPPLIER CONSOLIDATED ──────────────────────────────────────────────────
export function SupplierConsolidated({ products, orders, onRefresh, toast }) {
  const activeProducts = products.filter(p => p.status === 'active' && orders.some(o => o.product_id === p.id && o.type === 'standard'));
  return (
    <div>
      <div className="section-header"><div><div className="section-title">Consolidated View</div><div className="section-desc">Total demand per item across all markets</div></div></div>
      {activeProducts.length === 0 && <div className="empty"><div className="empty-icon">○</div><div className="empty-title">No orders yet</div></div>}
      {activeProducts.map(p => {
        const productOrders = orders.filter(o => o.product_id === p.id && o.type === 'standard');
        const totalQty = productOrders.reduce((s, o) => s + o.qty, 0);
        const pct = Math.min(100, Math.round((totalQty / p.moq) * 100));
        const reached = pct >= 100;
        return (
          <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              {p.image_url && <img src={p.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} />}
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
            <div style={{ padding: '8px 20px 4px' }}>
              <div className="moq-section">
                <div className="moq-label"><span>MOQ Progress</span><strong>{totalQty} / {p.moq}</strong></div>
                <div className="moq-track"><div className={`moq-fill${reached ? ' reached' : pct >= 70 ? ' close' : ''}`} style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Brand</th><th>SKU</th><th>Nigeria</th><th>Ghana</th><th>International</th><th>Total</th></tr></thead>
                <tbody>
                  {p.product_variants?.map(v => {
                    const byMarket = { Nigeria: 0, Ghana: 0, International: 0 };
                    productOrders.filter(o => o.variant_id === v.id).forEach(o => { byMarket[o.market] = (byMarket[o.market] || 0) + o.qty; });
                    const total = Object.values(byMarket).reduce((a, b) => a + b, 0);
                    return (
                      <tr key={v.id}>
                        <td><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ background: v.color, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /><strong>{v.brand}</strong></span></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{v.sku}</td>
                        {['Nigeria','Ghana','International'].map(m => <td key={m} style={{ color: byMarket[m] > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{byMarket[m] || '—'}</td>)}
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

// ── SAMPLES ────────────────────────────────────────────────────────────────
export function SupplierSamples({ products, orders, onRefresh, toast }) {
  const { profile } = useAuth();
  const [detailModal, setDetailModal] = useState(null);
  const samples = orders.filter(o => o.type === 'sample').map(o => ({
    ...o,
    product: products.find(x => x.id === o.product_id),
    variant: products.find(x => x.id === o.product_id)?.product_variants?.find(v => v.id === o.variant_id),
  }));

  const acknowledge = async (order) => {
    setDetailModal(order);
  };

  return (
    <div>
      <div className="section-header"><div><div className="section-title">Samples</div><div className="section-desc">Sample requests from market managers</div></div></div>
      {samples.length === 0 && <div className="empty"><div className="empty-icon">◻</div><div className="empty-title">No sample requests</div></div>}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Brand</th><th>Market</th><th>Qty</th><th>Status</th><th>Sample Cost</th><th>ETA</th><th>Requested</th><th></th></tr></thead>
          <tbody>
            {samples.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 500 }}>{o.product?.name}</td>
                <td>{o.variant && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: o.variant.color, display: 'inline-block' }} />{o.variant.brand}</span>}</td>
                <td><span className="badge badge-grey">{o.market}</span></td>
                <td>{o.qty}</td>
                <td><StageBadge status={o.status} type="sample" /></td>
                <td style={{ color: 'var(--text-secondary)' }}>{o.sample_cost ? `$${o.sample_cost}` : '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{o.sample_eta || '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{o.placed_at?.slice(0, 10)}</td>
                <td>
                  {o.status === 'collecting' && <button className="btn btn-sm btn-secondary" onClick={() => acknowledge(o)}>Acknowledge →</button>}
                  {o.status === 'accepted' && <button className="btn btn-sm btn-secondary" onClick={() => setDetailModal(o)}>Update</button>}
                  {o.status === 'pending_approval' && <span className="badge badge-amber">Awaiting market approval</span>}
                  {o.status === 'dispatched' && <button className="btn btn-sm btn-secondary" onClick={async () => {
                    await supabase.from('orders').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', o.id);
                    await supabase.from('timeline_log').insert({ order_id: o.id, stage: 'delivered', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
                    if (o.placed_by) await supabase.from('notifications').insert({ user_id: o.placed_by, type: 'sample_delivered', title: 'Sample Delivered', message: `Your sample of "${o.product?.name}" has been marked as delivered.`, order_id: o.id });
                    toast('Sample marked delivered', 'success'); onRefresh();
                  }}>Mark Received</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detailModal && <SampleAcknowledgeModal order={detailModal} product={detailModal.product} onClose={() => setDetailModal(null)} onRefresh={onRefresh} toast={toast} profile={profile} />}
    </div>
  );
}

// ── SAMPLE ACKNOWLEDGE MODAL ───────────────────────────────────────────────
function SampleAcknowledgeModal({ order, product, onClose, onRefresh, toast, profile }) {
  const [form, setForm] = useState({ sample_cost: order.sample_cost || '', sample_eta: order.sample_eta || '', notes: order.notes || '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.sample_cost || !form.sample_eta) return;
    setSaving(true);
    await supabase.from('orders').update({
      status: 'pending_approval',
      sample_cost: parseFloat(form.sample_cost),
      sample_eta: form.sample_eta,
      notes: form.notes,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: 'accepted', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    // Notify market manager
    if (order.placed_by) {
      await supabase.from('notifications').insert({ user_id: order.placed_by, type: 'sample_pending_approval', title: 'Sample Approval Required', message: `Your sample of "${product?.name}" costs $${form.sample_cost} and will arrive by ${form.sample_eta}. Please approve or reject.`, order_id: order.id });
    }
    toast('Sample details sent for market approval', 'success');
    setSaving(false);
    onRefresh();
    onClose();
  };

  return (
    <Modal title="Acknowledge Sample Request" subtitle={`${order.market} · ${order.qty} unit(s) of ${product?.name}`} onClose={onClose} narrow
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={submit} disabled={saving || !form.sample_cost || !form.sample_eta}>{saving ? 'Sending…' : 'Send for Approval'}</button></>}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Enter the sample cost and estimated delivery date. The market manager will need to approve before you dispatch.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group"><label>Sample Cost (USD) *</label><input type="number" step="0.01" value={form.sample_cost} onChange={e => set('sample_cost', e.target.value)} placeholder="e.g. 15.00" autoFocus /></div>
        <div className="form-group"><label>Estimated Delivery Date *</label><input type="date" value={form.sample_eta} onChange={e => set('sample_eta', e.target.value)} /></div>
        <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes for the market…" /></div>
      </div>
    </Modal>
  );
}
