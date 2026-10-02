// Attach before creating/navigating pages and retain failures after contexts close.
// New pages/popups share the same check; errors are never reset between actions.
function trackContextErrors(context, errors) {
  const observed = new WeakSet();
  function observe(page) {
    if (observed.has(page)) return;
    observed.add(page);
    page.on('pageerror', (error) => errors.push({ url: page.url(), name: error.name, message: error.message }));
  }
  context.on('page', observe);
  context.pages().forEach(observe);
}
module.exports = { trackContextErrors };
