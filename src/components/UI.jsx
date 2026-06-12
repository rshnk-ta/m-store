import { useState, useEffect } from 'react';
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
};

// ── MODAL ──────────────────────────────────────────────────────────────────
export function Modal({ title, subtitle, onClose, footer, children, wide, narrow }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : narrow ? ' narrow' : ''}`}>
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

// ── TOAST ──────────────────────────────────────────────────────────────────
export function Toast({ message, type = 'default' }) {
  if (!message) return null;
  return <div className={`toast ${type}`}>{message}</div>;
}

// ── SPINNER ────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

// ── MOQ BAR ───────────────────────────────────────────────────────────────
export function MoqBar({ product, orders }) {
  const qty = orders.filter(o => o.product_id === product.id).reduce((s, o) => s + o.qty, 0);
  const pct = Math.min(100, Math.round((qty / product.moq) * 100));
  const reached = pct >= 100;
  const close = pct >= 70 && !reached;
  return (
    <div className="moq-section">
      <div className="moq-label">
        <span>MOQ Progress</span>
        <strong>{qty} / {product.moq}</strong>
      </div>
      <div className="moq-track">
        <div className={`moq-fill${reached ? ' reached' : close ? ' close' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      {reached && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4, fontWeight: 500 }}>✓ MOQ reached</div>}
    </div>
  );
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
export function ProductCard({ p, orders = [], onAction, actionLabel, actionDisabled, children, showStatus }) {
  const [activeVariant, setActiveVariant] = useState(p.product_variants?.[0] || null);
  const displayImage = activeVariant?.image_url || p.image_url;

  // Keep activeVariant in sync if product_variants updates
  useEffect(() => {
    if (p.product_variants?.length > 0 && !activeVariant) {
      setActiveVariant(p.product_variants[0]);
    }
  }, [p.product_variants]);

  const totalOrdered = orders.filter(o => o.product_id === p.id && o.type === 'standard').reduce((s, o) => s + o.qty, 0);
  const moqPct = Math.min(100, Math.round((totalOrdered / p.moq) * 100));
  const moqReached = moqPct >= 100;
  const moqClose = moqPct >= 70 && !moqReached;

  return (
    <div className="product-card">
      <div className="product-card-img-wrap">
        {displayImage
          ? <img
              className="product-card-img"
              src={displayImage}
              alt={p.name}
              key={displayImage}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
        <div className="product-card-price">
          Unit price <strong>${p.unit_price}</strong> · MOQ <strong>{p.moq}</strong>
        </div>
        {(p.production_lead_days || p.shipping_lead_days) && (
          <div className="product-card-lead">
            ~{p.production_lead_days}d production · ~{p.shipping_lead_days}d shipping (est.)
          </div>
        )}

        {/* MOQ progress bar — always visible */}
        <div className="moq-section">
          <div className="moq-label">
            <span>Orders received</span>
            <strong>{totalOrdered} / {p.moq}</strong>
          </div>
          <div className="moq-track">
            <div className={`moq-fill${moqReached ? ' reached' : moqClose ? ' close' : ''}`} style={{ width: `${moqPct}%` }} />
          </div>
          {moqReached && <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4, fontWeight: 500 }}>✓ MOQ reached</div>}
        </div>

        {p.product_variants?.length > 0 && (
          <>
            <div className="variants-label">Brand variants</div>
            <div className="variant-pills">
              {p.product_variants.map(v => (
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
        {onAction && (
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={() => onAction(p)} disabled={actionDisabled}>
              {actionLabel || 'Action'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── IMAGE UPLOAD ──────────────────────────────────────────────────────────
export function ImageUpload({ value, onChange, label = 'Product Image' }) {
  const [preview, setPreview] = useState(value || null);
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(file);
  };
  return (
    <div className="form-group full">
      <label>{label}</label>
      <label className="img-upload-area" style={{ cursor: 'pointer' }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        {preview
          ? <img src={preview} alt="preview" className="img-preview" />
          : <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{Icon.upload}<br />Click to upload image</div>
        }
      </label>
    </div>
  );
}
