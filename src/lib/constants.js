export const MARKETS = ['Nigeria', 'Ghana', 'International'];
export const CATEGORIES = ['Apparel', 'Drinkware', 'Bags & Totes', 'Stationery', 'Office & Desk', 'Tech Accessories', 'Outdoor & Lifestyle'];
export const CATEGORY_ABBR = { 'Apparel': 'AP', 'Drinkware': 'DW', 'Bags & Totes': 'BT', 'Stationery': 'ST', 'Office & Desk': 'OD', 'Tech Accessories': 'TA', 'Outdoor & Lifestyle': 'OL' };

export const ORDER_STAGES = [
  { key: 'collecting',    label: 'Collecting Orders', short: 'Collecting' },
  { key: 'moq_reached',  label: 'MOQ Reached',        short: 'MOQ Reached' },
  { key: 'accepted',     label: 'Accepted',            short: 'Accepted' },
  { key: 'in_production',label: 'In Production',       short: 'Production' },
  { key: 'dispatched',   label: 'Dispatched',          short: 'Dispatched' },
  { key: 'in_transit',   label: 'In Transit',          short: 'In Transit' },
  { key: 'arrived',      label: 'Arrived at Port',     short: 'Arrived' },
  { key: 'delivered',    label: 'Delivered',           short: 'Delivered' },
];

export const SAMPLE_STAGES = [
  { key: 'collecting',       label: 'Requested',          short: 'Requested' },
  { key: 'accepted',         label: 'Acknowledged',        short: 'Acknowledged' },
  { key: 'pending_approval', label: 'Awaiting Approval',   short: 'Awaiting' },
  { key: 'dispatched',       label: 'Dispatched',          short: 'Dispatched' },
  { key: 'delivered',        label: 'Received',            short: 'Received' },
];

export const STAGE_COLORS = {
  collecting:    { bg: '#F5F0E8', text: '#92400E' },
  moq_reached:   { bg: '#FFFBEB', text: '#92400E' },
  accepted:      { bg: '#EFF6FF', text: '#1D4ED8' },
  in_production: { bg: '#F0FDF4', text: '#166534' },
  dispatched:    { bg: '#F0F9FF', text: '#0369A1' },
  in_transit:    { bg: '#F0F9FF', text: '#0369A1' },
  arrived:       { bg: '#ECFDF5', text: '#065F46' },
  delivered:     { bg: '#ECFDF5', text: '#065F46' },
  pending_approval: { bg: '#FFFBEB', text: '#92400E' },
  cancelled_moq_not_met: { bg: '#FEF2F2', text: '#991B1B' },
};

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#FAFAF8;--surface:#FFFFFF;--border:#E8E4DE;--border-strong:#C8C2BA;
  --text-primary:#1A1714;--text-secondary:#7A7068;--text-muted:#B0A89E;
  --accent:#1A1714;--accent-warm:#C17F3E;--accent-light:#F5F0E8;
  --red:#C0392B;--green:#2D6A4F;--blue:#1D4ED8;--yellow:#92400E;
  --radius:2px;--radius-md:4px;
  --shadow-sm:0 1px 3px rgba(26,23,20,0.06);
  --shadow-md:0 4px 16px rgba(26,23,20,0.08);
  --shadow-lg:0 12px 40px rgba(26,23,20,0.12);
  --font-display:'Cormorant Garamond',Georgia,serif;
  --font-body:'DM Sans',sans-serif;
  --sidebar-w:224px;--header-h:56px;
}
body{font-family:var(--font-body);background:var(--bg);color:var(--text-primary);font-size:13px;line-height:1.5}
.app{display:flex;height:100vh;overflow:hidden}
.sidebar{width:var(--sidebar-w);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.header{height:var(--header-h);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 28px;gap:14px;background:var(--surface);flex-shrink:0}
.content{flex:1;overflow-y:auto;padding:32px 28px}
.sidebar-logo{padding:20px 20px 16px;border-bottom:1px solid var(--border);flex-shrink:0}
.sidebar-logo h1{font-family:var(--font-display);font-size:19px;font-weight:500;letter-spacing:0.02em}
.sidebar-logo span{font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);font-weight:300}
.sidebar-section{padding:14px 12px 6px}
.sidebar-label{font-size:9px;letter-spacing:0.16em;text-transform:uppercase;color:var(--text-muted);font-weight:500;padding:0 8px;margin-bottom:4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);cursor:pointer;color:var(--text-secondary);font-size:12.5px;font-weight:400;transition:all 0.15s}
.nav-item:hover{background:var(--accent-light);color:var(--text-primary)}
.nav-item.active{background:var(--text-primary);color:white}
.nav-item svg{width:14px;height:14px;flex-shrink:0}
.nav-badge{margin-left:auto;background:#FFFBEB;color:#92400E;font-size:9px;font-weight:600;padding:1px 6px;border-radius:999px}
.nav-badge.active{background:rgba(255,255,255,0.2);color:white}
.sidebar-footer{margin-top:auto;padding:14px 16px;border-top:1px solid var(--border);flex-shrink:0}
.user-chip{display:flex;align-items:center;gap:10px}
.user-avatar{width:30px;height:30px;border-radius:50%;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--accent-warm);flex-shrink:0}
.user-name{font-size:12px;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-role{font-size:10px;color:var(--text-muted);letter-spacing:0.04em}
.sign-out-btn{background:none;border:none;cursor:pointer;font-size:10px;color:var(--text-muted);font-family:var(--font-body);padding:4px 0;letter-spacing:0.06em;text-transform:uppercase;transition:color 0.15s}
.sign-out-btn:hover{color:var(--red)}
.header-title{font-family:var(--font-display);font-size:20px;font-weight:400;flex:1}
.header-meta{font-size:11px;color:var(--text-muted);letter-spacing:0.06em}
.live-indicator{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--green);letter-spacing:0.06em}
.live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md)}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:18px}
.product-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;transition:box-shadow 0.2s,border-color 0.2s}
.product-card:hover{box-shadow:var(--shadow-md);border-color:var(--border-strong)}
.product-card-img-wrap{position:relative;overflow:hidden;height:200px;background:var(--accent-light);cursor:zoom-in}
.product-card-img{width:100%;height:200px;object-fit:cover;object-position:center;display:block;transition:transform 0.3s ease}
.product-card:hover .product-card-img{transform:scale(1.02)}
.product-card-body{padding:14px 16px}
.product-card-cat{font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px}
.product-card-name{font-family:var(--font-display);font-size:17px;font-weight:500;line-height:1.2;margin-bottom:4px}
.product-card-price{font-size:11px;color:var(--text-secondary);margin-bottom:6px}
.product-card-price strong{color:var(--text-primary);font-weight:500}
.product-card-lead{font-size:10px;color:var(--text-muted);font-style:italic;margin-bottom:10px}
.img-brand-tag{position:absolute;bottom:8px;left:8px;background:rgba(255,255,255,0.92);backdrop-filter:blur(4px);border:1px solid var(--border);border-radius:999px;padding:2px 10px;display:flex;align-items:center;gap:5px;font-size:10px;font-weight:500;pointer-events:none}
.img-thumbs{display:flex;gap:4px;position:absolute;bottom:8px;right:8px}
.img-thumb{width:24px;height:24px;border-radius:2px;object-fit:cover;border:1.5px solid white;cursor:pointer;opacity:0.7;transition:opacity 0.15s}
.img-thumb.active,.img-thumb:hover{opacity:1}
.moq-section{margin:8px 0 6px}
.moq-label{display:flex;justify-content:space-between;margin-bottom:5px}
.moq-label span{font-size:10px;color:var(--text-secondary)}
.moq-label strong{font-size:10px;font-weight:500}
.moq-track{height:3px;background:var(--border);border-radius:999px;overflow:hidden}
.moq-fill{height:100%;border-radius:999px;transition:width 0.4s;background:var(--accent)}
.moq-fill.reached{background:var(--green)}
.moq-fill.close{background:var(--accent-warm)}
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:500;letter-spacing:0.03em;white-space:nowrap}
.badge-green{background:#ECFDF5;color:#065F46}
.badge-amber{background:#FFFBEB;color:#92400E}
.badge-red{background:#FEF2F2;color:#991B1B}
.badge-grey{background:var(--accent-light);color:var(--text-secondary)}
.badge-blue{background:#EFF6FF;color:#1D4ED8}
.badge-sky{background:#F0F9FF;color:#0369A1}
.variant-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.variant-pill{display:flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid var(--border);border-radius:999px;font-size:10px;cursor:pointer;transition:all 0.15s;user-select:none}
.variant-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.variants-label{font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-top:10px;margin-bottom:5px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
thead tr{border-bottom:1px solid var(--border)}
th{font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);font-weight:500;padding:0 14px 10px;text-align:left;white-space:nowrap}
td{padding:12px 14px;border-bottom:1px solid var(--border);font-size:12.5px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--bg)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group.full{grid-column:1/-1}
label{font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-secondary);font-weight:500}
input,select,textarea{font-family:var(--font-body);font-size:13px;border:1px solid var(--border);border-radius:var(--radius-md);padding:8px 11px;background:var(--surface);color:var(--text-primary);outline:none;transition:border-color 0.15s;width:100%}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
input::placeholder,textarea::placeholder{color:var(--text-muted)}
textarea{resize:vertical;min-height:72px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--radius-md);font-family:var(--font-body);font-size:12px;font-weight:500;cursor:pointer;border:none;transition:all 0.15s;letter-spacing:0.02em}
.btn:disabled{opacity:0.45;cursor:not-allowed}
.btn-primary{background:var(--text-primary);color:white}
.btn-primary:hover:not(:disabled){background:#333}
.btn-secondary{background:var(--surface);color:var(--text-primary);border:1px solid var(--border)}
.btn-secondary:hover:not(:disabled){border-color:var(--border-strong);background:var(--bg)}
.btn-ghost{background:transparent;color:var(--text-secondary);border:1px solid transparent}
.btn-ghost:hover{background:var(--accent-light);color:var(--text-primary)}
.btn-sm{padding:5px 11px;font-size:11px}
.btn-danger{background:#FEF2F2;color:var(--red);border:1px solid #FECACA}
.btn-danger:hover{background:#FEE2E2}
.btn-success{background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0}
.btn-success:hover{background:#D1FAE5}
.modal-backdrop{position:fixed;inset:0;background:rgba(26,23,20,0.45);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(2px);animation:fadeIn 0.15s}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);width:580px;max-width:96vw;max-height:90vh;overflow-y:auto;animation:slideUp 0.2s ease}
.modal.wide{width:760px}
.modal.narrow{width:440px}
.modal.fullscreen{width:96vw;max-width:960px}
.modal-header{padding:20px 24px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;position:sticky;top:0;background:var(--surface);z-index:1}
.modal-title{font-family:var(--font-display);font-size:21px;font-weight:500}
.modal-subtitle{font-size:11px;color:var(--text-muted);margin-top:2px}
.modal-body{padding:20px 24px}
.modal-footer{padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;position:sticky;bottom:0;background:var(--surface)}
.close-btn{background:none;border:none;cursor:pointer;color:var(--text-muted);padding:2px;transition:color 0.15s;line-height:1}
.close-btn:hover{color:var(--text-primary)}
.stats-row{display:grid;gap:14px;margin-bottom:26px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px 18px}
.stat-label{font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px}
.stat-value{font-family:var(--font-display);font-size:30px;font-weight:400;line-height:1}
.stat-sub{font-size:10px;color:var(--text-secondary);margin-top:4px}
.section-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;gap:12px}
.section-title{font-family:var(--font-display);font-size:23px;font-weight:400}
.section-desc{font-size:11px;color:var(--text-muted);margin-top:1px}
.tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:22px;overflow-x:auto}
.tab{padding:8px 16px;font-size:11px;letter-spacing:0.06em;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;color:var(--text-secondary);transition:all 0.15s;white-space:nowrap;flex-shrink:0}
.tab.active{color:var(--text-primary);border-bottom-color:var(--text-primary);font-weight:500}
.tab:hover:not(.active){color:var(--text-primary)}
.filter-row{display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap;align-items:center}
.filter-chip{padding:5px 12px;border:1px solid var(--border);border-radius:999px;font-size:11px;color:var(--text-secondary);cursor:pointer;background:var(--surface);transition:all 0.15s}
.filter-chip.active{background:var(--text-primary);color:white;border-color:var(--text-primary)}
.search-input{border:1px solid var(--border);border-radius:var(--radius-md);padding:6px 12px;font-size:12px;background:var(--surface);color:var(--text-primary);outline:none;font-family:var(--font-body);transition:border-color 0.15s;min-width:180px}
.search-input:focus{border-color:var(--border-strong)}
.empty{text-align:center;padding:52px 24px}
.empty-icon{font-size:28px;margin-bottom:12px;opacity:0.35}
.empty-title{font-family:var(--font-display);font-size:19px;font-weight:400;color:var(--text-secondary);margin-bottom:4px}
.empty-desc{font-size:12px;color:var(--text-muted)}
.divider{height:1px;background:var(--border);margin:18px 0}
.variant-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)}
.variant-row:last-child{border-bottom:none}
.lifecycle-node{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;border:2px solid var(--border);background:var(--surface);color:var(--text-muted);flex-shrink:0;transition:all 0.2s}
.lifecycle-node.done{background:var(--text-primary);border-color:var(--text-primary);color:white}
.lifecycle-node.active{background:var(--accent-warm);border-color:var(--accent-warm);color:white}
.lifecycle-connector{width:24px;height:2px;background:var(--border);flex-shrink:0}
.lifecycle-connector.done{background:var(--text-primary)}
.lifecycle-label{font-size:9px;color:var(--text-muted);text-align:center;margin-top:4px;white-space:nowrap;max-width:60px}
.lifecycle-label.active{color:var(--accent-warm);font-weight:500}
.lifecycle-label.done{color:var(--text-primary)}
.loading-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:var(--bg);gap:14px}
.loading-logo{font-family:var(--font-display);font-size:30px;font-weight:400}
.loading-sub{font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted)}
.spinner{width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--text-primary);border-radius:50%;animation:spin 0.7s linear infinite}
.toast{position:fixed;bottom:22px;right:22px;background:var(--text-primary);color:white;padding:10px 18px;border-radius:var(--radius-md);font-size:12px;display:flex;align-items:center;gap:8px;box-shadow:var(--shadow-lg);z-index:2000;animation:slideUp 0.2s ease}
.toast.error{background:var(--red)}
.toast.success{background:var(--green)}
.login-screen{display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg)}
.login-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);padding:40px;width:380px;box-shadow:var(--shadow-md)}
.login-logo{font-family:var(--font-display);font-size:28px;font-weight:400;margin-bottom:4px}
.login-sub{font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);margin-bottom:28px}
.shipment-card{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-md);padding:14px 16px;margin-bottom:10px}
.shipment-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
.info-item label{font-size:9px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:2px}
.info-item span{font-size:12.5px;color:var(--text-primary)}
.approval-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;margin-bottom:14px}
.approval-card-header{display:flex;gap:14px;padding:16px;border-bottom:1px solid var(--border)}
.approval-card-img{width:60px;height:60px;object-fit:cover;border-radius:var(--radius);background:var(--accent-light);flex-shrink:0}
/* Lightbox */
.lightbox{position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:2000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s}
.lightbox-img{max-width:90vw;max-height:85vh;object-fit:contain;border-radius:4px}
.lightbox-close{position:absolute;top:20px;right:24px;background:none;border:none;color:white;cursor:pointer;font-size:24px;opacity:0.7;transition:opacity 0.15s}
.lightbox-close:hover{opacity:1}
.lightbox-prev,.lightbox-next{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.1);border:none;color:white;cursor:pointer;padding:12px 16px;border-radius:var(--radius-md);font-size:18px;transition:background 0.15s}
.lightbox-prev{left:20px}
.lightbox-next{right:20px}
.lightbox-prev:hover,.lightbox-next:hover{background:rgba(255,255,255,0.2)}
.lightbox-counter{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:0.1em}
/* Cart */
.cart-bar{position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--border);padding:14px 0;margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.cart-summary{font-size:12px;color:var(--text-secondary)}
.cart-summary strong{color:var(--text-primary)}
/* Notification dot */
.notif-dot{width:7px;height:7px;border-radius:50%;background:var(--red);margin-left:auto;flex-shrink:0}
/* Inline color picker */
.color-swatch-btn{width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px var(--border);cursor:pointer;flex-shrink:0;transition:transform 0.15s}
.color-swatch-btn:hover{transform:scale(1.1)}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:3px}
`;
