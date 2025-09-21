/**
 * Modern Toast Notification Module
 * Provides sleek, animated toast notifications with customizable options
 */

export const TOAST_TYPES = {
  SUCCESS: "success",
  ERROR: "error",
  INFO: "info",
  WARNING: "warning",
};

// Modern icons using Font Awesome
const TOAST_ICONS = {
  [TOAST_TYPES.SUCCESS]: '<i class="fa-solid fa-circle-check"></i>',
  [TOAST_TYPES.ERROR]: '<i class="fa-solid fa-circle-xmark"></i>',
  [TOAST_TYPES.INFO]: '<i class="fa-solid fa-circle-info"></i>',
  [TOAST_TYPES.WARNING]: '<i class="fa-solid fa-triangle-exclamation"></i>',
};

// Modern color scheme
const TOAST_COLORS = {
  [TOAST_TYPES.SUCCESS]: {
    background: "#ECFDF3",
    border: "#008D3E",
    icon: "#008D3E",
  },
  [TOAST_TYPES.ERROR]: {
    background: "#FEF2F2",
    border: "#DC2626",
    icon: "#DC2626",
  },
  [TOAST_TYPES.INFO]: {
    background: "#EFF6FF",
    border: "#2563EB",
    icon: "#2563EB",
  },
  [TOAST_TYPES.WARNING]: {
    background: "#FFFBEB",
    border: "#D97706",
    icon: "#D97706",
  },
};

let toastContainer = null;
let toastCount = 0;
const MAX_TOASTS = 5;

const createToastContainer = () => {
  if (toastContainer) return;

  toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  document.body.appendChild(toastContainer);
};

const createProgressBar = () => {
  const progressBar = document.createElement("div");
  progressBar.className = "toast-progress";
  return progressBar;
};

const createToast = (message, type = TOAST_TYPES.INFO) => {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  // Split message into title and content if it contains line breaks
  const [title, ...content] = message.split("\n");
  const hasContent = content.length > 0;

  toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-icon">${TOAST_ICONS[type]}</div>
            <div class="toast-text">
                <div class="toast-title">${title}</div>
                ${
                  hasContent
                    ? `<div class="toast-message">${content.join("\n")}</div>`
                    : ""
                }
            </div>
            <button class="toast-close" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
        ${createProgressBar().outerHTML}
    `;

  // Apply modern styling
  const colors = TOAST_COLORS[type];
  toast.style.backgroundColor = colors.background;
  toast.style.borderLeftColor = colors.border;
  toast.querySelector(".toast-icon").style.color = colors.icon;
  toast.querySelector(".toast-progress").style.backgroundColor = colors.border;

  // Add close button functionality
  const closeButton = toast.querySelector(".toast-close");
  closeButton.addEventListener("click", () => removeToast(toast));

  return toast;
};

const removeToast = (toast) => {
  toast.classList.add("toast-fade-out");
  setTimeout(() => {
    if (toast.parentNode === toastContainer) {
      try {
        toastContainer.removeChild(toast);
      } catch (error) {}
      toastCount--;
    }
    // Remove container if no more toasts
    if (toastContainer && toastContainer.children.length === 0) {
      document.body.removeChild(toastContainer);
      toastContainer = null;
    }
  }, 300);
};

export const showToast = (
  message,
  type = TOAST_TYPES.INFO,
  duration = 5000
) => {
  createToastContainer();

  // Remove oldest toast if maximum is reached
  if (toastCount >= MAX_TOASTS) {
    const oldestToast = toastContainer.firstChild;
    if (oldestToast) {
      removeToast(oldestToast);
    }
  }

  const toast = createToast(message, type);
  toastContainer.appendChild(toast);
  toastCount++;

  // Start progress bar animation
  const progressBar = toast.querySelector(".toast-progress");
  progressBar.style.transition = `width ${duration}ms linear`;

  // Force reflow to ensure animation works
  toast.offsetHeight;

  // Add fade in class and start progress bar
  toast.classList.add("toast-fade-in");
  setTimeout(() => {
    progressBar.style.width = "0%";
  }, 10);

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentNode === toastContainer) {
        removeToast(toast);
      }
    }, duration);
  }

  // Add hover pause functionality
  toast.addEventListener("mouseenter", () => {
    progressBar.style.transition = "none";
  });

  toast.addEventListener("mouseleave", () => {
    progressBar.style.transition = `width ${duration}ms linear`;
    progressBar.style.width = "0%";
  });
};
