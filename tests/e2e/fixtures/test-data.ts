// Test user credentials (must match seeded data in prisma/seed.ts)
export const TEST_USERS = {
  engineer: {
    email: 'thiyagarajan@htaipl.com',
    password: 'engineer123',
    name: 'Thiyagarajan',
  },
  hod: {
    email: 'kiran@htaipl.com',
    password: 'hod123',
    name: 'Kiran Kumar',
  },
  admin: {
    email: 'admin@htaipl.com',
    password: 'admin123',
    name: 'Hemanth Kumar',
  },
  customer: {
    email: 'customer@example.com',
    password: 'customer123',
    name: 'Test Customer',
    companyName: 'Test Company Pvt Ltd',
  },
}

// Test certificate data
export const TEST_CERTIFICATE = {
  customerName: 'Test Company Pvt Ltd',
  customerAddress: '123 Test Street, Bangalore',
  uucDescription: 'Digital Multimeter',
  uucMake: 'Fluke',
  uucModel: '87V',
  uucSerialNumber: 'TST-001',
}

// Status labels matching the application's StatusBadge component
export const STATUS_LABELS = {
  DRAFT: 'Draft',
  PENDING_HOD_REVIEW: 'Pending HoD Review',
  REVISION_REQUIRED: 'Revision Required',
  PENDING_CUSTOMER_APPROVAL: 'Pending Customer Approval',
  CUSTOMER_REVISION_REQUIRED: 'Customer Revision Required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}
