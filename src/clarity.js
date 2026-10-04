// Limit analytics to the canonical production site. Development, CI and preview
// traffic should never create sessions in Alo's Clarity project, and neither should
// automated browsers (crawlers and screenshot services report navigator.webdriver).
if (location.hostname === '3d.aialo.io' && !navigator.webdriver) {
  ((c, l, a, r, i, t, y) => {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r);
    t.async = true;
    t.src = `https://www.clarity.ms/tag/${i}`;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', 'yr9ooxj17y');
}
