// Basic consent: no Google script or request until an explicit opt-in.
const measurementId = 'G-323PY8QEP1';
const storageKey = 'jsqlite-analytics-consent-v1';
const lifetime = 180 * 24 * 60 * 60 * 1000;
const banner = document.getElementById('analytics-consent');
const settings = document.getElementById('analytics-settings');
let started = false;

function savedChoice() {
  try {
    const choice = JSON.parse(localStorage.getItem(storageKey));
    if (choice && ['accepted', 'rejected'].includes(choice.value) &&
        choice.expires > Date.now() && choice.expires <= Date.now() + lifetime) return choice.value;
  } catch { /* Unavailable storage means ask again next visit. */ }
  return null;
}

function startAnalytics() {
  if (started) return;
  started = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'granted', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
  });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    // Never include query strings, fragments, editor text or results.
    page_location: location.origin + location.pathname,
    page_referrer: '',
    page_title: 'JSQLite — browser playground',
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: 'none',
    cookie_path: '/jsqlite/',
    cookie_expires: lifetime / 1000,
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
}

function choose(value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ value, expires: Date.now() + lifetime }));
  } catch { /* The current visit's choice still applies. */ }
  banner.hidden = true;
  settings.focus();
  if (value === 'accepted') startAnalytics();
  else {
    window[`ga-disable-${measurementId}`] = true;
    // These cookies are scoped to this project, not sibling GitHub Pages sites.
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (name === '_ga' || name.startsWith('_ga_')) {
        document.cookie = `${name}=; Max-Age=0; Path=/jsqlite/; SameSite=Lax; Secure`;
      }
    }
    // Unload an already running tag when consent is withdrawn.
    if (started) location.reload();
  }
}

document.getElementById('analytics-accept').addEventListener('click', () => choose('accepted'));
document.getElementById('analytics-reject').addEventListener('click', () => choose('rejected'));
settings.addEventListener('click', () => {
  banner.hidden = false;
  document.getElementById('analytics-reject').focus();
});
const choice = savedChoice();
banner.hidden = choice !== null;
if (choice === 'accepted') startAnalytics();
