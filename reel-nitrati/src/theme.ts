export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const C = {
  graphite: '#101418',
  graphite2: '#161B20',
  graphite3: '#1E252C',
  line: '#2B343D',
  white: '#F5F2EA',
  muted: '#A9ADB0',
  dim: '#6F767C',
  beet: '#B83259',
  beetDeep: '#6E1934',
  beetDark: '#3A0B1C',
  beetLight: '#D9577C',
  teal: '#4DD9C0',
  tealDeep: '#1E7F70',
  leaf: '#3F7A55',
  leafDark: '#24503A',
  leafLight: '#6FA57C',
};

// Konzervativna radna sigurna zona za Instagram Reels
export const SAFE = {left: 90, right: 180, top: 200, bottom: 320};
export const SAFE_W = W - SAFE.left - SAFE.right; // 810
export const SAFE_CX = SAFE.left + SAFE_W / 2; // 495

export const FONT_HEAD = '"Barlow Condensed", "Inter", sans-serif';
export const FONT_BODY = '"Inter", sans-serif';
