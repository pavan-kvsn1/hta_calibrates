import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'

// For Prisma 7, use the SQLite adapter with options
// The db is at ./dev.db (relative to where the command runs from)
const adapter = new PrismaBetterSqlite3({
  url: 'file:./dev.db',
})
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Create two HoD users
  const hodPassword = await bcrypt.hash('hod123', 12)

  const hod1 = await prisma.user.upsert({
    where: { email: 'kiran@htaipl.com' },
    update: {},
    create: {
      email: 'kiran@htaipl.com',
      name: 'Kiran Kumar',
      passwordHash: hodPassword,
      role: 'HOD',
      isActive: true,
    },
  })
  console.log('Created HoD 1:', hod1.email)

  const hod2 = await prisma.user.upsert({
    where: { email: 'rajesh@htaipl.com' },
    update: {},
    create: {
      email: 'rajesh@htaipl.com',
      name: 'Rajesh Sharma',
      passwordHash: hodPassword,
      role: 'HOD',
      isActive: true,
    },
  })
  console.log('Created HoD 2:', hod2.email)

  // Create Engineer users - each assigned to a different HoD
  const engineerPassword = await bcrypt.hash('engineer123', 12)

  const engineer1 = await prisma.user.upsert({
    where: { email: 'thiyagarajan@htaipl.com' },
    update: { assignedHodId: hod1.id }, // Update assignment if exists
    create: {
      email: 'thiyagarajan@htaipl.com',
      name: 'Thiyagarajan',
      passwordHash: engineerPassword,
      role: 'ENGINEER',
      assignedHodId: hod1.id, // Reports to Kiran Kumar
      isActive: true,
    },
  })
  console.log('Created Engineer:', engineer1.email, '-> Reports to:', hod1.name)

  const engineer2 = await prisma.user.upsert({
    where: { email: 'chandrashekar@htaipl.com' },
    update: { assignedHodId: hod2.id }, // Update assignment if exists
    create: {
      email: 'chandrashekar@htaipl.com',
      name: 'Chandrashekar',
      passwordHash: engineerPassword,
      role: 'ENGINEER',
      assignedHodId: hod2.id, // Reports to Rajesh Sharma
      isActive: true,
    },
  })
  console.log('Created Engineer:', engineer2.email, '-> Reports to:', hod2.name)

  // Create Admin user
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@htaipl.com' },
    update: {},
    create: {
      email: 'admin@htaipl.com',
      name: 'Hemanth Kumar',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  })
  console.log('Created Admin:', admin.email)

  // Create Customer user
  const customerPassword = await bcrypt.hash('customer123', 12)
  const customer = await prisma.customerUser.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      name: 'Test Customer',
      passwordHash: customerPassword,
      companyName: 'Test Company Pvt Ltd',
      isActive: true,
    },
  })
  console.log('Created Customer:', customer.email)

  console.log('\n--- Test Credentials ---')
  console.log('Engineer 1: thiyagarajan@htaipl.com / engineer123 (Reports to Kiran)')
  console.log('Engineer 2: chandrashekar@htaipl.com / engineer123 (Reports to Rajesh)')
  console.log('HoD 1: kiran@htaipl.com / hod123 (Manages Thiyagarajan)')
  console.log('HoD 2: rajesh@htaipl.com / hod123 (Manages Chandrashekar)')
  console.log('Admin: admin@htaipl.com / admin123')
  console.log('Customer: customer@example.com / customer123')
  console.log('------------------------\n')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
