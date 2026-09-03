import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const daysFromNow = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
};

async function main() {
  console.log('Seeding database…');

  // ─── Users ───────────────────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hash(pw, 12);

  const dispatcher = await prisma.user.upsert({
    where: { email: 'dispatcher@fieldservice.com' },
    update: {},
    create: {
      email: 'dispatcher@fieldservice.com',
      passwordHash: await hash('dispatch123'),
      name: 'Sarah Mitchell',
      role: 'DISPATCHER',
    },
  });

  const tech1 = await prisma.user.upsert({
    where: { email: 'tech1@fieldservice.com' },
    update: {},
    create: {
      email: 'tech1@fieldservice.com',
      passwordHash: await hash('tech123'),
      name: 'James Carter',
      role: 'TECHNICIAN',
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: 'tech2@fieldservice.com' },
    update: {},
    create: {
      email: 'tech2@fieldservice.com',
      passwordHash: await hash('tech123'),
      name: 'Priya Sharma',
      role: 'TECHNICIAN',
    },
  });

  const tech3 = await prisma.user.upsert({
    where: { email: 'tech3@fieldservice.com' },
    update: {},
    create: {
      email: 'tech3@fieldservice.com',
      passwordHash: await hash('tech123'),
      name: 'Marcus Webb',
      role: 'TECHNICIAN',
    },
  });

  console.log('✓ Users seeded');

  // ─── Jobs ─────────────────────────────────────────────────────────────────
  // Clear existing demo jobs + related data for a clean re-seed
  await prisma.jobEvent.deleteMany({});
  await prisma.partUsed.deleteMany({});
  await prisma.jobAssignment.deleteMany({});
  await prisma.alertDismissal.deleteMany({});
  await prisma.job.deleteMany({});
  console.log('✓ Cleared existing jobs for fresh seed');

  // 1 — Completed job (yesterday, James, with parts & timeline)
  const job1 = await prisma.job.create({
    data: {
      customerName: 'Riverside Apartments',
      siteAddress: '12 Riverside Walk, Manchester, M1 1AA',
      description: 'Annual boiler service and safety inspection. Replace flue seal if worn.',
      priority: 1,
      scheduledDate: daysFromNow(-1),
      startTime: '09:00',
      estimatedDurationMinutes: 90,
      status: 'COMPLETED',
      completionNote: 'Boiler serviced, flue seal replaced. Advised landlord to replace thermostat within 3 months.',
    },
  });
  await prisma.jobAssignment.create({ data: { jobId: job1.id, technicianId: tech1.id } });
  await prisma.partUsed.create({ data: { jobId: job1.id, partName: 'Flue seal kit FS-220', quantity: 1, recordedById: tech1.id } });
  await prisma.partUsed.create({ data: { jobId: job1.id, partName: 'Service gasket set', quantity: 1, recordedById: tech1.id } });
  for (const evt of [
    { type: 'STATUS_CHANGE', oldValue: null, newValue: 'UNASSIGNED' },
    { type: 'ASSIGNED', oldValue: null, newValue: tech1.name },
    { type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED' },
    { type: 'STATUS_CHANGE', oldValue: 'ASSIGNED', newValue: 'EN_ROUTE' },
    { type: 'STATUS_CHANGE', oldValue: 'EN_ROUTE', newValue: 'ON_SITE' },
    { type: 'PART_ADDED', oldValue: null, newValue: '1× Flue seal kit FS-220' },
    { type: 'PART_ADDED', oldValue: null, newValue: '1× Service gasket set' },
    { type: 'COMPLETION', oldValue: 'ON_SITE', newValue: 'COMPLETED' },
    { type: 'NOTE', oldValue: null, newValue: 'Boiler serviced, flue seal replaced.' },
  ] as const) {
    await prisma.jobEvent.create({ data: { jobId: job1.id, type: evt.type, oldValue: evt.oldValue ?? null, newValue: evt.newValue ?? null, actorId: dispatcher.id } });
  }

  // 2 — On-site now (today, Priya)
  const job2 = await prisma.job.create({
    data: {
      customerName: 'Greenleaf Office Park',
      siteAddress: '45 Business Quarter, Leeds, LS1 2AB',
      description: 'Emergency HVAC failure — entire floor 3 AC units offline. Diagnose and restore.',
      priority: 1,
      scheduledDate: daysFromNow(0),
      startTime: '08:30',
      estimatedDurationMinutes: 120,
      status: 'ON_SITE',
    },
  });
  await prisma.jobAssignment.create({ data: { jobId: job2.id, technicianId: tech2.id } });
  await prisma.partUsed.create({ data: { jobId: job2.id, partName: 'Refrigerant R-410A (1kg)', quantity: 2, recordedById: tech2.id } });
  for (const evt of [
    { type: 'STATUS_CHANGE', oldValue: null, newValue: 'UNASSIGNED' },
    { type: 'ASSIGNED', oldValue: null, newValue: tech2.name },
    { type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED' },
    { type: 'STATUS_CHANGE', oldValue: 'ASSIGNED', newValue: 'EN_ROUTE' },
    { type: 'STATUS_CHANGE', oldValue: 'EN_ROUTE', newValue: 'ON_SITE' },
    { type: 'PART_ADDED', oldValue: null, newValue: '2× Refrigerant R-410A (1kg)' },
  ] as const) {
    await prisma.jobEvent.create({ data: { jobId: job2.id, type: evt.type, oldValue: evt.oldValue ?? null, newValue: evt.newValue ?? null, actorId: dispatcher.id } });
  }

  // 3 — En route (today, Marcus)
  const job3 = await prisma.job.create({
    data: {
      customerName: 'Harwood Primary School',
      siteAddress: '8 School Lane, Birmingham, B15 3CD',
      description: 'Scheduled electrical inspection — check distribution board, test RCDs.',
      priority: 2,
      scheduledDate: daysFromNow(0),
      startTime: '10:00',
      estimatedDurationMinutes: 60,
      status: 'EN_ROUTE',
    },
  });
  await prisma.jobAssignment.create({ data: { jobId: job3.id, technicianId: tech3.id } });
  for (const evt of [
    { type: 'STATUS_CHANGE', oldValue: null, newValue: 'UNASSIGNED' },
    { type: 'ASSIGNED', oldValue: null, newValue: tech3.name },
    { type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED' },
    { type: 'STATUS_CHANGE', oldValue: 'ASSIGNED', newValue: 'EN_ROUTE' },
  ] as const) {
    await prisma.jobEvent.create({ data: { jobId: job3.id, type: evt.type, oldValue: evt.oldValue ?? null, newValue: evt.newValue ?? null, actorId: dispatcher.id } });
  }

  // 4 — Assigned, later today (James)
  const job4 = await prisma.job.create({
    data: {
      customerName: 'The Grand Hotel',
      siteAddress: '1 Victoria Square, Edinburgh, EH1 1AA',
      description: 'Replace faulty water pump in basement plant room. Parts pre-ordered.',
      priority: 2,
      scheduledDate: daysFromNow(0),
      startTime: '14:00',
      estimatedDurationMinutes: 150,
      status: 'ASSIGNED',
    },
  });
  await prisma.jobAssignment.create({ data: { jobId: job4.id, technicianId: tech1.id } });
  for (const evt of [
    { type: 'STATUS_CHANGE', oldValue: null, newValue: 'UNASSIGNED' },
    { type: 'ASSIGNED', oldValue: null, newValue: tech1.name },
    { type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED' },
  ] as const) {
    await prisma.jobEvent.create({ data: { jobId: job4.id, type: evt.type, oldValue: evt.oldValue ?? null, newValue: evt.newValue ?? null, actorId: dispatcher.id } });
  }

  // 5 — Unassigned, tomorrow (open for bulk assign demo)
  const job5 = await prisma.job.create({
    data: {
      customerName: 'Parkview Retail Centre',
      siteAddress: '99 Park Road, Bristol, BS1 5EF',
      description: 'Install 3 new smart meter units across units 4, 7, and 12.',
      priority: 3,
      scheduledDate: daysFromNow(1),
      startTime: '09:00',
      estimatedDurationMinutes: 180,
      status: 'UNASSIGNED',
    },
  });
  await prisma.jobEvent.create({ data: { jobId: job5.id, type: 'STATUS_CHANGE', oldValue: null, newValue: 'UNASSIGNED', actorId: dispatcher.id } });

  // 6 — Unassigned, tomorrow (open)
  const job6 = await prisma.job.create({
    data: {
      customerName: 'Meadowbrook Care Home',
      siteAddress: '22 Meadow Close, Sheffield, S1 4GH',
      description: 'Emergency generator test & annual maintenance. Critical — care home cannot lose power.',
      priority: 1,
      scheduledDate: daysFromNow(1),
      startTime: '11:00',
      estimatedDurationMinutes: 90,
      status: 'UNASSIGNED',
    },
  });
  await prisma.jobEvent.create({ data: { jobId: job6.id, type: 'STATUS_CHANGE', oldValue: null, newValue: 'UNASSIGNED', actorId: dispatcher.id } });

  // 7 — Assigned, day after tomorrow (Priya)
  const job7 = await prisma.job.create({
    data: {
      customerName: 'Citylink Data Centre',
      siteAddress: '5 Technology Drive, London, EC2A 1HJ',
      description: 'UPS battery replacement and load test. Maintenance window 02:00-06:00.',
      priority: 1,
      scheduledDate: daysFromNow(2),
      startTime: '02:00',
      estimatedDurationMinutes: 240,
      status: 'ASSIGNED',
    },
  });
  await prisma.jobAssignment.create({ data: { jobId: job7.id, technicianId: tech2.id } });
  for (const evt of [
    { type: 'STATUS_CHANGE', oldValue: null, newValue: 'UNASSIGNED' },
    { type: 'ASSIGNED', oldValue: null, newValue: tech2.name },
    { type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED' },
  ] as const) {
    await prisma.jobEvent.create({ data: { jobId: job7.id, type: evt.type, oldValue: evt.oldValue ?? null, newValue: evt.newValue ?? null, actorId: dispatcher.id } });
  }

  // 8 — Late job (2 days ago, still EN_ROUTE — triggers alert)
  const job8 = await prisma.job.create({
    data: {
      customerName: 'Sunview Flats',
      siteAddress: '33 Sunview Road, Liverpool, L1 8JK',
      description: 'Repair burst pipe in communal area. Water isolated but tenants affected.',
      priority: 1,
      scheduledDate: daysFromNow(-2),
      startTime: '07:00',
      estimatedDurationMinutes: 120,
      status: 'EN_ROUTE',
    },
  });
  await prisma.jobAssignment.create({ data: { jobId: job8.id, technicianId: tech3.id } });
  for (const evt of [
    { type: 'STATUS_CHANGE', oldValue: null, newValue: 'UNASSIGNED' },
    { type: 'ASSIGNED', oldValue: null, newValue: tech3.name },
    { type: 'STATUS_CHANGE', oldValue: 'UNASSIGNED', newValue: 'ASSIGNED' },
    { type: 'STATUS_CHANGE', oldValue: 'ASSIGNED', newValue: 'EN_ROUTE' },
  ] as const) {
    await prisma.jobEvent.create({ data: { jobId: job8.id, type: evt.type, oldValue: evt.oldValue ?? null, newValue: evt.newValue ?? null, actorId: dispatcher.id } });
  }

  console.log('✓ Jobs seeded (8 demo jobs across all statuses)');
  console.log('✓ Seed complete!\n');
  console.log('Demo credentials:');
  console.log('  Dispatcher : dispatcher@fieldservice.com / dispatch123');
  console.log('  Technician : tech1@fieldservice.com      / tech123  (James Carter)');
  console.log('  Technician : tech2@fieldservice.com      / tech123  (Priya Sharma)');
  console.log('  Technician : tech3@fieldservice.com      / tech123  (Marcus Webb)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
