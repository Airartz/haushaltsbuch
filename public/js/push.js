// Push Notification Verwaltung
let _pushSubscription = null;

// ─── Stiller Auto-Init (beim App-Start) ─────────────────────────────────────
// Fragt KEINE Berechtigung an – nur reaktivieren wenn bereits erlaubt
async function initPushSilent() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return; // Nur wenn schon erlaubt

  try {
    const registration = await navigator.serviceWorker.ready;
    const res          = await fetch('/push/vapid-key');
    const { publicKey } = await res.json();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlB64ToUint8Array(publicKey)
      });
    }
    _pushSubscription = subscription;

    await fetch('/push/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription })
    });
  } catch (_) {}  // Fehler still ignorieren beim Auto-Init
}

// ─── Manuelles Aktivieren (per User-Klick) ───────────────────────────────────
async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Push wird von diesem Browser nicht unterstützt', 'error');
    return false;
  }

  try {
    // Berechtigung anfragen – nur mit User-Geste erlaubt!
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      showToast('Benachrichtigungen wurden abgelehnt', 'error');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const res          = await fetch('/push/vapid-key');
    const { publicKey } = await res.json();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlB64ToUint8Array(publicKey)
      });
    }
    _pushSubscription = subscription;

    const saveRes = await fetch('/push/subscribe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subscription })
    });

    if (saveRes.ok) {
      showToast('Benachrichtigungen aktiviert!', 'success');
      return true;
    }
    return false;
  } catch (err) {
    showToast('Fehler: ' + err.message, 'error');
    return false;
  }
}

// ─── Test-Push ───────────────────────────────────────────────────────────────
async function sendTestPush() {
  try {
    const res  = await fetch('/push/test', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Test fehlgeschlagen', 'error');
    } else {
      showToast(`Test gesendet! (${data.sent} Gerät${data.sent !== 1 ? 'e' : ''})`, 'success');
    }
  } catch (_) {
    showToast('Verbindungsfehler beim Test', 'error');
  }
}

// ─── Deaktivieren ────────────────────────────────────────────────────────────
async function unsubscribePush() {
  try {
    if (_pushSubscription) {
      await fetch('/push/unsubscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ endpoint: _pushSubscription.endpoint })
      });
      await _pushSubscription.unsubscribe();
      _pushSubscription = null;
    }
    showToast('Benachrichtigungen deaktiviert', 'info');
  } catch (_) {}
}

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const b64u = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw  = atob(b64u);
  const arr  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
