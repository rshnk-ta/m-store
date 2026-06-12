import { useState, useEffect, useCallback } from 'react';
import { ORDER_STAGES, SAMPLE_STAGES, STAGE_COLORS } from '../lib/constants';

// ── ICONS ──────────────────────────────────────────────────────────────────
export const Icon = {
  catalog:  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="0.5"/><rect x="9" y="2" width="5" height="5" rx="0.5"/><rect x="2" y="9" width="5" height="5" rx="0.5"/><rect x="9" y="9" width="5" height="5" rx="0.5"/></svg>,
  orders:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h12M2 8h12M2 13h8"/></svg>,
  supply:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 5l6-3 6 3v6l-6 3-6-3z"/><path d="M8 2v12M2 5l6 3 6-3"/></svg>,
  plus:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>,
  close:    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>,
  check:    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l4 4 6-6"/></svg>,
  edit:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-8 8H3v-3z"/></svg>,
  trash:    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h10M6 5V3h4v2M5 5l1 8h4l1-8"/></svg>,
  flag:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2v12M3 2h9l-2 4 2 4H3"/></svg>,
  ship:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 11l2-6h8l2 6H2z"/><path d="M5 5V3h6v2"/><path d="M1 13h14"/></svg>,
  clock:    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>,
  sample:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2h4v6l2 6H4L6 8V2z"/><path d="M6 8h4"/></svg>,
  approve:  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l4 4 6-6"/><circle cx="8" cy="8" r="6"/></svg>,
  inbox:    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10h3l1.5 2h3L11 10h3V4H2v6z"/></svg>,
  upload:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 10V3M5 6l3-3 3 3"/><path d="M3 11v2h10v-2"/></svg>,
  eye:      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>,
  cart:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 2h2l2 7h7l1-5H5"/><circle cx="7" cy="13" r="1"/><circle cx="12" cy="13" r="1"/></svg>,
  bell:     <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2a4 4 0 014 4v3l1 2H3l1-2V6a4 4 0 014-4z"/><path d="M6.5 13a1.5 1.5 0 003 0"/></svg>,
  brands:   <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="5" r="3"/><circle cx="11" cy="11" r="3"/><path d="M8 5h5M3 11h5"/></svg>,
  image:    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 10l3-3 3 3 2-2 4 4"/><circle cx="6" cy="7" r="1"/></svg>,
};

// ── MODAL ──────────────────────────────────────────────────────────────────
export function Modal({ title, subtitle, onClose, footer, children, wide, narrow, fullscreen }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : narrow ? ' narrow' : fullscreen ? ' fullscreen' : ''}`}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-subtitle">{subtitle}</div>}
          </div>
          <button className="close-btn" onClick={onClose}>{Icon.close}</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── LIGHTBOX ───────────────────────────────────────────────────────────────
export function Lightbox({ images, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx(i => Math.min(i + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [images, onClose]);

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      {idx > 0 && <button className="lightbox-prev" onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}>‹</button>}
      <img
        className="lightbox-img"
        src={images[idx]}
        alt={`Image ${idx + 1}`}
        onClick={e => e.stopPropagation()}
      />
      {idx < images.length - 1 && <button className="lightbox-next" onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}>›</button>}
      {images.length > 1 && <div className="lightbox-counter">{idx + 1} / {images.length}</div>}
    </div>
  );
}

// ── TOAST ──────────────────────────────────────────────────────────────────
export function Toast({ message, type = 'default' }) {
  if (!message) return null;
  return <div className={`toast ${type}`}>{message}</div>;
}

// ── SPINNER ────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

// ── STAGE BADGE ───────────────────────────────────────────────────────────
export function StageBadge({ status, type = 'standard' }) {
  const stages = type === 'sample' ? SAMPLE_STAGES : ORDER_STAGES;
  const stage = stages.find(s => s.key === status);
  const colors = STAGE_COLORS[status] || { bg: '#F5F0E8', text: '#92400E' };
  return (
    <span className="badge" style={{ background: colors.bg, color: colors.text }}>
      {stage?.label || status}
    </span>
  );
}

// ── LIFECYCLE BAR ─────────────────────────────────────────────────────────
export function LifecycleBar({ status, type = 'standard' }) {
  const stages = type === 'sample' ? SAMPLE_STAGES : ORDER_STAGES;
  const currentIdx = stages.findIndex(s => s.key === status);
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: 'max-content' }}>
        {stages.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div className={`lifecycle-node${i < currentIdx ? ' done' : i === currentIdx ? ' active' : ''}`}>
                {i < currentIdx ? <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l4 4 6-6"/></svg> : i + 1}
              </div>
              <div className={`lifecycle-label${i === currentIdx ? ' active' : i < currentIdx ? ' done' : ''}`}>{s.short || s.label}</div>
            </div>
            {i < stages.length - 1 && (
              <div className={`lifecycle-connector${i < currentIdx ? ' done' : ''}`} style={{ marginTop: 13 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PRODUCT CARD ──────────────────────────────────────────────────────────
export function ProductCard({ p, orders = [], children, showStatus }) {
  const [activeVariant, setActiveVariant] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (p.product_variants?.length > 0) {
      setActiveVariant(p.product_variants.find(v => v.is_active !== false) || p.product_variants[0]);
    }
  }, [p.id]);

  useEffect(() => { setImgIdx(0); }, [activeVariant?.id]);

  // Resolve images: variant_images table first, then image_url fallback, then product image
  const getImages = (variant) => {
    if (!variant) return p.image_url ? [p.image_url] : [];
    const fromTable = (variant.variant_images || [])
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(vi => vi.image_url)
      .filter(Boolean);
    if (fromTable.length > 0) return fromTable;
    if (variant.image_url) return [variant.image_url];
    return p.image_url ? [p.image_url] : [];
  };

  const displayImages = getImages(activeVariant);

  // MOQ bar: only count collecting (pending, not yet accepted) orders
  const collectingQty = orders
    .filter(o => o.product_id === p.id && o.type === 'standard' && o.status === 'collecting')
    .reduce((s, o) => s + o.qty, 0);
  const moqPct = Math.min(100, Math.round((collectingQty / p.moq) * 100));
  const moqReached = moqPct >= 100;
  const moqClose = moqPct >= 70 && !moqReached;

  return (
    <>
      <div className="product-card">
        <div className="product-card-img-wrap" onClick={() => displayImages.length > 0 && setLightbox({ images: displayImages, index: imgIdx })}>
          {displayImages.length > 0
            ? <img
                className="product-card-img"
                src={displayImages[imgIdx]}
                alt={`${p.name}${activeVariant ? ' — ' + activeVariant.brand : ''}`}
                key={`${activeVariant?.id || 'default'}-${imgIdx}`}
                onError={e => { e.target.style.opacity = 0; }}
              />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11 }}>No image</div>
          }
          {activeVariant && (
            <div className="img-brand-tag">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeVariant.color, display: 'inline-block' }} />
              {activeVariant.brand}
            </div>
          )}
          {displayImages.length > 1 && (
            <div className="img-thumbs" onClick={e => e.stopPropagation()}>
              {displayImages.slice(0, 4).map((img, i) => (
                <img key={i} src={img} className={`img-thumb${i === imgIdx ? ' active' : ''}`} alt="" onClick={() => setImgIdx(i)} />
              ))}
            </div>
          )}
          {showStatus && (
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <span className={`badge ${p.status === 'active' ? 'badge-green' : p.status === 'pending_approval' ? 'badge-amber' : p.status === 'rejected' ? 'badge-red' : 'badge-grey'}`}>
                {p.status === 'pending_approval' ? 'Pending' : p.status}
              </span>
            </div>
          )}
        </div>
        <div className="product-card-body">
          <div className="product-card-cat">{p.category}</div>
          <div className="product-card-name">{p.name}</div>
          <div className="product-card-price">Unit price <strong>${p.unit_price}</strong> · MOQ <strong>{p.moq}</strong></div>
          {(p.production_lead_days || p.shipping_lead_days) && (
            <div className="product-card-lead">~{p.production_lead_days}d production · ~{p.shipping_lead_days}d shipping (est.)</div>
          )}
          <div className="moq-section">
            <div className="moq-label"><span>Pending orders</span><strong>{collectingQty} / {p.moq}</strong></div>
            <div className="moq-track">
              <div className={`moq-fill${moqReached ? ' reached' : moqClose ? ' close' : ''}`} style={{ width: `${moqPct}%` }} />
            </div>
            {moqReached && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4, fontWeight: 500 }}>✓ MOQ reached — awaiting supplier acceptance</div>}
          </div>
          {p.product_variants?.filter(v => v.is_active !== false).length > 0 && (
            <>
              <div className="variants-label">Brand variants — click to preview</div>
              <div className="variant-pills">
                {p.product_variants.filter(v => v.is_active !== false).map(v => (
                  <span key={v.id} className="variant-pill" onClick={() => setActiveVariant(v)}
                    style={{
                      background: activeVariant?.id === v.id ? 'var(--text-primary)' : 'var(--surface)',
                      color: activeVariant?.id === v.id ? 'white' : 'var(--text-secondary)',
                      borderColor: activeVariant?.id === v.id ? 'var(--text-primary)' : 'var(--border)',
                    }}>
                    <span className="variant-dot" style={{ background: activeVariant?.id === v.id ? 'white' : v.color }} />
                    {v.brand}
                  </span>
                ))}
              </div>
            </>
          )}
          {children}
        </div>
      </div>
      {lightbox && <Lightbox images={lightbox.images} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </>
  );
}


// ── MULTI IMAGE UPLOAD ────────────────────────────────────────────────────
export function MultiImageUpload({ label = 'Images', onChange }) {
  const [previews, setPreviews] = useState([]);
  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    const newPreviews = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setPreviews(p => [...p, ...newPreviews]);
    onChange(prev => [...(prev || []), ...files]);
  };
  const remove = (i) => {
    setPreviews(p => p.filter((_, idx) => idx !== i));
    onChange(prev => prev.filter((_, idx) => idx !== i));
  };
  return (
    <div className="form-group full">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {previews.map((p, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <img src={p.preview} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
            <button onClick={() => remove(i)} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--red)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        ))}
        <label style={{ width: 64, height: 64, border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}>
          <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
          {Icon.plus}
        </label>
      </div>
    </div>
  );
}
