import { prisma } from '../src/lib/prisma'

async function main() {
  // Find all admin users
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true, role: true, isAdmin: true },
  })

  console.log('Current admin users:')
  console.log(JSON.stringify(admins, null, 2))

  if (admins.length === 0) {
    console.log('No admin users found')
    return
  }

  // Update the first admin to HOD with isAdmin
  const admin = admins[0]
  console.log(`\nUpdating ${admin.email} from ADMIN to HOD with isAdmin=true...`)

  const updated = await prisma.user.update({
    where: { id: admin.id },
    data: {
      role: 'HOD',
      isAdmin: true,
    },
  })

  console.log('Updated successfully:')
  console.log({ id: updated.id, email: updated.email, role: updated.role, isAdmin: updated.isAdmin })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
