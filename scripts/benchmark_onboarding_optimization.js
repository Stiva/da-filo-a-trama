const { performance } = require('perf_hooks');

const formData = {
  name: 'John',
  surname: 'Doe',
  scout_group: 'Roma 123',
  service_role: 'Capo Reparto',
  preferences: ['tecnica', 'natura', 'spiritualità'],
  avatar_config: {
    topType: 'ShortHairShortFlat',
    accessoriesType: 'Blank',
    hairColor: 'BrownDark',
    facialHairType: 'Blank',
    clotheType: 'BlazerShirt',
    eyeType: 'Default',
    eyebrowType: 'Default',
    mouthType: 'Default',
    skinColor: 'Light',
    seed: 'abc-123'
  }
};

const ITERATIONS = 100000;
const RETRIES = 3;

function baseline() {
  let result;
  for (let i = 0; i < ITERATIONS; i++) {
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      result = JSON.stringify({
        ...formData,
        service_role: formData.service_role || null,
        onboarding_completed: true,
        avatar_completed: true,
        preferences_set: formData.preferences.length > 0,
      });
    }
  }
  return result;
}

function optimized() {
  let result;
  for (let i = 0; i < ITERATIONS; i++) {
    const body = JSON.stringify({
      ...formData,
      service_role: formData.service_role || null,
      onboarding_completed: true,
      avatar_completed: true,
      preferences_set: formData.preferences.length > 0,
    });
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      result = body;
    }
  }
  return result;
}

console.log('Starting benchmark...');

const startB = performance.now();
baseline();
const endB = performance.now();
console.log(`Baseline: ${(endB - startB).toFixed(4)} ms`);

const startO = performance.now();
optimized();
const endO = performance.now();
console.log(`Optimized: ${(endO - startO).toFixed(4)} ms`);

const improvement = ((endB - startB) - (endO - startO)) / (endB - startB) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
