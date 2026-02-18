import { prisma } from '../src/lib/prisma'

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'ADMIN' },
        { isAdmin: true },
        { role: 'HOD' },
      ]
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isAdmin: true,
    },
  })

  console.log('Users with admin/HOD access:')
  console.log(JSON.stringify(users, null, 2))

  console.log('\n--- Summary ---')
  for (const user of users) {
    const showsToggle = user.role === 'HOD' && user.isAdmin === true
    console.log(`${user.email}: role=${user.role}, isAdmin=${user.isAdmin} -> Toggle visible: ${showsToggle}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
