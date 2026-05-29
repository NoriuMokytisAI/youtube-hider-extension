function getBadgeText(hideEnabled) {
  if (hideEnabled) return '';
  return 'OFF';
}

function isAnyTrue(flags) {
  return Object.values(flags).some(Boolean);
}

function updateSliderBackground(slider) {
  const min = slider.min || 0;
  const max = slider.max || 100;
  const value = slider.value;
  const percentage = ((value - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, #ebebeb ${percentage}%, #4a4a4a ${percentage}%)`;
}

const viewsSteps = [
  0, 100, 500, 1000, 2500, 5000, 7500, 10000, 15000, 25000, 50000, 75000,
  100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000,
  1000000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000, 8000000,
  9000000, 10000000,
];

function formatViews(views) {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(views % 1000000 === 0 ? 0 : 1) + 'M';
  } else if (views >= 1000) {
    return (views / 1000).toFixed(views % 1000 === 0 ? 0 : 1) + 'K';
  }
  return views.toString();
}

function findClosestViewsIndex(value) {
  let closestIndex = 0;
  let minDiff = Math.abs(viewsSteps[0] - value);
  for (let i = 1; i < viewsSteps.length; i++) {
    const diff = Math.abs(viewsSteps[i] - value);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  return closestIndex;
}

const dateYearSteps = Array.from({ length: 20 }, (_, i) => (i + 1) * 365);
const dateYearLabels = Array.from({ length: 20 }, (_, i) => {
  const years = i + 1;
  return `${years} ${years === 1 ? 'year' : 'years'}`;
});

const dateSteps = [0, 1, 3, 7, 14, 30, 60, 90, 180, ...dateYearSteps];

const dateStepLabels = [
  'Off',
  '1 day',
  '3 days',
  '1 week',
  '2 weeks',
  '1 month',
  '2 months',
  '3 months',
  '6 months',
  ...dateYearLabels,
];

const dateNewerSteps = [
  0,
  1 / 24,
  0.25,
  0.5,
  1,
  3,
  7,
  14,
  30,
  60,
  90,
  180,
  ...dateYearSteps,
];

const dateNewerStepLabels = [
  'Off',
  '1 hour',
  '6 hours',
  '12 hours',
  '1 day',
  '3 days',
  '1 week',
  '2 weeks',
  '1 month',
  '2 months',
  '3 months',
  '6 months',
  ...dateYearLabels,
];

function findClosestDateNewerIndex(value) {
  let closestIndex = 0;
  let minDiff = Math.abs(dateNewerSteps[0] - value);
  for (let i = 1; i < dateNewerSteps.length; i++) {
    const diff = Math.abs(dateNewerSteps[i] - value);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  return closestIndex;
}

function formatDateThreshold(days) {
  const idx = findClosestDateIndex(days);
  return dateStepLabels[idx];
}

function findClosestDateIndex(value) {
  let closestIndex = 0;
  let minDiff = Math.abs(dateSteps[0] - value);
  for (let i = 1; i < dateSteps.length; i++) {
    const diff = Math.abs(dateSteps[i] - value);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  return closestIndex;
}

function setEasyModeClass(isEasy) {
  document.body.classList.toggle('easy-mode-on', isEasy);
  document.body.classList.toggle('easy-mode-off', !isEasy);
}

function updateEasyModeUI(isEasyMode) {
  setEasyModeClass(isEasyMode);
}
