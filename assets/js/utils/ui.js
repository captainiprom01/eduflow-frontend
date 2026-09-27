'use strict';

/* Shared lightweight toast UI. */
let toastTimer = null;
function showToast(message) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] bg-ink dark:bg-surface-dark text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg opacity-0 pointer-events-none transition-opacity duration-300 max-w-[90vw] text-center';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 2400);
}
