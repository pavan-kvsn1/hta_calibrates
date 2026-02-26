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
}

// Test certificate data
export const TEST_CERTIFICATE = {
  customerName: 'Test Company Pvt Ltd',
  customerAddress: '123 Test Street, Test City',
  uucDescription: 'Digital Multimeter',
  uucMake: 'Fluke',
  uucModel: '87V',
  uucSerialNumber: 'TST-001',
}
