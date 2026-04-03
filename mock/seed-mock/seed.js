// Fake visitor counter that slowly ticks up
const el = document.getElementById('count');
if (el) {
  let n = 1;
  setInterval(() => {
    if (Math.random() < 0.3) {
      n++;
      el.textContent = String(n).padStart(4, '0');
    }
  }, 8000);
}
