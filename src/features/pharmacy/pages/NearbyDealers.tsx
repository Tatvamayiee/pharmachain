import { useEffect, useState } from 'react';
import { getDB, User } from '../../../platform/database/db';

// Static demo geo-coordinates (offline app — no live maps API)
const LOCATIONS: Record<string, { lat: number; lng: number; city: string }> = {
  'MediDist Dealer': { lat: 12.9716, lng: 77.5946, city: 'Bengaluru' },
  'sahana Pharmacy': { lat: 13.0355, lng: 77.5970, city: 'Bengaluru N.' },
  'Acme Pharma': { lat: 19.0760, lng: 72.8777, city: 'Mumbai' },
};

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.round(Math.hypot(a.lat - b.lat, a.lng - b.lng) * 111); // rough km
}

export default function NearbyDealers() {
  const [dealers, setDealers] = useState<{ name: string; city: string; km: number }[]>([]);

  useEffect(() => {
    (async () => {
      const db = await getDB();
      const users: User[] = await db.getAll('users');
      const here = LOCATIONS['sahana Pharmacy'];
      setDealers(
        users.filter(u => LOCATIONS[u.name] && u.role !== 'patient').map(u => ({
          name: u.name, city: LOCATIONS[u.name].city, km: dist(here, LOCATIONS[u.name]),
        })).sort((a, b) => a.km - b.km)
      );
    })();
  }, []);

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-2xl font-bold">Nearby Dealers</h1>
      <p className="mb-4 text-sm text-slate-500">Distance from sahana Pharmacy (demo geo data).</p>
      <div className="space-y-2">
        {dealers.map(d => (
          <div key={d.name} className="flex items-center justify-between rounded-xl border-slate- bg-white p-4">
            <div>
              <p className="text-sm font-medium">{d.name}</p>
              <p className="text-xs text-slate-500">{d.city}</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">{d.km} km</span>
          </div>
        ))}
      </div>
    </div>
  );
}
