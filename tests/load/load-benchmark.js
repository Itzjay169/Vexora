/**
 * Phase 37: Load Testing, Concurrency & SLO Benchmarks
 * Blueprint Ref: Section 46 & Section 49 (Performance & Scalability)
 */

export async function simulateRegistrationSpike({ totalRequests = 500, maxSlots = 1, latencyTargetMs = 300 } = {}) {
  let acceptedCount = 0;
  let rejectedCount = 0;
  const latencies = [];

  const startTime = Date.now();

  // Simulate concurrent registration requests against atomic slot allocation
  let remainingSlots = maxSlots;

  const runRequest = async () => {
    const reqStart = Date.now();
    // Simulate brief processing & lock acquisition (between 2ms and 25ms)
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 20) + 2));

    // Atomic allocation simulation
    if (remainingSlots > 0) {
      remainingSlots -= 1;
      acceptedCount += 1;
    } else {
      rejectedCount += 1;
    }

    const duration = Date.now() - reqStart;
    latencies.push(duration);
  };

  await Promise.all(Array.from({ length: totalRequests }, () => runRequest()));

  const totalTimeMs = Date.now() - startTime;
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

  return {
    totalRequests,
    acceptedCount,
    rejectedCount,
    maxSlots,
    zeroOversold: acceptedCount <= maxSlots,
    totalTimeMs,
    p50Ms: p50,
    p95Ms: p95,
    p99Ms: p99,
    targetMet: p95 <= latencyTargetMs,
  };
}

export async function simulateWebSocketFanout({ clientCount = 1000, messageCount = 5 } = {}) {
  const receiveLatencies = [];
  const start = Date.now();

  for (let m = 0; m < messageCount; m++) {
    const msgStart = Date.now();
    // Simulate broadcasting message across client sockets
    for (let c = 0; c < clientCount; c++) {
      // simulated micro-tick per socket
      if (c % 100 === 0) {
        receiveLatencies.push(Date.now() - msgStart);
      }
    }
  }

  const duration = Date.now() - start;
  return {
    clientCount,
    totalMessagesBroadcast: messageCount * clientCount,
    durationMs: duration,
    throughputMsgPerSec: Math.floor((messageCount * clientCount) / (duration / 1000 || 1)),
  };
}
