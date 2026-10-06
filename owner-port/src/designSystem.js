export const PREMIUM = Object.freeze({
  colors: Object.freeze({
    bg: '#070912', bgRaised: '#0E1220', panel: '#131827', panelSoft: '#1A2031', panelGlass: '#151A29EE',
    line: '#2A3247', lineSoft: '#FFFFFF12', text: '#F8F9FF', textSoft: '#C8CEDB', muted: '#8F99AF',
    violet: '#765BFF', violetDeep: '#4C35BB', cyan: '#5FE5FF', gold: '#FFD76D', rose: '#FF5D82',
    green: '#55E4A0', amber: '#FFB85C',
    lavender: '#E9D8FF', blush: '#FFD8F0', blue: '#74B8FF', ink: '#241B42',
  }),
  radius: Object.freeze({ xs: 9, sm: 12, md: 16, lg: 20, xl: 26, hero: 30, pill: 999 }),
  motion: Object.freeze({ tap: 120, fast: 180, standard: 280, entrance: 420, celebration: 1800 }),
  spacing: Object.freeze({ xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 30 }),
  surfaces: Object.freeze({
    base: '#070912', raised: '#0E1220', panel: '#131827', soft: '#1A2031', glass: '#151A29EE',
    feature: '#201744', sheet: '#101522', light: '#F8EEFF',
  }),
  gradients: Object.freeze({
    hero: ['#7B3FF2', '#E84FA8', '#FFB3D4'],
    violet: ['#5426C9', '#A43CFF', '#FF5DB8'],
    blue: ['#2356D8', '#638BFF', '#80D8FF'],
    gold: ['#FF9D39', '#FFD76D', '#FFF0AE'],
    rose: ['#D92C72', '#FF5D82', '#FFAF8C'],
  }),
  type: Object.freeze({
    display: 28, title: 21, section: 16, card: 14, body: 13, meta: 10, label: 9, micro: 8,
  }),
  layout: Object.freeze({ contentMax: 620, minTouch: 44, navHeight: 74, sheetMaxHeight: 0.86 }),
});

export const PREMIUM_TIERS = Object.freeze({
  standard: { label: 'STANDARD', accent: '#5FE5FF' },
  premium: { label: 'PREMIUM', accent: '#B699FF' },
  vip: { label: 'VIP', accent: '#FFD76D' },
  official: { label: 'OFFICIAL', accent: '#FFF0A8' },
});

export function motionBudget({ dataSaver = false, reduceMotion = false, lowPower = false } = {}) {
  if (reduceMotion) return { level: 'off', loops: false, particles: 0, fpsHint: 0, preloadHeavy: false };
  if (dataSaver || lowPower) return { level: 'lite', loops: false, particles: 6, fpsHint: 30, preloadHeavy: false };
  return { level: 'full', loops: true, particles: 18, fpsHint: 60, preloadHeavy: true };
}

export function effectPriority(kind = 'standard') {
  const normalized = String(kind || 'standard').toLowerCase();
  if (normalized.includes('full') || normalized.includes('cinematic') || normalized.includes('super')) return 3;
  if (normalized.includes('combo') || normalized.includes('premium') || normalized.includes('vip')) return 2;
  return 1;
}

