// PWA service-worker registration with auto-update.
//
// The app is an installable PWA; without update handling a browser can keep
// serving an old precached bundle indefinitely (symptom: fixes "work in one
// browser but not another", or forms that toast success but never upload —
// the old bundle faked persistence). skipWaiting + clientsClaim in
// vite.config.ts let a new worker take over immediately; the banner below
// tells the user to reload once when an update lands mid-session.
import { registerSW } from 'virtual:pwa-register';

// Identifiable build stamp — check this in the console to confirm which
// bundle a browser is actually running.
console.info(`[pharmachain] bundle ${import.meta.env.MODE} built ${__BUILD_TIME__}`);

function showUpdateBanner() {
  if (document.getElementById('pc-update-banner')) return;
  const el = document.createElement('div');
  el.id = 'pc-update-banner';
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed', 'left:16px', 'bottom:16px', 'z-index:9999',
    'display:flex', 'align-items:center', 'gap:12px',
    'background:#1e1b4b', 'color:#e0e7ff', 'padding:12px 16px',
    'border-radius:12px', 'font:500 13px/1.4 system-ui,sans-serif',
    'box-shadow:0 8px 24px rgba(0,0,0,.25)', 'max-width:340px',
  ].join(';');
  el.innerHTML =
    '<span>A new version of PharmaChain is ready.</span>';
  const btn = document.createElement('button');
  btn.textContent = 'Reload';
  btn.style.cssText = [
    'background:#6366f1', 'color:white', 'border:0', 'border-radius:8px',
    'padding:6px 12px', 'font:600 13px system-ui,sans-serif', 'cursor:pointer',
  ].join(';');
  btn.onclick = () => location.reload();
  el.appendChild(btn);
  document.body.appendChild(el);
}

registerSW({
  immediate: true,
  onNeedRefresh() {
    // autoUpdate usually applies silently; if an update is ever held back,
    // surface it visibly instead of leaving a stale client.
    showUpdateBanner();
  },
  onOfflineReady() {
    console.info('[pwa] PharmaChain is ready for offline use.');
  },
});
