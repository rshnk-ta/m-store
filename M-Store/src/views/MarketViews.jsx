import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Modal, Icon, ProductCard, StageBadge } from '../components/UI';
import { MARKETS } from '../lib/constants';
import { OrderDetailModal, ProductDetailModal } from './AdminViews';
import { notifyUsers } from '../lib/db';

// ── HELPERS ────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toFixed(2);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtShort = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

// ── RE-APPROVAL BANNER ─────────────────────────────────────────────────────
function ReApprovalBanner({ orders, onRefresh, toast }) {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    const myCollectingIds = orders
      .filter(o => o.status === 'collecting' && o.type === 'standard')
      .map(o => o.id);
    if (!myCollectingIds.length) { setLoading(false); return; }

    supabase
      .from('order_reapproval')
      .select('*, product_change_log(*, products(name, image_url, unit_price))')
      .in('order_id', myCollectingIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const enriched = (data || []).map(row => ({
          ...row,
          order: orders.find(o => o.id === row.order_id),
        }));
        setItems(enriched);
        setLoading(false);
      });
  }, [orders]);

  const respond = async (reapprovalId, decision) => {
    setResponding(reapprovalId);
    try {
      await supabase
        .from('order_reapproval')
        .update({ status: decision, responded_by: profile?.id, responded_at: new Date().toISOString() })
        .eq('id', reapprovalId);
      toast(
        decision === 'approved'
          ? 'Order confirmed under new terms'
          : 'Re-approval declined — you may cancel the order from My Orders',
        decision === 'approved' ? 'success' : 'default'
      );
      setItems(prev => prev.filter(x => x.id !== reapprovalId));
      onRefresh();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setResponding(null);
  };

  if (loading || items.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ padding: '12px 16px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#92400E' }}>
          ⚠️ Action Required — Supplier Updated Catalogue Items
        </div>
        <div style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>
          {items.length} of your collecting order{items.length !== 1 ? 's' : ''} {items.length !== 1 ? 'have been' : 'has been'} affected. Review and confirm whether you want to continue.
        </div>
      </div>
      {items.map(item => {
        const log = item.product_change_log;
        const product = log?.products;
        const order = item.order;
        const oldVals = log?.old_values || {};
        const newVals = log?.new_values || {};
        const changedFields = Object.keys(newVals).filter(k => String(oldVals[k]) !== String(newVals[k]));
        return (
          <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid #FCD34D', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {product?.image_url && <img src={product.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                {log?.change_type === 'deactivate'
                  ? `"${product?.name}" has been deactivated by the supplier`
                  : `"${product?.name}" has been updated`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Your order: <strong>{order?.qty} units</strong> · status <em>collecting</em>
              </div>
              {changedFields.length > 0 && log?.change_type === 'edit' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {changedFields.map(k => (
                    <span key={k} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3 }}>
                      <strong>{k}</strong>: {String(oldVals[k] ?? '—')} → {String(newVals[k] ?? '—')}
                    </span>
                  ))}
                </div>
              )}
              {log?.note && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: 4 }}>Supplier note: {log.note}</div>}
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Changed {fmtShort(log?.created_at)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button className="btn btn-success btn-sm" disabled={responding === item.id} onClick={() => respond(item.id, 'approved')}>
                ✓ Continue Order
              </button>
              <button className="btn btn-danger btn-sm" disabled={responding === item.id} onClick={() => respond(item.id, 'declined')}>
                ✕ Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ORDER CONFIRMATION SCREEN ──────────────────────────────────────────────
function OrderConfirmation({ confirmedLines, market, onDone }) {
  const totalValue = confirmedLines.reduce((s, l) => s + (l.product?.unit_price || 0) * l.desiredQty, 0);
  const totalQty = confirmedLines.reduce((s, l) => s + l.desiredQty, 0);
  const totalCartons = confirmedLines.reduce((s, l) => s + (l.cartonCount || 0), 0);
  const totalCbm = confirmedLines.reduce((s, l) => s + (l.cbm || 0), 0);
  const ref = `ORD-${market?.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      {/* Success header */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✓</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 6 }}>Order Submitted</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your order has been placed and is now collecting.</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'monospace' }}>{ref}</div>
      </div>

      {/* Order summary card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Order Items</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{market}</span>
        </div>
        {confirmedLines.map((line, i) => (
          <div key={line.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: i < confirmedLines.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {line.product?.image_url
              ? <img src={line.product.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
              : <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--bg)', flexShrink: 0 }} />
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{line.product?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: line.variant?.color, display: 'inline-block', flexShrink: 0 }} />
                {line.variant?.brand} · {line.variant?.sku}
              </div>
              {line.cartonCount && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {line.cartonCount} carton{line.cartonCount !== 1 ? 's' : ''}{line.cbm ? ` · ${line.cbm.toFixed(3)} CBM` : ''}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{line.desiredQty} units</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>${fmt(line.product?.unit_price * line.desiredQty)}</div>
            </div>
          </div>
        ))}
        {/* Totals */}
        <div style={{ padding: '14px 18px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{totalQty} units total</span>
            <strong>${fmt(totalValue)}</strong>
          </div>
          {totalCartons > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {totalCartons} carton{totalCartons !== 1 ? 's' : ''}{totalCbm > 0 ? ` · ${totalCbm.toFixed(3)} CBM` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Next steps */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>What happens next</div>
        {[
          { icon: '📦', label: 'Collecting', desc: 'Your order joins the collecting pool. Once MOQ is reached across all markets, production begins.' },
          { icon: '✅', label: 'Accepted', desc: 'Admin confirms and accepts the consolidated order with the supplier.' },
          { icon: '🏭', label: 'In Production', desc: 'Supplier manufactures your items.' },
          { icon: '🚚', label: 'Dispatched & Delivered', desc: 'Items are shipped to your market and you confirm receipt.' },
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: i < 3 ? 10 : 0 }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{step.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 1 }}>{step.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onDone}>← Back to Catalog</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onDone('orders')}>View My Orders →</button>
      </div>
    </div>
  );
}

// ── CART REVIEW MODAL ──────────────────────────────────────────────────────
function CartReviewModal({ lines, market, onConfirm, onClose, submitting }) {
  const totalValue = lines.reduce((s, l) => s + (l.product?.unit_price || 0) * l.desiredQty, 0);
  const totalQty = lines.reduce((s, l) => s + l.desiredQty, 0);
  const totalCartons = lines.reduce((s, l) => s + (l.cartonCount || 0), 0);
  const totalCbm = lines.reduce((s, l) => s + (l.cbm || 0), 0);
  const additions = lines.filter(l => l.delta > 0);
  const reductions = lines.filter(l => l.delta < 0 && l.desiredQty > 0);
  const removals = lines.filter(l => l.desiredQty === 0);

  return (
    <Modal
      title="Review Order"
      subtitle={`${market} · ${lines.filter(l => l.desiredQty > 0).length} line${lines.filter(l => l.desiredQty > 0).length !== 1 ? 's' : ''}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={onConfirm} disabled={submitting} style={{ minWidth: 160 }}>
            {submitting ? 'Submitting…' : `Confirm Order · $${fmt(totalValue)}`}
          </button>
        </>
      }
    >
      <div>
        {/* Change summary chips */}
        {(additions.length > 0 || reductions.length > 0 || removals.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {additions.length > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#DCFCE7', color: '#15803D', fontWeight: 500 }}>+{additions.length} new/increased</span>}
            {reductions.length > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#FEF9C3', color: '#854D0E', fontWeight: 500 }}>{reductions.length} reduced</span>}
            {removals.length > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#FEE2E2', color: '#991B1B', fontWeight: 500 }}>{removals.length} removing</span>}
          </div>
        )}

        {/* Line items */}
        {lines.map((line, i) => {
          const isNew = line.committedQty === 0 && line.desiredQty > 0;
          const isRemoved = line.desiredQty === 0;
          return (
            <div key={line.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < lines.length - 1 ? '1px solid var(--border)' : 'none', opacity: isRemoved ? 0.5 : 1 }}>
              {line.product?.image_url
                ? <img src={line.product.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                : <div style={{ width: 36, height: 36, background: 'var(--bg)', borderRadius: 'var(--radius)', flexShrink: 0 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 1 }}>{line.product?.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: line.variant?.color, display: 'inline-block' }} />
                  {line.variant?.brand}
                  {isNew && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 10, background: '#DCFCE7', color: '#15803D', fontSize: 9, fontWeight: 600 }}>NEW</span>}
                  {isRemoved && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 10, background: '#FEE2E2', color: '#991B1B', fontSize: 9, fontWeight: 600 }}>REMOVING</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {isRemoved
                  ? <div style={{ fontSize: 11, color: 'var(--red)', textDecoration: 'line-through' }}>{line.committedQty} units</div>
                  : <>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{line.desiredQty} units</div>
                    {line.delta !== 0 && (
                      <div style={{ fontSize: 10, color: line.delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
                        {line.delta > 0 ? `+${line.delta}` : line.delta} from previous
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>${fmt((line.product?.unit_price || 0) * line.desiredQty)}</div>
                  </>
                }
              </div>
            </div>
          );
        })}

        {/* Totals */}
        <div style={{ paddingTop: 14, marginTop: 4, borderTop: '2px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{totalQty} units total</div>
              {totalCartons > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalCartons} carton{totalCartons !== 1 ? 's' : ''}{totalCbm > 0 ? ` · ${totalCbm.toFixed(3)} CBM` : ''}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Estimated total value</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>${fmt(totalValue)}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>at catalog price · subject to confirmed cost</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── MARKET CATALOG ─────────────────────────────────────────────────────────
export function MarketCatalog({ products, orders, brands, onRefresh, toast, onNavigate }) {
  const { profile } = useAuth();
  const [sampleModal, setSampleModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [priceMax, setPriceMax] = useState(9999);
  const [showFilters, setShowFilters] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartReviewOpen, setCartReviewOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const market = profile?.market;
  const storageKey = `mstore_v2_${market}`;

  const [cart, setCartRaw] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  });

  // Sync cart with current order state
  useEffect(() => {
    if (!market) return;
    const pendingOrders = orders.filter(o => o.market === market && o.type === 'standard' && o.status === 'collecting');
    const pendingKeys = new Set(pendingOrders.map(o => `${o.product_id}__${o.variant_id}`));
    setCartRaw(prev => {
      let changed = false;
      const next = { ...prev };
      pendingOrders.forEach(o => {
        const key = `${o.product_id}__${o.variant_id}`;
        if (!(key in next)) { next[key] = o.qty; changed = true; }
      });
      Object.keys(next).forEach(key => {
        if (!pendingKeys.has(key)) {
          const [productId, variantId] = key.split('__');
          const hasNonCollectingOrder = orders.some(o =>
            o.product_id === productId && o.variant_id === variantId && o.market === market &&
            o.type === 'standard' && o.status !== 'collecting'
          );
          if (hasNonCollectingOrder) { delete next[key]; changed = true; }
        }
      });
      if (!changed) return prev;
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
    setCartReviewOpen(false);
  };

  // ── Filtering ──
  const activeProducts = products.filter(p => p.status === 'active');
  const cats = useMemo(() => ['All', ...Array.from(new Set(activeProducts.map(p => p.category).filter(Boolean)))], [activeProducts]);
  const allBrands = useMemo(() => {
    const b = new Set();
    activeProducts.forEach(p => p.product_variants?.forEach(v => v.brand && b.add(v.brand)));
    return ['All', ...Array.from(b).sort()];
  }, [activeProducts]);
  const maxCatalogPrice = useMemo(() => Math.max(Math.ceil(Math.max(...activeProducts.map(p => p.unit_price || 0), 0) / 10) * 10, 100), [activeProducts]);

  const filtered = useMemo(() => activeProducts.filter(p => {
    if (catFilter !== 'All' && p.category !== catFilter) return false;
    if (brandFilter !== 'All' && !p.product_variants?.some(v => v.brand === brandFilter)) return false;
    if (p.unit_price > priceMax) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.category?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [activeProducts, catFilter, brandFilter, priceMax, search]);

  const getPendingOrder = (productId, variantId) =>
    orders.find(o => o.product_id === productId && o.variant_id === variantId && o.market === market && o.type === 'standard' && o.status === 'collecting');

  const cartKey = (productId, variantId) => `${productId}__${variantId}`;

  const setQty = (productId, variantId, qty) => {
    const key = cartKey(productId, variantId);
    setCart(c => qty > 0 ? { ...c, [key]: qty } : Object.fromEntries(Object.entries(c).filter(([k]) => k !== key)));
  };

  // Build enriched cart lines
  const buildCartLines = (cartObj) => Object.entries(cartObj).map(([key, desiredQty]) => {
    const [productId, variantId] = key.split('__');
    const product = products.find(x => x.id === productId);
    const variant = product?.product_variants?.find(x => x.id === variantId);
    const pendingOrder = getPendingOrder(productId, variantId);
    const committedQty = pendingOrder?.qty || 0;
    const delta = desiredQty - committedQty;
    const upc = product?.units_per_carton;
    const cartonCount = upc && desiredQty > 0 ? Math.ceil(desiredQty / upc) : null;
    const cbm = (product?.carton_l && product?.carton_w && product?.carton_h && cartonCount)
      ? (product.carton_l / 100) * (product.carton_w / 100) * (product.carton_h / 100) * cartonCount
      : null;
    return { key, productId, variantId, desiredQty, committedQty, delta, product, variant, pendingOrder, cartonCount, cbm };
  }).filter(l => l.delta !== 0 || l.desiredQty > 0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cartLines = useMemo(() => buildCartLines(cart), [cart, products, orders]);
  const changedLines = cartLines.filter(l => l.delta !== 0);
  const hasChanges = changedLines.length > 0;
  const cartTotal = cartLines.reduce((s, l) => s + (l.product?.unit_price || 0) * l.desiredQty, 0);
  const totalCartons = cartLines.reduce((s, l) => s + (l.cartonCount || 0), 0);
  const totalCbm = cartLines.reduce((s, l) => s + (l.cbm || 0), 0);

  const submitCart = async () => {
    if (!hasChanges) return;
    setSubmitting(true);
    setCartReviewOpen(false);
    try {
      const submittedLines = [...changedLines];
      for (const { productId, variantId, desiredQty, pendingOrder, product } of changedLines) {
        if (desiredQty <= 0 && pendingOrder) {
          await supabase.from('orders').delete().eq('id', pendingOrder.id);
        } else if (pendingOrder) {
          await supabase.from('orders').update({ qty: desiredQty, updated_at: new Date().toISOString() }).eq('id', pendingOrder.id);
        } else {
          const { data: newOrder } = await supabase.from('orders').insert({
            product_id: productId, variant_id: variantId, market,
            qty: desiredQty, type: 'standard', status: 'collecting',
            placed_by: profile?.id, placed_at: new Date().toISOString(),
          }).select().single();
          if (newOrder) {
            await supabase.from('timeline_log').insert({ order_id: newOrder.id, stage: 'collecting', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
          }
        }

        // MOQ tracking
        if (product && desiredQty > 0) {
          const allProductOrders = orders
            .filter(o => o.product_id === productId && o.type === 'standard' && o.status === 'collecting' && !(pendingOrder && o.id === pendingOrder.id))
            .reduce((s, o) => s + o.qty, 0) + desiredQty;
          const wasReached = product.moq_reached;
          const nowReached = allProductOrders >= product.moq;
          if (nowReached && !wasReached) {
            await supabase.from('products').update({ moq_reached: true, moq_reached_at: new Date().toISOString() }).eq('id', productId);
            const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
            if (supplierUsers?.length) await notifyUsers(supplierUsers.map(u => u.id), 'moq_reached', 'MOQ Reached', `"${product.name}" has reached its MOQ of ${product.moq} units.`, { product_id: productId });
          } else if (!nowReached && wasReached) {
            await supabase.from('products').update({ moq_reached: false, moq_reached_at: null }).eq('id', productId);
          }
        }
      }

      const confirmationLines = submittedLines.filter(l => l.desiredQty > 0);
      clearCart();
      onRefresh();
      if (confirmationLines.length > 0) {
        setConfirmation(confirmationLines);
      } else {
        toast('Order updated', 'success');
      }
    } catch (e) {
      toast('Error: ' + e.message, 'error');
    }
    setSubmitting(false);
  };

  // Show confirmation screen instead of catalog
  if (confirmation) {
    return (
      <OrderConfirmation
        confirmedLines={confirmation}
        market={market}
        onDone={(dest) => {
          setConfirmation(null);
          if (dest === 'orders' && onNavigate) onNavigate('my-orders');
        }}
      />
    );
  }

  const activeFiltersCount = [catFilter !== 'All', brandFilter !== 'All', priceMax < maxCatalogPrice].filter(Boolean).length;

  return (
    <div style={{ paddingBottom: hasChanges ? 100 : 0 }}>
      <ReApprovalBanner orders={orders} onRefresh={onRefresh} toast={toast} />

      <div className="section-header">
        <div>
          <div className="section-title">Catalog</div>
          <div className="section-desc">{market} · {filtered.length} item{filtered.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Search + category chips + filters button */}
      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input className="search-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 180 }} />
        {cats.map(c => (
          <span key={c} className={`filter-chip${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)}>{c}</span>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto', position: 'relative' }}
          onClick={() => setShowFilters(f => !f)}
        >
          ⚙ Filters
          {activeFiltersCount > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: 'var(--accent-warm)', color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded filters panel */}
      {showFilters && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Brand</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allBrands.map(b => (
                <span key={b} className={`filter-chip${brandFilter === b ? ' active' : ''}`} style={{ fontSize: 11 }} onClick={() => setBrandFilter(b)}>{b}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Max price: ${priceMax >= maxCatalogPrice ? 'Any' : priceMax}
            </div>
            <input
              type="range" min={0} max={maxCatalogPrice} step={1}
              value={priceMax >= maxCatalogPrice ? maxCatalogPrice : priceMax}
              onChange={e => setPriceMax(Number(e.target.value) >= maxCatalogPrice ? 9999 : Number(e.target.value))}
              style={{ width: 160 }}
            />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setBrandFilter('All'); setPriceMax(9999); }}>Reset filters</button>
        </div>
      )}

      {/* Product grid */}
      <div className="card-grid">
        {filtered.map(p => {
          const totalCollecting = orders
            .filter(o => o.product_id === p.id && o.type === 'standard' && o.status === 'collecting')
            .reduce((s, o) => s + o.qty, 0);
          const moqPct = Math.min(100, Math.round((totalCollecting / (p.moq || 1)) * 100));
          const moqReached = p.moq_reached || moqPct >= 100;

          return (
            <div key={p.id} style={{ position: 'relative' }}>
              <div
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, cursor: 'pointer', zIndex: 1 }}
                onClick={() => setDetailModal(p)}
                title="View full details"
              />
              <ProductCard p={p} orders={orders.filter(o => o.type === 'standard')}>
                {/* Stock / MOQ progress */}
                <div style={{ margin: '10px 0 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {moqReached ? '✓ MOQ reached' : 'Collecting'}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 500, color: moqReached ? 'var(--green)' : 'var(--text-secondary)' }}>
                      {totalCollecting}/{p.moq} units
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${moqPct}%`,
                      background: moqReached ? 'var(--green)' : moqPct >= 70 ? 'var(--accent-warm)' : 'var(--accent)',
                      borderRadius: 2, transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Order qty inputs */}
                <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                  Your quantities
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
                          onChange={e => { const val = parseInt(e.target.value) || 0; setQty(p.id, v.id, val); if (val > 0 || committedQty > 0) setCartOpen(true); }}
                          onFocus={e => e.target.select()}
                          style={{ width: 72, fontSize: 12, textAlign: 'center', borderColor: delta !== 0 ? 'var(--accent-warm)' : undefined }}
                        />
                      </div>
                      {delta !== 0 && (
                        <div style={{ marginLeft: 15, marginTop: 3, fontSize: 10 }}>
                          <span style={{ color: delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{delta > 0 ? `+${delta}` : delta} from submitted</span>
                          {committedQty > 0 && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>(was {committedQty})</span>}
                        </div>
                      )}
                      {delta === 0 && committedQty > 0 && (
                        <div style={{ marginLeft: 15, marginTop: 3, fontSize: 10, color: 'var(--text-muted)' }}>{committedQty} submitted</div>
                      )}
                    </div>
                  );
                })}
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={() => setSampleModal(p)}>
                  {Icon.sample} Request Sample
                </button>
              </ProductCard>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty" style={{ gridColumn: '1/-1' }}>
            <div className="empty-icon">◻</div>
            <div className="empty-title">No items found</div>
            <div className="empty-desc">Try adjusting your search or filters</div>
          </div>
        )}
      </div>

      {/* ── FIXED CART BAR ── */}
      {(hasChanges || cartLines.some(l => l.committedQty > 0)) && (
        <div style={{ position: 'fixed', bottom: 0, left: 'var(--sidebar-w)', right: 0, background: 'var(--surface)', borderTop: '2px solid var(--border)', boxShadow: '0 -4px 20px rgba(26,23,20,0.08)', zIndex: 100 }}>
          {/* Mini summary */}
          {cartOpen && (
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Order Summary — {market}</div>
              {cartLines.map(({ key, desiredQty, committedQty, delta, product, variant }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 500 }}>{product?.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: variant?.color, display: 'inline-block' }} />
                      {variant?.brand}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{desiredQty} units</div>
                    {delta !== 0 && <div style={{ fontSize: 10, color: delta > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{delta > 0 ? `+${delta}` : delta}</div>}
                  </div>
                  <button onClick={() => setQty(key.split('__')[0], key.split('__')[1], committedQty)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 4px', flexShrink: 0 }} title="Revert">↺</button>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {totalCartons > 0 && `${totalCartons} cartons${totalCbm > 0 ? ` · ${totalCbm.toFixed(2)} CBM` : ''}`}
                </span>
                <strong>${fmt(cartTotal)}</strong>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', gap: 16 }}>
            <button onClick={() => setCartOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', padding: 0 }}>
              {hasChanges && (
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-warm)', color: 'white', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {changedLines.length}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 500 }}>{cartOpen ? '▾ Hide' : '▸ Summary'}</span>
            </button>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>
              {hasChanges
                ? <><span style={{ fontWeight: 500 }}>{changedLines.reduce((s, l) => s + Math.abs(l.delta), 0)} units changing</span> · Total <strong style={{ color: 'var(--text-primary)' }}>${fmt(cartTotal)}</strong></>
                : <>Total <strong>${fmt(cartTotal)}</strong></>
              }
            </div>
            {hasChanges && (
              <button className="btn btn-ghost btn-sm" onClick={() => { const reverted = {}; cartLines.forEach(l => { if (l.committedQty > 0) reverted[l.key] = l.committedQty; }); setCart(reverted); }}>
                Revert all
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => hasChanges && setCartReviewOpen(true)}
              disabled={submitting || !hasChanges}
              style={{ minWidth: 140 }}
            >
              {submitting ? 'Saving…' : hasChanges ? 'Review Order →' : 'No changes'}
            </button>
          </div>
        </div>
      )}

      {/* Cart review modal */}
      {cartReviewOpen && (
        <CartReviewModal
          lines={changedLines}
          market={market}
          onConfirm={submitCart}
          onClose={() => setCartReviewOpen(false)}
          submitting={submitting}
        />
      )}

      {sampleModal && <SampleModal product={sampleModal} market={market} onClose={() => setSampleModal(null)} onRefresh={onRefresh} toast={toast} profile={profile} />}
      {detailModal && <ProductDetailModal product={detailModal} onClose={() => setDetailModal(null)} />}
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

// ── ORDER TIMELINE CONSTANTS ───────────────────────────────────────────────
const STAGE_ORDER_STANDARD = ['collecting', 'accepted', 'in_production', 'dispatched', 'in_transit', 'arrived', 'delivered'];
const STAGE_ORDER_SAMPLE   = ['collecting', 'pending_approval', 'accepted', 'dispatched', 'delivered'];

const STAGE_LABELS = {
  collecting: 'Collecting', pending_approval: 'Pending Approval', accepted: 'Accepted',
  in_production: 'In Production', dispatched: 'Dispatched', in_transit: 'In Transit',
  arrived: 'Arrived', delivered: 'Delivered', cancelled: 'Cancelled',
};
const STAGE_ICONS = {
  collecting: '📦', pending_approval: '⏳', accepted: '✅', in_production: '🏭',
  dispatched: '🚢', in_transit: '✈️', arrived: '🏪', delivered: '🎉', cancelled: '✕',
};
const STAGE_DESCS = {
  collecting: 'Order is in the collecting pool, waiting for MOQ.',
  pending_approval: 'Awaiting your approval before dispatch.',
  accepted: 'Order confirmed and handed to supplier.',
  in_production: 'Supplier is manufacturing your items.',
  dispatched: 'Items have left the supplier.',
  in_transit: 'Shipment is en route to your market.',
  arrived: 'Goods have arrived — please confirm receipt.',
  delivered: 'Order complete. Items received by your market.',
  cancelled: 'This order was cancelled.',
};

// ── ORDER TIMELINE MODAL ───────────────────────────────────────────────────
function OrderTimelineModal({ order, shipments, onClose, onConfirmDelivery, onApproveSample, onRejectSample, sampleProcessing }) {
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);

  useEffect(() => {
    supabase.from('timeline_log').select('*').eq('order_id', order.id)
      .order('actual_date', { ascending: true })
      .then(({ data }) => { setTimeline(data || []); setLoadingTimeline(false); });
  }, [order.id]);

  const stages = order.type === 'sample' ? STAGE_ORDER_SAMPLE : STAGE_ORDER_STANDARD;
  const isCancelled = order.status === 'cancelled';
  const currentIdx = isCancelled ? -1 : stages.indexOf(order.status);
  const shipment = shipments?.find(s => s.order_id === order.id);

  const getStageDate = (stage) => {
    const entry = timeline.find(t => t.stage === stage);
    return entry?.actual_date ? fmtShort(entry.actual_date) : null;
  };

  const footer = (() => {
    if (order.status === 'arrived') return <button className="btn btn-success btn-sm" onClick={onConfirmDelivery}>✓ Confirm Receipt</button>;
    if (order.type === 'sample' && order.status === 'pending_approval') return (
      <>
        <button className="btn btn-danger btn-sm" disabled={sampleProcessing} onClick={onRejectSample}>Reject</button>
        <button className="btn btn-success btn-sm" disabled={sampleProcessing} onClick={onApproveSample}>✓ Approve Sample</button>
      </>
    );
    return null;
  })();

  return (
    <Modal title="Order Details" subtitle={order.product?.name} onClose={onClose} footer={footer}>
      {/* Product summary strip */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {order.product?.image_url && (
          <img src={order.product.image_url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{order.product?.name}</div>
          {order.variant && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: order.variant.color, display: 'inline-block' }} />
              {order.variant.brand} · {order.variant.sku}
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
            <span><strong>{order.qty}</strong> <span style={{ color: 'var(--text-muted)' }}>units</span></span>
            {order.unit_cost && <span><strong>${order.unit_cost}</strong><span style={{ color: 'var(--text-muted)' }}>/unit</span></span>}
            {order.unit_cost && <span><strong>${fmt(order.unit_cost * order.qty)}</strong> <span style={{ color: 'var(--text-muted)' }}>total</span></span>}
          </div>
          {shipment?.eta && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>ETA: {fmtDate(shipment.eta)}</div>}
        </div>
        <StageBadge status={order.status} type={order.type} />
      </div>

      {/* Timeline */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>Order Timeline</div>
      {loadingTimeline ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Connector line */}
          <div style={{ position: 'absolute', left: 15, top: 16, bottom: 16, width: 2, background: 'var(--border)', zIndex: 0 }} />
          {stages.map((stage, i) => {
            const done = !isCancelled && i <= currentIdx;
            const current = !isCancelled && i === currentIdx;
            const date = getStageDate(stage);
            return (
              <div key={stage} style={{ display: 'flex', gap: 14, marginBottom: i < stages.length - 1 ? 16 : 0, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: done ? (current ? 'var(--accent-warm)' : 'var(--green)') : 'var(--bg)',
                  border: `2px solid ${done ? (current ? 'var(--accent-warm)' : 'var(--green)') : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: done ? 14 : 10, color: done ? 'white' : 'var(--text-muted)',
                  boxShadow: current ? '0 0 0 4px rgba(214,120,50,0.18)' : 'none',
                }}>
                  {done ? (i < currentIdx ? '✓' : STAGE_ICONS[stage]) : <span style={{ fontWeight: 600 }}>{i + 1}</span>}
                </div>
                <div style={{ flex: 1, paddingTop: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: current ? 600 : done ? 500 : 400, fontSize: 13, color: done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {STAGE_LABELS[stage]}
                      {current && <span style={{ marginLeft: 8, fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'var(--accent-warm)', color: 'white', fontWeight: 700, verticalAlign: 'middle' }}>NOW</span>}
                    </div>
                    {date && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{date}</span>}
                  </div>
                  {(done || current) && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{STAGE_DESCS[stage]}</div>
                  )}
                </div>
              </div>
            );
          })}
          {isCancelled && (
            <div style={{ display: 'flex', gap: 14, marginTop: 12, position: 'relative', zIndex: 1 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--red)', border: '2px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', flexShrink: 0 }}>✕</div>
              <div style={{ paddingTop: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--red)' }}>Cancelled</div>
                {order.cancelled_reason && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{order.cancelled_reason}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shipment tracking block */}
      {shipment && ['dispatched', 'in_transit', 'arrived'].includes(order.status) && (
        <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Shipment</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
            {shipment.tracking_number && (
              <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Tracking #</div><div style={{ fontFamily: 'monospace', fontWeight: 500 }}>{shipment.tracking_number}</div></div>
            )}
            {shipment.carrier && (
              <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Carrier</div><div style={{ fontWeight: 500 }}>{shipment.carrier}</div></div>
            )}
            {shipment.eta && (
              <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>ETA</div><div style={{ fontWeight: 500 }}>{fmtDate(shipment.eta)}</div></div>
            )}
            {shipment.port_of_loading && (
              <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Route</div><div style={{ fontWeight: 500 }}>{shipment.port_of_loading} → {shipment.destination || '—'}</div></div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── MARKET MY ORDERS ───────────────────────────────────────────────────────
export function MarketOrders({ products, orders, shipments, onRefresh, toast }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('standard');
  const [rejectModal, setRejectModal] = useState(null);
  const [processing, setProcessing] = useState(null);
  const [sampleProcessing, setSampleProcessing] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const market = profile?.market;
  const myOrders = orders
    .filter(o => o.market === market && o.type === tab)
    .map(o => ({
      ...o,
      product: products.find(x => x.id === o.product_id),
      variant: products.find(x => x.id === o.product_id)?.product_variants?.find(v => v.id === o.variant_id),
    }));

  const STATUS_GROUPS = { all: 'All', active: 'Active', shipping: 'Shipping', done: 'Completed', cancelled: 'Cancelled' };
  const filteredOrders = myOrders.filter(o => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return ['collecting', 'accepted', 'in_production', 'pending_approval'].includes(o.status);
    if (statusFilter === 'shipping') return ['dispatched', 'in_transit', 'arrived'].includes(o.status);
    if (statusFilter === 'done') return o.status === 'delivered';
    if (statusFilter === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  const costApprovalOrders = orders.filter(o =>
    o.market === market && o.type === 'standard' && o.cost_approval_status === 'pending'
  ).map(o => ({
    ...o,
    product: products.find(x => x.id === o.product_id),
    variant: products.find(x => x.id === o.product_id)?.product_variants?.find(v => v.id === o.variant_id),
  }));

  const approveSample = async (order) => {
    setSampleProcessing(order.id);
    await supabase.from('orders').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: 'accepted', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
    if (supplierUsers?.length) await notifyUsers(supplierUsers.map(u => u.id), 'sample_accepted', 'Sample Approved', `${market} approved the sample of "${order.product?.name}". Please dispatch when ready.`, { order_id: order.id, product_id: order.product_id });
    toast('Sample approved — supplier notified', 'success');
    setSampleProcessing(null);
    setSelected(null);
    onRefresh();
  };

  const rejectSample = async (order) => {
    setSampleProcessing(order.id);
    await supabase.from('orders').update({ status: 'cancelled', cancelled_reason: 'Market rejected sample', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: 'cancelled', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
    if (supplierUsers?.length) await notifyUsers(supplierUsers.map(u => u.id), 'sample_rejected', 'Sample Rejected', `${market} rejected the sample of "${order.product?.name}".`, { order_id: order.id, product_id: order.product_id });
    toast('Sample rejected', 'default');
    setSampleProcessing(null);
    setSelected(null);
    onRefresh();
  };

  const confirmDelivery = async (order) => {
    await supabase.from('orders').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: 'delivered', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    const shipment = shipments.find(s => s.order_id === order.id && s.destination === market);
    if (shipment) await supabase.from('shipments').update({ status: 'delivered', confirmed_by: profile?.id }).eq('id', shipment.id);
    toast('Delivery confirmed ✓', 'success');
    setSelected(null);
    onRefresh();
  };

  const approveCost = async (order) => {
    setProcessing(order.id);
    await supabase.from('orders').update({ cost_approval_status: 'approved', updated_at: new Date().toISOString() }).eq('id', order.id);
    const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
    if (supplierUsers?.length) await notifyUsers(supplierUsers.map(u => u.id), 'cost_approved', 'Cost Approved', `${market} approved the cost for "${order.product?.name}" at $${order.unit_cost}/unit.`, { product_id: order.product_id, order_id: order.id });
    toast('Cost approved', 'success');
    setProcessing(null);
    onRefresh();
  };

  const rejectCost = async (order, reduceQtyTo) => {
    setProcessing(order.id);
    const product = order.product;
    if (reduceQtyTo <= 0) {
      await supabase.from('orders').update({ status: 'cancelled', cost_approval_status: 'rejected', cancelled_reason: 'Market rejected cost increase', updated_at: new Date().toISOString() }).eq('id', order.id);
    } else {
      await supabase.from('orders').update({ qty: reduceQtyTo, cost_approval_status: 'rejected', updated_at: new Date().toISOString() }).eq('id', order.id);
    }
    const otherOrders = orders.filter(o => o.product_id === order.product_id && o.type === 'standard' && o.id !== order.id && ['collecting', 'accepted'].includes(o.status));
    const remainingTotal = otherOrders.reduce((s, o) => s + o.qty, 0) + (reduceQtyTo > 0 ? reduceQtyTo : 0);
    let shortfallMsg = '';
    if (product && remainingTotal < product.moq) {
      const allRelated = orders.filter(o => o.product_id === order.product_id && o.type === 'standard' && o.id !== order.id && ['collecting', 'accepted'].includes(o.status));
      for (const o of allRelated) {
        await supabase.from('orders').update({ status: 'cancelled', cancelled_reason: `MOQ shortfall after ${market} backed out`, updated_at: new Date().toISOString() }).eq('id', o.id);
      }
      shortfallMsg = ` MOQ shortfall — order cancelled.`;
      const affectedUserIds = [...new Set(allRelated.map(o => o.placed_by).filter(Boolean))];
      const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
      await notifyUsers([...affectedUserIds, ...(supplierUsers?.map(u => u.id) || [])], 'moq_shortfall_cancelled', 'Order Cancelled — MOQ Shortfall', `"${product.name}" order cancelled: ${market} backed out.`, { product_id: order.product_id });
    } else {
      const { data: supplierUsers } = await supabase.from('users').select('id').eq('role', 'supplier');
      if (supplierUsers?.length) await notifyUsers(supplierUsers.map(u => u.id), 'cost_rejected', 'Cost Rejected', `${market} rejected the cost for "${product?.name}".`, { product_id: order.product_id, order_id: order.id });
    }
    toast(`Cost rejected.${shortfallMsg}`, shortfallMsg ? 'error' : 'default');
    setProcessing(null);
    setRejectModal(null);
    onRefresh();
  };

  return (
    <div>
      <ReApprovalBanner orders={myOrders} onRefresh={onRefresh} toast={toast} />
      <div className="section-header">
        <div>
          <div className="section-title">My Orders</div>
          <div className="section-desc">{market} · {myOrders.length} order{myOrders.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Cost approval banner */}
      {costApprovalOrders.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent-warm)', marginBottom: 10, fontWeight: 500 }}>
            ⚠ {costApprovalOrders.length} cost approval{costApprovalOrders.length !== 1 ? 's' : ''} required
          </div>
          {costApprovalOrders.map(o => (
            <div key={o.id} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
              {o.product?.image_url && <img src={o.product.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 'var(--radius)', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{o.product?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Catalog <strong>${o.product?.unit_price}</strong> → Confirmed <strong style={{ color: 'var(--red)' }}>${o.unit_cost}</strong> · {o.qty} units · ${fmt(o.unit_cost * o.qty)} total
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="btn btn-sm btn-success" disabled={processing === o.id} onClick={() => approveCost(o)}>{Icon.check} Approve</button>
                <button className="btn btn-sm btn-danger" disabled={processing === o.id} onClick={() => setRejectModal(o)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + status filter chips */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div className="tabs" style={{ margin: 0 }}>
          <div className={`tab${tab === 'standard' ? ' active' : ''}`} onClick={() => setTab('standard')}>Orders</div>
          <div className={`tab${tab === 'sample' ? ' active' : ''}`} onClick={() => setTab('sample')}>
            Samples
            {orders.filter(o => o.market === market && o.type === 'sample' && o.status === 'pending_approval').length > 0 && (
              <span className="badge badge-amber" style={{ marginLeft: 6, padding: '1px 6px' }}>
                {orders.filter(o => o.market === market && o.type === 'sample' && o.status === 'pending_approval').length}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_GROUPS).map(([key, label]) => (
            <span key={key} className={`filter-chip${statusFilter === key ? ' active' : ''}`} style={{ fontSize: 11 }} onClick={() => setStatusFilter(key)}>{label}</span>
          ))}
        </div>
      </div>

      {/* Order cards */}
      {filteredOrders.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">○</div>
          <div className="empty-title">No orders here</div>
          <div className="empty-desc">{myOrders.length === 0 ? 'Browse the catalog to place orders' : 'Try a different filter'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredOrders.map(o => {
            const shipment = shipments.find(s => s.order_id === o.id && s.destination === market);
            const needsAction = o.status === 'arrived' || (o.type === 'sample' && o.status === 'pending_approval') || o.cost_approval_status === 'pending';
            return (
              <div
                key={o.id}
                onClick={() => setSelected(o)}
                style={{
                  background: 'var(--surface)', border: `1px solid ${needsAction ? 'var(--accent-warm)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', padding: '14px 18px', cursor: 'pointer',
                  display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {o.product?.image_url && (
                  <img src={o.product.image_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{o.product?.name}</div>
                    <StageBadge status={o.status} type={o.type} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {o.variant && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: o.variant.color, display: 'inline-block' }} />{o.variant.brand}</span>}
                    <span>{o.qty} units</span>
                    {o.unit_cost && <span>${fmt(o.unit_cost * o.qty)}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {shipment?.eta && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ETA {fmtDate(shipment.eta)}</span>}
                    {shipment?.tracking_number && <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 3 }}>{shipment.tracking_number}</span>}
                    {needsAction && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-warm)' }}>⚡ Action needed</span>}
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 16, flexShrink: 0, alignSelf: 'center' }}>›</div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <OrderTimelineModal
          order={selected}
          shipments={shipments.filter(s => s.order_id === selected.id)}
          onClose={() => setSelected(null)}
          onConfirmDelivery={() => confirmDelivery(selected)}
          onApproveSample={() => approveSample(selected)}
          onRejectSample={() => rejectSample(selected)}
          sampleProcessing={sampleProcessing === selected?.id}
        />
      )}

      {rejectModal && (
        <RejectCostModal order={rejectModal} onClose={() => setRejectModal(null)} onConfirm={(qty) => rejectCost(rejectModal, qty)} processing={processing === rejectModal.id} />
      )}
    </div>
  );
}

// ── REJECT COST MODAL ──────────────────────────────────────────────────────
function RejectCostModal({ order, onClose, onConfirm, processing }) {
  const [choice, setChoice] = useState('full');
  return (
    <Modal title="Reject Cost Increase" subtitle={order.product?.name} onClose={onClose}
      footer={<><button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-danger btn-sm" disabled={processing} onClick={() => onConfirm(choice === 'full' ? 0 : order.qty)}>{processing ? 'Processing…' : 'Confirm'}</button></>}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
        The confirmed cost (${order.unit_cost}/unit) is higher than the catalog price (${order.product?.unit_price}).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: 12, border: `1px solid ${choice === 'full' ? 'var(--text-primary)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)' }}>
          <input type="radio" checked={choice === 'full'} onChange={() => setChoice('full')} style={{ width: 'auto', marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Back out entirely</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cancel your {order.qty}-unit order. If below MOQ, the whole batch cancels.</div>
          </div>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: 12, border: `1px solid ${choice === 'reduce' ? 'var(--text-primary)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)' }}>
          <input type="radio" checked={choice === 'reduce'} onChange={() => setChoice('reduce')} style={{ width: 'auto', marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Keep order, flag rejection</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keep the {order.qty} units but record your objection. Supplier will be notified.</div>
          </div>
        </label>
      </div>
    </Modal>
  );
}

// ── MARKET TRACKING ────────────────────────────────────────────────────────
export function MarketTracking({ products, orders, shipments, onRefresh, toast }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(null);
  const [sampleProcessing, setSampleProcessing] = useState(null);
  const market = profile?.market;

  const trackingOrders = orders
    .filter(o => o.market === market && ['dispatched', 'in_transit', 'arrived', 'delivered'].includes(o.status))
    .map(o => ({
      ...o,
      product: products.find(x => x.id === o.product_id),
      variant: products.find(x => x.id === o.product_id)?.product_variants?.find(v => v.id === o.variant_id),
    }));

  const activeShipments = trackingOrders.filter(o => o.status !== 'delivered');
  const completedShipments = trackingOrders.filter(o => o.status === 'delivered');

  const confirmDelivery = async (order) => {
    await supabase.from('orders').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('timeline_log').insert({ order_id: order.id, stage: 'delivered', actual_date: new Date().toISOString().slice(0, 10), created_by: profile?.id });
    const shipment = shipments.find(s => s.order_id === order.id && s.destination === market);
    if (shipment) await supabase.from('shipments').update({ status: 'delivered', confirmed_by: profile?.id }).eq('id', shipment.id);
    toast('Delivery confirmed ✓', 'success');
    setSelected(null);
    onRefresh();
  };

  const ShipmentCard = ({ order }) => {
    const shipment = shipments.find(s => s.order_id === order.id && s.destination === market);
    const needsConfirm = order.status === 'arrived';
    return (
      <div
        onClick={() => setSelected(order)}
        style={{
          background: 'var(--surface)', border: `1px solid ${needsConfirm ? 'var(--accent-warm)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-md)', padding: '16px 18px', cursor: 'pointer',
          display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'box-shadow 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: needsConfirm ? 'var(--accent-warm)' : order.status === 'delivered' ? 'var(--green)' : 'var(--bg)', border: `2px solid ${needsConfirm ? 'var(--accent-warm)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {STAGE_ICONS[order.status]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{order.product?.name}</div>
            <StageBadge status={order.status} type={order.type} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            {order.variant && <><span style={{ width: 6, height: 6, borderRadius: '50%', background: order.variant.color, display: 'inline-block' }} />{order.variant.brand}</>}
            <span>·</span><span>{order.qty} units</span>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted)' }}>
            {shipment?.tracking_number && (
              <span style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '2px 6px', borderRadius: 3, color: 'var(--text-secondary)' }}>{shipment.tracking_number}</span>
            )}
            {shipment?.carrier && <span>{shipment.carrier}</span>}
            {shipment?.eta && <span>ETA {fmtDate(shipment.eta)}</span>}
            {shipment?.port_of_loading && <span>{shipment.port_of_loading} → {shipment.destination || market}</span>}
          </div>
          {needsConfirm && <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: 'var(--accent-warm)' }}>⚡ Arrived — please confirm receipt</div>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <div className="section-title">Shipment Tracking</div>
          <div className="section-desc">{market} · {activeShipments.length} active shipment{activeShipments.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {trackingOrders.length === 0 ? (
        <div className="empty" style={{ marginTop: 40 }}>
          <div className="empty-icon">🚢</div>
          <div className="empty-title">No shipments yet</div>
          <div className="empty-desc">Tracking appears here once your orders are dispatched</div>
        </div>
      ) : (
        <>
          {activeShipments.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>Active Shipments</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {activeShipments.map(o => <ShipmentCard key={o.id} order={o} />)}
              </div>
            </>
          )}
          {completedShipments.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12 }}>Completed</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: 0.65 }}>
                {completedShipments.map(o => <ShipmentCard key={o.id} order={o} />)}
              </div>
            </>
          )}
        </>
      )}

      {selected && (
        <OrderTimelineModal
          order={selected}
          shipments={shipments.filter(s => s.order_id === selected.id)}
          onClose={() => setSelected(null)}
          onConfirmDelivery={() => confirmDelivery(selected)}
          onApproveSample={() => {}}
          onRejectSample={() => {}}
          sampleProcessing={false}
        />
      )}
    </div>
  );
}

// ── SUPPLIER CATALOG (read-only reference view) ────────────────────────────
export function SupplierCatalog({ products, orders }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [activeOnly, setActiveOnly] = useState(true);
  const [detailModal, setDetailModal] = useState(null);

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
          <div key={p.id} style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, cursor: 'pointer', zIndex: 1 }} onClick={() => setDetailModal(p)} title="View full details" />
            <ProductCard p={p} orders={orders.filter(o => o.type === 'standard')} showStatus />
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty" style={{ gridColumn: '1/-1' }}>
            <div className="empty-icon">◻</div>
            <div className="empty-title">No items found</div>
          </div>
        )}
      </div>
      {detailModal && <ProductDetailModal product={detailModal} onClose={() => setDetailModal(null)} />}
    </div>
  );
}
