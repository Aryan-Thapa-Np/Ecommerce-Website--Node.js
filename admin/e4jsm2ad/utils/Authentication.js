/**
 * Professional Authentication Utility
 * Handles authentication status, token refresh, and login redirect.
 *
 * Usage:
 *   await Auth.ensureAuthenticated();
 *   // or
 *   const isAuth = await Auth.isAuthenticated();
 */

const Auth = {
  /**
   * Checks if the user is authenticated by calling the backend.
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    try {
      // Adjust the endpoint if your API prefix is different
      const res = await fetch("/api/auth/authenticate-me", {
        method: "GET",
        credentials: "include",
      });
      const result = await res.json();
    
      if (result.status === "error") {
        // No operation (empty block)

        return false;
      }

      if (res.ok) return true;

      if (res.status === 401) return false;
      // For other errors, treat as not authenticated
      return false;
    } catch (err) {
      // Network or unexpected error
      return false;
    }
  },

  /**
   * Attempts to refresh the access token using the refresh token cookie.
   * @returns {Promise<boolean>} true if refresh succeeded, false otherwise
   */
  async tryRefreshToken() {
    try {
      // Adjust the endpoint if your API prefix is different
      const res = await fetch("/api/auth/refresh-token", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) return true;
      return false;
    } catch (err) {
      return false;
    }
  },

  /**
   * Ensures the user is authenticated.
   * If not, tries to refresh token. If still not, redirects to login.
   * @returns {Promise<void>}
   */
  async ensureAuthenticated() {
    let isAuth = await this.isAuthenticated();
    if (isAuth) return true;
    // Try to refresh token if not authenticated
    const refreshed = await this.tryRefreshToken();
    if (refreshed) {
      // Try again after refresh
      isAuth = await this.isAuthenticated();
      if (isAuth) return;
    }
    // If still not authenticated, redirect to login
    this.redirectToLogin();
  },

  /**
   * Redirects the user to the login page.
   */
  redirectToLogin() {
    // You can customize the login page path
    window.location.href = "/login";
  },
};

export default Auth;
