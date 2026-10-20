/** Runs a task once a slot is free; resolves or rejects with the task. */
export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

export function createLimiter(concurrency: number): Limiter {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(
      `Concurrency must be a positive integer, got ${concurrency}`,
    );
  }

  let active = 0;
  const queue: (() => void)[] = [];

  // A finished task hands its slot straight to the next waiter instead of
  // freeing it, so a newcomer can't grab it before the waiter resumes.
  const release = () => {
    const next = queue.shift();
    if (next) next();
    else active -= 1;
  };

  return async (task) => {
    if (active < concurrency) active += 1;
    else await new Promise<void>((resolve) => queue.push(resolve));

    try {
      return await task();
    } finally {
      release();
    }
  };
}
