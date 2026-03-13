// A simple script to simulate the benchmark.
// Due to clerk authentication and database setup we can mock the supabase behavior.
const { performance } = require('perf_hooks');

// Mock data
const PROFILES_COUNT = 1500;
const EVENTS_COUNT = 5;

const mockProfiles = Array.from({ length: PROFILES_COUNT }).map((_, i) => ({ id: `user-${i}` }));
const mockEvents = Array.from({ length: EVENTS_COUNT }).map((_, i) => ({ id: `event-${i}` }));

// Mock Supabase Database Insert (simulate ~1ms per batch insert)
const mockInsert = async (records) => {
  await new Promise(resolve => setTimeout(resolve, 5)); // Simulate network+DB time for one upsert query
  return { error: null };
};

// Baseline implementation
async function enrollBaseline(eventIds) {
  for (const eventId of eventIds) {
    // Simulated fetch profiles per event
    const profiles = mockProfiles;

    if (!profiles.length) continue;

    const enrollments = profiles.map(p => ({
      event_id: eventId,
      user_id: p.id,
      status: 'confirmed',
    }));

    await mockInsert(enrollments);
  }
}

// Optimized implementation
async function enrollOptimized(eventIds) {
  // Simulated fetch profiles once
  const profiles = mockProfiles;

  if (!profiles.length) return;

  const enrollments = [];
  for (const eventId of eventIds) {
    for (const profile of profiles) {
      enrollments.push({
        event_id: eventId,
        user_id: profile.id,
        status: 'confirmed',
      });
    }
  }

  const CHUNK_SIZE = 5000;
  for (let i = 0; i < enrollments.length; i += CHUNK_SIZE) {
    const chunk = enrollments.slice(i, i + CHUNK_SIZE);
    await mockInsert(chunk);
  }
}

async function run() {
  console.log(`Running benchmark with ${PROFILES_COUNT} users and ${EVENTS_COUNT} events...`);
  console.log(`This translates to ${PROFILES_COUNT * EVENTS_COUNT} total enrollments.`);

  // Baseline
  const startB = performance.now();
  await enrollBaseline(mockEvents.map(e => e.id));
  const endB = performance.now();
  console.log(`Baseline (N+1 Selects/Inserts): ${(endB - startB).toFixed(2)} ms`);

  // Optimized
  const startO = performance.now();
  await enrollOptimized(mockEvents.map(e => e.id));
  const endO = performance.now();
  console.log(`Optimized (Batched Selection/Insertion): ${(endO - startO).toFixed(2)} ms`);

  console.log(`Improvement: ${((endB - startB) / (endO - startO)).toFixed(2)}x faster DB roundtrips.`);
}

run();
