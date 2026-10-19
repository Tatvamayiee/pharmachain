// Single source of truth for the demo accounts shared by the frontend Login
// page and the backend seed/bootstrap. Passwords follow the <role>123 demo
// convention. DEV DEMO DATA ONLY — never seed real users from this.
const DEMO_USERS = [
  { id: 'demo-manufacturer', email: 'manufacturer@pharmachain.com', name: 'tatva manufacturer', role: 'manufacturer', organization: 'Tatva Pharmaceuticals' },
  { id: 'demo-distributor', email: 'distributor@pharmachain.com', name: 'kaveri distributor', role: 'distributor', organization: 'Kaveri Distributors' },
  { id: 'demo-dealer', email: 'dealer@pharmachain.com', name: 'sahana Pharmacy', role: 'dealer', organization: 'Sahana Medicals' },
  { id: 'demo-hospital', email: 'hospital@pharmachain.com', name: 'kmch hospital', role: 'hospital', organization: 'KMCH Hospitals' },
  { id: 'demo-customer', email: 'customer@pharmachain.com', name: 'arjun customer', role: 'customer', organization: '' },
  { id: 'demo-transport', email: 'transporter@pharmachain.com', name: 'Transporter', role: 'transport', organization: 'FleetGo Logistics' },
  { id: 'demo-admin', email: 'admin@pharmachain.com', name: 'regulatory admin', role: 'admin', organization: 'Central Drugs Authority' },
];

module.exports = { DEMO_USERS };
