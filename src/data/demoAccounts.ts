import type { UserRole } from '../types';

export interface DemoAccount {
  role: UserRole;
  label: string;
  name: string;
  email: string;
  password: string;
  organization: string;
  location: string;
}

/**
 * Demo credentials for the prototype. These are intentionally public and are
 * surfaced in the Login page "Demo Access" section. Production authentication
 * would replace this service entirely (see services/authService.ts).
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'manufacturer',
    label: 'Manufacturer',
    name: 'tatva manufacturer',
    email: 'manufacturer@pharmachain.com',
    password: 'manufacturer123',
    organization: 'Tatva Pharmaceuticals',
    location: 'Tiruppur, Tamil Nadu',
  },
  {
    role: 'distributor',
    label: 'Distributor',
    name: 'kaveri distributor',
    email: 'distributor@pharmachain.com',
    password: 'distributor123',
    organization: 'Kaveri Distributors',
    location: 'Coimbatore, Tamil Nadu',
  },
  {
    role: 'dealer',
    label: 'Dealer / Pharmacy',
    name: 'sahana Pharmacy',
    email: 'dealer@pharmachain.com',
    password: 'dealer123',
    organization: 'Sahana Medicals',
    location: 'Chennai, Tamil Nadu',
  },
  {
    role: 'hospital',
    label: 'Hospital',
    name: 'kmch hospital',
    email: 'hospital@pharmachain.com',
    password: 'hospital123',
    organization: 'KMCH Hospitals',
    location: 'Coimbatore, Tamil Nadu',
  },
  {
    role: 'customer',
    label: 'Customer',
    name: 'arjun customer',
    email: 'customer@pharmachain.com',
    password: 'customer123',
    organization: '—',
    location: 'Madurai, Tamil Nadu',
  },
  {
    role: 'transport',
    label: 'Transporter',
    name: 'Transporter',
    email: 'transporter@pharmachain.com',
    password: 'transport123',
    organization: 'FleetGo Logistics',
    location: 'Chennai, Tamil Nadu',
  },
  {
    role: 'admin',
    label: 'Administrator',
    name: 'regulatory admin',
    email: 'admin@pharmachain.com',
    password: 'admin123',
    organization: 'Central Drugs Authority',
    location: 'Hyderabad, Telangana',
  },
];

export const ROLE_HOME: Record<UserRole, string> = {
  manufacturer: '/manufacturer',
  distributor: '/distributor',
  dealer: '/dealer',
  hospital: '/hospital',
  customer: '/customer',
  transport: '/transporter',
  admin: '/admin',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  manufacturer: 'Manufacturer',
  distributor: 'Distributor',
  dealer: 'Dealer / Pharmacy',
  hospital: 'Hospital',
  customer: 'Customer',
  transport: 'Transporter',
  admin: 'Regulatory Administrator',
};
