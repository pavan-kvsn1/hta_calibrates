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

  // Create HoD user first
  const hodPassword = await bcrypt.hash('hod123', 12)
  const hod = await prisma.user.upsert({
    where: { email: 'hod@htaipl.com' },
    update: {},
    create: {
      email: 'hod@htaipl.com',
      name: 'Kiran Kumar',
      passwordHash: hodPassword,
      role: 'HOD',
      isActive: true,
    },
  })
  console.log('Created HoD:', hod.email)

  // Create Engineer users
  const engineerPassword = await bcrypt.hash('engineer123', 12)

  const engineer1 = await prisma.user.upsert({
    where: { email: 'thiyagarajan@htaipl.com' },
    update: {},
    create: {
      email: 'thiyagarajan@htaipl.com',
      name: 'Thiyagarajan',
      passwordHash: engineerPassword,
      role: 'ENGINEER',
      assignedHodId: hod.id,
      isActive: true,
    },
  })
  console.log('Created Engineer:', engineer1.email)

  const engineer2 = await prisma.user.upsert({
    where: { email: 'chandrashekar@htaipl.com' },
    update: {},
    create: {
      email: 'chandrashekar@htaipl.com',
      name: 'Chandrashekar',
      passwordHash: engineerPassword,
      role: 'ENGINEER',
      assignedHodId: hod.id,
      isActive: true,
    },
  })
  console.log('Created Engineer:', engineer2.email)

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
  console.log('Engineer: thiyagarajan@htaipl.com / engineer123')
  console.log('Engineer: chandrashekar@htaipl.com / engineer123')
  console.log('HoD: hod@htaipl.com / hod123')
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
