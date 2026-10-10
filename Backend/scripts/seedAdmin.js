// Create (or promote) the first super admin.
// Usage: ADMIN_EMAIL=you@x.com ADMIN_PASSWORD=secret [ADMIN_NAME="Super Admin"] npm run seed:admin
const mongoose = require('mongoose');
require('dotenv').config();
const Admin = require('../models/Admin');

(async () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Super Admin' } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  let admin = await Admin.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (admin) {
    admin.role = 'super_admin';
    admin.isActive = true;
    admin.password = ADMIN_PASSWORD; // re-hashed by the model's pre-save hook
  } else {
    admin = new Admin({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'super_admin' });
  }
  await admin.save();
  console.log(`Super admin ready: ${admin.email}`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
