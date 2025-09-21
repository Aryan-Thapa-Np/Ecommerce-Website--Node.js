import { showToast, TOAST_TYPES } from "./utils/toast.js";
import { csrftoken } from "./utils/generateCsrf.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitButton = form.querySelector(".btn-primary");
  const togglePasswordIcon = document.querySelector(".toggle-password");
  const twoFactorModal = document.getElementById("two-factor-modal");
  const twoFactorForm = document.getElementById("two-factor-form");
  const emailVerificationModal = document.getElementById(
    "email-verification-modal"
  );
  const emailVerificationForm = document.getElementById(
    "email-verification-form"
  );
  const codeInputs = emailVerificationForm.querySelectorAll(".code-input");
  const modalCloseButton = emailVerificationModal.querySelector(".modal-close");

  let csrfToken = "";
  let emailTemp = "";
  // Determine method (app or email) from modal or state
  let method = "";

  // Toggle password visibility
  togglePasswordIcon.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePasswordIcon.classList.toggle("fa-eye");
    togglePasswordIcon.classList.toggle("fa-eye-slash");
  });

  // Real-time email validation
  emailInput.addEventListener("input", () => {
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value);
    submitButton.disabled = !isValidEmail || !passwordInput.value;
    emailInput.setCustomValidity(
      isValidEmail ? "" : "Please enter a valid email address"
    );
  });

  // Real-time password validation
  passwordInput.addEventListener("input", () => {
    submitButton.disabled = !emailInput.value || !passwordInput.value;
  });

  // Setup code input navigation and paste support for both modals
  const setupCodeInputs = (form) => {
    const codeInputs = form.querySelectorAll(".code-input");
    codeInputs.forEach((input, index) => {
      // Only allow numbers to be entered
      input.addEventListener("input", (e) => {
        input.value = input.value.replace(/[^0-9]/g, "");
        if (input.value.length === 1 && index < codeInputs.length - 1) {
          codeInputs[index + 1].focus();
        }
      });
      input.addEventListener("keydown", (e) => {
        // Allow navigation keys, backspace, delete, tab, etc.
        if (
          ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight"].includes(
            e.key
          )
        ) {
          if (e.key === "Backspace" && input.value === "" && index > 0) {
            codeInputs[index - 1].focus();
          }
          return;
        }
        // Handle Ctrl+V and Shift+Insert for paste
        if (
          (e.ctrlKey && e.key === "v") ||
          (e.shiftKey && e.key === "Insert")
        ) {
          // Let the paste event handle it
          return;
        }
        // Block non-numeric keys
        if (!/^[0-9]$/.test(e.key)) {
          e.preventDefault();
        }
      });
      // Paste event: allow pasting full code, only numbers, on each input
      input.addEventListener("paste", (e) => {
        let paste = "";
        if (e.clipboardData) {
          paste = e.clipboardData.getData("text");
        } else if (window.clipboardData) {
          paste = window.clipboardData.getData("Text");
        }
        const sanitized = paste.replace(/[^0-9]/g, "");
        if (sanitized.length === codeInputs.length) {
          e.preventDefault();
          codeInputs.forEach((ci, i) => {
            ci.value = sanitized[i] || "";
          });
          codeInputs[codeInputs.length - 1].focus();
        }
      });
    });
  };

  setupCodeInputs(twoFactorForm);
  setupCodeInputs(emailVerificationForm);

  // Close modal
  const closeModal = (modal) => {
    modal.style.display = "none";
    modal
      .querySelectorAll(".code-input")
      .forEach((input) => (input.value = ""));
    // Hide error message (no longer needed, using toast)
    if (modal.querySelector(".error-message")) {
      modal.querySelector(".error-message").style.display = "none";
    }
  };

  twoFactorModal
    .querySelector(".modal-close")
    .addEventListener("click", () => closeModal(twoFactorModal));
  emailVerificationModal
    .querySelector(".modal-close")
    .addEventListener("click", () => closeModal(emailVerificationModal));

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    submitButton.classList.add("loading");
    submitButton.disabled = true;
    csrfToken = await csrftoken();

    try {
      const formData = new FormData(form);
      const data = {
        email: formData.get("email"),
        password: formData.get("password"),
        rememberMe: document.getElementById("remember")?.checked || false,
      };

      emailTemp = data.email;

      // Simulate API call for login
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      
  

      if (result.requiresEmailVerification === true) {
        // Show email verification modal
        // Show email verification modal and start timer (30 seconds)
        emailVerificationModal.style.display = "flex";
        // Force reflow to ensure animations work
        emailVerificationModal.offsetHeight;
        emailVerificationModal.classList.add("show");
        method = result.method;
        // Focus first input after animation completes
        setTimeout(() => {
          emailVerificationForm.querySelector(".code-input").focus();
        }, 500);
        updateResendTimer(30);
        showToast(
          "Please check your email for the verification code",
          TOAST_TYPES.INFO
        );

        return;
      }

      if (result.requiresTwoFactor === true) {
        // Show  2fa email verification modal
        // Show  2fa email verification modal and start timer (30 seconds)
        method = result.twoFactorMethod || "email";

        twoFactorModal.style.display = "flex";
        // Force reflow to ensure animations work
        twoFactorModal.offsetHeight;
        twoFactorModal.classList.add("show");
        // Focus first input after animation completes
        setTimeout(() => {
          twoFactorForm.querySelector(".code-input").focus();
        }, 500);
        updateResendTimer(30);
        if (result.twoFactorMethod === "email") {
          showToast(
            "Please check your email for the verification code",
            TOAST_TYPES.INFO
          );
        } else {
          showToast(
            "Please check your Authenticator for the verification code",
            TOAST_TYPES.INFO
          );
        }
        return;
      }
      if (result.status == "error") {
        const errorMessage = result.message;
        showToast(errorMessage, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        showToast(result.message, TOAST_TYPES.ERROR);
        return;
      }

      // Show success toast
      showToast("Login submitted successfully!", TOAST_TYPES.SUCCESS);
      window.location.href = result.redirect || "/login";
    } catch (error) {
      console.error("Login error:", error);
      showToast("Login failed. Please try again.", TOAST_TYPES.ERROR);
    } finally {
      submitButton.classList.remove("loading");
      submitButton.disabled = false;
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
        body: JSON.stringify({ email: emailTemp }),
        credentials: "include",
      });

      const result = await response.json();

      if (result.status == "error") {
        const errorMessage = result.message;
        showToast(errorMessage, TOAST_TYPES.ERROR);
        return;
      }

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

  // Add resend button to modal (outside the code inputs, after the submit button)
  emailVerificationForm.appendChild(resendButton);

  // Email verification form submission
  emailVerificationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const verifyButton = emailVerificationForm.querySelector(".btn-primary");
    const code = Array.from(codeInputs)
      .map((input) => input.value)
      .join("");

    verifyButton.classList.add("loading");
    verifyButton.disabled = true;
    csrfToken = await csrftoken();

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({
          email: emailTemp,
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
          "Verification successful! Refreshing the page...",
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

  // 2FA form submission
  twoFactorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const verifyButton = twoFactorForm.querySelector(".btn-primary");
    verifyButton.classList.add("loading");
    verifyButton.disabled = true;
    csrfToken = await csrftoken();

    const codeInputsArr = Array.from(
      twoFactorForm.querySelectorAll(".code-input")
    );
    const code = codeInputsArr.map((input) => input.value).join("");

    // Client-side validation: all fields filled and numeric
    if (
      codeInputsArr.some(
        (input) => input.value.trim() === "" || !/^\d$/.test(input.value)
      ) ||
      code.length !== 6
    ) {
      showToast("Please enter a valid 6-digit code.", TOAST_TYPES.ERROR);
      verifyButton.classList.remove("loading");
      verifyButton.disabled = false;
      return;
    }

    // Determine method (app or email) from modal or state


    try {
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({
          email: emailTemp,
          otp: code,
          method,
          rememberMe: rememberMe === 'true' ? true : document.getElementById("remember")?.checked || false,
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
      setTimeout(() => {
        showToast("Login successful!", TOAST_TYPES.SUCCESS);
        closeModal(twoFactorModal);
        form.reset();
        window.location.href = result.redirect || "/login";
      }, 2000);
    } catch (error) {
      showToast("Verification failed. Please try again.", TOAST_TYPES.ERROR);
    } finally {
      setTimeout(() => {
        verifyButton.classList.remove("loading");
        verifyButton.disabled = false;
      }, 2000);
    }
  });

  // OAuth button handlers
  document.querySelector(".btn-google").addEventListener("click", () => {
    window.location.href = "/api/auth/oauth/google";
  });




// Get the query parameters from the current URL
const urlParams = new URLSearchParams(window.location.search);

// Access specific parameters
const requiresTwoFactor = urlParams.get('requiresTwoFactor'); // "true"
const twoFactorMethod = urlParams.get('twoFactorMethod'); // The value of two_factor_method
const email = urlParams.get('email');
const rememberMe = urlParams.get('rememberMe');

// Example usage
if (requiresTwoFactor === 'true') {
  if (requiresTwoFactor === 'true') {
    emailTemp = email;
    // Show  2fa email verification modal
    // Show  2fa email verification modal and start timer (30 seconds)
    method = twoFactorMethod;

    twoFactorModal.style.display = "flex";
    // Force reflow to ensure animations work
    twoFactorModal.offsetHeight;
    twoFactorModal.classList.add("show");
    // Focus first input after animation completes
    setTimeout(() => {
      twoFactorForm.querySelector(".code-input").focus();
    }, 500);
    updateResendTimer(30);
    if (twoFactorMethod === "email") {
      showToast(
        "Please check your email for the verification code",
        TOAST_TYPES.INFO
      );
    } else {
      showToast(
        "Please check your Authenticator for the verification code",
        TOAST_TYPES.INFO
      );
    }
    return;
  }
}


});
