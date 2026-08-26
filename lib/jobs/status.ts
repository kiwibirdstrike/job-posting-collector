import type { JobStatus } from "./types";

const allowedTransitions: Record<JobStatus, JobStatus[]> = {
  new: ["interested", "ignored", "archived"],
  interested: ["applying", "ignored", "archived"],
  applying: ["applied", "interested", "ignored", "archived"],
  applied: ["interview", "rejected", "archived"],
  interview: ["offer", "rejected", "archived"],
  offer: ["archived", "rejected"],
  rejected: ["archived"],
  archived: ["new", "interested"],
  ignored: ["new", "interested", "archived"]
};

export function canTransitionJobStatus(
  current: JobStatus,
  next: JobStatus
): boolean {
  return current === next || allowedTransitions[current].includes(next);
}

export function assertStatusTransition(
  current: JobStatus,
  next: JobStatus
): JobStatus {
  if (!canTransitionJobStatus(current, next)) {
    throw new Error(`Cannot move job from ${current} to ${next}`);
  }

  return next;
}
