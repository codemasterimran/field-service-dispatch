import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create dispatcher
  const dispatcher = await prisma.user.upsert({
    where: { email: 'dispatcher@fieldservice.com' },
    update: {},
    create: {
      email: 'dispatcher@fieldservice.com',
      passwordHash: await bcrypt.hash('dispatch123', 12),
      name: 'Sarah Mitchell',
      role: 'DISPATCHER',
    },
  });

  // Create technicians
  const tech1 = await prisma.user.upsert({
    where: { email: 'tech1@fieldservice.com' },
    update: {},
    create: {
      email: 'tech1@fieldservice.com',
      passwordHash: await bcrypt.hash('tech123', 12),
      name: 'James Carter',
      role: 'TECHNICIAN',
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: 'tech2@fieldservice.com' },
    update: {},
    create: {
      email: 'tech2@fieldservice.com',
      passwordHash: await bcrypt.hash('tech123', 12),
      name: 'Priya Sharma',
      role: 'TECHNICIAN',
    },
  });

  const tech3 = await prisma.user.upsert({
    where: { email: 'tech3@fieldservice.com' },
    update: {},
    create: {
      email: 'tech3@fieldservice.com',
      passwordHash: await bcrypt.hash('tech123', 12),
      name: 'Marcus Webb',
      role: 'TECHNICIAN',
    },
  });

  console.log('Users seeded:', {
    dispatcher: dispatcher.email,
    techs: [tech1.email, tech2.email, tech3.email],
  });

  console.log('Seed complete!');
  console.log('\nDemo credentials:');
  console.log('  Dispatcher: dispatcher@fieldservice.com / dispatch123');
  console.log('  Technician: tech1@fieldservice.com / tech123');
  console.log('  Technician: tech2@fieldservice.com / tech123');
  console.log('  Technician: tech3@fieldservice.com / tech123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
