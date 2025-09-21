import { showToast, TOAST_TYPES } from "./utils/toast.js";
import { csrftoken } from "./utils/generateCsrf.js";

document.addEventListener("DOMContentLoaded", async () => {
  const resetEmailForm = document.getElementById("reset-email-form");
  const resetVerifyForm = document.getElementById("reset-verify-form");
  const resetPasswordForm = document.getElementById("reset-password-form");
  const steps = document.querySelectorAll(".step");
  const stepContents = document.querySelectorAll(".reset-step-content");
  const newPasswordInput = document.getElementById("new-password");
  const confirmPasswordInput = document.getElementById("confirm-password");
  const togglePasswordIcons = document.querySelectorAll(".toggle-password");
  const verificationInputs = resetVerifyForm.querySelectorAll(
    ".verification-input"
  );
  const requirements = resetPasswordForm.querySelectorAll(".requirement");
  const resendCodeLink = document.getElementById("resend-code");

  // Initialize CSRF token

  let currentStep = 1;
  let vefEmail = null;
  let csrfToken = "";
  let tempOtp = "";

  // Input sanitization helper for verification code
  const sanitizeCode = (value) => value.replace(/[^0-9]/g, "").slice(0, 6);

  // Handle paste event for verification code
  resetVerifyForm.addEventListener("paste", (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData(
      "text"
    );
    const sanitizedCode = sanitizeCode(pastedText);

    verificationInputs.forEach((input, index) => {
      if (sanitizedCode[index]) {
        input.value = sanitizedCode[index];
        if (index < verificationInputs.length - 1) {
          verificationInputs[index + 1].focus();
        }
      }
    });
  });

  // Enhance verification input handling
  verificationInputs.forEach((input, index) => {
    input.addEventListener("input", (e) => {
      const sanitized = sanitizeCode(e.target.value);
      input.value = sanitized.slice(-1);

      if (input.value && index < verificationInputs.length - 1) {
        verificationInputs[index + 1].focus();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && index > 0) {
        verificationInputs[index - 1].focus();
      }
    });
  });

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
      regex: /[^A-Za-z0-9]/,
      element: requirements[4],
      message: "One special character",
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

  // Update step indicators and content
  const updateStep = (step) => {
    steps.forEach((s, index) => {
      s.classList.toggle("active", index + 1 === step);
    });
    stepContents.forEach((content, index) => {
      content.style.display = index + 1 === step ? "block" : "none";
    });
    currentStep = step;
  };

  // Step 1: Email submission
  resetEmailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitButton = resetEmailForm.querySelector(".btn-primary");
    submitButton.classList.add("loading");
    submitButton.disabled = true;
    csrfToken = await csrftoken();

    try {
      const formData = new FormData(resetEmailForm);
      const email = formData.get("email");

      const response = await fetch("/api/auth/password-reset-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({ email: email }),
        credentials: "include",
      });

      const result = await response.json();

      if (result.status == "error") {
        const errrr = result.message;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        const err = response.message;
        showToast(err, TOAST_TYPES.ERROR);
        return;
      }

      vefEmail = email;

      showToast("Reset code sent to your email.", TOAST_TYPES.SUCCESS);
      updateStep(2);
      updateResendTimer(30);
    } catch (error) {
      showToast(
        error.message || "Failed to send reset code",
        TOAST_TYPES.ERROR
      );
    } finally {
      submitButton.classList.remove("loading");
      submitButton.disabled = false;
      resetEmailForm.reset();
    }
  });

  // Step 2: Verify code
  resetVerifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitButton = resetVerifyForm.querySelector(".btn-primary");
    submitButton.classList.add("loading");
    submitButton.disabled = true;

    const code = Array.from(verificationInputs)
      .map((input) => input.value)
      .join("");
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      showToast(
        "Invalid code. Please enter a 6-digit number.",
        TOAST_TYPES.ERROR
      );
      return;
    }

    try {
      const response = await fetch("/api/auth/verify-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({ email: vefEmail, otp: code }),
        credentials: "include",
      });

      const result = await response.json();

      if (result.status == "error") {
        const errrr = result.message;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        showToast("Failed to verify code", TOAST_TYPES.ERROR);
        return;
      }
      setTimeout(() => {
        resetVerifyForm.reset();
        showToast("Verification successful.", TOAST_TYPES.SUCCESS);
        updateStep(3);
        tempOtp = code; // Store OTP for later use
      }, 2000);
    } catch (error) {
      showToast(error.message || "Failed to verify code", TOAST_TYPES.ERROR);
    } finally {
      setTimeout(() => {
        submitButton.classList.remove("loading");
        submitButton.disabled = false;
        resetVerifyForm.reset();
      }, 2000);
    }
  });

  // Resend code with animation and timer
  let resendTimer = null;
  const resendCodeBtn = resendCodeLink;
  const originalResendText = resendCodeBtn.textContent;

  function updateResendTimer(seconds) {
    if (seconds > 0) {
      resendCodeBtn.textContent = `Resend (${seconds}s)`;
      resendCodeBtn.classList.add("disabled");
      resendCodeBtn.style.pointerEvents = "none";
      resendTimer = setTimeout(() => updateResendTimer(seconds - 1), 1000);
    } else {
      resendCodeBtn.textContent = originalResendText;
      resendCodeBtn.classList.remove("disabled");
      resendCodeBtn.style.pointerEvents = "";
    }
  }

  resendCodeLink.addEventListener("click", async (e) => {
    e.preventDefault();
    resendCodeLink.disabled = true;
    resendCodeLink.textContent = "Resending...";

    try {
      const response = await fetch("/api/auth/password-reset-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({ email: vefEmail }),
        credentials: "include",
      });

      const result = await response.json();

      if (result.status == "error") {
        const errrr = result.message;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        const err = response.message;
        showToast(err, TOAST_TYPES.ERROR);
        return;
      }

      showToast("Reset code resent to your email.", TOAST_TYPES.SUCCESS);
      // Start 30s timer
      updateResendTimer(30);
    } catch (error) {
      showToast("Failed to resend code. Please try again.", TOAST_TYPES.ERROR);
    } finally {
      resendCodeLink.disabled = false;
      resendCodeLink.textContent = originalResendText;
    }
  });

  // Step 3: New password submission
  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitButton = resetPasswordForm.querySelector(".btn-primary");
    submitButton.classList.add("loading");
    submitButton.disabled = true;

    let allRequirementsMet = true;
    passwordRequirements.forEach((req) => {
      const isMet = req.regex.test(newPasswordInput.value);
      req.element.classList.toggle("met", isMet);
      if (!isMet) allRequirementsMet = false;
    });

    if (!allRequirementsMet) {
      alert("Password does not meet all requirements.");
      submitButton.classList.remove("loading");
      submitButton.disabled = false;
      return;
    }

    if (newPasswordInput.value !== confirmPasswordInput.value) {
      alert("Passwords do not match.");
      submitButton.classList.remove("loading");
      submitButton.disabled = false;
      return;
    }

    try {
      const formData = new FormData(resetPasswordForm);
      const data = {
        newPassword: formData.get("new-password"),
        confirmPassword: formData.get("confirm-password"),
      };

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({
          email: vefEmail,
          otp: tempOtp,
          password: data.newPassword,
          confirmPassword: data.confirmPassword,
        }),
      });

      const result = await response.json();

      if (result.status == "error") {
        const errrr = result.message;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }
      if (!response.ok) {
        const err = response.message;
        showToast(err, TOAST_TYPES.ERROR);
        return;
      }

      showToast(
        "Password reset successful. You can now log in.",
        TOAST_TYPES.SUCCESS
      );
      // Redirect to login page after a short delay
      setTimeout(() => {
        window.location.href = "/login"; // Adjust the URL as needed
      }, 2000);
    } catch (error) {
      showToast(
        error.message || "Password reset failed. Please try again.",
        TOAST_TYPES.ERROR
      );
    } finally {
      setTimeout(() => {
        resetPasswordForm.reset();
        submitButton.classList.remove("loading");
        submitButton.disabled = false;
      }, 2000);
    }
  });

  // Real-time password validation
  newPasswordInput.addEventListener("input", () => {
    passwordRequirements.forEach((req) => {
      const isMet = req.regex.test(newPasswordInput.value);
      req.element.classList.toggle("met", isMet);
    });
  });

  // Confirm password validation
  confirmPasswordInput.addEventListener("input", () => {
    confirmPasswordInput.setCustomValidity(
      newPasswordInput.value !== confirmPasswordInput.value
        ? "Passwords do not match"
        : ""
    );
  });
});

function updateStepProgress(currentStep) {
  const stepsContainer = document.querySelector(".reset-steps");
  const steps = document.querySelectorAll(".step");

  // Update data attribute for progress line
  stepsContainer.setAttribute("data-step", currentStep);

  // Update step states
  steps.forEach((step, index) => {
    const stepNumber = index + 1;
    step.classList.remove("active", "completed");

    if (stepNumber === currentStep) {
      step.classList.add("active");
    } else if (stepNumber < currentStep) {
      step.classList.add("completed");
    }
  });
}

function showStep(stepNumber) {
  // Hide all steps
  document.querySelectorAll(".reset-step-content").forEach((step) => {
    step.style.display = "none";
  });

  // Show current step
  const currentStep = document.getElementById(`step-${stepNumber}`);
  if (currentStep) {
    currentStep.style.display = "block";
  }

  // Update progress
  updateStepProgress(stepNumber);
}
