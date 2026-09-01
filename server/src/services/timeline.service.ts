import { prisma } from '../utils/prisma';
import { EventType } from '@prisma/client';

interface WriteEventArgs {
  jobId: string;
  type: EventType;
  oldValue?: string | null;
  newValue?: string | null;
  actorId: string;
}

/**
 * Single write path for all JobEvent inserts.
 * IMPORTANT: No UPDATE or DELETE operations exist for this table anywhere in
 * the codebase. This function is the only code path that writes to JobEvent.
 */
export async function writeEvent(args: WriteEventArgs): Promise<void> {
  await prisma.jobEvent.create({
    data: {
      jobId: args.jobId,
      type: args.type,
      oldValue: args.oldValue ?? null,
      newValue: args.newValue ?? null,
      actorId: args.actorId,
    },
  });
}
