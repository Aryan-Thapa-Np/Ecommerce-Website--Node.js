const csrftoken = async () => {
  try {
    const response = await fetch("/api/auth/get-csrf", {
      method: "GET",
      credentials: "include",
    });

    const data = await response.json();

    
      if (data.status == "error") {
        const errrr = data.message;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }

    if (!response.ok) {
      showToast(response.message || "Failed to fetch csrf", TOAST_TYPES.ERROR);
      return;
    }
    if (data.token) {
      const csrfToken = data.token;
      return csrfToken;
    }
  } catch (error) {
    console.error("Failed to initialize CSRF token:", error);
  }
};



export { csrftoken };
