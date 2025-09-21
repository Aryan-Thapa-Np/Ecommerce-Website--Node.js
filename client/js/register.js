import { showToast, TOAST_TYPES } from "./utils/toast.js";

import { csrftoken } from "./utils/generateCsrf.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("register-form");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const submitButton = form.querySelector(".btn-primary");
  const requirements = document.querySelectorAll(".requirement");
  const togglePasswordIcons = document.querySelectorAll(".toggle-password");
  const emailVerificationModal = document.getElementById(
    "email-verification-modal"
  );
  const emailVerificationForm = document.getElementById(
    "email-verification-form"
  );
  const codeInputs = emailVerificationForm.querySelectorAll(".code-input");
  const modalCloseButton = emailVerificationModal.querySelector(".modal-close");
  let userEmail = ""; // Store email for resend functionality
  let csrfToken = "";


  // Password requirements validation
  const passwordRequirements = [
    {
      regex: /.{8,}/,
      element: requirements[0],
      message: "At least 8 characters",
    },
    {
      regex: /[A-Z]/,
      element: requirements[1],
      message: "One uppercase letter",
    },
    {
      regex: /[a-z]/,
      element: requirements[2],
      message: "One lowercase letter",
    },
    { regex: /[0-9]/, element: requirements[3], message: "One number" },
    {
      regex: /[@$!%*?&]/,
      element: requirements[4],
      message: "One special character (@$!%*?&)",
    },
    {
      regex: /^[^\s]+$/,
      element: requirements[5],
      message: "No spaces allowed",
    },
  ];

  // Toggle password visibility
  togglePasswordIcons.forEach((icon) => {
    icon.addEventListener("click", () => {
      const input = icon.previousElementSibling;
      const type = input.type === "password" ? "text" : "password";
      input.type = type;
      icon.classList.toggle("fa-eye");
      icon.classList.toggle("fa-eye-slash");
    });
  });

  // Real-time password validation
  passwordInput.addEventListener("input", () => {
    let allRequirementsMet = true;

    passwordRequirements.forEach((req) => {
      const isMet = req.regex.test(passwordInput.value);
      req.element.classList.toggle("met", isMet);
      if (!isMet) allRequirementsMet = false;
    });

    submitButton.disabled =
      !allRequirementsMet || passwordInput.value !== confirmPasswordInput.value;
  });

  // Confirm password validation
  confirmPasswordInput.addEventListener("input", () => {
    submitButton.disabled = passwordInput.value !== confirmPasswordInput.value;
    confirmPasswordInput.setCustomValidity(
      passwordInput.value !== confirmPasswordInput.value
        ? "Passwords do not match"
        : ""
    );
  });

  // Input sanitization helpers
  const sanitizers = {
    username: (value) =>
      value
        .trim()
        .replace(/[^a-zA-Z0-9\s-_]/g, "")
        .slice(0, 50),
    email: (value) => value.trim().toLowerCase(),
    password: (value) => value.trim(),
    code: (value) => value.replace(/[^0-9]/g, "").slice(0, 6),
  };

  // Input validation
  const validators = {
    username: (value) => value.length >= 3 && value.length <= 50,
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    password: (value) => {
      const requirements = [
        /.{8,}/, // at least 8 chars
        /[A-Z]/, // uppercase
        /[a-z]/, // lowercase
        /[0-9]/, // number
        /[^A-Za-z0-9]/, // special char
        /^[^\s]+$/, // no spaces
      ];
      return requirements.every((regex) => regex.test(value));
    },
    code: (value) => /^\d{6}$/.test(value),
  };

  // Apply sanitization to form inputs
  form.querySelectorAll("input").forEach((input) => {
    const type = input.name;
    if (sanitizers[type]) {
      input.addEventListener("input", (e) => {
        const sanitized = sanitizers[type](e.target.value);
        if (sanitized !== e.target.value) {
          e.target.value = sanitized;
        }
      });
    }
  });

  // Setup code input with paste support
  const setupCodeInputs = () => {
    const codeInputs = emailVerificationForm.querySelectorAll(".code-input");

    // Handle paste event
    emailVerificationForm.addEventListener("paste", (e) => {
      e.preventDefault();
      const pastedText = (e.clipboardData || window.clipboardData).getData(
        "text"
      );
      const sanitizedCode = sanitizers.code(pastedText);

      codeInputs.forEach((input, index) => {
        if (sanitizedCode[index]) {
          input.value = sanitizedCode[index];
          if (index < codeInputs.length - 1) {
            codeInputs[index + 1].focus();
          }
        }
      });
    });

    // Handle input navigation and sanitization
    codeInputs.forEach((input, index) => {
      input.addEventListener("input", (e) => {
        const sanitized = sanitizers.code(e.target.value);
        input.value = sanitized.slice(-1);

        if (input.value && index < codeInputs.length - 1) {
          codeInputs[index + 1].focus();
        }
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && index > 0) {
          codeInputs[index - 1].focus();
        }
      });
    });
  };

  // Modal close button handler
  modalCloseButton.addEventListener("click", () => {
    closeEmailVerificationModal();
  });

  // Close modal when clicking outside
  emailVerificationModal.addEventListener("click", (e) => {
    if (e.target === emailVerificationModal) {
      modalCloseButton.click();
    }
  });

  // Resend code functionality with timer
  let resendTimer = null;
  const resendButton = document.createElement("button");
  resendButton.className = "btn btn-primary btn-block btn-link";
  resendButton.innerHTML = `
        <span class="btn-text">Resend Code</span>
        <span class="btn-loader" style="display: none;"></span>
    `;

  const updateResendTimer = (seconds) => {
    if (seconds > 0) {
      resendButton.querySelector(
        ".btn-text"
      ).textContent = `Resend Code (${seconds}s)`;
      resendButton.disabled = true;
      resendTimer = setTimeout(() => updateResendTimer(seconds - 1), 1000);
    } else {
      resendButton.querySelector(".btn-text").textContent = "Resend Code";
      resendButton.disabled = false;
    }
  };

  resendButton.addEventListener("click", async () => {
    if (!userEmail) {
      showToast(
        "Please complete the registration form first",
        TOAST_TYPES.ERROR
      );
      return;
    }

    // Show spinner and disable button
    const btnText = resendButton.querySelector(".btn-text");
    const btnLoader = resendButton.querySelector(".btn-loader");
    btnText.style.display = "none";
    btnLoader.style.display = "inline-block";
    resendButton.disabled = true;

    try {
      // Add artificial delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({ email: userEmail }),
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        showToast(result.message || "Failed to resend code", TOAST_TYPES.ERROR);
        return;
      }

      // Reset inputs
      emailVerificationForm
        .querySelectorAll(".code-input")
        .forEach((input) => (input.value = ""));

      // Start timer (30 seconds)
      updateResendTimer(30);
      showToast(
        "A new verification code has been sent to your email",
        TOAST_TYPES.SUCCESS
      );
    } catch (error) {
      showToast(error.message || "Failed to resend code", TOAST_TYPES.ERROR);
      // Reset button state on error
      btnText.textContent = "Resend Code";
      btnText.style.display = "inline-block";
      btnLoader.style.display = "none";
      resendButton.disabled = false;
    } finally {
      // Hide spinner
      btnText.style.display = "inline-block";
      btnLoader.style.display = "none";
    }
  });

  // Add resend button to modal
  emailVerificationForm.appendChild(resendButton);
  setupCodeInputs();

  // Form submission with validation
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate all fields
    const formData = new FormData(form);
    const data = {
      username: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      terms: formData.get("terms"),
    };

    // Validate all fields
    const errors = [];
    if (!validators.username(data.username))
      errors.push("Username must be between 3 and 50 characters");
    if (!validators.email(data.email))
      errors.push("Please enter a valid email address");
    if (!validators.password(data.password))
      errors.push("Password does not meet requirements");
    if (data.password !== data.confirmPassword)
      errors.push("Passwords do not match");
    if (!data.terms) errors.push("Please accept the terms and conditions");

    if (errors.length > 0) {
      showToast(errors.join("\n"), TOAST_TYPES.ERROR);
      return;
    }

    submitButton.classList.add("loading");
    submitButton.disabled = true;
    csrfToken = await csrftoken();

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      const result = await response.json();

      if (!result.success) {
        const errrr = result.errors[0].msg;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }

      if (result.status == "error") {
        const errrr = result.msg;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        showToast("Registration failed. Please try again.", TOAST_TYPES.ERROR);
        return;
      }

      // Store email for resend functionality
      userEmail = data.email;

      // Show email verification modal and start timer (30 seconds)
      emailVerificationModal.style.display = "flex";
      // Force reflow to ensure animations work
      emailVerificationModal.offsetHeight;
      emailVerificationModal.classList.add("show");
      // Focus first input after animation completes
      setTimeout(() => {
        emailVerificationForm.querySelector(".code-input").focus();
      }, 500);
      updateResendTimer(30);
      showToast(
        "Please check your email for the verification code",
        TOAST_TYPES.INFO
      );
    } catch (error) {
      showToast("Registration failed. Please try again.", TOAST_TYPES.ERROR);
    } finally {
      submitButton.classList.remove("loading");
      submitButton.disabled = false;
    }
  });

  // Email verification form submission with validation
  emailVerificationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const verifyButton = emailVerificationForm.querySelector(".btn-primary");
    const code = Array.from(codeInputs)
      .map((input) => input.value)
      .join("");

    if (!validators.code(code)) {
      showToast("Please enter a valid 6-digit code", TOAST_TYPES.ERROR);
      return;
    }

    verifyButton.classList.add("loading");
    verifyButton.disabled = true;

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({
          email: userEmail,
          otp: code,
        }),
        credentials: "include",
      });

      const result = await response.json();

      if (result.status == "error") {
        const errrr = result.message;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        showToast(
          result.message || "Verification failed. Please try again.",
          TOAST_TYPES.ERROR
        );
        return;
      }

      // Clear any existing timer
      if (resendTimer) {
        clearTimeout(resendTimer);
      }
      setTimeout(() => {
        // Hide modal with animation
        emailVerificationModal.classList.remove("show");
        setTimeout(() => {
          emailVerificationModal.style.display = "none";
        }, 400); // Match the animation duration
        showToast(
          "Registration successful! Redirecting to login...",
          TOAST_TYPES.SUCCESS
        );
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }, 2000);
    } catch (error) {
      showToast(
        error.message || "Verification failed. Please try again.",
        TOAST_TYPES.ERROR
      );
    } finally {
      setTimeout(() => {
        // Hide modal with animation
        verifyButton.classList.remove("loading");
        verifyButton.disabled = false;
      }, 2000);
    }
  });

  // OAuth button handlers
  document.querySelector(".btn-google").addEventListener("click", () => {
    window.location.href = "/api/auth/oauth/google";
  });

 
});

function closeEmailVerificationModal() {
  const modal = document.querySelector(".modal");
  if (!modal) return;

  modal.classList.add("hide");
  setTimeout(() => {
    modal.classList.remove("show", "hide");
    modal.style.display = "none";
  }, 300); // Match the CSS transition duration
}
  