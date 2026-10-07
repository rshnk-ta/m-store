import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, StageBadge, MultiImageUpload, Lightbox } from '../components/UI';
import { CATEGORIES, CATEGORY_ABBR } from '../lib/constants';
import { OrderDetailModal, ShipmentsTab, TimelineTab, ProductDetailModal } from './AdminViews';
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
    onAdd({ tempId: Math.random().toString(36).slice(2), brand: vForm.brand, sku: vForm.sku, color: brand?.color || '#000000', imageFiles: vForm.imageFiles });
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
          <input value={vForm.sku} onChange={e => setVForm(f => ({ ...f, sku: e.target.value }))} placeholder="e.g. BRH_DW_001" style={{ fontFamily: 'monospace', fontSize: 12 }} />
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
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span><span style={{ fontSize: 9 }}>Add</span>
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
  const [form, setForm] = useState({ name: '', category: CATEGORIES[0], moq: '', unit_price: '', production_lead_days: 30, carton_l: '', carton_w: '', carton_h: '', units_per_carton: '', gross_weight_kg: '', product_l: '', product_w: '', product_h: '' });
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
        carton_l: form.carton_l ? parseFloat(form.carton_l) : null,
        carton_w: form.carton_w ? parseFloat(form.carton_w) : null,
        carton_h: form.carton_h ? parseFloat(form.carton_h) : null,
        units_per_carton: form.units_per_carton ? parseInt(form.units_per_carton) : null,
        gross_weight_kg: form.gross_weight_kg ? parseFloat(form.gross_weight_kg) : null,
        product_l: form.product_l ? parseFloat(form.product_l) : null,
        product_w: form.product_w ? parseFloat(form.product_w) : null,
        product_h: form.product_h ? parseFloat(form.product_h) : null,
        status: 'pending_approval', image_url: imageUrl, submitted_by: profile?.id,
      }).select().single();
      if (error) throw error;

      for (const v of variants) {
        const { data: variant } = await supabase.from('product_variants').insert({
          product_id: product.id, brand: v.brand, sku: v.sku, color: v.color,
        }).select().single();
        if (!variant) continue;
        const files = v.imageFiles?.filter(f => f instanceof File) || [];
        for (let i = 0; i < files.length; i++) {
          const url = await uploadImage(files[i], 'variants');
          if (url) {
            await supabase.from('variant_images').insert({ variant_id: variant.id, image_url: url, sort_order: i });
            if (i === 0) await supabase.from('product_variants').update({ image_url: url }).eq('id', variant.id);
          }
        }
      }

      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
      if (admins?.length) await notifyUsers(admins.map(u => u.id), 'product_pending', 'New Item for Approval', `"${form.name}" has been submitted for catalog approval.`, { product_id: product.id });

      toast(`Submitted with ${variants.length} variant${variants.length !== 1 ? 's' : ''}`, 'success');
      setForm({ name: '', category: CATEGORIES[0], moq: '', unit_price: '', production_lead_days: 30, carton_l: '', carton_w: '', carton_h: '', units_per_carton: '', gross_weight_kg: '', product_l: '', product_w: '', product_h: '' });
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
            <div className="form-group full" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Carton / Packaging Info</div>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group"><label>Carton L (cm)</label><input type="number" step="0.1" value={form.carton_l} onChange={e => set('carton_l', e.target.value)} placeholder="60" /></div>
                <div className="form-group"><label>Carton W (cm)</label><input type="number" step="0.1" value={form.carton_w} onChange={e => set('carton_w', e.target.value)} placeholder="40" /></div>
                <div className="form-group"><label>Carton H (cm)</label><input type="number" step="0.1" value={form.carton_h} onChange={e => set('carton_h', e.target.value)} placeholder="30" /></div>
                <div className="form-group"><label>Units / Carton</label><input type="number" value={form.units_per_carton} onChange={e => set('units_per_carton', e.target.value)} placeholder="12" /></div>
                <div className="form-group"><label>Gross Weight (kg)</label><input type="number" step="0.01" value={form.gross_weight_kg} onChange={e => set('gross_weight_kg', e.target.value)} placeholder="8.5" /></div>
                <div className="form-group"><label>Product L (cm) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opt.</span></label><input type="number" step="0.1" value={form.product_l} onChange={e => set('product_l', e.target.value)} placeholder="15" /></div>
                <div className="form-group"><label>Product W (cm) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opt.</span></label><input type="number" step="0.1" value={form.product_w} onChange={e => set('product_w', e.target.value)} placeholder="10" /></div>
                <div className="form-group"><label>Product H (cm) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opt.</span></label><input type="number" step="0.1" value={form.product_h} onChange={e => set('product_h', e.target.value)} placeholder="5" /></div>
              </div>
            </div>
            <div className="form-group full">
              <label>Default Product Image</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', background: 'var(--bg)' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setImageFile(e.target.files[0])} />
                {imageFile ? <><img src={URL.createObjectURL(imageFile)} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius)' }} /><span style={{ fontSize: 11, color: 'var(--green)' }}>✓ {imageFile.name}</span></> : <><span style={{ color: 'var(--text-muted)' }}>{Icon.upload}</span><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click to upload</span></>}
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
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>Add one variant per brand. Images are optional but recommended. MOQ <strong>{form.moq}</strong> shared across all variants.</div>
          {variants.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>No variants yet</div>}
          {variants.map((v, idx) => (
            <div key={v.tempId} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: v.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12 }}><strong>{v.brand}</strong> — {v.sku}</span>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
                  const files = Array.from(e.target.files);
                  setVariants(vs => vs.map((x, i) => i === idx ? { ...x, imageFiles: [...(x.imageFiles || []), ...files] } : x));
                }} />
                {v.imageFiles?.filter(f => f instanceof File).length > 0 ? <span style={{ color: 'var(--green)' }}>✓ {v.imageFiles.filter(f => f instanceof File).length} image{v.imageFiles.filter(f => f instanceof File).length !== 1 ? 's' : ''} · Change</span> : <span style={{ color: 'var(--text-muted)', padding: '3px 8px', border: '1px dashed var(--border-strong)', borderRadius: 4 }}>{Icon.upload} Add image</span>}
              </label>
              <button className="btn btn-ghost btn-sm" onClick={() => setVariants(vs => vs.filter((_, i) => i !== idx))} style={{ color: 'var(--red)', padding: 4 }}>{Icon.trash}</button>
            </div>
          ))}
          <VariantForm brands={brands} category={form.category} existingVariants={variants} onAdd={(v) => setVariants(prev => [...prev, v])} />
          <div className="divider" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving || variants.length === 0}>{saving ? 'Submitting…' : `Submit for Approval (${variants.length} variant${variants.length !== 1 ? 's' : ''})`}</button>
            {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Uploading, please wait…</span>}
            <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => {
              if (window.confirm('Reset the entire form?')) {
                setForm({ name: '', category: CATEGORIES[0], moq: '', unit_price: '', production_lead_days: 30, carton_l: '', carton_w: '', carton_h: '', units_per_carton: '', gross_weight_kg: '', product_l: '', product_w: '', product_h: '' });
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
  // Only show pending / rejected items here — active items have their own section
  const myItems = products.filter(p => p.submitted_by === profile?.id && (p.status === 'pending_approval' || p.status === 'rejected' || p.status === 'draft'));

  return (
    <div>
      <div className="section-header"><div><div className="section-title">My Submissions</div><div className="section-desc">Pending and rejected items</div></div></div>
      {myItems.length === 0 && <div className="empty"><div className="empty-icon">◻</div><div className="empty-title">No pending submissions</div><div className="empty-desc">Active items are managed in "My Active Catalogue"</div></div>}
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
                  <span className={`badge ${p.status === 'pending_approval' ? 'badge-amber' : p.status === 'rejected' ? 'badge-red' : 'badge-grey'}`}>
                    {p.status === 'pending_approval' ? 'Pending' : p.status}
                  </span>
                </td>
                <td>
                  {(p.status === 'pending_approval' || p.status === 'rejected') && <button className="btn btn-secondary btn-sm" onClick={() => setEditModal(p)}>{Icon.edit} Edit</button>}
                  {p.status === 'rejected' && p.rejection_comment && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>Reason: {p.rejection_comment}</div>}
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

// ── ACTIVE CATALOGUE MANAGEMENT ────────────────────────────────────────────
// Supplier can edit or deactivate items they submitted that are currently active.
// Every change is logged to product_change_log; if scope = 'all_collecting',
// all collecting orders for that product get an order_reapproval entry and the
// market managers are notified.
export function SupplierActiveCatalogue({ products, orders, brands, onRefresh, toast }) {
  const { profile } = useAuth();
  const [detailModal, setDetailModal] = useState(null);
  const [changeModal, setChangeModal] = useState(null); // { product, mode: 'edit'|'deactivate' }
  const [historyModal, setHistoryModal] = useState(null);

  const myActive = products.filter(p => p.submitted_by === profile?.id && p.status === 'active');

  const openEdit = (p) => setChangeModal({ product: p, mode: 'edit' });
  const openDeactivate = (p) => setChangeModal({ product: p, mode: 'deactivate' });
  const openHistory = (p) => setHistoryModal(p);

  return (
    <div>
      <div className="section-header">
        <div><div className="section-title">My Active Catalogue</div><div className="section-desc">{myActive.length} live item{myActive.length !== 1 ? 's' : ''}</div></div>
      </div>

      {myActive.length === 0 && (
        <div className="empty"><div className="empty-icon">◻</div><div className="empty-title">No active items yet</div><div className="empty-desc">Once an item is approved it appears here</div></div>
      )}

      <div className="card-grid">
        {myActive.map(p => {
          const activeOrders = orders.filter(o => o.product_id === p.id && o.type === 'standard' && o.status !== 'cancelled');
          const hasCollecting = activeOrders.some(o => o.status === 'collecting');
          return (
            <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Card header — clickable to view details */}
              <div style={{ cursor: 'pointer', padding: 16, flex: 1 }} onClick={() => setDetailModal(p)}>
                {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 'var(--radius)', marginBottom: 12 }} onError={e => e.target.style.display = 'none'} />}
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{p.category} · ${p.unit_price}/unit · MOQ {p.moq}</div>
                {activeOrders.length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                    <span>{activeOrders.length} active order{activeOrders.length !== 1 ? 's' : ''}</span>
                    {hasCollecting && <span style={{ color: 'var(--accent-warm)' }}>· collecting</span>}
                  </div>
                )}
              </div>
              {/* Action row */}
              <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(p)}>{Icon.edit} Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => openDeactivate(p)}>Deactivate</button>
                <button className="btn btn-ghost btn-sm" title="Change history" onClick={() => openHistory(p)}>⏱</button>
              </div>
            </div>
          );
        })}
      </div>

      {detailModal && <ProductDetailModal product={detailModal} onClose={() => setDetailModal(null)} />}
      {changeModal && (
        <CatalogueChangeModal
          product={changeModal.product}
          mode={changeModal.mode}
          brands={brands}
          orders={orders}
          profile={profile}
          onClose={() => setChangeModal(null)}
          onSave={() => { setChangeModal(null); onRefresh(); }}
          toast={toast}
        />
      )}
      {historyModal && <ChangeHistoryModal product={historyModal} onClose={() => setHistoryModal(null)} />}
    </div>
  );
}

// ── CATALOGUE CHANGE MODAL ─────────────────────────────────────────────────
// Handles both 'edit' and 'deactivate' flows for active catalogue items.
// Enforces:
//   • Only 'collecting' orders can be affected — orders in_production+ are untouched.
//   • If scope = 'all_collecting': create order_reapproval rows + notify market managers.
//   • Changes are logged to product_change_log with before/after snapshots.
//   • Footnote shows the supplier the limitation explicitly.
function CatalogueChangeModal({ product, mode, brands, orders, profile, onClose, onSave, toast }) {
  const isEdit = mode === 'edit';
  const [scope, setScope] = useState('new_orders_only');
  const [note, setNote] = useState('');
  const [form, setForm] = useState({
    name: product.name,
    unit_price: product.unit_price,
    moq: product.moq,
    production_lead_days: product.production_lead_days,
    carton_l: product.carton_l ?? '',
    carton_w: product.carton_w ?? '',
    carton_h: product.carton_h ?? '',
    units_per_carton: product.units_per_carton ?? '',
    gross_weight_kg: product.gross_weight_kg ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Collecting orders for this product (these can be affected by changes)
  const collectingOrders = orders.filter(o => o.product_id === product.id && o.type === 'standard' && o.status === 'collecting');
  // Orders already past collecting (cannot be affected — shown for supplier awareness)
  const lockedOrders = orders.filter(o => o.product_id === product.id && o.type === 'standard' && !['collecting', 'cancelled'].includes(o.status));

  const apply = async () => {
    setSaving(true);
    try {
      const changeType = isEdit ? 'edit' : 'deactivate';
      const oldValues = isEdit
        ? { name: product.name, unit_price: product.unit_price, moq: product.moq, production_lead_days: product.production_lead_days, carton_l: product.carton_l, carton_w: product.carton_w, carton_h: product.carton_h, units_per_carton: product.units_per_carton, gross_weight_kg: product.gross_weight_kg }
        : { status: 'active' };
      const newValues = isEdit
        ? { name: form.name, unit_price: parseFloat(form.unit_price) || product.unit_price, moq: parseInt(form.moq) || product.moq, production_lead_days: parseInt(form.production_lead_days) || product.production_lead_days, carton_l: form.carton_l ? parseFloat(form.carton_l) : null, carton_w: form.carton_w ? parseFloat(form.carton_w) : null, carton_h: form.carton_h ? parseFloat(form.carton_h) : null, units_per_carton: form.units_per_carton ? parseInt(form.units_per_carton) : null, gross_weight_kg: form.gross_weight_kg ? parseFloat(form.gross_weight_kg) : null }
        : { status: 'draft' };

      // 1. Write the change log entry
      const { data: changeLog, error: clErr } = await supabase.from('product_change_log').insert({
        product_id: product.id,
        changed_by: profile.id,
        change_type: changeType,
        scope,
        old_values: oldValues,
        new_values: newValues,
        note: note.trim() || null,
      }).select().single();
      if (clErr) throw clErr;

      // 2. Apply the product change
      if (isEdit) {
        await supabase.from('products').update({ ...newValues, updated_at: new Date().toISOString() }).eq('id', product.id);
      } else {
        // Deactivate: set to draft (hides from market catalog)
        await supabase.from('products').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', product.id);
      }

      // 3. If scope = all_collecting, create re-approval rows for each collecting order and notify markets
      if (scope === 'all_collecting' && collectingOrders.length > 0) {
        for (const o of collectingOrders) {
          await supabase.from('order_reapproval').insert({
            order_id: o.id,
            change_log_id: changeLog.id,
            status: 'pending',
          });
        }
        // Notify distinct market managers who placed these orders
        const placedByIds = [...new Set(collectingOrders.map(o => o.placed_by).filter(Boolean))];
        if (placedByIds.length > 0) {
          const msgTitle = isEdit ? `Catalogue Item Changed: ${product.name}` : `Catalogue Item Removed: ${product.name}`;
          const msgBody = isEdit
            ? `The supplier has updated "${product.name}". Your collecting order is affected — please review and re-confirm whether you want to proceed.`
            : `"${product.name}" has been deactivated by the supplier. Your collecting order is affected — please review and decide whether to proceed or cancel.`;
          await notifyUsers(placedByIds, 'reapproval_required', msgTitle, msgBody, { product_id: product.id, change_log_id: changeLog.id });
        }
      }

      const action = isEdit ? 'Item updated' : 'Item deactivated';
      const suffix = scope === 'all_collecting' && collectingOrders.length > 0
        ? ` — ${collectingOrders.length} collecting order${collectingOrders.length !== 1 ? 's' : ''} sent for market re-approval`
        : '';
      toast(`${action}${suffix}`, 'success');
      onSave();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setSaving(false);
  };

  return (
    <Modal
      title={isEdit ? `Edit: ${product.name}` : `Deactivate: ${product.name}`}
      subtitle={isEdit ? 'Changes to an active catalogue item' : 'Remove this item from the catalogue'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button className={`btn btn-sm ${isEdit ? 'btn-primary' : 'btn-danger'}`} onClick={apply} disabled={saving}>
            {saving ? 'Applying…' : isEdit ? 'Apply Changes' : 'Deactivate Item'}
          </button>
        </>
      }
    >
      {/* Scope picker */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Who does this change apply to?</div>
        <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
          {[
            { val: 'new_orders_only', label: 'New orders only', desc: 'Existing collecting orders are not affected by this change.' },
            { val: 'all_collecting', label: 'All collecting orders too', desc: 'Market managers who have placed orders will be notified and asked to re-confirm their order.' },
          ].map(opt => (
            <label key={opt.val} style={{ display: 'flex', gap: 10, cursor: 'pointer', padding: '10px 14px', border: `1px solid ${scope === opt.val ? 'var(--accent-warm)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', background: scope === opt.val ? 'var(--accent-light)' : 'var(--bg)' }}>
              <input type="radio" name="scope" value={opt.val} checked={scope === opt.val} onChange={() => setScope(opt.val)} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Live order summary for supplier awareness */}
      {(collectingOrders.length > 0 || lockedOrders.length > 0) && (
        <div style={{ marginBottom: 20, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 11 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Current Orders</div>
          {collectingOrders.length > 0 && (
            <div style={{ marginBottom: 4, color: scope === 'all_collecting' ? 'var(--accent-warm)' : 'var(--text-secondary)' }}>
              • <strong>{collectingOrders.length}</strong> order{collectingOrders.length !== 1 ? 's' : ''} in <em>collecting</em> — {scope === 'all_collecting' ? 'will be sent for re-approval' : 'will NOT be affected'}
            </div>
          )}
          {lockedOrders.length > 0 && (
            <div style={{ color: 'var(--text-muted)' }}>
              • <strong>{lockedOrders.length}</strong> order{lockedOrders.length !== 1 ? 's' : ''} already past collecting — <strong>these cannot be affected</strong>
            </div>
          )}
        </div>
      )}

      {/* Edit form (only when mode = edit) */}
      {isEdit && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Updated Details</div>
          <div className="form-grid">
            <div className="form-group full"><label>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label>Unit Price (USD)</label><input type="number" step="0.01" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} /></div>
            <div className="form-group"><label>MOQ</label><input type="number" value={form.moq} onChange={e => set('moq', e.target.value)} /></div>
            <div className="form-group"><label>Production Lead (days)</label><input type="number" value={form.production_lead_days} onChange={e => set('production_lead_days', e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Packaging (optional)</div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              <div className="form-group"><label>Carton L (cm)</label><input type="number" step="0.1" value={form.carton_l} onChange={e => set('carton_l', e.target.value)} /></div>
              <div className="form-group"><label>Carton W (cm)</label><input type="number" step="0.1" value={form.carton_w} onChange={e => set('carton_w', e.target.value)} /></div>
              <div className="form-group"><label>Carton H (cm)</label><input type="number" step="0.1" value={form.carton_h} onChange={e => set('carton_h', e.target.value)} /></div>
              <div className="form-group"><label>Units / Carton</label><input type="number" value={form.units_per_carton} onChange={e => set('units_per_carton', e.target.value)} /></div>
              <div className="form-group"><label>Gross Weight (kg)</label><input type="number" step="0.01" value={form.gross_weight_kg} onChange={e => set('gross_weight_kg', e.target.value)} /></div>
            </div>
          </div>
        </>
      )}

      {/* Optional note */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Reason / Note for markets <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={isEdit ? 'e.g. Updated carton dimensions to reflect new packaging from factory.' : 'e.g. Item discontinued by manufacturer.'} style={{ minHeight: 52 }} />
      </div>

      {/* Supplier footnote / disclaimer */}
      <div style={{ padding: '10px 14px', background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 'var(--radius-md)', fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
        <strong>Important:</strong> Changes can only affect orders still in <em>collecting</em> status. Orders that have already been accepted or are further along in production cannot be modified — they will continue under the original terms.
      </div>
    </Modal>
  );
}

// ── CHANGE HISTORY MODAL ───────────────────────────────────────────────────
function ChangeHistoryModal({ product, onClose }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('product_change_log')
      .select('*, users:changed_by(name, email)')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setLog(data || []); setLoading(false); });
  }, [product.id]);

  return (
    <Modal title={`Change History`} subtitle={product.name} onClose={onClose}>
      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 24 }}>Loading…</div>}
      {!loading && log.length === 0 && <div className="empty"><div className="empty-icon">○</div><div className="empty-title">No changes recorded</div></div>}
      {log.map(entry => {
        const scopeLabel = entry.scope === 'all_collecting' ? 'Applied to collecting orders' : 'New orders only';
        return (
          <div key={entry.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span className={`badge ${entry.change_type === 'edit' ? 'badge-blue' : entry.change_type === 'deactivate' ? 'badge-red' : 'badge-green'}`}>
                {entry.change_type}
              </span>
              <span className="badge badge-grey" style={{ fontSize: 9 }}>{scopeLabel}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {entry.note && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, fontStyle: 'italic' }}>{entry.note}</div>}
            {entry.change_type === 'edit' && entry.old_values && entry.new_values && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.keys(entry.new_values).filter(k => entry.old_values[k] !== entry.new_values[k]).map(k => (
                  <span key={k} style={{ padding: '2px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3 }}>
                    <strong>{k}</strong>: {String(entry.old_values[k] ?? '—')} → {String(entry.new_values[k] ?? '—')}
                  </span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              by {entry.users?.name || entry.users?.email || 'supplier'}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}

// ── EDIT MODAL (pending/rejected items) ───────────────────────────────────
function SupplierEditModal({ product, brands, onClose, onSave, toast }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({ name: product.name, category: product.category, moq: product.moq, unit_price: product.unit_price, production_lead_days: product.production_lead_days, carton_l: product.carton_l ?? '', carton_w: product.carton_w ?? '', carton_h: product.carton_h ?? '', units_per_carton: product.units_per_carton ?? '', gross_weight_kg: product.gross_weight_kg ?? '', product_l: product.product_l ?? '', product_w: product.product_w ?? '', product_h: product.product_h ?? '' });
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
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '14px 0 10px' }}>Carton / Packaging Info</div>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
        <div className="form-group"><label>Carton L (cm)</label><input type="number" step="0.1" value={form.carton_l} onChange={e => set('carton_l', e.target.value)} placeholder="60" /></div>
        <div className="form-group"><label>Carton W (cm)</label><input type="number" step="0.1" value={form.carton_w} onChange={e => set('carton_w', e.target.value)} placeholder="40" /></div>
        <div className="form-group"><label>Carton H (cm)</label><input type="number" step="0.1" value={form.carton_h} onChange={e => set('carton_h', e.target.value)} placeholder="30" /></div>
        <div className="form-group"><label>Units / Carton</label><input type="number" value={form.units_per_carton} onChange={e => set('units_per_carton', e.target.value)} placeholder="12" /></div>
        <div className="form-group"><label>Gross Weight (kg)</label><input type="number" step="0.01" value={form.gross_weight_kg} onChange={e => set('gross_weight_kg', e.target.value)} placeholder="8.5" /></div>
        <div className="form-group"><label>Product L (cm)</label><input type="number" step="0.1" value={form.product_l} onChange={e => set('product_l', e.target.value)} placeholder="15" /></div>
        <div className="form-group"><label>Product W (cm)</label><input type="number" step="0.1" value={form.product_w} onChange={e => set('product_w', e.target.value)} placeholder="10" /></div>
        <div className="form-group"><label>Product H (cm)</label><input type="number" step="0.1" value={form.product_h} onChange={e => set('product_h', e.target.value)} placeholder="5" /></div>
      </div>
      <div className="divider" />
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>Variants</div>
      {variants.filter(v => v.isExisting).map(v => (
        <div className="variant-row" key={v.id} style={{ opacity: v.toDelete ? 0.4 : 1, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block' }} />
          <span style={{ flex: 1, fontSize: 12 }}><strong>{v.brand}</strong> — {v.sku}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, marginRight: 8 }}>
            <input type="checkbox" checked={v.is_active !== false} onChange={async (e) => {
              await supabase.from('product_variants').update({ is_active: e.target.checked }).eq('id', v.id);
              setVariants(vs => vs.map(x => x.id === v.id ? { ...x, is_active: e.target.checked } : x));
              toast(`Variant ${e.target.checked ? 'activated' : 'deactivated'}`, 'success');
            }} />
            {v.is_active !== false ? 'Active' : 'Inactive'}
          </label>
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

  const productGroups = {};
  orders.filter(o => o.type === 'standard').forEach(o => {
    const p = products.find(x => x.id === o.product_id);
    const v = p?.product_variants?.find(x => x.id === o.variant_id);
    if (!productGroups[o.product_id]) productGroups[o.product_id] = { product: p, orders: [] };
    productGroups[o.product_id].orders.push({ ...o, product: p, variant: v });
  });

  const groupForStage = (statusMatch) => Object.values(productGroups)
    .map(g => ({ product: g.product, orders: g.orders.filter(statusMatch) }))
    .filter(g => g.orders.length > 0);

  const statusGroups = {
    moq_reached: groupForStage(o => o.status === 'collecting').filter(g => g.product?.moq_reached),
    accepted: groupForStage(o => o.status === 'accepted'),
    in_production: groupForStage(o => o.status === 'in_production'),
    dispatched: groupForStage(o => ['dispatched', 'in_transit'].includes(o.status)),
    delivered: groupForStage(o => ['arrived', 'delivered'].includes(o.status)),
    cancelled: groupForStage(o => o.status === 'cancelled'),
  };

  const tabs = [
    { key: 'moq_reached', label: 'Awaiting Acceptance' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'in_production', label: 'In Production' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'delivered', label: 'Done' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const visible = statusGroups[tab] || [];

  const advanceAllOrders = async (productId, status) => {
    const precedingStatus = { in_production: 'accepted', dispatched: 'in_production' }[status];
    const productOrders = orders.filter(o => o.product_id === productId && o.type === 'standard' && o.status === precedingStatus);
    for (const o of productOrders) {
      await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', o.id);
      await supabase.from('timeline_log').insert({ order_id: o.id, stage: status, actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    }
    const placedByIds = [...new Set(productOrders.map(o => o.placed_by).filter(Boolean))];
    const product = products.find(x => x.id === productId);
    if (placedByIds.length) await notifyUsers(placedByIds, 'order_update', 'Order Update', `Your order for "${product?.name}" is now: ${status.replace(/_/g, ' ')}.`, { product_id: productId });
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
                {tab === 'cancelled' && repOrder?.cancelled_reason && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 4 }}>{repOrder.cancelled_reason}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {tab === 'moq_reached' && <button className="btn btn-sm btn-success" onClick={() => setAcceptModal(grpOrders)}>{Icon.check} Accept All</button>}
                {tab === 'accepted' && <button className="btn btn-sm btn-secondary" onClick={() => advanceAllOrders(product?.id, 'in_production')}>Start Production</button>}
                {tab === 'in_production' && <button className="btn btn-sm btn-secondary" onClick={() => setSelected(repOrder)}>Manage Dispatch →</button>}
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(repOrder)}>{Icon.eye}</button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Market','Brand','Qty','Status'].map(h => <th key={h} style={{ padding: '6px 18px', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left' }}>{h}</th>)}
              </tr></thead>
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
      {selected && <OrderDetailModal order={selected} product={selected.product} shipments={shipments.filter(s => s.order_id === selected.id)} onClose={() => setSelected(null)} onRefresh={onRefresh} toast={toast} readOnly={false} />}
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

    const allCollecting = orders.filter(o => o.product_id === product?.id && o.type === 'standard' && o.status === 'collecting');
    for (const o of allCollecting) {
      await supabase.from('orders').update({
        status: 'accepted', unit_cost: unitCost, payment_terms: form.payment_terms,
        estimated_completion: form.estimated_completion || null, notes: form.notes,
        accepted_by: profile?.id, accepted_at: new Date().toISOString(),
        cost_approval_status: needsCostApproval ? 'pending' : null,
        updated_at: new Date().toISOString(),
      }).eq('id', o.id);
      await supabase.from('timeline_log').insert({ order_id: o.id, stage: 'accepted', planned_date: form.estimated_completion || null, actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    }

    // FIX: also reset moq_reached_at when clearing moq_reached flag
    await supabase.from('products').update({ moq_reached: false, moq_reached_at: null }).eq('id', product?.id);

    const placedByIds = [...new Set(allCollecting.map(o => o.placed_by).filter(Boolean))];
    const msg = needsCostApproval
      ? `Your order for "${product?.name}" has been accepted at $${unitCost}/unit. Note: this is >5% above catalog price — your approval is required.`
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
        // FIX: exclude cancelled orders from MOQ bar so they don't inflate the count
        const productOrders = orders.filter(o => o.product_id === p.id && o.type === 'standard' && o.status !== 'cancelled');
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
  const [dispatching, setDispatching] = useState(null);
  const samples = orders.filter(o => o.type === 'sample').map(o => ({
    ...o,
    product: products.find(x => x.id === o.product_id),
    variant: products.find(x => x.id === o.product_id)?.product_variants?.find(v => v.id === o.variant_id),
  }));

  const markDispatched = async (order) => {
    setDispatching(order.id);
    await supabase.from('orders').update({ status: 'dispatched', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: 'dispatched', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    if (order.placed_by) {
      await supabase.from('notifications').insert({ user_id: order.placed_by, type: 'sample_dispatched', title: 'Sample Dispatched', message: `Your sample of "${order.product?.name}" has been dispatched and is on its way.`, order_id: order.id });
    }
    toast('Sample marked as dispatched', 'success');
    setDispatching(null);
    onRefresh();
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
                  {o.status === 'collecting' && <button className="btn btn-sm btn-secondary" onClick={() => setDetailModal(o)}>Acknowledge →</button>}
                  {o.status === 'accepted' && <button className="btn btn-sm btn-primary" disabled={dispatching === o.id} onClick={() => markDispatched(o)}>{dispatching === o.id ? 'Dispatching…' : '↑ Mark Dispatched'}</button>}
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
    await supabase.from('orders').update({ status: 'pending_approval', sample_cost: parseFloat(form.sample_cost), sample_eta: form.sample_eta, notes: form.notes, updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: 'accepted', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
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
