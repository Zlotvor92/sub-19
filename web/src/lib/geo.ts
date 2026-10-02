/* Lokacija uređaja iz pregledača. Jedino mesto koje dodiruje `navigator.geolocation`. */

import type { GeoPort } from '../services/weather/weatherSync';

export function browserGeo(): GeoPort {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  return {
    available: () => !!nav?.geolocation,
    async denied() {
      try {
        if (!nav?.permissions?.query) return false;
        const st = await nav.permissions.query({ name: 'geolocation' });
        return st.state === 'denied';
      } catch {
        return false;
      }
    },
    position(opts) {
      return new Promise((resolve, reject) => {
        if (!nav?.geolocation) {
          reject(new Error('geo'));
          return;
        }
        nav.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          (e) => reject(Object.assign(new Error(e.message), { code: e.code })),
          opts
        );
      });
    },
    inApp() {
      try {
        const standalone = nav ? (nav as unknown as { standalone?: unknown }).standalone : false;
        return !!window.matchMedia?.('(display-mode: standalone)').matches || standalone === true;
      } catch {
        return false;
      }
    }
  };
}
