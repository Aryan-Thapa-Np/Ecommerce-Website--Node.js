import Auth from "./utils/Authentication.js";
import { csrftoken } from "./utils/generateCsrf.js";
import { showToast, TOAST_TYPES } from "./utils/toast.js";

// Global constant for active page tracking
const ACTIVE_PAGE_KEY = "customer_active_page";

document.addEventListener("DOMContentLoaded", () => {
  // Add revoke modal HTML to body
  const revokeModalHTML = `
    <div class="revoke-modal" id="revokeModal">
      <div class="revoke-modal-dialog">
        <div class="revoke-modal-content">
          <div class="revoke-modal-header">
            <h3 class="revoke-modal-title">Confirm Action</h3>
          </div>
          <div class="revoke-modal-body">
            <p id="revokeMessage"></p>
          </div>
          <div class="revoke-modal-footer">
            <button class="revoke-btn revoke-btn-cancel" id="revokeCancelBtn">Cancel</button>
            <button class="revoke-btn revoke-btn-confirm" id="revokeConfirmBtn">
              <span class="btn-text">Confirm</span>
              <span class="btn-loader" style="display: none;">
                <i class="fas fa-spinner fa-spin"></i>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to body
  document.body.insertAdjacentHTML("beforeend", revokeModalHTML);

  // Initialize modal elements
  const revokeModal = document.getElementById("revokeModal");
  const revokeMessage = document.getElementById("revokeMessage");
  const revokeCancelBtn = document.getElementById("revokeCancelBtn");
  const revokeConfirmBtn = document.getElementById("revokeConfirmBtn");
  let currentSessionToRevoke = null;

  // Modal functions
  function showRevokeModal(sessionId, isCurrentSession) {
    currentSessionToRevoke = { id: sessionId, isCurrent: isCurrentSession };
    revokeMessage.textContent = isCurrentSession
      ? "Are you sure you want to logout from this device?"
      : "Are you sure you want to revoke this session?";
    revokeModal.classList.add("show");
  }

  function hideRevokeModal() {
    revokeModal.classList.remove("show");
    currentSessionToRevoke = null;
    revokeConfirmBtn.disabled = false;
    revokeConfirmBtn.querySelector(".btn-text").style.display = "";
    revokeConfirmBtn.querySelector(".btn-loader").style.display = "none";
  }

  // Modal event listeners
  revokeCancelBtn.addEventListener("click", hideRevokeModal);

  revokeConfirmBtn.addEventListener("click", async () => {
    if (!currentSessionToRevoke) return;

    // Show loading state
    revokeConfirmBtn.disabled = true;
    revokeConfirmBtn.querySelector(".btn-text").style.display = "none";
    revokeConfirmBtn.querySelector(".btn-loader").style.display =
      "inline-block";

    try {
      if (currentSessionToRevoke.id === "all") {
        // Revoke all other sessions
        const response = await fetch("/api/auth/sessions", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${csrfToken}`,
          },
          credentials: "include",
        });
        const data = await response.json();
        if (data.status === "error") {
          showToast(data.message, TOAST_TYPES.ERROR);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to revoke sessions");
        }

        showToast("All other sessions have been revoked", TOAST_TYPES.SUCCESS);
        loadActiveSessions();
      } else {
        // Handle single session revocation
        const response = await fetch(
          `/api/auth/sessions/${currentSessionToRevoke.id}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": `bearer ${csrfToken}`,
            },
            credentials: "include",
          }
        );
        const data = await response.json();
        if (data.status === "error") {
          showToast(data.message, TOAST_TYPES.ERROR);
          return;
        }
        if (!response.ok) {
          throw new Error("Failed to revoke session");
        }

        if (currentSessionToRevoke.isCurrent) {
          // If current session, clear storage and redirect to login
          sessionStorage.clear();
          window.location.href = "/login";
        } else {
          // If other session, just reload the sessions list
          showToast("Session revoked successfully", TOAST_TYPES.SUCCESS);
          loadActiveSessions();
        }
      }
    } catch (error) {
      showToast(
        `Failed to revoke session${
          currentSessionToRevoke.id === "all" ? "s" : ""
        }`,
        TOAST_TYPES.ERROR
      );
    } finally {
      hideRevokeModal();
    }
  });

  (async () => {
    const check = await Auth.ensureAuthenticated();

    if (!check) {
      // Check if we've already tried refreshing
      if (!sessionStorage.getItem("hasRefreshed")) {
        // Set flag to indicate refresh has been attempted
        sessionStorage.setItem("hasRefreshed", "true");
        window.location.reload();
      } else {
        // Clear the flag and redirect to login
        sessionStorage.removeItem("hasRefreshed");
        // window.location.href = "/login";
      }
    }
    // If the user is not authenticated, they will be redirected to login.
    // If authenticated, you can safely run protected code below.
  })();

  // Elements
  const sidebar = document.getElementById("sidebar");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileOverlay = document.getElementById("mobileOverlay");
  const mainContent = document.getElementById("mainContent");
  const navItems = document.querySelectorAll(".nav-item");
  const pageSections = document.querySelectorAll(".page-section");
  const toggleSwitches = document.querySelectorAll(".toggle-switch input");
  const ordersCount = document.getElementById("ordersCount");
  const wishlistCount = document.getElementById("wishlistCount");
  const cartCount = document.getElementById("cartCount");
  const supportCount = document.getElementById("supportCount");

  let csrfToken = "";
  let emailTemp = "";
  let user_id = "";

  // Mock data for stats (replace with actual API calls in production)

  // Mobile menu toggle
  const toggleMobileMenu = () => {
    sidebar.classList.toggle("mobile-open");
    mobileOverlay.classList.toggle("active");
    mainContent.classList.toggle("sidebar-collapsed");
  };

  // =========================
  // SECTION: Persist Active Page with sessionStorage
  // This block ensures that when a user refreshes the page,
  // the last active section (dashboard/settings/etc) is loaded instead of always starting from dashboard.
  // =========================

  // Modified showPage to also store active page in sessionStorage
  const showPage = (pageId) => {
    // Remove active class from all nav items
    navItems.forEach((item) => item.classList.remove("active"));

    // Add active class to clicked nav item
    const activeNavItem = document.querySelector(
      `.nav-item[data-page="${pageId}"]`
    );
    if (activeNavItem) {
      activeNavItem.classList.add("active");
    }

    // Hide all pages and show selected page
    pageSections.forEach((section) => {
      section.classList.remove("active");
      section.style.display = "none";
      section.classList.add("page-transition");
    });

    // Append 'Page' to pageId to match the section ID format
    const sectionId = `${pageId}Page`;
    const activePage = document.getElementById(sectionId);
    if (activePage) {
      activePage.classList.add("active");
      activePage.style.display = "block";
      setTimeout(() => {
        activePage.classList.remove("page-transition");
      }, 50);
    }

    // Save active page to sessionStorage
    sessionStorage.setItem(ACTIVE_PAGE_KEY, pageId);

    // Close mobile menu on navigation (for mobile view)
    if (sidebar.classList.contains("mobile-open")) {
      toggleMobileMenu();
    }
  };

  // Event Listeners
  mobileMenuBtn.addEventListener("click", toggleMobileMenu);
  mobileOverlay.addEventListener("click", toggleMobileMenu);

  // Close sidebar when clicking outside
  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      if (sidebar.classList.contains("mobile-open")) {
        toggleMobileMenu();
      }
    }
  });

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const pageId = item.getAttribute("data-page");
      if (pageId) {
        showPage(pageId);
      }
    });
  });

  // On page load, restore last active page if present
  let initialPage = sessionStorage.getItem(ACTIVE_PAGE_KEY) || "dashboard";

  setTimeout(() => {
    showPage(initialPage);
  }, 1000);

  // --- Enhanced search bar functionality with fuzzy matching and professional suggestions ---
  // Define searchable sections and their mapping to page/subsection IDs
  const SEARCH_MAP = [
    {
      keywords: [
        "dashboard",
        "home",
        "dashboard page",
        "dashboard section",
        "dashboard menu",
        "dashboard button",
        "dashboard icon",
        "dashboard link",
      ],
      page: "dashboard",
    },
    {
      keywords: [
        "orders",
        "order",
        "orders page",
        "orders section",
        "orders menu",
        "orders button",
        "orders icon",
        "orders link",
      ],
      page: "orders",
    },
    {
      keywords: [
        "wishlist",
        "wish list",
        "wishlist page",
        "wishlist section",
        "wishlist menu",
        "wishlist button",
        "wishlist icon",
        "wishlist link",
      ],
      page: "wishlist",
    },
    {
      keywords: [
        "cart",
        "shopping cart",
        "cart page",
        "cart section",
        "cart menu",
        "cart button",
        "cart icon",
        "cart link",
      ],
      page: "cart",
    },
    {
      keywords: [
        "settings",
        "account settings",
        "settings page",
        "settings section",
        "settings menu",
        "settings button",
        "settings icon",
        "settings link",
      ],
      page: "settings",
    },
    {
      keywords: [
        "support",
        "help",
        "support page",
        "support section",
        "support menu",
        "support button",
        "support icon",
        "support link",
      ],
      page: "support",
    },
    {
      keywords: [
        "chat",
        "chat support",
        "customer support",
        "live chat",
        "message",
        "conversation",
        "chat page",
        "chat section",
      ],
      page: "chat",
    },
    {
      keywords: [
        "notifications",
        "alerts",
        "notification center",
        "updates",
        "messages",
        "notification page",
        "notification section",
      ],
      page: "notifications",
    },
    {
      keywords: [
        "active subscriptions",
        "subscriptions",
        "subscription page",
        "my subscriptions",
        "current subscriptions",
        "subscription management",
      ],
      page: "activeSubscriptions",
    },
    // Subsections in settings
    {
      keywords: [
        "profile",
        "profile details",
        "edit profile",
        "change name",
        "change email",
        "image",
        "phone",
        "address",
        "city",
        "state",
        "country",
        "postal code",
        "avatar",
        "profile picture",
        "personal information",
        "update profile",
      ],
      page: "settings",
      focus: "profileForm",
    },
    {
      keywords: [
        "security",
        "security settings",
        "2fa",
        "two factor",
        "authenticator",
        "email verification",
        "account status",
        "account status reason",
        "account status expiry",
        "created at",
        "password security",
        "account protection",
      ],
      page: "settings",
      focus: "securityForm",
    },
    // Order-related subsections
    {
      keywords: [
        "pending orders",
        "awaiting orders",
        "orders in queue",
        "unprocessed orders",
        "orders waiting",
        "orders not started",
      ],
      page: "orders",
      focus: "pendingOrders",
    },
    {
      keywords: [
        "processing orders",
        "in progress orders",
        "ongoing orders",
        "active orders",
        "orders being processed",
      ],
      page: "orders",
      focus: "processingOrders",
    },
    {
      keywords: [
        "completed orders",
        "finished orders",
        "delivered orders",
        "fulfilled orders",
        "successful orders",
        "received orders",
      ],
      page: "orders",
      focus: "completedOrders",
    },
    // Support-related subsections
    {
      keywords: [
        "create ticket",
        "new ticket",
        "open ticket",
        "submit issue",
        "report problem",
        "contact support",
        "ask for help",
        "create support ticket",
      ],
      page: "support",
      focus: "createSupportTicketBtn",
    },
    // Chat-related keywords
    {
      keywords: [
        "send message",
        "chat history",
        "support chat",
        "customer service chat",
        "live assistance",
        "chat with support",
        "message support",
      ],
      page: "chat",
    },
    // Active Subscriptions subsections
    {
      keywords: [
        "subscription credentials",
        "account credentials",
        "subscription login",
        "view credentials",
        "subscription details",
        "subscription access",
      ],
      page: "activeSubscriptions",
      focus: "active-subscriptions-table",
    },
  ];

  // Levenshtein distance for fuzzy matching
  function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1)
      .fill()
      .map(() => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    return matrix[b.length][a.length];
  }

  // Input sanitization helper
  function sanitizeSearchInput(str) {
    return str
      .replace(/<[^>]*>?/gm, "") // Remove HTML tags
      .replace(/[^\w\s\-@.]/gi, "") // Remove special chars except word, whitespace, dash, @, .
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim()
      .toLowerCase();
  }

  // Find best match with fuzzy matching
  function findBestMatch(searchTerm) {
    let bestMatch = null;
    let minDistance = Infinity;
    const threshold = 3; // Max allowed edit distance for fuzzy match

    for (const entry of SEARCH_MAP) {
      for (const keyword of entry.keywords) {
        const distance = levenshteinDistance(searchTerm, keyword.toLowerCase());
        if (distance < minDistance && distance <= threshold) {
          minDistance = distance;
          bestMatch = entry;
        }
      }
    }
    return bestMatch;
  }

  // Show live suggestions
  function showSuggestions(searchTerm, suggestionBox) {
    suggestionBox.innerHTML = "";
    if (!searchTerm) {
      suggestionBox.style.display = "none";
      return;
    }

    const matches = [];
    for (const entry of SEARCH_MAP) {
      for (const keyword of entry.keywords) {
        const distance = levenshteinDistance(searchTerm, keyword.toLowerCase());
        if (distance <= 3 || keyword.toLowerCase().includes(searchTerm)) {
          matches.push({ keyword, entry });
        }
      }
    }

    if (matches.length > 0) {
      suggestionBox.style.display = "block";
      suggestionBox.style.zIndex = "100000"; // Ensure it's above all other elements

      // Group matches by page
      const groupedMatches = {};
      matches.forEach(({ keyword, entry }) => {
        if (!groupedMatches[entry.page]) {
          groupedMatches[entry.page] = { entry, keywords: [] };
        }
        if (!groupedMatches[entry.page].keywords.includes(keyword)) {
          groupedMatches[entry.page].keywords.push(keyword);
        }
      });

      // Display top matches from each group (limited to 8 total)
      let count = 0;
      const displayedKeywords = new Set();

      Object.values(groupedMatches).forEach(({ entry, keywords }) => {
        if (count >= 8) return;

        // Get the best keyword match for this entry
        const keyword = keywords[0];
        if (displayedKeywords.has(keyword)) return;

        displayedKeywords.add(keyword);
        count++;

        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.tabIndex = 0; // Make focusable for keyboard navigation

        // Add appropriate icon based on page
        let icon = "fa-question";
        switch (entry.page) {
          case "dashboard":
            icon = "fa-chart-line";
            break;
          case "orders":
            icon = "fa-shopping-bag";
            break;
          case "wishlist":
            icon = "fa-heart";
            break;
          case "cart":
            icon = "fa-shopping-cart";
            break;
          case "settings":
            icon = "fa-cog";
            break;
          case "support":
            icon = "fa-headset";
            break;
          case "chat":
            icon = "fa-comments";
            break;
          case "notifications":
            icon = "fa-bell";
            break;
          case "activeSubscriptions":
            icon = "fa-id-card";
            break;
        }

        div.innerHTML = `
          <i class="fas ${icon}"></i>
          <span>${keyword}</span>
          <span class="suggestion-category">${capitalizeFirstLetter(
            entry.page
          )}</span>
        `;

        div.addEventListener("click", () => {
          navigateToMatch(entry);
          suggestionBox.style.display = "none";
          searchInput.value = "";
        });

        suggestionBox.appendChild(div);
      });
    } else {
      suggestionBox.style.display = "none";
    }
  }

  // Navigate to matched page/subsection
  function navigateToMatch(found) {
    showPage(found.page); // Assumes showPage is defined elsewhere
    if (found.focus) {
      setTimeout(() => {
        const el =
          document.getElementById(found.focus) ||
          document.querySelector(`.${found.focus}`);
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (found.focus === "profileForm") {
            el.querySelector('input[name="name"]')?.focus();
          }
        }
      }, 200);
    }
  }

  // Initialize search bar with enhanced features
  const searchInput = document.querySelector(".search-input");
  const suggestionBox = document.createElement("div");
  suggestionBox.className = "suggestion-box";
  searchInput.parentNode.appendChild(suggestionBox);

  // Add search shortcut hint
  const searchShortcut = document.createElement("span");
  searchShortcut.className = "search-shortcut";
  searchShortcut.textContent = "Ctrl+K";
  searchInput.parentNode.appendChild(searchShortcut);

  // Show suggestions with icons and categories
  function showSuggestions(searchTerm, suggestionBox) {
    suggestionBox.innerHTML = "";
    if (!searchTerm) {
      suggestionBox.style.display = "none";
      return;
    }

    const matches = [];
    for (const entry of SEARCH_MAP) {
      for (const keyword of entry.keywords) {
        const distance = levenshteinDistance(searchTerm, keyword.toLowerCase());
        if (distance <= 3 || keyword.toLowerCase().includes(searchTerm)) {
          matches.push({ keyword, entry });
        }
      }
    }

    if (matches.length > 0) {
      suggestionBox.style.display = "block";

      // Group matches by page
      const groupedMatches = {};
      matches.forEach(({ keyword, entry }) => {
        if (!groupedMatches[entry.page]) {
          groupedMatches[entry.page] = { entry, keywords: [] };
        }
        if (!groupedMatches[entry.page].keywords.includes(keyword)) {
          groupedMatches[entry.page].keywords.push(keyword);
        }
      });

      // Display top matches from each group (limited to 8 total)
      let count = 0;
      const displayedKeywords = new Set();

      Object.values(groupedMatches).forEach(({ entry, keywords }) => {
        if (count >= 8) return;

        // Get the best keyword match for this entry
        const keyword = keywords[0];
        if (displayedKeywords.has(keyword)) return;

        displayedKeywords.add(keyword);
        count++;

        const div = document.createElement("div");
        div.className = "suggestion-item";

        // Add appropriate icon based on page
        let icon = "fa-question";
        switch (entry.page) {
          case "dashboard":
            icon = "fa-chart-line";
            break;
          case "orders":
            icon = "fa-shopping-bag";
            break;
          case "wishlist":
            icon = "fa-heart";
            break;
          case "cart":
            icon = "fa-shopping-cart";
            break;
          case "settings":
            icon = "fa-cog";
            break;
          case "support":
            icon = "fa-headset";
            break;
          case "chat":
            icon = "fa-comments";
            break;
          case "notifications":
            icon = "fa-bell";
            break;
          case "activeSubscriptions":
            icon = "fa-id-card";
            break;
        }

        div.innerHTML = `
          <i class="fas ${icon}"></i>
          <span>${keyword}</span>
          <span class="suggestion-category">${capitalizeFirstLetter(
            entry.page
          )}</span>
        `;

        div.addEventListener("click", () => {
          navigateToMatch(entry);
          suggestionBox.style.display = "none";
          searchInput.value = "";
        });

        suggestionBox.appendChild(div);
      });
    } else {
      suggestionBox.style.display = "none";
    }
  }

  searchInput.addEventListener("input", (e) => {
    const searchTerm = sanitizeSearchInput(e.target.value);
    showSuggestions(searchTerm, suggestionBox);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const searchTerm = sanitizeSearchInput(searchInput.value);
      suggestionBox.style.display = "none";
      if (!searchTerm) return;

      const found = findBestMatch(searchTerm);
      if (found) {
        navigateToMatch(found);
        searchInput.value = "";
      } else {
        searchInput.value = "";
        searchInput.placeholder = "No section found!";
        setTimeout(() => {
          searchInput.placeholder = "Search pages, orders, settings...";
        }, 1200);
      }
    } else if (e.key === "Escape") {
      suggestionBox.style.display = "none";
      searchInput.value = "";
      searchInput.blur();
    } else if (
      e.key === "ArrowDown" &&
      suggestionBox.style.display === "block"
    ) {
      // Navigate to first suggestion
      const firstSuggestion = suggestionBox.querySelector(".suggestion-item");
      if (firstSuggestion) {
        firstSuggestion.focus();
        e.preventDefault();
      }
    }
  });

  // Global keyboard shortcut for search (Ctrl+K)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // Handle clicks outside to close suggestion box
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !suggestionBox.contains(e.target)) {
      suggestionBox.style.display = "none";
    }
  });

  // Add keyboard navigation for suggestions
  suggestionBox.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const suggestions = suggestionBox.querySelectorAll(".suggestion-item");
      const currentIndex = Array.from(suggestions).indexOf(
        document.activeElement
      );

      if (e.key === "ArrowDown" && currentIndex < suggestions.length - 1) {
        suggestions[currentIndex + 1].focus();
      } else if (e.key === "ArrowUp") {
        if (currentIndex === 0) {
          searchInput.focus();
        } else if (currentIndex > 0) {
          suggestions[currentIndex - 1].focus();
        }
      }
    } else if (
      e.key === "Enter" &&
      document.activeElement.classList.contains("suggestion-item")
    ) {
      document.activeElement.click();
    } else if (e.key === "Escape") {
      suggestionBox.style.display = "none";
      searchInput.value = "";
      searchInput.blur();
    }
  });

  // Professional CSS for suggestions
  const style = document.createElement("style");
  style.textContent = `
    .suggestion-box {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      max-height: 240px;
      overflow-y: auto;
      width: 100%;
      z-index: 1000;
      display: none;
      margin-top: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    .suggestion-item {
      padding: 12px 16px;
      cursor: pointer;
      font-size: 14px;
      color: #2d3748;
      border-bottom: 1px solid #edf2f7;
      transition: background-color 0.2s ease;
      display: flex;
      align-items: center;
    }
    .suggestion-item:last-child {
      border-bottom: none;
    }
    .suggestion-item:hover {
      background-color: #f7fafc;
    }
    .suggestion-item:active {
      background-color: #edf2f7;
    }
    .suggestion-item i {
      margin-right: 10px;
      color: #4a5568;
      width: 16px;
      text-align: center;
    }
    .suggestion-category {
      font-size: 11px;
      color: #718096;
      background: #edf2f7;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: auto;
    }
    .search-input:focus {
      border-color: #3182ce;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
    }
    .search-bar {
      position: relative;
    }
    .search-bar .search-input {
      padding-right: 40px;
      padding-left: 30px;
      transition: all 0.3s ease;
    }
    .search-bar .search-input:focus {
      width: 300px;
    }
    .search-bar .search-icon {
      position: absolute;
      right: 12px;
      
      top: 50%;
      transform: translateY(-50%);
      color: #718096;
    }
    .search-bar .search-input:focus + .search-icon {
      color: #3182ce;
    }
    .search-shortcut {
      position: absolute;
      right: 40px;
      top: 50%;
      transform: translateY(-50%);
      background: #edf2f7;
      color: #718096;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);

  // Notification button
  const notificationBtn = document.querySelector(".header-btn .fa-bell");
  notificationBtn.parentElement.addEventListener("click", () => {
    // Implement notification functionality here
    showPage("notifications");
  });

  const supportbtn = document.querySelector(".header-btn .fa-question-circle");
  supportbtn.parentElement.addEventListener("click", () => {
    // Implement support functionality here
    showPage("settings");
  });

  const home = document.getElementById("home");
  home.addEventListener("click", () => {
    showPage("dashboard");
  });

  // Handle window resize for responsive behavior
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && sidebar.classList.contains("mobile-open")) {
      toggleMobileMenu();
    }
  });

  // =========================
  // SECTION: Profile Details & Email Verification Modal Logic
  // =========================

  function showSettingsSkeleton() {
    const settingsPage = document.getElementById("settingsPage");
    settingsPage.style.position = "relative"; // needed for absolute overlay

    const overlay = document.createElement("div");
    overlay.className = "skeleton-overlay";
    overlay.id = "settingsSkeletonOverlay";

    // Build skeleton matching actual sections: profile + security
    overlay.innerHTML = `
        <!-- Profile Details Section -->
        <div>
            <div class="skeleton-header"></div>
            <div class="skeleton-subtitle"></div>
        </div>
        <div style="display: flex; align-items: center; gap: 32px; flex-wrap: wrap;">
            <div style="text-align: center;">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-line short"></div>
            </div>
            <div style="flex:1; min-width:220px;">
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
            </div>
        </div>
        <!-- Security Settings Section -->
        <div>
            <div class="skeleton-header"></div>
            <div class="skeleton-subtitle"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="flex:1;">
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
            </div>
            <div class="skeleton-toggle"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="flex:1;">
                <div class="skeleton-line long"></div>
                <div class="skeleton-line medium"></div>
            </div>
            <div class="skeleton-toggle"></div>
        </div>
    `;

    settingsPage.appendChild(overlay);
  }

  function hideSettingsSkeleton() {
    const overlay = document.getElementById("settingsSkeletonOverlay");
    if (overlay) overlay.remove();
  }
  showSettingsSkeleton();

  function showHeaderSkeleton() {
    const headerRight = document.querySelector(".header-right");
    const userMenu = document.querySelector(".user-menu");
    const notificationBtn = document.querySelectorAll(".header-btn");

    userMenu.style.opacity = "0";
    notificationBtn.forEach((btn) => (btn.style.opacity = "0"));
    headerRight.style.position = "relative"; // so overlay fits over it

    const overlay = document.createElement("div");
    overlay.className = "skeleton-header-overlay";
    overlay.id = "headerSkeletonOverlay";

    overlay.innerHTML = `
        <div class="skeleton-btn"></div>
        <div class="skeleton-btn"></div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <div class="skeleton-avatar-small"></div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div class="skeleton-line medium"></div>
                <div class="skeleton-line short"></div>
            </div>
        </div>
    `;

    headerRight.appendChild(overlay);
  }

  function hideHeaderSkeleton() {
    const overlay = document.getElementById("headerSkeletonOverlay");
    const headerRight = document.querySelector(".header-right");
    const userMenu = document.querySelector(".user-menu");
    const notificationBtn = document.querySelectorAll(".header-btn");
    userMenu.style.opacity = "1";
    notificationBtn.forEach((btn) => (btn.style.opacity = "1"));
    headerRight.style.opacity = "1";
    if (overlay) overlay.remove();
  }

  showHeaderSkeleton();
  //from here the real api integration will begain-----------------------------------------------------

  // --- Enhanced Profile Details Edit/Save/Cancel Logic ---
  const profileNameInput = document.getElementById("profileNameInput");
  const profileEmailInput = document.getElementById("profileEmailInput");
  const profileNameEditBtn = document.getElementById("profileNameEditBtn");
  const profileNameSaveBtn = document.getElementById("profileNameSaveBtn");
  const profileNameCancelBtn = document.getElementById("profileNameCancelBtn");
  const profileEmailEditBtn = document.getElementById("profileEmailEditBtn");
  const profileEmailSaveBtn = document.getElementById("profileEmailSaveBtn");
  const profileEmailCancelBtn = document.getElementById(
    "profileEmailCancelBtn"
  );
  const profileImageUploadBtn = document.getElementById(
    "profileImageUploadBtn"
  );
  const profileImageSaveBtn = document.getElementById("profileImageSaveBtn");
  const profileImageCancelBtn = document.getElementById(
    "profileImageCancelBtn"
  );
  const profileImageInput = document.getElementById("profileImageInput");
  const profilePreview = document.getElementById("profilePreview");

  // Store original values for cancel
  let originalName = "";
  let originalEmail = "";
  let originalImageSrc = "";

  // Name edit/save/cancel
  profileNameEditBtn?.addEventListener("click", () => {
    originalName = profileNameInput.value;
    profileNameInput.disabled = false;
    profileNameInput.focus();
    profileNameEditBtn.style.display = "none";
    profileNameSaveBtn.style.display = "";
    profileNameCancelBtn.style.display = "";
  });

  profileNameSaveBtn?.addEventListener("click", async () => {
    if (
      !profileNameSaveBtn ||
      !profileNameInput ||
      !profileNameEditBtn ||
      !profileNameCancelBtn
    ) {
      console.error("Required DOM elements are missing");
      return;
    }

    // Set loading state with spinner
    profileNameInput.disabled = true;
    profileNameCancelBtn.style.display = "none";
    profileNameEditBtn.style.display = "none";
    profileNameSaveBtn.textContent = "";
    profileNameSaveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin hero" aria-hidden="true"></i>`;
    profileNameSaveBtn.setAttribute("aria-busy", "true");

    try {
      const name = profileNameInput.value.trim();
      if (!name) {
        showToast("Name cannot be empty.", TOAST_TYPES.ERROR);
        return;
      }
      if (name === originalName) {
        showToast("Please Enter New Name.", TOAST_TYPES.ERROR);
        return;
      }
      if (name.length < 3) {
        showToast(
          "Name must be at least 3 characters long..",
          TOAST_TYPES.ERROR
        );

        return;
      }
      if (name.length > 30) {
        showToast("Name cannot exceed 30 characters.", TOAST_TYPES.ERROR);
        return;
      }

      const formData = new FormData();
      formData.append("name", name);
      const user = formData.get("name");

      const response = await fetch("/api/users/profile/info", {
        method: "PATCH",
        body: JSON.stringify({ name: user }),
        credentials: "include",
        headers: {
          "X-CSRF-Token": `bearer ${csrfToken}`,
          "content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.status == "error") {
        const err = data.message;
        showToast(err, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        const errr = data.message;
        showToast(errr || "Plese try again later.", TOAST_TYPES.ERROR);
        return;
      }

      setTimeout(() => {
        getnotifications();
        showToast("Successfully Name Changed..", TOAST_TYPES.SUCCESS);
      }, 2000);
    } catch (error) {
      profileNameInput.focus();
      showToast("Plese try again later.", TOAST_TYPES.ERROR);
      return;
    } finally {
      setTimeout(() => {
        profileNameSaveBtn.style.display = "none";
        profileNameEditBtn.style.display = "";
        profileNameSaveBtn.innerHTML = ` <i class="fas fa-save"></i>`;
        profileNameSaveBtn.setAttribute("aria-busy", "false");
      }, 2000);
    }
  });

  profileNameCancelBtn?.addEventListener("click", () => {
    profileNameInput.value = originalName;
    profileNameInput.disabled = true;
    profileNameEditBtn.style.display = "";
    profileNameSaveBtn.style.display = "none";
    profileNameCancelBtn.style.display = "none";
  });

  // Email edit/save/cancel

  profileEmailEditBtn?.addEventListener("click", () => {
    originalEmail = profileEmailInput.value;
    profileEmailInput.disabled = false;
    profileEmailInput.focus();
    profileEmailEditBtn.style.display = "none";
    profileEmailSaveBtn.style.display = "";
    profileEmailCancelBtn.style.display = "";
  });

  profileEmailSaveBtn?.addEventListener("click", async () => {
    profileEmailInput.disabled = true;
    profileEmailEditBtn.style.display = "none";
    profileEmailCancelBtn.style.display = "none";
    profileEmailSaveBtn.style.display = "";
    profileEmailSaveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin hero" aria-hidden="true"></i>`;
    profileEmailSaveBtn.setAttribute("aria-busy", "true");

    try {
      const email = profileEmailInput.value.trim().toLowerCase();
      if (!email) {
        showToast("Email cannot be empty.", TOAST_TYPES.ERROR);
        return;
      }
      if (email === originalEmail) {
        showToast("Please Enter New Email.", TOAST_TYPES.ERROR);
        return;
      }
      if (email.length < 5) {
        showToast(
          "Email must be at least 5 characters long.",
          TOAST_TYPES.ERROR
        );
        return;
      }
      if (email.length > 254) {
        showToast("Email is too long.", TOAST_TYPES.ERROR);
        return;
      }
      const emailRegex =
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
      if (!emailRegex.test(email)) {
        showToast("Please enter a valid email address.", TOAST_TYPES.ERROR);
        return;
      }
      if (email.includes("..")) {
        showToast("Email cannot contain consecutive dots.", TOAST_TYPES.ERROR);
        return;
      }
      const domain = email.split("@")[1];
      if (!domain.includes(".")) {
        showToast(
          "Email domain must contain at least one dot.",
          TOAST_TYPES.ERROR
        );
        return;
      }

      const formData = new FormData();
      formData.append("email", email);
      const user = formData.get("email");

      emailTemp = user;

      const response = await fetch("/api/users/profile/info", {
        method: "PATCH",
        body: JSON.stringify({ email: user }),
        credentials: "include",
        headers: {
          "X-CSRF-Token": `bearer ${csrfToken}`,
          "content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (data.status == "error") {
        const err = data.message;
        showToast(err, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        const errr = data.message;
        showToast(errr || "Plese try again later.", TOAST_TYPES.ERROR);
        return;
      }

      setTimeout(() => {
        showToast("Successfully Email Changed.", TOAST_TYPES.SUCCESS);
        if (data.requireEmailVerification == true) {
          showToast("Please verify your email.", TOAST_TYPES.SUCCESS);
          emailVerificationModal.classList.add("show");
          setTimeout(() => {
            emailVerificationModal.style.display = "flex";
          }, 400);
        }

        getnotifications();
      }, 2000);
    } catch (error) {
      profileNameInput.focus();
      showToast("Plese try again later.", TOAST_TYPES.ERROR);
      return;
    } finally {
      setTimeout(() => {
        profileEmailSaveBtn.style.display = "none";
        profileEmailEditBtn.style.display = "";
        profileEmailSaveBtn.innerHTML = ` <i class="fas fa-save"></i>`;
        profileEmailSaveBtn.setAttribute("aria-busy", "false");
      }, 2000);
    }
  });

  profileEmailCancelBtn?.addEventListener("click", () => {
    profileEmailInput.value = originalEmail;
    profileEmailInput.disabled = true;
    profileEmailEditBtn.style.display = "";
    profileEmailSaveBtn.style.display = "none";
    profileEmailCancelBtn.style.display = "none";
  });

  // Profile image upload/save/cancel
  profileImageInput?.addEventListener("click", () => {
    originalImageSrc = profilePreview.src;
  });

  profileImageInput?.addEventListener("change", (e) => {
    if (profileImageInput.files && profileImageInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        profilePreview.src = ev.target.result;
        profileImageSaveBtn.style.display = "";
        profileImageCancelBtn.style.display = "";
        profileImageUploadBtn.style.display = "none";
      };
      reader.readAsDataURL(profileImageInput.files[0]);
    }
  });
  profileImageSaveBtn?.addEventListener("click", async () => {
    profileImageCancelBtn.style.display = "none";
    profileImageSaveBtn.style.display = "";
    profileImageSaveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin hero" aria-hidden="true"></i>`;
    profileImageSaveBtn.setAttribute("aria-busy", "true");

    // Use FormData to send the file as multipart/form-data
    const formData = new FormData();
    if (profileImageInput.files && profileImageInput.files[0]) {
      formData.append("profileImage", profileImageInput.files[0]);
    } else {
      alert("No file selected.");
      return;
    }

    try {
      const response = await fetch("/api/users/profile/image", {
        method: "POST",
        body: formData,
        credentials: "include",
        headers: {
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
      });

      const data = await response.json();
      if (data.status == "error") {
        const err = data.message;
        showToast(err, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        showToast("failed TO Save Profile Image!", TOAST_TYPES.ERROR);
        return;
      }

      setTimeout(() => {
        showToast("Profile image saved!", TOAST_TYPES.SUCCESS);
        getnotifications();
      }, 2000);
    } catch (error) {
      showToast("Plese try again later.", TOAST_TYPES.ERROR);
      return;
    } finally {
      setTimeout(() => {
        profileImageUploadBtn.style.display = "";
        profileImageSaveBtn.style.display = "none";
        profileImageSaveBtn.innerHTML = ` <i class="fas fa-save"></i>`;
        profileImageSaveBtn.setAttribute("aria-busy", "false");
      }, 2000);
    }
  });

  profileImageCancelBtn?.addEventListener("click", () => {
    profilePreview.src = originalImageSrc;
    profileImageSaveBtn.style.display = "none";
    profileImageCancelBtn.style.display = "none";
    profileImageUploadBtn.style.display = "";
    // Optionally clear file input
    profileImageInput.value = "";
  });

  const userName = document.querySelector(".user-info h4");
  const userRole = document.querySelector(".user-info p");
  const formName = document.querySelector('.form-input[name="name"]');
  const formEmail = document.querySelector('.form-input[name="email"]');
  const userImage = document.querySelector(".user-avatar");
  let ordercheck = false;

  //Fetch data

  const UserData = async () => {
    csrfToken = await csrftoken();
    try {
      const response = await fetch("/api/users/profile", {
        method: "GET",
        credentials: "include", // Include cookies for session
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok) throw new Error("Failed to fetch user data");
      // Update UI with user data

      const user = data.profile;
      ordercheck = data.ordercheck;

      if (user.two_factor_enabled == 1) {
        if (user.two_factor_method == "email") {
          emailToggle.checked = true;
          emailbadge.innerHTML = "Enabled";
          emailbadge.className = "status-badge status-enabled";
        } else {
          emailToggle.checked = false;
          emailbadge.innerHTML = "Disabled";
          emailbadge.className = "status-badge status-disabled";
        }
        if (user.two_factor_method == "app") {
          authenticatorToggle.checked = true;
          authbadge.innerHTML = "Enabled";
          authbadge.className = "status-badge status-enabled";
        } else {
          authenticatorToggle.checked = false;
          authbadge.innerHTML = "Disabled";
          authbadge.className = "status-badge status-disabled";
        }
      } else {
        authenticatorToggle.checked = false;
        emailToggle.checked = false;
        authbadge.innerHTML = "Disabled";
        authbadge.className = "status-badge status-disabled";
        emailbadge.innerHTML = "Disabled";
        emailbadge.className = "status-badge status-disabled";
      }

      emailTemp = user.email;
      user_id = user.id;

      window.chatUserId = user.id;
      window.chatUserName = user.username;

      userName.textContent = user.username || "User";
      userRole.textContent = user.role;
      formName.value = user.username || "";
      formEmail.value = user.email || "";
      // Set profile image preview
      if (user.profile_image) {
        let imgUrl = user.profile_image.replace(/^public\//, "/");
        profilePreview.src = imgUrl;
        userImage.src = imgUrl;
        window.userImageprofile = imgUrl;
      } else {
        profilePreview.src = "../noice/placeholder.webp";
        userImage.src = "../noice/placeholder.webp";
      }
      setTimeout(() => {
        hideSettingsSkeleton();
        hideHeaderSkeleton();
      }, 2000);
    } catch (error) {
      showToast("Error fetching user data", TOAST_TYPES.ERROR);
    }
  };
  UserData();

  const emailVerificationModal = document.getElementById(
    "email-verification-modal"
  );
  const emailVerificationForm = document.getElementById(
    "email-verification-form"
  );
  const codeInputs = emailVerificationForm.querySelectorAll(".code-input");

  // Utility: Sanitize code input
  function sanitizeCode(value) {
    return value.replace(/[^0-9]/g, "").slice(0, 6);
  }

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

  setupCodeInputs(emailVerificationForm);

  // Close modal
  const closeModal = (modal) => {
    modal.style.display = "none";
    modal
      .querySelectorAll(".code-input")
      .forEach((input) => (input.value = ""));

    if (modal.querySelector(".error-message")) {
      modal.querySelector(".error-message").style.display = "none";
    }
  };

  emailVerificationModal
    .querySelector(".modal-close")
    .addEventListener("click", () => closeModal(emailVerificationModal));

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
        getnotifications();
        setTimeout(() => {
          window.location.reload();
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

  // =========================
  // SECTION: 2FA Setup & Verification Logic
  // =========================

  const authenticatorToggle = document.querySelector(
    ".toggle-2fa-authenticator"
  );
  const emailToggle = document.querySelector(".toggle-2fa-email");
  document.querySelector(".security-status .status-badge").id =
    "authenticatorStatus";
  const emailbadge = document.getElementById("test");
  const authbadge = document.getElementById("authenticatorStatus");

  // Authenticator toggle
  authenticatorToggle.addEventListener("change", async () => {
    emailToggle.disabled = authenticatorToggle.checked;

    if (!authenticatorToggle.checked) {
      try {
        authbadge.innerHTML = `<i class="fa-solid fa-spinner fa-spin hero" aria-hidden="true"></i>`;
        authbadge.setAttribute("aria-busy", "true");
        authbadge.className = "status-badge";
        const response = await fetch("/api/auth/2fa/disable-request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${csrfToken}`,
          },
        });

        const data = await response.json();

        if (data.status == "error") {
          const errrr = data.message;
          showToast(errrr, TOAST_TYPES.ERROR);
          return;
        }

        setTimeout(() => {
          showToast("Check Email for disable 2FA request", TOAST_TYPES.SUCCESS);
          authbadge.innerHTML = "Enabled";
          authenticatorToggle.checked = true;
          authbadge.className = "status-badge status-enabled";
        }, 2000);
      } catch (error) {
        setTimeout(() => {
          showToast("Error disabling authenticator 2FA:", TOAST_TYPES.ERROR);
          authbadge.innerHTML = "Enabled";
          authenticatorToggle.checked = true;
          authbadge.className = "status-badge status-enabled";
        }, 2000);
      }
      return;
    }

    // // Disable email 2FA if enabled
    // if (emailToggle.checked) {

    //   emailbadge.innerHTML = `<i class="fa-solid fa-spinner fa-spin hero" aria-hidden="true"></i>`;
    //   emailbadge.setAttribute("aria-busy", "true");
    //   try {
    //     const response = await fetch('/api/auth/2fa/disable-request', {
    //       method: 'POST',
    //       headers: {
    //         'Content-Type': 'application/json',
    //         "X-CSRF-Token": `bearer ${csrfToken}`,
    //       }
    //     });
    //     const data = await response.json();
    //     if (!response.ok) throw new Error('Failed to disable email 2FA');
    //     emailToggle.checked = true;

    //     if (data.status == "error") {
    //       const errrr = data.message;
    //       showToast(errrr, TOAST_TYPES.ERROR);
    //       return;
    //     }

    //     setTimeout(() => {
    //       emailToggle.checked = true;
    //       showToast("Check Email for disable 2FA request", TOAST_TYPES.SUCCESS);
    //       emailbadge.innerHTML = 'Enabled';
    //       emailbadge.className = 'status-badge status-enabled';
    //     }, 2000);
    //   } catch (error) {

    //     setTimeout(() => {
    //       emailToggle.checked = true;
    //       showToast("Error disabling email 2FA:", TOAST_TYPES.ERROR);
    //       emailbadge.innerHTML = 'Enabled';
    //       emailbadge.className = 'status-badge status-enabled';
    //     }, 2000);
    //     return;
    //   }
    // }

    // Setup authenticator 2FA
    try {
      authbadge.innerHTML = `<i class="fa-solid fa-spinner fa-spin hero" aria-hidden="true"></i>`;
      authbadge.setAttribute("aria-busy", "true");
      authbadge.className = "status-badge";
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({ method: "app" }),
      });
      const data = await response.json();

      if (data.status == "error") {
        const errrr = data.message;
        showToast(errrr, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) throw new Error("Failed to initiate 2FA");

      setTimeout(() => {
        // Display QR code
        document.getElementById(
          "authQrCodeContainer"
        ).innerHTML = `<img src="${data.qrCode}" alt="QR Code" style="width: 150px; height: 150px;">`;
        const authModal = document.getElementById("twoFactorAuthModal");
        authModal.classList.add("show");
        authModal.setAttribute("aria-hidden", "false");
        authModal.inert = false;
      }, 2000);

      // Verify code
      const verifyBtn = document.getElementById("verifyTwoFactorAuthBtn");
      const originalBtnText = verifyBtn.innerHTML;
      verifyBtn.onclick = async () => {
        const code = document.getElementById("authTotpCodeInput").value;

        const errorElement = document.getElementById("authTotpError");

        if (!/^\d{6}$/.test(code)) {
          errorElement.textContent = "Enter a valid 6-digit code";
          return;
        }

        errorElement.textContent = "";
        verifyBtn.innerHTML = '<span class="loading-spinner"></span> Verifying';
        verifyBtn.disabled = true;

        try {
          const verifyResponse = await fetch("/api/auth/2fa/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": `bearer ${csrfToken}`,
            },
            body: JSON.stringify({
              email: emailTemp,
              otp: code,
              method: "app",
            }),
          });
          const data = await verifyResponse.json();

          if (data.status == "error") {
            const errrr = data.message;
            setTimeout(() => {
              showToast(errrr, TOAST_TYPES.ERROR);
            }, 2000);
            return;
          }

          setTimeout(() => {
            authbadge.innerHTML = "Enabled";
            authbadge.className = "status-badge status-enabled";
            document
              .getElementById("twoFactorAuthModal")
              .classList.remove("show");
          }, 2000);
        } catch (error) {
          setTimeout(() => {
            errorElement.textContent = "Invalid code. Try again.";
          }, 2000);
        } finally {
          setTimeout(() => {
            verifyBtn.innerHTML = originalBtnText;
            verifyBtn.disabled = false;
          }, 2000);
        }
      };
    } catch (error) {
      showToast("Error enabling authenticator 2FA:", TOAST_TYPES.ERROR);
    } finally {
      setTimeout(() => {
        authbadge.innerHTML = "Disabled";
        authenticatorToggle.checked = false;
        authbadge.className = "status-badge status-disabled";
        authbadge.setAttribute("aria-busy", "false");
      }, 2000);
    }
  });

  // Email toggle
  emailToggle.addEventListener("change", async () => {
    authenticatorToggle.disabled = emailToggle.checked;
    emailbadge.innerHTML = `<i class="fa-solid fa-spinner fa-spin hero" aria-hidden="true"></i>`;
    emailbadge.setAttribute("aria-busy", "true");
    emailbadge.className = "status-badge";

    if (!emailToggle.checked) {
      try {
        const response = await fetch("/api/auth/2fa/disable-request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${csrfToken}`,
          },
        });
        const data = await response.json();

        if (data.status == "error") {
          const errrr = data.message;
          showToast(errrr, TOAST_TYPES.ERROR);
          return;
        }

        if (!response.ok) throw new Error("Failed to disable 2FA");
        setTimeout(() => {
          showToast("Check Email for disable 2FA request", TOAST_TYPES.SUCCESS);
          emailToggle.checked = true;
          emailbadge.innerHTML = "Enabled";
          emailbadge.className = "status-badge status-enabled";
        }, 2000);
      } catch (error) {
        setTimeout(() => {
          showToast("Error disabling email 2FA", TOAST_TYPES.ERROR);
          emailToggle.checked = true;
          emailbadge.innerHTML = "Enabled";
          emailbadge.className = "status-badge status-enabled";
        }, 2000);
      }
      return;
    }

    // Setup email 2FA
    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        body: JSON.stringify({ method: "email" }),
      });
      if (!response.ok) throw new Error("Failed to initiate 2FA");
      const emailModal = document.getElementById("emailTwoFactorModal");
      emailModal.classList.add("show");
      emailModal.setAttribute("aria-hidden", "false");
      emailModal.inert = false;

      // Verify code
      const verifyBtn = document.getElementById("verifyTwoFactorEmailBtn");
      const originalBtnText = verifyBtn.innerHTML;
      verifyBtn.onclick = async () => {
        const code = document.getElementById("emailTwoFactorInput").value;
        const errorElement = document.getElementById("emailTwoFactorError");

        if (!/^\d{6}$/.test(code)) {
          errorElement.textContent = "Enter a valid 6-digit code";
          return;
        }

        errorElement.textContent = "";
        verifyBtn.innerHTML = '<span class="loading-spinner"></span> Verifying';

        verifyBtn.disabled = true;

        try {
          const verifyResponse = await fetch("/api/auth/2fa/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": `bearer ${csrfToken}`,
            },
            body: JSON.stringify({
              email: emailTemp,
              otp: sanitizeCode(code),
              method: "email",
            }),
          });
          const data = await verifyResponse.json();

          if (data.status == "error") {
            const errrr = data.message;
            setTimeout(() => {
              showToast(errrr, TOAST_TYPES.ERROR);
            }, 2000);

            return;
          }

          setTimeout(() => {
            emailbadge.innerHTML = "Enabled";
            emailbadge.className = "status-badge status-enabled";
            document
              .getElementById("emailTwoFactorModal")
              .classList.remove("show");
          }, 2000);
        } catch (error) {
          setTimeout(() => {
            errorElement.textContent = "Invalid code. Try again.";
          }, 2000);
        } finally {
          setTimeout(() => {
            verifyBtn.innerHTML = originalBtnText;
            verifyBtn.setAttribute("aria-busy", "false");
            verifyBtn.disabled = false;
          }, 2000);
        }
      };
    } catch (error) {
      showToast("Error enabling email 2FA:", TOAST_TYPES.ERROR);
    } finally {
      setTimeout(() => {
        emailbadge.innerHTML = "Disabled";
        emailbadge.className = "status-badge status-disabled";
        emailbadge.setAttribute("aria-busy", "false");
        emailToggle.disabled = false;
      }, 2000);
    }
  });

  // Close buttons
  document.getElementById("2faAuthenticatorclose").onclick = () => {
    const modal = document.getElementById("twoFactorAuthModal");
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;

    authenticatorToggle.checked = false;
    authbadge.innerHTML = "Disabled";
    authbadge.className = "status-badge status-disabled";

    // Re-enable the other toggle and focus the original toggle
    emailToggle.disabled = false;
    authenticatorToggle.focus();
  };
  document.getElementById("2faemailclose").onclick = () => {
    const modal = document.getElementById("emailTwoFactorModal");
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;

    emailToggle.checked = false;
    emailbadge.innerHTML = "Disabled";
    emailbadge.className = "status-badge status-disabled";

    // Re-enable the other toggle and focus the original toggle
    authenticatorToggle.disabled = false;
    emailToggle.focus();
  };

  let originalActivityContent = "";
  showActivitySkeleton();
  async function fetchNotifications() {
    try {
      const response = await fetch(`/api/users/recentactivity`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        credentials: "include",
      });

      const notifications = await response.json();

      if (notifications.status === "error") {
        showToast(notifications.message, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Ensure notifications is an array
      const notificationList = Array.isArray(notifications)
        ? notifications
        : notifications
        ? [notifications]
        : [];

      const container = document.getElementById("activity");
      container.innerHTML =
        notificationList.length > 0
          ? notificationList
              .map(
                (notification) => `
                <div class="activity-item">
                    <div class="activity-icon" style="background: ${notification.icon_background};">
                        <i class="${notification.icon_class}"></i>
                    </div>
                    <div class="activity-content">
                        <h4>${notification.title}</h4>
                        <p>${notification.message}</p>
                    </div>
                    <div class="activity-time">${notification.relative_time}</div>
                </div>
            `
              )
              .join("")
          : "<p>No notifications available.</p>";
    } catch (error) {
      document.getElementById("activity").innerHTML =
        "<p>Error loading notifications.</p>";
    }
  }

  setTimeout(() => fetchNotifications(), 2000);

  function showActivitySkeleton() {
    const activity = document.getElementById("activity");
    // Save current content
    originalActivityContent = activity.innerHTML;

    // Build skeleton HTML
    let skeletonHTML = "";
    for (let i = 0; i < 3; i++) {
      skeletonHTML += `
          <div class="activity-skeleton">
              <div class="skeleton-icon"></div>
              <div class="skeleton-text">
                  <div class="skeleton-line medium"></div>
                  <div class="skeleton-line long"></div>
              </div>
          </div>`;
    }
    activity.innerHTML = skeletonHTML;
  }

  function hideActivitySkeleton() {
    const activity = document.querySelector("activity");
    activity.innerHTML = originalActivityContent;
  }

  function showNotificationSkeleton() {
    const activity = document.querySelector(".notifications-list");
    // Save current content
    originalActivityContent = activity.innerHTML;

    // Build skeleton HTML
    let skeletonHTML = "";
    for (let i = 0; i < 3; i++) {
      skeletonHTML += `
          <div class="activity-skeleton">
              <div class="skeleton-icon"></div>
              <div class="skeleton-text">
                  <div class="skeleton-line medium"></div>
                  <div class="skeleton-line long"></div>
              </div>
          </div>`;
    }
    activity.innerHTML = skeletonHTML;
  }

  showNotificationSkeleton();

  const getnotifications = async () => {
    const notificationBadge = document.querySelector(".notification-badge");
    const notificationsCount = document.getElementById("notificationsCount");

    try {
      const response = await fetch("/api/users/notifications", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "error") {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }

      // Update notification badge
      const unviewedCount = data.filter((n) => n.viewed === 0).length;
      notificationBadge.textContent = unviewedCount > 0 ? unviewedCount : 0;
      notificationsCount.textContent = unviewedCount > 0 ? unviewedCount : 0;
      notificationsCount.style.display = unviewedCount > 0 ? "block" : "none";
      notificationBadge.style.display = unviewedCount > 0 ? "block" : "none";

      // Render notifications
      const container = document.querySelector(".notifications-list");
      container.innerHTML =
        data.length > 0
          ? data
              .map(
                (notification) => `
            <div class="activity-item ${
              notification.viewed === 0 ? "notifiback" : ""
            }" data-id="${notification.id}">
              <div class="activity-icon" style="background: ${
                notification.icon_background
              };">
                <i class="${notification.icon_class}"></i>
              </div>
              <div class="activity-content">
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
              </div>
              <div class="activity-time">
                ${notification.relative_time}
                <span class="closenoti" data-id="${notification.id}">
                  <i class="fa-solid fa-xmark"></i>
                </span>
              </div>
            </div>
          `
              )
              .join("")
          : `<div class="empty-state">
            <i class="fas fa-bell-slash"></i>
            <h3>No new notifications</h3>
            <p>You're all caught up!</p>
          </div>`;

      // Add event listeners for viewing notifications
      const notificationItems = document.querySelectorAll(".activity-item");
      notificationItems.forEach((item) => {
        item.addEventListener("click", async (e) => {
          // Prevent triggering view event when clicking the close button
          if (e.target.closest(".closenoti")) return;

          if (!item.classList.contains("notifiback")) return;

          try {
            const id = item.getAttribute("data-id");
            const response = await fetch(
              `/api/users/notifications/viewed/${id}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-CSRF-Token": `bearer ${csrfToken}`,
                },
                credentials: "include",
              }
            );

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            item.classList.remove("notifiback");
            notificationBadge.textContent = Math.max(
              0,
              parseInt(notificationBadge.textContent) - 1
            );
            notificationsCount.textContent = Math.max(
              0,
              parseInt(notificationsCount.textContent) - 1
            );
            notificationsCount.style.display =
              Math.max(0, parseInt(notificationsCount.textContent) - 1) > 0
                ? "block"
                : "none";
            notificationBadge.style.display =
              Math.max(0, parseInt(notificationBadge.textContent) - 1) > 0
                ? "block"
                : "none";
          } catch (error) {
            showToast(
              "Failed to mark notification as viewed",
              TOAST_TYPES.ERROR
            );
          }
        });
      });

      // Add event listeners for deleting notifications
      const closeButtons = document.querySelectorAll(".closenoti");
      closeButtons.forEach((button) => {
        button.addEventListener("click", async (e) => {
          e.stopPropagation(); // Prevent triggering the parent item click event
          const id = button.getAttribute("data-id");
          const item = button.closest(".activity-item");

          try {
            const response = await fetch(
              `/api/users/notifications/delete/${id}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-CSRF-Token": `bearer ${csrfToken}`,
                },
                credentials: "include",
              }
            );

            const result = await response.json();
            if (result.status === "error") {
              showToast("Failed to delete notification", TOAST_TYPES.ERROR);
              return;
            }

            // Apply animation and remove from DOM after animation completes
            item.classList.add("notifiback2");
            item.addEventListener(
              "animationend",
              () => {
                item.remove();
                // Update badge if the deleted notification was unviewed
                if (item.classList.contains("notifiback")) {
                  notificationBadge.textContent = Math.max(
                    0,
                    parseInt(notificationBadge.textContent) - 1
                  );
                }
                // Check if container is empty after deletion
                if (!container.querySelector(".activity-item")) {
                  container.innerHTML = `
                  <div class="empty-state">
                    <i class="fas fa-bell-slash"></i>
                    <h3>No new notifications</h3>
                    <p>You're all caught up!</p>
                  </div>`;
                }
              },
              { once: true }
            );
          } catch (error) {
            showToast("Failed to delete notification", TOAST_TYPES.ERROR);
          }
        });
      });
    } catch (error) {
      showToast("Failed to load notifications", TOAST_TYPES.ERROR);
    }
  };

  setTimeout(() => {
    getnotifications();
  }, 2000);

  //logout-----------------------

  const logout = document.getElementById("logout");

  logout.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logoutcurrent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        credentials: "include",
      });

      // Clear session storage and redirect to login
      sessionStorage.clear();
      window.location.href = "/login";
    } catch (error) {
      showToast("Failed to log out", TOAST_TYPES.ERROR);
    }
  });

  // Session Management
  async function loadActiveSessions() {
    const sessionsContainer = document.getElementById("activeSessions");
    if (!sessionsContainer) return; // Exit if container not found

    try {
      const response = await fetch("/api/auth/sessions", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const data = await response.json();

      if (data.status === "error") {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }

      // Handle case where data or sessions is undefined
      if (!data || !data.sessions || !Array.isArray(data.sessions)) {
        throw new Error("Invalid session data received");
      }

      const sessionHTML = data.sessions
        .map((session) => {
          const isCurrentSession = session.isCurrentSession;
          const deviceInfo = formatDeviceInfo(session.deviceInfo);
          const lastActive = formatDate(session.lastActivity);
          const ipAddress = session.ipAddress || "Unknown";

          return `
          <div class="session-item ${
            isCurrentSession ? "current-session" : ""
          }" data-session-id="${session.id}">
            <div class="session-icon">
              <i class="fas ${getDeviceIcon(session.device_info)}"></i>
            </div>
            <div class="session-info">
              <h4>${deviceInfo}</h4>
              <p>
                <span class="ip-address" title="IP Address">
                  <i class="fas fa-network-wired"></i> ${ipAddress}
                </span>
                <span class="last-active" title="Last Activity">
                  <i class="fas fa-clock"></i> ${lastActive}
                </span>
                ${
                  isCurrentSession
                    ? '<span class="session-badge current">Current Session</span>'
                    : '<span class="session-badge active">Active</span>'
                }
              </p>
            </div>
            <div class="session-actions">
              <button class="btn-revoke" data-session-id="${session.id}">
                <i class="fas ${
                  isCurrentSession ? "fa-sign-out-alt" : "fa-times"
                }"></i>
                ${isCurrentSession ? "Logout" : "Revoke"}
              </button>
            </div>
          </div>
        `;
        })
        .join("");

      sessionsContainer.innerHTML =
        sessionHTML || "<p>No active sessions found.</p>";

      // Add event listeners to all revoke buttons
      const revokeButtons = sessionsContainer.querySelectorAll(".btn-revoke");
      revokeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const sessionId = button.dataset.sessionId;
          const isCurrentSession = button
            .closest(".session-item")
            .classList.contains("current-session");
          showRevokeModal(sessionId, isCurrentSession);
        });
      });

      // Add CSS for current session highlight if not already added
      if (!document.getElementById("session-styles")) {
        const sessionStyles = document.createElement("style");
        sessionStyles.id = "session-styles";
        sessionStyles.textContent = `
          .current-session {
            background-color: rgba(var(--primary-rgb), 0.05);
            border: 1px solid rgba(var(--primary-rgb), 0.1);
          }
          .ip-address, .last-active {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-right: 12px;
          }
          .ip-address i, .last-active i {
            font-size: 0.9em;
            opacity: 0.7;
          }
        `;
        document.head.appendChild(sessionStyles);
      }
    } catch (error) {
      sessionsContainer.innerHTML =
        '<p class="error">Failed to load active sessions.</p>';
      showToast("Failed to load active sessions", TOAST_TYPES.ERROR);
    }
  }

  // Helper function to get cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
  }

  // Helper function to get appropriate icon based on device info
  function getDeviceIcon(deviceInfo) {
    try {
      // If deviceInfo is a string, parse it
      const info =
        typeof deviceInfo === "string" ? JSON.parse(deviceInfo) : deviceInfo;

      // Handle case where info might be null or undefined
      if (!info) return "fa-desktop"; // default fallback

      // Check device type first
      if (
        info.deviceType === "mobile" ||
        info.client?.device?.type === "mobile"
      )
        return "fa-mobile-alt";
      if (
        info.deviceType === "tablet" ||
        info.client?.device?.type === "tablet"
      )
        return "fa-tablet-alt";

      // Then check browser
      const browser = (info.browser || info.client?.name || "").toLowerCase();
      if (browser.includes("firefox")) return "fa-firefox";
      if (browser.includes("chrome")) return "fa-chrome";
      if (browser.includes("safari")) return "fa-safari";
      if (browser.includes("edge")) return "fa-edge";

      // Default to desktop if no specific matches
      return "fa-desktop";
    } catch (error) {
      console.warn("Error parsing device info:", error);
      return "fa-desktop"; // Fallback icon
    }
  }

  // Helper function to format device info
  function formatDeviceInfo(deviceInfo) {
    try {
      // If deviceInfo is a string, parse it
      const info =
        typeof deviceInfo === "string" ? JSON.parse(deviceInfo) : deviceInfo;

      // Handle case where info might be null or undefined
      if (!info) return "Unknown Device";

      // Get browser info
      const browser = info.browser || info.client?.name || "Unknown Browser";
      const browserName = browser.split("/")[0]; // Remove version number if present

      // Get OS info
      const os = info.os || info.client?.os?.name || "Unknown OS";
      const osVersion = info.client?.os?.version || "";

      // Get device info
      const device = info.deviceType || info.client?.device?.type || "desktop";
      const deviceStr = device.charAt(0).toUpperCase() + device.slice(1);

      return `${browserName} on ${os} ${osVersion} (${deviceStr})`;
    } catch (error) {
      console.warn("Error formatting device info:", error);
      return "Unknown Device"; // Fallback text
    }
  }

  // Helper function to format date
  function formatDate(date) {
    try {
      const d = new Date(date);
      const now = new Date();
      const diff = now - d;

      if (diff < 60000) return "Just now";
      if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;

      return d.toLocaleDateString();
    } catch (error) {
      console.warn("Error formatting date:", error);
      return "Unknown date"; // Fallback text
    }
  }

  // Event listener for "Revoke All Others" button
  document.getElementById("revokeAllBtn").addEventListener("click", () => {
    // Show modal for revoking all other sessions
    currentSessionToRevoke = { id: "all", isCurrent: false };
    revokeMessage.textContent =
      "Warning: This will revoke access on all other devices. Currently active sessions may remain accessible for up to 1 hour. Continue?";
    revokeModal.classList.add("show");
  });

  // Load active sessions when the settings page is shown
  const settingsNavItem = document.querySelector(
    '.nav-item[data-page="settings"]'
  );
  settingsNavItem.addEventListener("click", () => {
    loadActiveSessions();
  });

  // Also load sessions if we're starting on the settings page
  if (sessionStorage.getItem(ACTIVE_PAGE_KEY) === "settings") {
    loadActiveSessions();
  }

  // Orders functionality
  // Constants for pagination
  const ORDERS_PER_PAGE = 20;
  let currentOrdersPage = 1;
  let totalOrdersPages = 1;
  let allOrders = [];
  let filteredOrders = [];

  // Show loading overlay
  const showOrdersLoading = () => {
    const overlay = document.getElementById("ordersLoadingOverlay");
    const table = document.getElementById("ordersTable");
    if (overlay) {
      overlay.style.display = "flex";
    }
    if (table) {
      table.style.opacity = "0.5";
    }
  };

  // Hide loading overlay
  const hideOrdersLoading = () => {
    const overlay = document.getElementById("ordersLoadingOverlay");
    const table = document.getElementById("ordersTable");
    if (overlay) {
      overlay.style.display = "none";
    }
    if (table) {
      table.style.opacity = "1";
    }
  };

  // Helper: Debounce function for search input
  const debounce = (func, delay) => {
    let timeout;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  };

  // Reset all order preferences
  const resetOrderPreferences = () => {
    // Show loading overlay
    showOrdersLoading();

    // Clear all order-related localStorage items
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key.startsWith("orderColumn_") ||
        key === "orderSearchTerm" ||
        key === "orderStatusFilter" ||
        key === "orderDateFilter" ||
        key === "orderCurrentPage"
      ) {
        keysToRemove.push(key);
      }
    }

    // Remove the keys
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Reset UI elements
    const orderSearchInput = document.getElementById("orderSearchInput");
    const orderStatusFilter = document.getElementById("orderStatusFilter");
    const orderDateFilter = document.getElementById("orderDateFilter");
    const columnCheckboxes = document.querySelectorAll(
      ".order-new-column-checkbox input"
    );

    if (orderSearchInput) orderSearchInput.value = "";
    if (orderStatusFilter) orderStatusFilter.value = "";
    if (orderDateFilter) orderDateFilter.value = "";

    // Reset column checkboxes to checked
    columnCheckboxes.forEach((checkbox) => {
      checkbox.checked = true;
      const columnId = checkbox.id;
      const columnClass = columnId.replace("col-", "col-");
      document.querySelectorAll(`.${columnClass}`).forEach((cell) => {
        cell.classList.remove("hidden");
      });
    });

    // Reset pagination
    currentOrdersPage = 1;

    // Apply filters and update UI with delay
    setTimeout(() => {
      applyFiltersAndSearch();
      hideOrdersLoading();
    }, 1000);
  };

  // Initialize orders functionality
  const initOrders = () => {
    // Get elements
    const ordersSection = document.getElementById("ordersPage");
    const ordersTableBody = document.getElementById("ordersTableBody");
    const orderNewCards = document.getElementById("orderNewCards");
    const noOrdersMessage = document.getElementById("noOrdersMessage");
    const orderSearchInput = document.getElementById("orderSearchInput");
    const orderStatusFilter = document.getElementById("orderStatusFilter");
    const orderDateFilter = document.getElementById("orderDateFilter");
    const columnToggleBtn = document.getElementById("columnToggleBtn");
    const columnDropdown = document.getElementById("columnDropdown");
    const columnCheckboxes = document.querySelectorAll(
      ".order-new-column-checkbox input"
    );
    const resetPreferencesBtn = document.getElementById(
      "resetOrderPreferences"
    );

    // Pagination elements
    const paginationPrev = document.getElementById("paginationPrev");
    const paginationNext = document.getElementById("paginationNext");

    // Skip initialization if elements don't exist
    if (!ordersSection || !ordersTableBody) {
      return;
    }

    // Initialize reset preferences button
    if (resetPreferencesBtn) {
      resetPreferencesBtn.addEventListener("click", resetOrderPreferences);
    }

    // Initialize column toggle dropdown
    if (columnToggleBtn && columnDropdown) {
      columnToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        columnDropdown.classList.toggle("show");
      });

      // Close dropdown when clicking outside
      document.addEventListener("click", (e) => {
        if (
          !columnToggleBtn.contains(e.target) &&
          !columnDropdown.contains(e.target)
        ) {
          columnDropdown.classList.remove("show");
        }
      });

      // Initialize column checkboxes
      columnCheckboxes.forEach((checkbox) => {
        const columnId = checkbox.id;
        const columnClass = columnId.replace("col-", "col-");

        // Load saved preference from localStorage
        const savedPreference = localStorage.getItem(`orderColumn_${columnId}`);
        if (savedPreference !== null) {
          checkbox.checked = savedPreference === "true";
        }

        // Set initial state based on checkbox (which may have been updated from localStorage)
        const isChecked = checkbox.checked;
        document.querySelectorAll(`.${columnClass}`).forEach((cell) => {
          cell.classList.toggle("hidden", !isChecked);
        });

        // Add event listener for checkbox change
        checkbox.addEventListener("change", () => {
          const isNowChecked = checkbox.checked;

          // Update column visibility
          document.querySelectorAll(`.${columnClass}`).forEach((cell) => {
            cell.classList.toggle("hidden", !isNowChecked);
          });

          // Save preference to localStorage
          localStorage.setItem(`orderColumn_${columnId}`, isNowChecked);
        });
      });
    }

    // Initialize search input with saved value
    if (orderSearchInput) {
      // Load saved search term
      const savedSearch = localStorage.getItem("orderSearchTerm");
      if (savedSearch) {
        orderSearchInput.value = savedSearch;
      }

      orderSearchInput.addEventListener(
        "input",
        debounce(() => {
          // Save search term
          localStorage.setItem("orderSearchTerm", orderSearchInput.value);
          showOrdersLoading();
          setTimeout(() => {
            applyFiltersAndSearch();
            hideOrdersLoading();
          }, 1000); // 1s delay for loading state
        }, 300)
      );
    }

    // Initialize filters with saved values
    if (orderStatusFilter) {
      // Load saved status filter
      const savedStatusFilter = localStorage.getItem("orderStatusFilter");
      if (savedStatusFilter) {
        orderStatusFilter.value = savedStatusFilter;
      }

      orderStatusFilter.addEventListener("change", () => {
        // Save status filter
        localStorage.setItem("orderStatusFilter", orderStatusFilter.value);
        showOrdersLoading();
        setTimeout(() => {
          applyFiltersAndSearch();
          hideOrdersLoading();
        }, 1000); // 1s delay for loading state
      });
    }

    if (orderDateFilter) {
      // Load saved date filter
      const savedDateFilter = localStorage.getItem("orderDateFilter");
      if (savedDateFilter) {
        orderDateFilter.value = savedDateFilter;
      }

      orderDateFilter.addEventListener("change", () => {
        // Save date filter
        localStorage.setItem("orderDateFilter", orderDateFilter.value);
        showOrdersLoading();
        setTimeout(() => {
          applyFiltersAndSearch();
          hideOrdersLoading();
        }, 1000); // 1s delay for loading state
      });
    }

    // Initialize pagination
    if (paginationPrev) {
      paginationPrev.addEventListener("click", () => {
        if (currentOrdersPage > 1) {
          showOrdersLoading();
          setTimeout(() => {
            currentOrdersPage--;
            updateOrdersUI();
            // Save current page
            localStorage.setItem("orderCurrentPage", currentOrdersPage);
            hideOrdersLoading();
          }, 1000); // 1s delay for loading state
        }
      });
    }

    if (paginationNext) {
      paginationNext.addEventListener("click", () => {
        if (currentOrdersPage < totalOrdersPages) {
          showOrdersLoading();
          setTimeout(() => {
            currentOrdersPage++;
            updateOrdersUI();
            // Save current page
            localStorage.setItem("orderCurrentPage", currentOrdersPage);
            hideOrdersLoading();
          }, 1000); // 1s delay for loading state
        }
      });
    }

    // Load saved current page
    const savedCurrentPage = localStorage.getItem("orderCurrentPage");
    if (savedCurrentPage) {
      currentOrdersPage = parseInt(savedCurrentPage, 10) || 1;
    }

    // Fetch orders initially
    fetchOrders();
  };

  // Update orders badge counter
  const updateOrdersBadge = () => {
    // Count pending and processing orders
    const pendingOrders = allOrders.filter(
      (order) => order.status === "pending" || order.status === "processing"
    );

    // Get the badge element
    const ordersBadge = document.querySelector(
      '.nav-item[data-page="orders"] .nav-badge'
    );

    if (ordersBadge) {
      // If there are pending/processing orders, show the badge with count
      if (pendingOrders.length > 0) {
        ordersBadge.textContent = pendingOrders.length;
        ordersBadge.style.display = "inline-flex";
      } else {
        // Otherwise hide the badge
        ordersBadge.style.display = "none";
      }
    }
  };

  // Update recent orders in dashboard
  const updateRecentOrders = () => {
    const recentOrdersList = document.getElementById("recentOrdersList");
    const noRecentOrdersMessage = document.getElementById(
      "noRecentOrdersMessage"
    );

    if (!recentOrdersList || !noRecentOrdersMessage) {
      return;
    }

    // Get the 4 most recent orders
    const recentOrders = allOrders.slice(0, 4);

    if (recentOrders.length === 0) {
      // Show empty state if no orders
      recentOrdersList.style.display = "none";
      noRecentOrdersMessage.style.display = "block";
      return;
    }

    // Hide empty state and show orders
    recentOrdersList.style.display = "flex";
    noRecentOrdersMessage.style.display = "none";

    // Generate HTML for recent orders
    recentOrdersList.innerHTML = recentOrders
      .map((order) => {
        try {
          // Format date
          let formattedDate = "N/A";
          try {
            if (order.created_at) {
              const orderDate = new Date(order.created_at);
              formattedDate = orderDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
            }
          } catch (dateError) {
            console.error("Error formatting date:", dateError);
          }

          const orderRef = order.order_reference || "N/A";
          const orderStatus = order.status || "pending";

          // Get the first item for display
          const firstItem =
            order.items && order.items.length > 0 ? order.items[0] : null;
          const itemName = firstItem ? firstItem.item_name : "Unknown Item";
          const imageUrl =
            firstItem && firstItem.image_url
              ? firstItem.image_url
              : "../noice/placeholder.webp";

          // Show additional items count if more than one
          const additionalItemsText =
            order.items && order.items.length > 1
              ? ` + ${order.items.length - 1} more`
              : "";

          let statusClass = "pending";
          switch (orderStatus) {
            case "completed":
              statusClass = "completed";
              break;
            case "processing":
              statusClass = "processing";
              break;
            case "cancelled":
              statusClass = "cancelled";
              break;
            case "failed":
              statusClass = "failed";
              break;
            default:
              statusClass = "pending";
          }

          return `
          <div class="recent-order-item" data-order-id="${order.id}">
            <img src="${imageUrl}" alt="${itemName}" class="recent-order-image" onerror="this.src='../noice/placeholder.webp'">
            <div class="recent-order-details">
              <div class="recent-order-name">${itemName}${additionalItemsText}</div>
              <div class="recent-order-info">
                <span class="recent-order-id">${orderRef}</span>
                <span class="recent-order-date">${formattedDate}</span>
                <span class="recent-order-status ${statusClass}">${capitalizeFirstLetter(
            orderStatus
          )}</span>
              </div>
            </div>
          </div>
        `;
        } catch (error) {
          console.error("Error rendering recent order:", error);
          return "";
        }
      })
      .join("");

    // Add click event to each order item
    const orderItems = document.querySelectorAll(".recent-order-item");
    orderItems.forEach((item) => {
      item.addEventListener("click", () => {
        showPage("orders");
      });
    });
  };

  // Update dashboard stats
  const updateDashboardStats = () => {
    // Update orders count
    const ordersCountElement = document.getElementById("ordersCount");
    const ordersCount2 = document.getElementById("ordersCount2");
    if (ordersCountElement) {
      ordersCountElement.textContent = allOrders.length;
      ordersCount2.textContent = allOrders.length;
    }

    // Calculate last month and this month order counts
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    let thisMonthCount = 0;
    let lastMonthCount = 0;
    allOrders.forEach((order) => {
      const d = new Date(order.created_at);
      if (d.getMonth() === thisMonth && d.getFullYear() === thisYear)
        thisMonthCount++;
      if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear)
        lastMonthCount++;
    });
    let percentChange = 0;
    if (lastMonthCount === 0 && thisMonthCount > 0) {
      percentChange = 100;
    } else if (lastMonthCount > 0) {
      percentChange = Math.round(
        ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100
      );
    }
    const ordersChange = document.getElementById("ordersChange");
    if (ordersChange) {
      const icon =
        percentChange >= 0
          ? '<i class="fas fa-arrow-up"></i>'
          : '<i class="fas fa-arrow-down"></i>';
      const sign = percentChange > 0 ? "+" : "";
      ordersChange.innerHTML = `${icon} <span>${sign}${percentChange}% from last month</span>`;
      ordersChange.className =
        "stat-change " + (percentChange >= 0 ? "positive" : "negative");
    }

    // Pending, Processing, Completed counts
    const pending = allOrders.filter((o) => o.status === "pending").length;
    const processing = allOrders.filter(
      (o) => o.status === "processing"
    ).length;
    const completed = allOrders.filter((o) => o.status === "completed").length;
    const pendingEl = document.getElementById("pendingOrdersCount");
    const processingEl = document.getElementById("processingOrdersCount");
    const completedEl = document.getElementById("completedOrdersCount");
    if (pendingEl) pendingEl.textContent = pending;
    if (processingEl) processingEl.textContent = processing;
    if (completedEl) completedEl.textContent = completed;
  };

  // Show/hide skeleton loader for recent orders
  const showRecentOrdersSkeleton = () => {
    const skeleton = document.getElementById("recentOrdersSkeleton");
    const list = document.getElementById("recentOrdersList");
    const empty = document.getElementById("noRecentOrdersMessage");
    if (skeleton) skeleton.style.display = "flex";
    if (list) list.style.display = "none";
    if (empty) empty.style.display = "none";
  };
  // Accepts: html string for recent orders, and a boolean for "has orders"
  const showRecentOrdersAfterSkeleton = (html, hasOrders) => {
    const skeleton = document.getElementById("recentOrdersSkeleton");
    const list = document.getElementById("recentOrdersList");
    const empty = document.getElementById("noRecentOrdersMessage");
    if (skeleton) skeleton.style.display = "none";
    if (list) {
      list.innerHTML = html;
      list.style.display = hasOrders ? "flex" : "none";
    }
    if (empty) empty.style.display = hasOrders ? "none" : "block";
  };

  // Fetch orders from API
  const fetchOrders = async () => {
    let skeletonStart = Date.now();
    let recentOrdersHtml = "";
    let hasRecentOrders = false;
    try {
      showOrdersLoading();
      showRecentOrdersSkeleton();

      // Fetch orders from API
      const response = await fetch("/api/orders", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        credentials: "include",
      });

      const data = await response.json();

      if (data.status === "error") {
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status}: ${response.statusText}`
        );
      }

      // Process orders data
      allOrders = data.orders || [];

      // Sort orders by date (newest first)
      allOrders.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      // Prepare recent orders HTML but do NOT render yet
      const recentOrders = allOrders.slice(0, 4);
      hasRecentOrders = recentOrders.length > 0;
      recentOrdersHtml = hasRecentOrders
        ? recentOrders
            .map((order) => {
              let formattedDate = "N/A";
              try {
                if (order.created_at) {
                  const orderDate = new Date(order.created_at);
                  formattedDate = orderDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                }
              } catch {}
              const orderRef = order.order_reference || "N/A";
              const orderStatus = order.status || "pending";

              // Get the first item for the dashboard preview
              const firstItem =
                order.items && order.items.length > 0 ? order.items[0] : null;
              const itemName = firstItem ? firstItem.item_name : "Unknown Item";
              const imageUrl =
                firstItem && firstItem.image_url
                  ? firstItem.image_url
                  : "../noice/placeholder.webp";

              let statusClass = "pending";
              switch (orderStatus) {
                case "completed":
                  statusClass = "completed";
                  break;
                case "processing":
                  statusClass = "processing";
                  break;
                case "cancelled":
                  statusClass = "cancelled";
                  break;
                case "failed":
                  statusClass = "failed";
                  break;
                default:
                  statusClass = "pending";
              }
              return `
              <div class="recent-order-item" data-order-id="${order.id}">
                <img src="${imageUrl}" alt="${itemName}" class="recent-order-image" onerror="this.src='../noice/placeholder.webp'">
                <div class="recent-order-details">
                  <div class="recent-order-name">${itemName}${
                order.items.length > 1
                  ? ` + ${order.items.length - 1} more`
                  : ""
              }</div>
                  <div class="recent-order-info">
                    <span class="recent-order-id">${orderRef}</span>
                    <span class="recent-order-date">${formattedDate}</span>
                    <span class="recent-order-status ${statusClass}">${capitalizeFirstLetter(
                orderStatus
              )}</span>
                  </div>
                </div>
              </div>
            `;
            })
            .join("")
        : "";

      // Update orders badge counter
      updateOrdersBadge();
      // Update dashboard stats
      updateDashboardStats();
      // Apply initial filters
      applyFiltersAndSearch();
    } catch (error) {
      const ordersTableBody = document.getElementById("ordersTableBody");
      if (ordersTableBody) {
        ordersTableBody.innerHTML = `
          <tr>
            <td colspan="8" class="error-row">
              Failed to load orders. Please try again later.
            </td>
          </tr>
        `;
      }
    } finally {
      // Always hide loading overlay when done
      setTimeout(() => {
        hideOrdersLoading();
      }, 1000);
      // Ensure skeleton is shown for at least 3s, then show data
      const elapsed = Date.now() - skeletonStart;
      const minSkeleton = 3000;
      setTimeout(() => {
        showRecentOrdersAfterSkeleton(recentOrdersHtml, hasRecentOrders);
        // Add click event to each order item after rendering
        const orderItems = document.querySelectorAll(".recent-order-item");
        orderItems.forEach((item) => {
          item.addEventListener("click", () => {
            showPage("orders");
          });
        });
      }, Math.max(0, minSkeleton - elapsed));
    }
  };

  // Apply filters and search to orders
  const applyFiltersAndSearch = () => {
    // Get filter values
    const searchTerm =
      document.getElementById("orderSearchInput")?.value.toLowerCase() || "";
    const statusFilter =
      document.getElementById("orderStatusFilter")?.value || "";
    const dateFilter = document.getElementById("orderDateFilter")?.value || "";

    // Filter orders
    filteredOrders = allOrders.filter((order) => {
      // Apply search filter
      const orderRef = order.order_reference?.toLowerCase() || "";
      const matchesSearch = !searchTerm || orderRef.includes(searchTerm);

      // Apply status filter
      const matchesStatus = !statusFilter || order.status === statusFilter;

      // Apply date filter
      let matchesDate = true;
      if (dateFilter && dateFilter !== "") {
        const orderDate = new Date(order.created_at);
        const now = new Date();

        switch (dateFilter) {
          case "today":
            matchesDate = orderDate.toDateString() === now.toDateString();
            break;
          case "week":
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            matchesDate = orderDate >= weekAgo;
            break;
          case "month":
            matchesDate =
              orderDate.getMonth() === now.getMonth() &&
              orderDate.getFullYear() === now.getFullYear();
            break;
          case "year":
            matchesDate = orderDate.getFullYear() === now.getFullYear();
            break;
          default:
            // 'All time' or empty value - no date filtering
            matchesDate = true;
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });

    // Reset to first page when filters change
    currentOrdersPage = 1;

    // Calculate total pages
    totalOrdersPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);

    // Update UI
    updateOrdersUI();

    // Update orders badge counter
    updateOrdersBadge();

    // Save current filters to localStorage
    localStorage.setItem("orderSearchTerm", searchTerm);
    localStorage.setItem("orderStatusFilter", statusFilter);
    localStorage.setItem("orderDateFilter", dateFilter);
  };

  // Update orders UI with current filtered orders and pagination
  const updateOrdersUI = () => {
    // Get elements
    const ordersTableBody = document.getElementById("ordersTableBody");
    const orderNewCards = document.getElementById("orderNewCards");
    const noOrdersMessage = document.getElementById("noOrdersMessage");
    const paginationPrev = document.getElementById("paginationPrev");
    const paginationNext = document.getElementById("paginationNext");
    const paginationNumbers = document.getElementById("paginationNumbers");
    const paginationStart = document.getElementById("paginationStart");
    const paginationEnd = document.getElementById("paginationEnd");
    const paginationTotal = document.getElementById("paginationTotal");
    const paginationContainer = document.querySelector(".order-new-pagination");

    // Check if elements exist
    if (!ordersTableBody || !noOrdersMessage) {
      console.error("Orders elements not found");
      return;
    }

    // Calculate pagination
    const startIndex = (currentOrdersPage - 1) * ORDERS_PER_PAGE;
    const endIndex = Math.min(
      startIndex + ORDERS_PER_PAGE,
      filteredOrders.length
    );
    const currentPageOrders = filteredOrders.slice(startIndex, endIndex);

    // Update pagination info
    if (paginationStart && paginationEnd && paginationTotal) {
      paginationStart.textContent =
        filteredOrders.length > 0 ? startIndex + 1 : 0;
      paginationEnd.textContent = endIndex;
      paginationTotal.textContent = filteredOrders.length;
    }

    // Update pagination buttons
    if (paginationPrev && paginationNext) {
      paginationPrev.disabled = currentOrdersPage === 1;
      paginationNext.disabled = endIndex >= filteredOrders.length;
    }

    // Generate page numbers if element exists
    if (paginationNumbers) {
      generatePaginationNumbers();
    }

    // Show empty state if no orders
    if (filteredOrders.length === 0) {
      ordersTableBody.innerHTML = "";
      if (orderNewCards) orderNewCards.innerHTML = "";
      if (noOrdersMessage) noOrdersMessage.style.display = "block";
      if (paginationContainer) paginationContainer.style.display = "none";
      return;
    }

    // Hide empty state and show pagination
    if (noOrdersMessage) noOrdersMessage.style.display = "none";
    if (paginationContainer) paginationContainer.style.display = "flex";

    // Render orders for desktop table view
    ordersTableBody.innerHTML = currentPageOrders
      .map((order) => {
        try {
          // Safely get order properties with defaults
          const orderRef = order.order_reference || "N/A";
          const orderStatus = order.status || "pending";
          const orderPaymentMethod = order.payment_method || "N/A";
          const orderPaymentStatus = order.payment_status || "pending";
          const orderItemCount = order.item_count || 0;
          const orderId = order.id || 0;

          // Format date
          let formattedDate = "N/A";
          try {
            if (order.created_at) {
              const orderDate = new Date(order.created_at);
              formattedDate = orderDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            }
          } catch (dateError) {
            console.error("Error formatting date:", dateError);
          }

          // Determine status class
          let statusClass = "pending";
          switch (orderStatus) {
            case "completed":
              statusClass = "completed";
              break;
            case "processing":
              statusClass = "processing";
              break;
            case "cancelled":
              statusClass = "cancelled";
              break;
            case "failed":
              statusClass = "failed";
              break;
            default:
              statusClass = "pending";
          }

          // Determine payment status class
          let paymentStatusClass = "pending";
          switch (orderPaymentStatus) {
            case "paid":
              paymentStatusClass = "paid";
              break;
            case "pending":
              paymentStatusClass = "pending";
              break;
            case "failed":
              paymentStatusClass = "failed";
              break;
            case "refunded":
              paymentStatusClass = "refunded";
              break;
            default:
              paymentStatusClass = "pending";
          }

          // Process items for display
          const items = order.items || [];
          const itemNames = items.map(
            (item) => item.item_name || "Unknown Item"
          );
          const itemImages = items.map(
            (item) => item.image_url || "../noice/placeholder.webp"
          );

          // Generate HTML for item names
          const itemNamesHtml = itemNames
            .map(
              (name) => `
          <div class="order-item-name">${name}</div>
        `
            )
            .join("");

          // Generate HTML for item images
          const itemImagesHtml = itemImages
            .map(
              (image, index) => `
          <img src="${image}" alt="${
                itemNames[index] || "Product"
              }" class="order-item-image" title="${
                itemNames[index] || "Product"
              }" onerror="this.src='../noice/placeholder.webp'">
        `
            )
            .join("");

          return `
        <tr>
          <td class="col-order-id">${orderRef}</td>
          <td class="col-date">${formattedDate}</td>
          <td class="col-status">
            <span class="order-new-status ${statusClass}">
              ${capitalizeFirstLetter(orderStatus)}
            </span>
          </td>
          <td class="col-total">NPR ${parseFloat(order.total_amount).toFixed(
            2
          )}</td>
          <td class="col-payment">
            <div class="order-new-payment">
              <span class="order-new-payment-status ${paymentStatusClass}"></span>
              ${capitalizeFirstLetter(
                orderPaymentMethod
              )} (${capitalizeFirstLetter(orderPaymentStatus)})
            </div>
          </td>
          <td class="col-items">
            <span class="order-items-count">${orderItemCount}</span>
          </td>
          <td class="col-item-name">
            ${itemNamesHtml}
          </td>
          <td class="col-image">
            <div class="order-item-images">
              ${itemImagesHtml}
            </div>
          </td>
        </tr>
        `;
        } catch (error) {
          console.error("Error rendering order row:", error);
          return `
        <tr>
          <td colspan="8" class="error-row">Error displaying order</td>
        </tr>
        `;
        }
      })
      .join("");

    // Render orders for mobile card view
    if (orderNewCards) {
      orderNewCards.innerHTML = currentPageOrders
        .map((order) => {
          try {
            // Safely get order properties with defaults
            const orderRef = order.order_reference || "N/A";
            const orderStatus = order.status || "pending";
            const orderPaymentMethod = order.payment_method || "N/A";
            const orderPaymentStatus = order.payment_status || "pending";
            const orderItemCount = order.item_count || 0;
            const orderId = order.id || 0;

            // Format date
            let formattedDate = "N/A";
            try {
              if (order.created_at) {
                const orderDate = new Date(order.created_at);
                formattedDate = orderDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
              }
            } catch (dateError) {
              console.error("Error formatting date:", dateError);
            }

            // Determine status class
            let statusClass = "pending";
            switch (orderStatus) {
              case "completed":
                statusClass = "completed";
                break;
              case "processing":
                statusClass = "processing";
                break;
              case "cancelled":
                statusClass = "cancelled";
                break;
              case "failed":
                statusClass = "failed";
                break;
              default:
                statusClass = "pending";
            }

            // Determine payment status class
            let paymentStatusClass = "pending";
            switch (orderPaymentStatus) {
              case "paid":
                paymentStatusClass = "paid";
                break;
              case "pending":
                paymentStatusClass = "pending";
                break;
              case "failed":
                paymentStatusClass = "failed";
                break;
              case "refunded":
                paymentStatusClass = "refunded";
                break;
              default:
                paymentStatusClass = "pending";
            }

            // Process items for display
            const items = order.items || [];
            const itemImages = items.map(
              (item) => item.image_url || "../noice/placeholder.webp"
            );

            // Generate HTML for item images (limit to 4 with a +X indicator for more)
            let itemImagesHtml = "";
            if (itemImages.length > 0) {
              const displayImages = itemImages.slice(0, 4);
              itemImagesHtml = displayImages
                .map(
                  (image, index) => `
              <img src="${image}" alt="Product" class="order-new-card-image" onerror="this.src='../noice/placeholder.webp'">
            `
                )
                .join("");

              if (itemImages.length > 4) {
                itemImagesHtml += `<div class="order-new-card-image" style="display:flex;align-items:center;justify-content:center;background:#f1f5f9;font-size:12px;font-weight:600;">+${
                  itemImages.length - 4
                }</div>`;
              }
            }

            return `
          <div class="order-new-card">
            <div class="order-new-card-header">
              <div class="order-new-card-id">${orderRef}</div>
              <div class="order-new-card-date">${formattedDate}</div>
            </div>
            
            <div class="order-new-card-row">
              <div class="order-new-card-label">Status:</div>
              <div class="order-new-card-value">
                <span class="order-new-status ${statusClass}">
                  ${capitalizeFirstLetter(orderStatus)}
                </span>
              </div>
            </div>
            
            <div class="order-new-card-row">
              <div class="order-new-card-label">Total:</div>
              <div class="order-new-card-value">NPR ${parseFloat(
                order.total_amount
              ).toFixed(2)}</div>
            </div>
            
            <div class="order-new-card-row">
              <div class="order-new-card-label">Payment:</div>
              <div class="order-new-card-value">
                <div class="order-new-payment">
                  <span class="order-new-payment-status ${paymentStatusClass}"></span>
                  ${capitalizeFirstLetter(
                    orderPaymentMethod
                  )} (${capitalizeFirstLetter(orderPaymentStatus)})
                </div>
              </div>
            </div>
            
            <div class="order-new-card-items">
              <span class="order-new-card-item-count">${orderItemCount}</span>
              <div class="order-new-card-images">
                ${itemImagesHtml}
              </div>
            </div>
          </div>
          `;
          } catch (error) {
            console.error("Error rendering order card:", error);
            return `
          <div class="order-new-card">
            <div class="order-new-card-header">
              <div class="order-new-card-id">Error</div>
            </div>
            <div class="order-new-card-row">
              <div class="order-new-card-value">Failed to display order information</div>
            </div>
          </div>
          `;
          }
        })
        .join("");
    }

    // Add event listeners for column toggle checkboxes
    document
      .querySelectorAll(".order-new-column-checkbox input")
      .forEach((checkbox) => {
        const columnClass = checkbox.id.replace("col-", "col-");
        const isChecked = checkbox.checked;

        // Update column visibility based on checkbox state
        document.querySelectorAll(`.${columnClass}`).forEach((cell) => {
          cell.classList.toggle("hidden", !isChecked);
        });

        // Add event listener for checkbox change
        checkbox.addEventListener("change", () => {
          const isNowChecked = checkbox.checked;
          document.querySelectorAll(`.${columnClass}`).forEach((cell) => {
            cell.classList.toggle("hidden", !isNowChecked);
          });
        });
      });
  };

  // Generate pagination numbers
  const generatePaginationNumbers = () => {
    const paginationNumbers = document.getElementById("paginationNumbers");
    if (!paginationNumbers) return;

    paginationNumbers.innerHTML = "";

    // Determine which page numbers to show
    let startPage = Math.max(1, currentOrdersPage - 2);
    let endPage = Math.min(totalOrdersPages, currentOrdersPage + 2);

    // Always show at least 5 pages if available
    if (endPage - startPage < 4) {
      if (startPage === 1) {
        endPage = Math.min(5, totalOrdersPages);
      } else if (endPage === totalOrdersPages) {
        startPage = Math.max(1, totalOrdersPages - 4);
      }
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
      addPageNumber(1);
      if (startPage > 2) {
        addEllipsis();
      }
    }

    // Add page numbers
    for (let i = startPage; i <= endPage; i++) {
      addPageNumber(i);
    }

    // Add ellipsis and last page if needed
    if (endPage < totalOrdersPages) {
      if (endPage < totalOrdersPages - 1) {
        addEllipsis();
      }
      addPageNumber(totalOrdersPages);
    }
  };

  // Add a page number to pagination
  const addPageNumber = (pageNum) => {
    const paginationNumbers = document.getElementById("paginationNumbers");
    if (!paginationNumbers) return;

    const pageElement = document.createElement("div");
    pageElement.className = `order-new-page-number${
      pageNum === currentOrdersPage ? " active" : ""
    }`;
    pageElement.textContent = pageNum;
    pageElement.addEventListener("click", () => goToPage(pageNum));
    paginationNumbers.appendChild(pageElement);
  };

  // Add ellipsis to pagination
  const addEllipsis = () => {
    const paginationNumbers = document.getElementById("paginationNumbers");
    if (!paginationNumbers) return;

    const ellipsis = document.createElement("div");
    ellipsis.className = "order-new-page-number dots";
    ellipsis.textContent = "...";
    paginationNumbers.appendChild(ellipsis);
  };

  // Go to specific page
  const goToPage = (pageNum) => {
    currentOrdersPage = pageNum;
    updateOrdersUI();

    // Scroll to top of table
    const tableContainer = document.querySelector(".orders-table-container");
    if (tableContainer) {
      tableContainer.scrollTop = 0;
    }
  };

  // Helper: Capitalize first letter
  const capitalizeFirstLetter = (string) => {
    if (!string) return "";
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  // Initialize orders functionality
  showOrdersLoading();
  setTimeout(() => {
    hideOrdersLoading();
    initOrders();
  }, 1000);

  // Add orders to the search map if not already there
  if (!SEARCH_MAP.some((entry) => entry.page === "orders")) {
    SEARCH_MAP.push({
      keywords: [
        "orders",
        "order",
        "orders page",
        "orders section",
        "orders menu",
        "orders button",
        "orders icon",
        "orders link",
      ],
      page: "orders",
    });
  }

  // --- Wishlist and Cart Logic ---
  // Helper to format price
  const formatPrice = (price) => `NPR ${parseFloat(price).toFixed(2)}`;

  // Render wishlist
  const renderWishlist = async () => {
    const list = document.getElementById("wishlistList");
    const empty = document.getElementById("wishlistEmpty");
    const countElem = document.getElementById("wishlistCount");
    if (!list || !empty) return;
    list.innerHTML = "";
    empty.style.display = "none";
    try {
      const res = await fetch("/api/products/wishlist", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
      });
      const data = await res.json();
      if (data.status === "error") {
        return;
      }
      const items = data.data || [];
      if (countElem) countElem.textContent = items.length;
      if (!Array.isArray(items) || items.length === 0) {
        list.style.display = "none";
        empty.style.display = "block";
        return;
      }
      list.style.display = "flex";
      list.innerHTML = items
        .map((item) => {
          const price = parseFloat(item.item_price || 0);
          const orig = parseFloat(item.original_price || 0);
          let discountHtml = "";
          if (orig && orig > price) {
            const percent = Math.round(((orig - price) / orig) * 100);
            discountHtml = `
            <span class="wishlist-original-price">${formatPrice(orig)}</span>
            <span class="wishlist-discount-badge">-${percent}%</span>
          `;
          }
          return `
          <div class="wishlist-item">
            <img src="${item.item_image || "../noice/placeholder.webp"}" alt="${
            item.item_name
          }" class="wishlist-image" onerror="this.src='../noice/placeholder.webp'">
            <div class="wishlist-details">
              <div class="wishlist-name">${item.item_name}</div>
              <div class="wishlist-price">${formatPrice(
                price
              )}${discountHtml}</div>
            </div>
            <button class="wishlist-remove-btn" data-id="${
              item.id
            }"><i class="fas fa-trash"></i></button>
          </div>
        `;
        })
        .join("");
      // Remove button logic
      list.querySelectorAll(".wishlist-remove-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const itemDiv = btn.closest(".wishlist-item");
          if (itemDiv) {
            itemDiv.classList.add("fade-out-remove");
            setTimeout(async () => {
              await fetch(`/api/products/wishlist/remove/${id}`, {
                method: "DELETE",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  "X-CSRF-Token": `bearer ${csrfToken}`,
                },
              });
              renderWishlist();
            }, 350);
          } else {
            await fetch(`/api/products/wishlist/remove/${id}`, {
              method: "DELETE",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": `bearer ${csrfToken}`,
              },
            });
            renderWishlist();
          }
        });
      });
    } catch {
      list.style.display = "none";
      empty.style.display = "block";
      if (countElem) countElem.textContent = "0";
    }
  };

  // Render cart
  const renderCart = async () => {
    const list = document.getElementById("cartList");
    const empty = document.getElementById("cartEmpty");
    const totalContainer = document.getElementById("cartTotalContainer");
    const totalValue = document.getElementById("cartTotalValue");
    const countElem = document.getElementById("cartCount");
    if (!list || !empty || !totalContainer || !totalValue) return;
    list.innerHTML = "";
    empty.style.display = "none";
    totalContainer.style.display = "none";
    try {
      const res = await fetch("/api/products/cart", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
      });
      const data = await res.json();
      if (data.status === "error") {
        return;
      }
      const items = (data.data && data.data.items) || [];
      if (countElem) countElem.textContent = items.length;
      if (!Array.isArray(items) || items.length === 0) {
        list.style.display = "none";
        empty.style.display = "block";
        totalContainer.style.display = "none";
        return;
      }
      // Use backend total if available, otherwise calculate
      let total =
        data.data && data.data.totalAmount
          ? parseFloat(data.data.totalAmount)
          : 0;
      if (!total) {
        total = items.reduce(
          (sum, item) =>
            sum + parseFloat(item.price || 0) * (item.quantity || 1),
          0
        );
      }
      list.style.display = "flex";
      list.innerHTML = items
        .map((item) => {
          const price = parseFloat(item.item_price || item.price || 0);
          const orig = parseFloat(item.original_price || 0);
          let discountHtml = "";
          if (orig && orig > price) {
            const percent = Math.round(((orig - price) / orig) * 100);
            discountHtml = `
            <span class="wishlist-original-price">${formatPrice(orig)}</span>
            <span class="wishlist-discount-badge">-${percent}%</span>
          `;
          }
          return `
          <div class="cart-item">
            <img src="${item.item_image || "../noice/placeholder.webp"}" alt="${
            item.item_name || item.name
          }" class="cart-image" onerror="this.src='../noice/placeholder.webp'">
            <div class="cart-details">
              <div class="cart-name">${item.item_name || item.name}</div>
              <div class="cart-price">${formatPrice(price)}${discountHtml}</div>
              <div class="cart-qty">Qty: ${item.quantity || 1}</div>
            </div>
            <button class="cart-remove-btn" data-id="${
              item.id
            }"><i class="fas fa-trash"></i></button>
          </div>
        `;
        })
        .join("");
      totalValue.textContent = formatPrice(total);
      totalContainer.style.display = "flex";
      // Remove button logic
      list.querySelectorAll(".cart-remove-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          const itemDiv = btn.closest(".cart-item");
          if (itemDiv) {
            itemDiv.classList.add("fade-out-remove");
            setTimeout(async () => {
              await fetch(`/api/products/cart/remove/${id}`, {
                method: "DELETE",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  "X-CSRF-Token": `bearer ${csrfToken}`,
                },
              });
              renderCart();
            }, 350);
          } else {
            await fetch(`/api/products/cart/remove/${id}`, {
              method: "DELETE",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": `bearer ${csrfToken}`,
              },
            });
            renderCart();
          }
        });
      });
      // Add checkout button if not present
      if (!document.getElementById("cartCheckoutBtn")) {
        const checkoutBtn = document.createElement("button");
        checkoutBtn.id = "cartCheckoutBtn";
        checkoutBtn.className = "btn btn-primary";
        checkoutBtn.textContent = "Checkout";
        checkoutBtn.style.marginLeft = "16px";
        checkoutBtn.onclick = () => {
          window.location.href = "/checkout";
        };
        totalContainer.appendChild(checkoutBtn);
      }
    } catch {
      list.style.display = "none";
      empty.style.display = "block";
      totalContainer.style.display = "none";
      if (countElem) countElem.textContent = "0";
    }
  };

  // Navigation logic for wishlist/cart
  document
    .querySelectorAll('.nav-item[data-page="wishlist"]')
    .forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        showPage("wishlist");
        showWishlistSkeleton();
        setTimeout(() => renderWishlist().then(hideWishlistSkeleton), 1000); // 1s
      });
    });
  document.querySelectorAll('.nav-item[data-page="cart"]').forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      showPage("cart");
      showCartSkeleton();
      setTimeout(() => renderCart().then(hideCartSkeleton), 1000); // 1s
    });
  });

  // --- Wishlist and Cart Skeleton Loader Helpers ---
  function showWishlistSkeleton() {
    const skeleton = document.getElementById("wishlistSkeleton");
    const list = document.getElementById("wishlistList");
    const empty = document.getElementById("wishlistEmpty");
    if (skeleton) skeleton.style.display = "block";
    if (list) list.style.display = "none";
    if (empty) empty.style.display = "none";
  }
  function hideWishlistSkeleton() {
    const skeleton = document.getElementById("wishlistSkeleton");
    if (skeleton) skeleton.style.display = "none";
  }
  function showCartSkeleton() {
    const skeleton = document.getElementById("cartSkeleton");
    const list = document.getElementById("cartList");
    const empty = document.getElementById("cartEmpty");
    const totalContainer = document.getElementById("cartTotalContainer");
    if (skeleton) skeleton.style.display = "block";
    if (list) list.style.display = "none";
    if (empty) empty.style.display = "none";
    if (totalContainer) totalContainer.style.display = "none";
  }
  function hideCartSkeleton() {
    const skeleton = document.getElementById("cartSkeleton");
    if (skeleton) skeleton.style.display = "none";
  }
  // --- Update navigation logic to show skeletons ---
  document
    .querySelectorAll('.nav-item[data-page="wishlist"]')
    .forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        showPage("wishlist");
        showWishlistSkeleton();
        setTimeout(() => renderWishlist().then(hideWishlistSkeleton), 1000); // 1s
      });
    });
  document.querySelectorAll('.nav-item[data-page="cart"]').forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      showPage("cart");
      showCartSkeleton();
      setTimeout(() => renderCart().then(hideCartSkeleton), 1000); // 1s
    });
  });
  // Also show skeletons on initial load
  showWishlistSkeleton();
  setTimeout(() => renderWishlist().then(hideWishlistSkeleton), 1000);
  showCartSkeleton();
  setTimeout(() => renderCart().then(hideCartSkeleton), 1000);

  // =========================
  // ACTIVE SUBSCRIPTIONS (CLIENT)
  // =========================

  const activeSubscriptionsNavItem = document.querySelector(
    '.nav-item[data-page="activeSubscriptions"]'
  );
  const activeSubscriptionsPage = document.getElementById(
    "activeSubscriptionsPage"
  );
  const activeSubscriptionsSearchInput = document.getElementById(
    "active-subscriptions-search-input"
  );
  const activeSubscriptionsStatusFilter = document.getElementById(
    "active-subscriptions-status-filter"
  );
  const activeSubscriptionsDateFilter = document.getElementById(
    "active-subscriptions-date-filter"
  );
  const activeSubscriptionsTableBody = document.getElementById(
    "active-subscriptions-table-body"
  );
  const activeSubscriptionsShowingStart = document.getElementById(
    "active-subscriptions-showing-start"
  );
  const activeSubscriptionsShowingEnd = document.getElementById(
    "active-subscriptions-showing-end"
  );
  const activeSubscriptionsTotalEntries = document.getElementById(
    "active-subscriptions-total-entries"
  );
  const activeSubscriptionsCurrentPageElement = document.getElementById(
    "active-subscriptions-current-page"
  );
  const activeSubscriptionsTotalPages = document.getElementById(
    "active-subscriptions-total-pages"
  );
  const activeSubscriptionsPrevPage = document.getElementById(
    "active-subscriptions-prev-page"
  );
  const activeSubscriptionsNextPage = document.getElementById(
    "active-subscriptions-next-page"
  );
  const activeSubscriptionsLoadingOverlay = document.getElementById(
    "active-subscriptions-loading-overlay"
  );

  // Modal
  const viewCredentialsModal = document.getElementById(
    "view-credentials-modal"
  );
  const closeCredentialsModalBtn = document.getElementById(
    "close-credentials-modal-btn"
  );
  const closeViewCredentialsBtn = document.getElementById(
    "close-view-credentials-btn"
  );
  const credentialEmail = document.getElementById("credential-email");
  const credentialPassword = document.getElementById("credential-password");
  const credentialPin = document.getElementById("credential-pin");
  const credentialNotes = document.getElementById("credential-notes");
  const togglePasswordBtn = document.getElementById("toggle-password-btn");

  let allActiveSubscriptions = [];
  let filteredActiveSubscriptions = [];
  let activeSubscriptionsCurrentPage = 1;
  const ACTIVE_SUBSCRIPTIONS_PER_PAGE = 10;

  function showActiveSubscriptionsLoadingOverlay() {
    if (activeSubscriptionsLoadingOverlay) {
      activeSubscriptionsLoadingOverlay.style.display = "flex";
    }
  }
  function hideActiveSubscriptionsLoadingOverlay() {
    if (activeSubscriptionsLoadingOverlay) {
      activeSubscriptionsLoadingOverlay.style.display = "none";
    }
  }

  function formatSubscriptionDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function fetchActiveSubscriptions() {
    try {
      showActiveSubscriptionsLoadingOverlay();
      const res = await fetch(
        `/api/users/user/my/new/active-subscriptions/${window.chatUserId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${csrfToken}`,
          },
          credentials: "include",
        }
      );
      const data = await res.json();

      if (data.status === "error") {
        activeSubscriptionsTableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <i class="fas fa-id-card"></i>
              <h3>No Subscriptions Found</h3>
              <p>You don't have any active subscriptions yet.</p>
            </div>
          </td>
        </tr>
      `;

        hideActiveSubscriptionsLoadingOverlay();
        return;
      }

      if (!data.status || data.status !== "success") {
        throw new Error(data.message || "Failed to fetch active subscriptions");
      }
      allActiveSubscriptions = data.data || [];
      applyActiveSubscriptionsFilters();
    } catch (error) {
      console.error("Error fetching active subscriptions:", error);
      activeSubscriptionsTableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <i class="fas fa-exclamation-triangle"></i>
              <h3>Error Loading Subscriptions</h3>
              <p>Failed to load subscriptions. Please try again later.</p>
            </div>
          </td>
        </tr>
      `;
      hideActiveSubscriptionsLoadingOverlay();
    }
  }

  function applyActiveSubscriptionsFilters() {
    showActiveSubscriptionsLoadingOverlay();
    setTimeout(() => {
      const search = sanitizeSearchInput(
        activeSubscriptionsSearchInput?.value || ""
      );
      const status = activeSubscriptionsStatusFilter?.value || "";
      const dateFilter = activeSubscriptionsDateFilter?.value || "";
      filteredActiveSubscriptions = allActiveSubscriptions.filter(
        (subscription) => {
          // Search filter
          const matchesSearch =
            !search ||
            (subscription.subscription_name &&
              subscription.subscription_name.toLowerCase().includes(search)) ||
            (subscription.plan_name &&
              subscription.plan_name.toLowerCase().includes(search));
          // Status filter
          const matchesStatus = !status || subscription.status === status;
          // Date filter
          let matchesDate = true;
          const now = new Date();
          const endDate = new Date(subscription.end_date);
          if (dateFilter === "expiring-soon") {
            const sevenDaysLater = new Date();
            sevenDaysLater.setDate(now.getDate() + 7);
            matchesDate = endDate > now && endDate <= sevenDaysLater;
          } else if (dateFilter === "expired") {
            matchesDate = endDate < now;
          } else if (dateFilter === "this-month") {
            matchesDate =
              endDate.getMonth() === now.getMonth() &&
              endDate.getFullYear() === now.getFullYear();
          } else if (dateFilter === "last-month") {
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastMonthYear =
              now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            matchesDate =
              endDate.getMonth() === lastMonth &&
              endDate.getFullYear() === lastMonthYear;
          }
          return matchesSearch && matchesStatus && matchesDate;
        }
      );
      activeSubscriptionsCurrentPage = 1;
      renderActiveSubscriptionsTable();
      hideActiveSubscriptionsLoadingOverlay();
    }, 1000);
  }

  function renderActiveSubscriptionsTable() {
    const start =
      (activeSubscriptionsCurrentPage - 1) * ACTIVE_SUBSCRIPTIONS_PER_PAGE;
    const end = Math.min(
      start + ACTIVE_SUBSCRIPTIONS_PER_PAGE,
      filteredActiveSubscriptions.length
    );
    const pageSubscriptions = filteredActiveSubscriptions.slice(start, end);
    activeSubscriptionsShowingStart.textContent =
      filteredActiveSubscriptions.length > 0 ? start + 1 : 0;
    activeSubscriptionsShowingEnd.textContent = end;
    activeSubscriptionsTotalEntries.textContent =
      filteredActiveSubscriptions.length;
    activeSubscriptionsCurrentPageElement.textContent =
      activeSubscriptionsCurrentPage;
    activeSubscriptionsTotalPages.textContent = Math.max(
      1,
      Math.ceil(
        filteredActiveSubscriptions.length / ACTIVE_SUBSCRIPTIONS_PER_PAGE
      )
    );
    activeSubscriptionsPrevPage.disabled = activeSubscriptionsCurrentPage === 1;
    activeSubscriptionsNextPage.disabled =
      end >= filteredActiveSubscriptions.length;
    if (filteredActiveSubscriptions.length === 0) {
      activeSubscriptionsTableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <i class="fas fa-filter"></i>
              <h3>No Matching Subscriptions</h3>
              <p>No subscriptions match your current filters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }
    activeSubscriptionsTableBody.innerHTML = pageSubscriptions
      .map((subscription) => {
        // Format dates
        const startDate = formatSubscriptionDate(subscription.start_date);
        const endDate = formatSubscriptionDate(subscription.end_date);
        // Format days left
        let daysLeft = subscription.days_left;
        let daysLeftClass = "";
        if (daysLeft < 0) {
          daysLeftClass = "text-danger";
          daysLeft = "Expired";
        } else if (daysLeft <= 7) {
          daysLeftClass = "text-warning";
          daysLeft = `${daysLeft} days`;
        } else {
          daysLeft = `${daysLeft} days`;
        }
        // Format status
        let statusClass = "";
        switch (subscription.status) {
          case "active":
            statusClass = "text-success";
            break;
          case "expired":
            statusClass = "text-danger";
            break;
          case "cancelled":
            statusClass = "text-warning";
            break;
        }
        // Format auto renew
        const autoRenew = subscription.auto_renew
          ? '<i class="fas fa-check text-success"></i>'
          : '<i class="fas fa-times text-danger"></i>';
        // Format subscription logo
        let logoUrl = subscription.logo_url || "../noice/placeholder.webp";
        if (logoUrl.startsWith("public/")) {
          logoUrl = "/" + logoUrl.substring(7);
        }
        return `
        <tr>
          <td class="col-subscription">
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${logoUrl}" alt="${subscription.subscription_name}" style="width:24px;height:24px;object-fit:contain;">
              ${subscription.subscription_name}
            </div>
          </td>
          <td class="col-plan">${subscription.plan_name}</td>
          <td class="col-start-date">${startDate}</td>
          <td class="col-end-date">${endDate}</td>
          <td class="col-days-left"><span class="${daysLeftClass}">${daysLeft}</span></td>
          <td class="col-status"><span class="${statusClass}">${subscription.status}</span></td>
          <td class="col-auto-renew">${autoRenew}</td>
          <td class="col-actions">
            <div class="action-buttons">
              <button class="btn-action view" title="View Credentials" data-action="view" data-id="${subscription.id}">
                <i class="fas fa-key"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
    // Add event listeners for actions
    activeSubscriptionsTableBody
      .querySelectorAll(".btn-action")
      .forEach((btn) => {
        btn.addEventListener("click", handleActiveSubscriptionAction);
      });
    // Restore column visibility from localStorage
    restoreActiveSubscriptionsColumnVisibility();
    // Attach column toggle listeners
    attachActiveSubscriptionsColumnToggleListeners();
  }

  function handleActiveSubscriptionAction(e) {
    const btn = e.currentTarget;
    const action = btn.getAttribute("data-action");
    const subscriptionId = btn.getAttribute("data-id");
    const subscription = allActiveSubscriptions.find(
      (s) => s.id == subscriptionId
    );
    if (!subscription) return;
    if (action === "view") {
      showCredentialsModal(subscription);
    }
  }

  function showCredentialsModal(subscription) {
    credentialEmail.textContent =
      subscription.subscription_email || "Not provided";
    credentialPassword.textContent =
      subscription.subscription_password || "Not provided";
    credentialPassword.classList.add("password-hidden");
    credentialPin.textContent = subscription.subscription_pin || "Not provided";
    credentialNotes.textContent = subscription.notes || "No notes";

    // Show with transition
    viewCredentialsModal.style.display = "flex";
    viewCredentialsModal.classList.add("show");
    viewCredentialsModal.style.opacity = "0";
    setTimeout(() => {
      viewCredentialsModal.style.opacity = "1";
      viewCredentialsModal.querySelector(
        ".action-modal-content"
      ).style.transform = "translateY(0)";
    }, 10);
  }

  togglePasswordBtn.addEventListener("click", () => {
    const isHidden = credentialPassword.classList.contains("password-hidden");
    if (isHidden) {
      credentialPassword.classList.remove("password-hidden");
      togglePasswordBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
      credentialPassword.classList.add("password-hidden");
      togglePasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
    }
  });

  closeCredentialsModalBtn.addEventListener("click", closeCredentialsModal);
  closeViewCredentialsBtn.addEventListener("click", closeCredentialsModal);

  function closeCredentialsModal() {
    // Hide with transition
    viewCredentialsModal.style.opacity = "0";
    viewCredentialsModal.querySelector(
      ".action-modal-content"
    ).style.transform = "translateY(20px)";
    setTimeout(() => {
      viewCredentialsModal.classList.remove("show");
      viewCredentialsModal.style.display = "none";
    }, 300);
  }
  // Event listeners
  activeSubscriptionsSearchInput?.addEventListener(
    "input",
    applyActiveSubscriptionsFilters
  );
  activeSubscriptionsStatusFilter?.addEventListener(
    "change",
    applyActiveSubscriptionsFilters
  );
  activeSubscriptionsDateFilter?.addEventListener(
    "change",
    applyActiveSubscriptionsFilters
  );
  activeSubscriptionsPrevPage?.addEventListener("click", () => {
    if (activeSubscriptionsCurrentPage > 1) {
      activeSubscriptionsCurrentPage--;
      renderActiveSubscriptionsTable();
    }
  });
  activeSubscriptionsNextPage?.addEventListener("click", () => {
    if (
      activeSubscriptionsCurrentPage <
      Math.ceil(
        filteredActiveSubscriptions.length / ACTIVE_SUBSCRIPTIONS_PER_PAGE
      )
    ) {
      activeSubscriptionsCurrentPage++;
      renderActiveSubscriptionsTable();
    }
  });
  activeSubscriptionsNavItem?.addEventListener("click", () => {
    showPage("activeSubscriptions");
    showActiveSubscriptionsLoadingOverlay();
    setTimeout(() => {
      hideActiveSubscriptionsLoadingOverlay();
      fetchActiveSubscriptions();
    }, 2000);
  });
  // If page loaded directly on active subscriptions, fetch subscriptions
  if (
    sessionStorage.getItem("customer_active_page") === "activeSubscriptions"
  ) {
    showActiveSubscriptionsLoadingOverlay();
    setTimeout(() => {
      hideActiveSubscriptionsLoadingOverlay();
      fetchActiveSubscriptions();
    }, 2000);
  }

  function restoreActiveSubscriptionsColumnVisibility() {
    if (!activeSubscriptionsColumnToggles) return;
    activeSubscriptionsColumnToggles
      .querySelectorAll('input[type="checkbox"]')
      .forEach((checkbox) => {
        const col = checkbox.getAttribute("data-column");
        const saved = localStorage.getItem(`activeSubscriptionsColumn_${col}`);
        if (saved !== null) {
          checkbox.checked = saved === "1";
          document.querySelectorAll(`.col-${col}`).forEach((cell) => {
            cell.style.display = checkbox.checked ? "" : "none";
          });
        }
      });
  }

  const activeSubscriptionsColumnToggles = document.getElementById(
    "active-subscriptions-column-toggles"
  );

  const activeSubscriptionsToggleColumnsBtn = document.getElementById(
    "active-subscriptions-toggle-columns-btn"
  );

  // Toggle dropdown on button click
  activeSubscriptionsToggleColumnsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (activeSubscriptionsColumnToggles.style.display === "block") {
      activeSubscriptionsColumnToggles.style.display = "none";
    } else {
      activeSubscriptionsColumnToggles.style.display = "block";
    }
  });
  // Close dropdown when clicking outside
  window.addEventListener("click", (e) => {
    if (
      activeSubscriptionsColumnToggles &&
      !activeSubscriptionsColumnToggles.contains(e.target) &&
      e.target !== activeSubscriptionsToggleColumnsBtn
    ) {
      activeSubscriptionsColumnToggles.style.display = "none";
    }
  });

  // Add this function ONCE, outside of renderActiveSubscriptionsTable
  function attachActiveSubscriptionsColumnToggleListeners() {
    if (!activeSubscriptionsColumnToggles) return;
    activeSubscriptionsColumnToggles
      .querySelectorAll('input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.onchange = () => {
          const col = checkbox.getAttribute("data-column");
          const show = checkbox.checked;
          document.querySelectorAll(`.col-${col}`).forEach((cell) => {
            cell.style.display = show ? "" : "none";
          });
          // Save to localStorage
          localStorage.setItem(
            `activeSubscriptionsColumn_${col}`,
            show ? "1" : "0"
          );
        };
      });
  }

  // --- Support Section Logic (Customer) ---

  const supportLink = document.getElementById("supportLink");
  const supportPage = document.getElementById("supportPage");
  const supportTableBody = document.getElementById("supportTableBody");
  const supportStatusFilter = document.getElementById("support-status-filter");
  const supportDateFilter = document.getElementById("support-date-filter");
  const supportSearchInput = document.getElementById("support-search-input");
  const createSupportTicketBtn = document.getElementById(
    "createSupportTicketBtn"
  );

  // Modals
  const supportViewModal = document.getElementById("support-view-modal");
  const supportCreateModal = document.getElementById("support-create-modal");

  // Modal fields
  const supportViewSubject = document.getElementById("support-view-subject");
  const supportViewDate = document.getElementById("support-view-date");
  const supportViewStatus = document.getElementById("support-view-status");
  const supportViewMessage = document.getElementById("support-view-message");
  const supportViewReplyBlock = document.getElementById(
    "support-view-reply-block"
  );
  const supportViewReply = document.getElementById("support-view-reply");

  // Modal close buttons
  const closeSupportViewModal = document.getElementById(
    "close-support-view-modal"
  );
  const closeSupportViewBtn = document.getElementById("close-support-view-btn");
  const closeSupportCreateModal = document.getElementById(
    "close-support-create-modal"
  );
  const cancelSupportCreateBtn = document.getElementById(
    "cancel-support-create-btn"
  );
  const sendSupportCreateBtn = document.getElementById(
    "send-support-create-btn"
  );

  // Create form fields
  const supportCreateForm = document.getElementById("support-create-form");
  const supportCreateSubject = document.getElementById(
    "support-create-subject"
  );
  const supportCreateMessage = document.getElementById(
    "support-create-message"
  );

  let supportTickets = [];
  let selectedSupportTicket = null;

  function showSupportPage() {
    document
      .querySelectorAll(".page-section")
      .forEach((p) => (p.style.display = "none"));
    supportPage.style.display = "block";
  }
  if (supportLink) {
    supportLink.addEventListener("click", (e) => {
      e.preventDefault();
      showSupportPage();
      fetchSupportTickets();
    });
  }

  async function fetchSupportTickets() {
    // Use the new customer endpoint
    const status = supportStatusFilter.value;
    const date = supportDateFilter.value;
    const q = supportSearchInput.value.trim();
    let url = `/api/support/my-tickets?`;
    if (status) url += `status=${encodeURIComponent(status)}&`;
    if (date) url += `date=${encodeURIComponent(date)}&`;
    if (q) url += `q=${encodeURIComponent(q)}&`;
    try {
      const res = await fetch(url, {
        headers: {
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        credentials: "include",
      });
      supportTickets = await res.json();

      if (supportTickets.status === "error") {
        supportTableBody.innerHTML = `<tr><td colspan=\"5\">Failed to load tickets</td></tr>`;
        showToast(supportTickets.message, TOAST_TYPES.ERROR);
        return;
      }
      renderSupportTable();
      updateSupportBadgeCount(supportTickets);
    } catch (err) {
      supportTableBody.innerHTML = `<tr><td colspan=\"5\">Failed to load tickets</td></tr>`;
    }
  }

  // Function to update the support badge count
  function updateSupportBadgeCount(tickets) {
    if (!tickets || !Array.isArray(tickets)) return;

    // Count tickets that need attention (open or pending)
    const needAttentionCount = tickets.filter(
      (ticket) => ticket.status === "open" || ticket.status === "pending"
    ).length;

    // Update the badge in sidebar
    const supportBadge = document.getElementById("supportBadge");
    const support2 = document.getElementById("supportBadge2");
    const supportCount3 = document.getElementById("supportCount");
    if (supportBadge) {
      supportBadge.textContent = needAttentionCount;
      support2.textContent = needAttentionCount;
      supportCount3.textContent = needAttentionCount;
      // Show/hide badge based on count
      supportBadge.style.display = needAttentionCount > 0 ? "flex" : "none";
      support2.style.display = needAttentionCount > 0 ? "flex" : "none";
    }
  }

  function sanitizeInput(str) {
    // Remove dangerous characters and trim
    return str
      .replace(/[<>]/g, "")
      .replace(/[;}{\[\]~|]/g, "")
      .trim();
  }

  function renderSupportTable() {
    if (!supportTickets.length) {
      supportTableBody.innerHTML = `<tr><td colspan="5">No support tickets found</td></tr>`;
      return;
    }
    supportTableBody.innerHTML = "";
    supportTickets.forEach((ticket) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${sanitizeInput(ticket.subject)}</td>
        <td><span class="status-badge status-${ticket.status}">${
        ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)
      }</span></td>
        <td>${
          sanitizeInput(ticket.message).length > 60
            ? sanitizeInput(ticket.message).slice(0, 60) + "..."
            : sanitizeInput(ticket.message)
        }</td>
        <td>${
          ticket.admin_reply
            ? sanitizeInput(ticket.admin_reply).length > 60
              ? sanitizeInput(ticket.admin_reply).slice(0, 60) + "..."
              : sanitizeInput(ticket.admin_reply)
            : '<span style="color:#aaa;">No reply</span>'
        }</td>
        <td class="action-buttons">
          <button class="btn-action" title="View" data-action="view" data-id="${
            ticket.id
          }"><i class="fas fa-eye"></i></button>
        </td>
      `;
      supportTableBody.appendChild(tr);
    });
  }

  // Filter events
  [supportStatusFilter, supportDateFilter, supportSearchInput].forEach((el) => {
    if (el) el.addEventListener("input", fetchSupportTickets);
  });

  // Table action handler
  supportTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const ticket = supportTickets.find((t) => t.id == id);
    if (!ticket) return;
    selectedSupportTicket = ticket;
    showSupportViewModal(ticket);
  });

  // Modal open/close logic
  function showSupportViewModal(ticket) {
    supportViewSubject.textContent = ticket.subject;
    supportViewDate.textContent = new Date(ticket.created_at).toLocaleString();
    supportViewStatus.textContent =
      ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1);
    supportViewMessage.textContent = ticket.message;
    if (ticket.admin_reply) {
      supportViewReplyBlock.style.display = "flex";
      supportViewReply.textContent = ticket.admin_reply;
    } else {
      supportViewReplyBlock.style.display = "none";
      supportViewReply.textContent = "";
    }

    // Show with transition
    supportViewModal.style.display = "flex";
    supportViewModal.style.opacity = "0";
    setTimeout(() => {
      supportViewModal.style.opacity = "1";
      supportViewModal.querySelector(".action-modal-content").style.transform =
        "translateY(0)";
    }, 10);
  }

  function closeSupportView() {
    // Hide with transition
    supportViewModal.style.opacity = "0";
    supportViewModal.querySelector(".action-modal-content").style.transform =
      "translateY(20px)";
    setTimeout(() => {
      supportViewModal.style.display = "none";
    }, 300);
  }
  closeSupportViewModal.onclick = closeSupportView;
  closeSupportViewBtn.onclick = closeSupportView;

  // Create ticket modal logic
  createSupportTicketBtn.onclick = function () {
    supportCreateSubject.value = "";
    supportCreateMessage.value = "";

    // Show with transition
    supportCreateModal.style.display = "flex";
    supportCreateModal.style.opacity = "0";
    setTimeout(() => {
      supportCreateModal.style.opacity = "1";
      supportCreateModal.querySelector(
        ".action-modal-content"
      ).style.transform = "translateY(0)";
    }, 10);
  };

  const sendSupportCreateBtn2 = document.getElementById(
    "send-support-create-btn"
  );
  const supportOriginalData = sendSupportCreateBtn2.innerHTML;

  function closeSupportCreate() {
    // Hide with transition
    supportCreateModal.style.opacity = "0";
    supportCreateModal.querySelector(".action-modal-content").style.transform =
      "translateY(20px)";
    setTimeout(() => {
      supportCreateModal.style.display = "none";
    }, 300);
  }
  closeSupportCreateModal.onclick = closeSupportCreate;
  cancelSupportCreateBtn.onclick = closeSupportCreate;

  sendSupportCreateBtn.onclick = async function (e) {
    e.preventDefault();
    const subject = sanitizeInput(supportCreateSubject.value);
    const message = sanitizeInput(supportCreateMessage.value);
    if (!subject || !message)
      return showToast("Subject and message are required.", TOAST_TYPES.ERROR);
    if (subject.length < 3 || message.length < 10)
      return showToast(
        "Please provide a more detailed subject and message.",
        TOAST_TYPES.ERROR
      );
    try {
      sendSupportCreateBtn2.disabled = true;
      sendSupportCreateBtn2.innerHTML = "Sending...";
      await fetch("/api/support/create-support-ticket", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${csrfToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ subject, message }),
      });

      setTimeout(() => {
        closeSupportCreate();
        fetchSupportTickets();
        sendSupportCreateBtn2.disabled = false;
        sendSupportCreateBtn2.innerHTML = supportOriginalData;
      }, 2000);
    } catch (err) {
      sendSupportCreateBtn2.disabled = false;
      sendSupportCreateBtn2.innerHTML = supportOriginalData;
      showToast("Failed to create support ticket.", TOAST_TYPES.ERROR);
    }
  };

  fetchSupportTickets();

  // Chat functionality - Starting from line 3970
  // Chat WebSocket connection
  let chatSocket = null;
  let chatReconnectInterval = null;
  let chatUserId = null;
  let chatUserName = null;
  let formatenewimage = null;
  let userImageprofile = null;

  setTimeout(() => {
    chatUserId = window.chatUserId;
    chatUserName = window.chatUserName;

    userImageprofile = window.userImageprofile;
  }, 2000);

  const CHAT_RECONNECT_DELAY = 5000; // 5 seconds

  // Initialize chat functionality
  setTimeout(() => {
    const initChat = () => {
      if (!chatUserId) {
        console.error("User ID not found for chat initialization");
        return;
      }

      // DOM elements
      const chatInput = document.getElementById("chatInput");
      const chatSendBtn = document.getElementById("chatSendBtn");
      const chatFileBtn = document.getElementById("chatFileBtn");
      const chatFileInput = document.getElementById("chatFileInput");
      const chatMessages = document.getElementById("chatMessages");
      const chatRefreshBtn = document.getElementById("chatRefreshBtn");
      const chatFilePreview = document.getElementById("chatFilePreview");
      const chatImageModal = document.getElementById("chatImageModal");
      const chatModalImage = document.getElementById("chatModalImage");
      const chatImageClose = document.getElementById("chatImageClose");
      const chatcontiner = document.querySelector(".chat-input-container");

      // Selected file for upload
      let selectedFile = null;
   

      if (ordercheck) {
     
        chatcontiner.style.display = "block";
      } else {
       
        chatcontiner.style.display = "none";
      }

      // Connect to WebSocket
      const connectChatWebSocket = () => {
        if (chatSocket !== null) {
          chatSocket.close();
        }

        // Create WebSocket connection
        const wsProtocol =
          window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/customer/chat/${chatUserId}`;

        chatSocket = new WebSocket(wsUrl);

        chatSocket.onopen = () => {
          if (chatReconnectInterval) {
            clearInterval(chatReconnectInterval);
            chatReconnectInterval = null;
          }

          // Load chat history
          loadChatHistory();

          // Update unread count
          updateChatUnreadCount();
        };

        chatSocket.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.type === "chat_message") {
            // Add message to chat
            addMessageToChat(data.message);

            // If the message is from admin and the user is on the chat page, mark as read
            if (
              data.message.sender_type === "admin" &&
              document.getElementById("chatPage").style.display !== "none"
            ) {
              markMessageAsRead(data.message.id);
            } else if (data.message.sender_type === "admin") {
              // Update unread count if not on chat page
              updateChatUnreadCount();
            }
          } else if (data.type === "chat_history") {
            // Display chat history
            displayChatHistory(data.messages);
          } else if (data.type === "message_read") {
            // Update message read status
            updateMessageReadStatus(data.message_id);
          } else if (data.type === "unread_count") {
            // Update unread count badge
            updateUnreadBadge(data.count);
          } else if (data.type === "error") {
            console.error("Chat WebSocket error message:", data.message);

            // Show toast notification for errors, especially rate limiting
            if (data.message && data.message.includes("Rate limit exceeded")) {
              showToast(data.message, TOAST_TYPES.ERROR);

              // Re-enable the send button if it was disabled
              if (chatSendBtn) {
                chatSendBtn.disabled = false;
              }

              // Clear loading state if any
              const loadingEl = document.querySelector(".chat-loading");
              if (loadingEl) {
                loadingEl.remove();
              }
            }
          }
        };

        chatSocket.onclose = (event) => {
          // Attempt to reconnect
          if (!chatReconnectInterval) {
            chatReconnectInterval = setInterval(() => {
              connectChatWebSocket();
            }, CHAT_RECONNECT_DELAY);
          }
        };

        chatSocket.onerror = (error) => {
          console.error("Chat WebSocket error:", error);
        };
      };

      // Load chat history
      const loadChatHistory = () => {
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
          chatSocket.send(
            JSON.stringify({
              type: "get_history",
            })
          );
        } else {
          console.error(
            "WebSocket is not connected. Cannot load chat history."
          );
        }
      };

      // Display chat history
      const displayChatHistory = (messages) => {
        // Clear existing messages
        chatMessages.innerHTML = "";

        // Check if messages is undefined or empty
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          // Show empty state if no messages
          chatMessages.innerHTML = `
          <div class="chat-empty-state" id="chatEmptyState">
            <i class="fas fa-comments"></i>
            <h3>No messages yet</h3>
            <p>Place an order to start a conversation with our team and we'll respond as soon as possible.</p>
          </div>
        `;
          return;
        }

        // Hide empty state
        const emptyState = document.getElementById("chatEmptyState");
        if (emptyState) {
          emptyState.style.display = "none";
        }

        // Sort messages by timestamp
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Group messages by date
        const messagesByDate = {};
        messages.forEach((message) => {
          const messageDate = new Date(message.timestamp).toLocaleDateString();
          if (!messagesByDate[messageDate]) {
            messagesByDate[messageDate] = [];
          }
          messagesByDate[messageDate].push(message);
        });

        // Display messages grouped by date
        Object.keys(messagesByDate).forEach((date) => {
          // Add date divider
          const dateDivider = document.createElement("div");
          dateDivider.className = "chat-date-divider";
          dateDivider.innerHTML = `<span>${formatChatDate(date)}</span>`;
          chatMessages.appendChild(dateDivider);

          // Add messages for this date
          messagesByDate[date].forEach((message) => {
            addMessageToChat(message, false);
          });
        });

        // Scroll to bottom
        scrollChatToBottom();
      };

      // Format chat date
      const formatChatDate = (dateString) => {
        const today = new Date().toLocaleDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toLocaleDateString();

        if (dateString === today) {
          return "Today";
        } else if (dateString === yesterdayString) {
          return "Yesterday";
        } else {
          return dateString;
        }
      };

      // Add message to chat
      const addMessageToChat = (message, scroll = true) => {
        // Remove empty state if present
        const emptyState = document.getElementById("chatEmptyState");
        if (emptyState) {
          emptyState.style.display = "none";
        }

        const messageElement = document.createElement("div");
        messageElement.className = `chat-message ${
          message.sender_type === "user" ? "sent" : "received"
        }`;
        messageElement.dataset.id = message.id;

        const timestamp = new Date(message.timestamp);
        const timeString = timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        let mediaHtml = "";
        if (message.media_url) {
          const fileExtension = message.media_url
            .split(".")
            .pop()
            .toLowerCase();
          const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(
            fileExtension
          );
          const isVideo = ["mp4", "webm", "ogg"].includes(fileExtension);

          if (isImage) {
            mediaHtml = `
            <div class="chat-media">
              <img src="${message.media_url}" alt="Shared image" class="chat-image">
            </div>
          `;
          } else if (isVideo) {
            mediaHtml = `
            <div class="chat-media">
              <video controls>
                <source src="${message.media_url}" type="video/${fileExtension}">
                Your browser does not support the video tag.
              </video>
            </div>
          `;
          } else {
            mediaHtml = `
            <div class="chat-media">
              <a href="${message.media_url}" target="_blank" class="chat-file-link">
                <i class="fas fa-file"></i> Download File
              </a>
            </div>
          `;
          }
        }

        messageElement.innerHTML = `
        <div class="chat-avatar">
          <img src="${
            message.sender_type === "user"
              ? userImageprofile
              : "../noice/placeholder.webp"
          }" alt="${message.sender_type === "user" ? "You" : "Support"}">
        </div>
        <div class="chat-bubble">
          ${mediaHtml}
          ${
            message.content
              ? `<div class="chat-text">${message.content}</div>`
              : ""
          }
          <div class="chat-time">${timeString}</div>
        </div>
      `;

        chatMessages.appendChild(messageElement);

        if (scroll) {
          scrollChatToBottom();
        }
      };

      // Scroll chat to bottom
      const scrollChatToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      };

      // Send message
      const sendMessage = () => {
        const content = chatInput.value.trim();

        if (!content && !selectedFile) {
          return; // Don't send empty messages
        }

        // Disable send button and show loading state
        chatSendBtn.disabled = true;
        chatSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        if (selectedFile) {
          // Upload file first, then send message with file URL
          uploadFile(selectedFile, content);
        } else {
          // Send text-only message
          if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            try {
              // Add temporary message with loading state
              const tempMsgId = "temp-" + Date.now();
              const tempMsg = document.createElement("div");
              tempMsg.className = "chat-message sent";
              tempMsg.dataset.id = tempMsgId;
              chatMessages.appendChild(tempMsg);
              scrollChatToBottom();

              // Send message
              chatSocket.send(
                JSON.stringify({
                  type: "chat_message",
                  content: content,
                  sender_id: chatUserId,
                  sender_name: chatUserName,
                  sender_type: "user",
                  customer_id: chatUserId, // Always include customer_id
                  temp_id: tempMsgId, // Include temporary ID for reference
                })
              );

              // Clear input
              chatInput.value = "";

              // Reset send button after a short delay
              setTimeout(() => {
                chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
                chatSendBtn.disabled =
                  content.trim().length === 0 && !selectedFile;
              }, 500);
            } catch (error) {
              console.error("Error sending message:", error);
              showToast(
                "Failed to send message. Please try again.",
                TOAST_TYPES.ERROR
              );

              // Reset send button
              chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
              chatSendBtn.disabled = false;
            }
          } else {
            console.error(
              "WebSocket not connected:",
              chatSocket ? chatSocket.readyState : "null"
            );
            showToast(
              "Chat connection is not available. Please try again later.",
              TOAST_TYPES.ERROR
            );

            // Reset send button
            chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            chatSendBtn.disabled = false;
          }
        }
      };

      // Upload file
      const uploadFile = async (file, content) => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("user_id", chatUserId);
          formData.append("csrf_token", csrftoken);

          // Show loading state
          chatSendBtn.disabled = true;
          chatSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

          const response = await fetch("/api/customer/chat/upload", {
            method: "POST",
            body: formData,
            credentials: "same-origin",
            headers: {
              "X-CSRF-Token": `bearer ${csrfToken}`,
            },
          });

          const data = await response.json();
          if (data.status === "error") {
            showToast(
              data.message || "Failed to upload file",
              TOAST_TYPES.ERROR
            );
            return;
          }

          if (!data.file_url) {
            throw new Error("No file URL returned from server");
          }

          // Send message with file URL
          if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.send(
              JSON.stringify({
                type: "chat_message",
                content: content,
                media_url: data.file_url,
                media_type: file.type,
                sender_id: chatUserId,
                sender_name: chatUserName,
                sender_type: "user",
                customer_id: chatUserId, // Always include customer_id
              })
            );

            // Clear input and file preview
            chatInput.value = "";
            clearFilePreview();
          } else {
            console.error(
              "WebSocket not connected for file message:",
              chatSocket ? chatSocket.readyState : "null"
            );
            throw new Error("Chat connection is not available");
          }
        } catch (error) {
          showToast(
            "Failed to upload file: " + error.message,
            TOAST_TYPES.ERROR
          );

          // Clear selected file on error
          selectedFile = null;
        } finally {
          // Reset button state
          chatSendBtn.disabled = false;
          chatSendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
      };

      // Show file preview
      const showFilePreview = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          let previewHtml = "";
          if (file.type.startsWith("image/")) {
            previewHtml = `
            <img src="${e.target.result}" alt="Preview">
            <div class="chat-file-info">
              <div class="chat-file-name">${file.name}</div>
              <div class="chat-file-size">${formatFileSize(file.size)}</div>
            </div>
          `;
          } else if (file.type.startsWith("video/")) {
            previewHtml = `
            <div style="background-color: #e2e8f0; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
              <i class="fas fa-film" style="font-size: 24px; color: #64748b;"></i>
            </div>
            <div class="chat-file-info">
              <div class="chat-file-name">${file.name}</div>
              <div class="chat-file-size">${formatFileSize(file.size)}</div>
            </div>
          `;
          } else {
            previewHtml = `
            <div style="background-color: #e2e8f0; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
              <i class="fas fa-file" style="font-size: 24px; color: #64748b;"></i>
            </div>
            <div class="chat-file-info">
              <div class="chat-file-name">${file.name}</div>
              <div class="chat-file-size">${formatFileSize(file.size)}</div>
            </div>
          `;
          }
          chatFilePreview.innerHTML = `
          ${previewHtml}
          <button class="chat-file-remove" id="chatFileRemove">
            <i class="fas fa-times"></i>
          </button>
        `;
          chatFilePreview.style.display = "flex";
          // Move the preview above the input if not already there
          const inputContainer = document.querySelector(
            ".chat-input-container"
          );
          if (
            inputContainer &&
            chatFilePreview.nextSibling !== inputContainer
          ) {
            inputContainer.parentNode.insertBefore(
              chatFilePreview,
              inputContainer
            );
          }
          // Enable send button
          chatSendBtn.disabled = false;
          // Add event listener to remove button
          document
            .getElementById("chatFileRemove")
            .addEventListener("click", clearFilePreview);
        };
        reader.readAsDataURL(file);
      };

      // Clear file preview
      const clearFilePreview = () => {
        chatFilePreview.style.display = "none";
        chatFilePreview.innerHTML = "";
        selectedFile = null;

        // Disable send button if text is also empty
        if (!chatInput.value.trim()) {
          chatSendBtn.disabled = true;
        }

        // Reset file input
        chatFileInput.value = "";
      };

      // Format file size
      const formatFileSize = (bytes) => {
        if (bytes < 1024) {
          return bytes + " B";
        } else if (bytes < 1048576) {
          return (bytes / 1024).toFixed(1) + " KB";
        } else {
          return (bytes / 1048576).toFixed(1) + " MB";
        }
      };

      // Mark message as read
      const markMessageAsRead = (messageId) => {
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
          chatSocket.send(
            JSON.stringify({
              type: "mark_read",
              message_id: messageId,
            })
          );
        }
      };

      // Update message read status
      const updateMessageReadStatus = (messageId) => {
        const messageElement = document.querySelector(
          `.chat-message[data-id="${messageId}"]`
        );
        if (messageElement) {
          messageElement.classList.add("read");
        }
      };

      // Update unread count
      const updateChatUnreadCount = () => {
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
          chatSocket.send(
            JSON.stringify({
              type: "get_unread_count",
            })
          );
        }
      };

      // Update unread badge
      const updateUnreadBadge = (count) => {
        const chatBadge = document.getElementById("chatCount");
        if (count > 0) {
          chatBadge.textContent = count > 99 ? "99+" : count;
          chatBadge.style.display = "flex";
        } else {
          chatBadge.style.display = "none";
        }
      };

      // Event Listeners
      chatInput.addEventListener("input", () => {
        chatSendBtn.disabled = !(chatInput.value.trim() || selectedFile);
      });

      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!chatSendBtn.disabled) {
            sendMessage();
          }
        }
      });

      chatSendBtn.addEventListener("click", sendMessage);

      chatFileBtn.addEventListener("click", () => {
        chatFileInput.click();
      });

      chatFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];

          // Check file size (max 10MB)
          if (file.size > 10 * 1024 * 1024) {
            showToast("File size exceeds 10MB limit.", TOAST_TYPES.ERROR);
            return;
          }

          selectedFile = file;
          showFilePreview(file);
        }
      });

      chatRefreshBtn.addEventListener("click", () => {
        loadChatHistory();
        chatRefreshBtn.classList.add("fa-spin");
        setTimeout(() => {
          chatRefreshBtn.classList.remove("fa-spin");
        }, 1000);
      });

      // Handle image clicks to show in modal
      chatMessages.addEventListener("click", (e) => {
        if (e.target.classList.contains("chat-image")) {
          chatModalImage.src = e.target.src;
          chatImageModal.classList.add("show");
        }
      });

      chatImageClose.addEventListener("click", () => {
        chatImageModal.classList.remove("show");
      });

      // Close modal when clicking outside
      chatImageModal.addEventListener("click", (e) => {
        if (e.target === chatImageModal) {
          chatImageModal.classList.remove("show");
        }
      });

      // Initialize WebSocket connection
      connectChatWebSocket();

      // Mark messages as read when chat page is opened
      document.querySelectorAll('[data-page="chat"]').forEach((link) => {
        link.addEventListener("click", () => {
          setTimeout(() => {
            const unreadMessages = document.querySelectorAll(
              ".chat-message.received:not(.read)"
            );
            unreadMessages.forEach((message) => {
              markMessageAsRead(message.dataset.id);
            });

            // Update unread count
            updateChatUnreadCount();
          }, 500);
        });
      });
    };

    // Initialize chat when DOM is loaded
    if (document.getElementById("chatPage")) {
      initChat();
    }
  }, 3000);
});
