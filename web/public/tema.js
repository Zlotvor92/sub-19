'use strict';

/* TEMA PRE PRVOG ISCRTAVANJA. Ručni izbor (Ti → Izgled) čuva se po uređaju u localStorage pod `sub20-tema` („light“ | „dark“);
   bez njega odlučuje sistem (`prefers-color-scheme` u CSS-u) i ovde se ništa ne radi. Skripta je spoljna i sinhrona zato što CSP
   ne dozvoljava inline, a bez nje bi se pri ručno izabranoj temi koja se razlikuje od sistemske video jedan bljesak pogrešne boje.
   Isti rečnik i ista boja trake pregledača kao `src/lib/theme.ts` (test `theme.test.ts` drži da se ne razilaze). */
(function tema() {
  var v = null;
  try {
    v = localStorage.getItem('sub20-tema');
  } catch (e) {
    /* privatni režim: ostaje sistemska tema */
  }
  if (v !== 'light' && v !== 'dark') return;
  var root = document.documentElement;
  root.setAttribute('data-theme', v);
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) {
    metas[i].setAttribute('content', v === 'dark' ? '#0f1612' : '#f6f7f5');
  }
})();
