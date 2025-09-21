import Auth from './Authentication.js';

// Example: Check authentication and log a message


// Use Auth.ensureAuthenticated() when you want to guarantee the user is authenticated
// before running any protected logic or rendering a protected page.
// If the user is not authenticated, it will attempt to refresh the token;
// if that fails, it will redirect to the login page.
// Example usage in a protected page/component:
// (async () => {
//     await Auth.ensureAuthenticated();
//     // If the user is not authenticated, they will be redirected to login.
//     // If authenticated, you can safely run protected code below.
//     console.log("I am authenticated (using ensureAuthenticated)");
// })();

// Yes, you can directly use await Auth.ensureAuthenticated() instead of Auth.isAuthenticated().
// ensureAuthenticated() will check authentication, try to refresh if needed, and redirect to login if not authenticated.
// Use it when you want to guarantee the user is authenticated before running protected logic.

(async () => {
    await Auth.ensureAuthenticated();
    // If the user is not authenticated, they will be redirected to login.
    // If authenticated, you can safely run protected code below.
    console.log("I am authenticated (using ensureAuthenticated)");
})();
