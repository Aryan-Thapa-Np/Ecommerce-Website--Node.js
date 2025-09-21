import Auth from "./utils/Authentication.js";
import { csrftoken } from "./utils/generateCsrf.js";
import { showToast, TOAST_TYPES } from "./utils/toast.js";

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Global constant for active page tracking
const ACTIVE_PAGE_KEY = "admin_active_page";

document.addEventListener("DOMContentLoaded", async () => {
  setTimeout(() => {
    const headerRight = document.querySelector(".header-right");
    headerRight.style.visibility = "visible";
  }, 2300);

  let csrfToken = "";
  let emailTemp = "";
  let user_id = "";

  csrfToken = await csrftoken();
  window.csrfToken = csrfToken;

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
      console.error("Error:", error);
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

  // Mock data for stats (replace with actual API calls in production)
  const stats = {
    orders: 24,
    wishlist: 8,
    cart: 3,
    support: 2,
  };

  // Initialize stats
  const updateStats = () => {
    ordersCount.textContent = stats.orders;
    wishlistCount.textContent = stats.wishlist;
    cartCount.textContent = stats.cart;
    supportCount.textContent = stats.support;
  };

  // Function to fetch and update order statistics
  const fetchOrderStats = async () => {
    try {
      showHeaderSkeleton();

      // Fetch all orders
      const res = await fetch("/api/orders/admin/orders", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
      });

      const data = await res.json();

      if (data.status === "error") {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch orders");
      }

      const orders = data.orders || [];

      // Calculate stats
      const totalOrders = orders.length;
      const pendingOrders = orders.filter(
        (order) => order.status === "pending"
      ).length;
      const processingOrders = orders.filter(
        (order) => order.status === "processing"
      ).length;
      const completedOrders = orders.filter(
        (order) => order.status === "completed"
      ).length;
      const failedOrders = orders.filter(
        (order) => order.status === "cancelled" || order.status === "failed"
      ).length;

      // Calculate total income from completed and paid orders
      const totalIncome = orders
        .filter(
          (order) =>
            order.payment_status === "paid" && order.status === "completed"
        )
        .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

      // Calculate pending income from paid orders that aren't completed yet
      const pendingIncome = orders
        .filter(
          (order) =>
            order.payment_status === "paid" && order.status !== "completed"
        )
        .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

      // Calculate orders from current month and previous month
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      // Filter orders by month
      const currentMonthOrders = orders.filter((order) => {
        const orderDate = new Date(order.created_at);
        return (
          orderDate.getMonth() === currentMonth &&
          orderDate.getFullYear() === currentYear
        );
      });

      const previousMonthOrders = orders.filter((order) => {
        const orderDate = new Date(order.created_at);
        return (
          orderDate.getMonth() === previousMonth &&
          orderDate.getFullYear() === previousYear
        );
      });

      // Calculate percentage change
      const currentMonthCount = currentMonthOrders.length;
      const previousMonthCount = previousMonthOrders.length;

      let percentChange = 0;
      let isPositive = true;

      if (previousMonthCount > 0) {
        percentChange =
          ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100;
        isPositive = percentChange >= 0;
      } else if (currentMonthCount > 0) {
        // If previous month had 0 orders but current month has orders, that's a 100% increase
        percentChange = 100;
        isPositive = true;
      }

      // Round to nearest integer
      percentChange = Math.abs(Math.round(percentChange));

      // Update UI
      const ordersCount = document.getElementById("ordersCount");
      const pendingOrdersCount = document.getElementById("pendingOrdersCount");
      const processingOrdersCount = document.getElementById(
        "processingOrdersCount"
      );
      const completedOrdersCount = document.getElementById(
        "completedOrdersCount"
      );
      const failedOrdersCount = document.getElementById("failedOrdersCount");
      const totalIncomeValue = document.getElementById("totalIncomeValue");
      const pendingIncomeValue = document.getElementById("pendingIncomeValue");

      if (ordersCount) ordersCount.textContent = totalOrders;
      if (pendingOrdersCount) pendingOrdersCount.textContent = pendingOrders;
      if (processingOrdersCount)
        processingOrdersCount.textContent = processingOrders;
      if (completedOrdersCount)
        completedOrdersCount.textContent = completedOrders;
      if (failedOrdersCount) failedOrdersCount.textContent = failedOrders;

      // Format currency without decimal places
      if (totalIncomeValue)
        totalIncomeValue.textContent = `NPR ${Math.round(totalIncome)}`;
      if (pendingIncomeValue)
        pendingIncomeValue.textContent = `NPR ${Math.round(pendingIncome)}`;

      // Update the percentage change text and icon for total orders
      const orderChangeElement = document.querySelector(
        ".stat-card:first-child .stat-change"
      );
      if (orderChangeElement) {
        const iconElement = orderChangeElement.querySelector("i");
        const textElement = orderChangeElement.querySelector("span");

        if (iconElement) {
          // Remove all existing classes and add the appropriate one
          iconElement.className = "";
          iconElement.classList.add(
            "fas",
            isPositive ? "fa-arrow-up" : "fa-arrow-down"
          );
        }

        if (textElement) {
          textElement.textContent = `${
            isPositive ? "+" : "-"
          }${percentChange}% from last month`;
        }

        // Update the class for color
        orderChangeElement.className = "stat-change";
        orderChangeElement.classList.add(isPositive ? "positive" : "negative");
      }

      hideHeaderSkeleton();
    } catch (error) {
      console.error("Error fetching order statistics:", error);
      hideHeaderSkeleton();
    }
  };

  // Function to update orders badge count based on pending and processing orders
  const updateOrdersBadgeCount = (orders) => {
    if (!orders || !Array.isArray(orders)) return;

    // Count pending and processing orders
    const pendingProcessingCount = orders.filter(
      (order) => order.status === "pending" || order.status === "processing"
    ).length;

    // Update the badge in sidebar
    const ordersBadge = document.querySelector(
      '.nav-item[data-page="orders"] .nav-badge'
    );
    if (ordersBadge) {
      ordersBadge.textContent = pendingProcessingCount;
      // Show/hide badge based on count
      ordersBadge.style.display = pendingProcessingCount > 0 ? "flex" : "none";
    }
  };

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

    const activePage = document.getElementById(`${pageId}Page`);
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

    // Fetch order stats when dashboard is shown
    if (pageId === "dashboard") {
      fetchOrderStats();
    }

    // Fetch active subscriptions when that page is shown
    if (pageId === "activeSubscriptions") {
      fetchActiveSubscriptions();
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
  // updateStats(); // Remove this line as we're replacing it with fetchOrderStats
  setTimeout(() => {
    showPage(initialPage);
    // Fetch order stats when dashboard loads
    if (initialPage === "dashboard") {
      fetchOrderStats();
    }
    // Fetch active subscriptions when that page loads
    if (initialPage === "activeSubscriptions") {
      fetchActiveSubscriptions();
    }
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
        "active subscriptions",
        "subscriptions",
        "active subscription",
        "subscription management",
        "manage subscriptions",
        "track subscriptions",
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
      ],
      page: "settings",
      focus: "securityForm",
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

  // Input sanitization helper for search
  function sanitizeSearchInput(str) {
    return str
      .replace(/<[^>]*>?/gm, "") // Remove HTML tags
      .replace(/[{};\]\[<>~"'|\\]/g, "") // Remove dangerous chars
      .replace(/[^\w\s\-@.]/gi, "") // Remove special chars except word, whitespace, dash, @, .
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim()
      .toLowerCase();
  }

  // Input sanitization helper for chat
  function sanitizeChatInput(str) {
    return str
      .replace(/<script.*?>.*?<\/script>/gi, "") // Remove script tags
      .replace(/<[^>]*>?/gm, "") // Remove HTML tags
      .replace(/[{};\]\[<>~"'|\\]/g, "") // Remove dangerous chars
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim();
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
      matches.slice(0, 5).forEach(({ keyword, entry }) => {
        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.textContent = keyword;
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

  // Initialize search bar
  const searchInput = document.querySelector(".search-input");
  const suggestionBox = document.createElement("div");
  suggestionBox.className = "suggestion-box";
  searchInput.parentNode.appendChild(suggestionBox);

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
          searchInput.placeholder = "Search orders, products...";
        }, 1200);
      }
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
  
    .search-input:focus {
      border-color: #3182ce;
      box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
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

  //Fetch data

  const UserData = async () => {
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

      if (data.status === "error") {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch user data");
      // Update UI with user data

      const user = data.profile;

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

      if (result.status === "error") {
        showToast(result.message, TOAST_TYPES.ERROR);
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
          console.error("Error verifying authenticator 2FA:", error);
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
          console.error("Error verifying email 2FA:", error);
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
      console.error("Error fetching notifications:", error);
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
    const sidebarotification = document.getElementById("notificationsBadge");

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
      notificationBadge.textContent = unviewedCount > 0 ? unviewedCount : "0";
      sidebarotification.textContent = unviewedCount > 0 ? unviewedCount : "0";
      sidebarotification.style.display = unviewedCount > 0 ? "flex" : "none";
      notificationBadge.style.display = unviewedCount > 0 ? "flex" : "none";

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

            sidebarotification.style.display =
              Math.max(0, parseInt(sidebarotification.textContent) - 1) > 0
                ? "flex"
                : "none";
            notificationBadge.style.display =
              Math.max(0, parseInt(notificationBadge.textContent) - 1) > 0
                ? "flex"
                : "none";
          } catch (error) {
            console.error("Error marking as viewed:", error);
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
            console.error("Error deleting notification:", error);
            showToast("Failed to delete notification", TOAST_TYPES.ERROR);
          }
        });
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
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
      console.error("Error logging out:", error);
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
      console.error("Error loading sessions:", error);
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

  // =========================
  // SECTION: Admin Orders Page Logic
  // =========================

  // Orders page elements
  const ordersPage = document.getElementById("ordersPage");
  const ordersList = document.getElementById("orders-list");
  const ordersEmptyState = document.getElementById("orders-empty-state");
  const ordersSearchInput = document.getElementById("orders-search-input");
  const ordersStatusFilter = document.getElementById("orders-status-filter");
  const ordersPaymentFilter = document.getElementById("orders-payment-filter");
  const ordersDateFilter = document.getElementById("orders-date-filter");
  const ordersToggleColumnsBtn = document.getElementById(
    "orders-toggle-columns-btn"
  );
  const ordersColumnToggles = document.getElementById("orders-column-toggles");
  const ordersListContainer = document.querySelector(".orders-list-container");
  const ordersListFooter = document.querySelector(".orders-list-footer");
  const ordersShowingStart = document.getElementById("orders-showing-start");
  const ordersShowingEnd = document.getElementById("orders-showing-end");
  const ordersTotalEntries = document.getElementById("orders-total-entries");
  const ordersPrevPage = document.getElementById("orders-prev-page");
  const ordersNextPage = document.getElementById("orders-next-page");
  const ordersCurrentPage = document.getElementById("orders-current-page");
  const ordersTotalPages = document.getElementById("orders-total-pages");

  let allAdminOrders = [];
  let filteredAdminOrders = [];
  let adminOrdersPage = 1;
  const ADMIN_ORDERS_PER_PAGE = 20;

  // Utility: Show/hide loading overlay for orders list
  function showOrdersLoadingOverlay(message = "Loading orders...") {
    const loadingOverlay = document.getElementById("orders-loading-overlay");
    if (loadingOverlay) {
      const loadingText = loadingOverlay.querySelector(".loading-text");
      if (loadingText) {
        loadingText.textContent = message;
      }
      loadingOverlay.style.display = "flex";
    }
  }
  
  function hideOrdersLoadingOverlay() {
    const loadingOverlay = document.getElementById("orders-loading-overlay");
    if (loadingOverlay) {
      loadingOverlay.style.display = "none";
    }
  }

  // Fetch orders for admin
  async function fetchAdminOrders() {
    try {
      showOrdersLoadingOverlay("Fetching orders...");
      
      // Get the orders list and empty state elements
      const ordersList = document.getElementById("orders-list");
      const ordersEmptyState = document.getElementById("orders-empty-state");
      
      // Show loading state
      if (ordersList) {
        ordersList.innerHTML = "";
      }
      
      const res = await fetch("/api/orders/admin/orders", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      setTimeout(() => hideOrdersLoadingOverlay(), 1000);
      if (!data.success)
        throw new Error(data.message || "Failed to fetch orders");
      allAdminOrders = data.orders || [];

      // Update orders badge count with pending and processing orders
      updateOrdersBadgeCount(allAdminOrders);

      // Update dashboard stats if we're on the dashboard page
      const currentPage = sessionStorage.getItem(ACTIVE_PAGE_KEY);
      if (currentPage === "dashboard") {
        fetchOrderStats();
      }

      applyAdminOrderFilters();
    } catch (err) {
      setTimeout(() => hideOrdersLoadingOverlay(), 1000);
      
      // Show error state
      const ordersList = document.getElementById("orders-list");
      const ordersEmptyState = document.getElementById("orders-empty-state");
      
      if (ordersList) {
        ordersList.innerHTML = "";
      }
      
      if (ordersEmptyState) {
        ordersEmptyState.style.display = "flex";
        ordersEmptyState.innerHTML = `
          <i class="fas fa-exclamation-circle"></i>
          <h3>Error Loading Orders</h3>
          <p>Failed to load orders. Please try again later.</p>
        `;
      }
    }
  }

  fetchAdminOrders();

  // Utility: Sanitize search input for orders
  function sanitizeOrderSearchInput(str) {
    return str
      .replace(/<[^>]*>?/gm, "") // Remove HTML tags
      .replace(/[^\w\s\-@.]/gi, "") // Remove special chars except word, whitespace, dash, @, .
      .replace(/\s+/g, " ") // Collapse whitespace
      .trim()
      .toLowerCase();
  }

  // Apply filters and search
  function applyAdminOrderFilters() {
    // Show loading overlay with filtering message
    showOrdersLoadingOverlay("Filtering orders...");
    setTimeout(() => {
      let search = sanitizeOrderSearchInput(ordersSearchInput?.value || "");
      let status = ordersStatusFilter?.value || "";
      let payment = ordersPaymentFilter?.value || "";
      let date = ordersDateFilter?.value || "";
      filteredAdminOrders = allAdminOrders.filter((order) => {
        // Search by customer name, item name, or order id
        let matchesSearch =
          !search ||
          (order.order_reference &&
            order.order_reference.toLowerCase().includes(search)) ||
          (order.customer_name &&
            order.customer_name.toLowerCase().includes(search)) ||
          (order.customer_email &&
            order.customer_email.toLowerCase().includes(search)) ||
          (order.items &&
            order.items.some(
              (item) =>
                item.item_name && item.item_name.toLowerCase().includes(search)
            ));
        // Status
        let matchesStatus = !status || order.status === status;
        // Payment
        let matchesPayment = !payment || order.payment_status === payment;
        // Date
        let matchesDate = true;
        if (date) {
          const orderDate = new Date(order.created_at);
          const now = new Date();
          switch (date) {
            case "today":
              matchesDate = orderDate.toDateString() === now.toDateString();
              break;
            case "week": {
              const weekAgo = new Date();
              weekAgo.setDate(now.getDate() - 7);
              matchesDate = orderDate >= weekAgo;
              break;
            }
            case "month":
              matchesDate =
                orderDate.getMonth() === now.getMonth() &&
                orderDate.getFullYear() === now.getFullYear();
              break;
            case "year":
              matchesDate = orderDate.getFullYear() === now.getFullYear();
              break;
            default:
              matchesDate = true;
          }
        }
        return matchesSearch && matchesStatus && matchesPayment && matchesDate;
      });
      adminOrdersPage = 1;
      renderAdminOrdersTable();
      hideOrdersLoadingOverlay();
    }, 1000);
  }

  // Render orders table
  function renderAdminOrdersTable() {
    const start = (adminOrdersPage - 1) * ADMIN_ORDERS_PER_PAGE;
    const end = Math.min(
      start + ADMIN_ORDERS_PER_PAGE,
      filteredAdminOrders.length
    );
    const pageOrders = filteredAdminOrders.slice(start, end);
    
    // Update pagination info
    ordersShowingStart.textContent =
      filteredAdminOrders.length > 0 ? start + 1 : 0;
    ordersShowingEnd.textContent = end;
    ordersTotalEntries.textContent = filteredAdminOrders.length;
    ordersCurrentPage.textContent = adminOrdersPage;
    ordersTotalPages.textContent = Math.max(
      1,
      Math.ceil(filteredAdminOrders.length / ADMIN_ORDERS_PER_PAGE)
    );
    ordersPrevPage.disabled = adminOrdersPage === 1;
    ordersNextPage.disabled = end >= filteredAdminOrders.length;
    
    // Get the orders list container
    const ordersList = document.getElementById("orders-list");
    const ordersEmptyState = document.getElementById("orders-empty-state");
    
    // Show empty state if no orders
    if (filteredAdminOrders.length === 0) {
      if (ordersList) ordersList.innerHTML = "";
      if (ordersEmptyState) ordersEmptyState.style.display = "flex";
      return;
    }
    
    // Hide empty state
    if (ordersEmptyState) ordersEmptyState.style.display = "none";
    
    // Render orders as list items
    if (ordersList) {
      ordersList.innerHTML = pageOrders
        .map((order) => {
          // Items and images
          const itemsHtml =
            order.items && order.items.length > 0
              ? order.items
                  .map(
                    (item) =>
                      `<div class="order-item-details">${item.item_name} <span class="order-item-count">x${item.quantity}</span></div>`
                  )
                  .join("")
              : '<div class="order-item-details">No items</div>';
              
          const imagesHtml =
            order.items && order.items.length > 0
              ? order.items
                  .map(
                    (item) =>
                      `<img src="${
                        item.image_url || "../noice/placeholder.webp"
                      }" alt="${item.item_name}" class="order-image" title="${
                        item.item_name
                      }" onerror="this.src='../noice/placeholder.webp'">`
                  )
                  .join("")
              : '<img src="../noice/placeholder.webp" alt="No Image" class="order-image">';
              
          // Status classes
          let statusClass = order.status || "pending";
          let paymentClass = order.payment_status || "pending";
          
          // Format date
          const orderDate = new Date(order.created_at);
          const formattedDate = orderDate.toLocaleString();
          
          // Return the order item HTML
          return `
            <li class="order-item" data-id="${order.id}">
              <div class="order-item-left">
                <div class="order-id">${order.order_reference || order.id}</div>
                <div class="order-date">${formattedDate}</div>
                <div class="order-customer">${
                  order.customer_name || "Unknown"
                }<br><span style="font-size:12px;color:#64748b;">${
                  order.customer_email || ""
                }</span></div>
              </div>
              
              <div class="order-item-middle">
                <div class="order-items-list">
                  ${itemsHtml}
                </div>
                <div class="order-images">
                  ${imagesHtml}
                </div>
                <div class="order-total">
                  NPR ${parseFloat(order.total_amount).toFixed(2)}
                </div>
              </div>
              
              <div class="order-item-right">
                <div class="order-status-section">
                  <span class="order-status ${statusClass}">
                    ${statusClass.charAt(0).toUpperCase() + statusClass.slice(1)}
                  </span>
                  <span class="payment-status ${paymentClass}">
                    ${paymentClass.charAt(0).toUpperCase() + paymentClass.slice(1)}
                  </span>
                </div>
                <div class="order-actions">
                  <button class="btn-order-action view" title="View Details" data-action="view" data-id="${
                    order.id
                  }"><i class="fas fa-eye"></i></button>
                  <button class="btn-order-action edit" title="Change Status" data-action="status" data-id="${
                    order.id
                  }"><i class="fas fa-edit"></i></button>
                  <button class="btn-order-action view" title="Payment Proof" data-action="proof" data-id="${
                    order.id
                  }"><i class="fas fa-receipt"></i></button>
                  <button class="btn-order-action delete" title="Delete Order" data-action="delete" data-id="${
                    order.id
                  }"><i class="fas fa-trash-alt"></i></button>
                </div>
              </div>
            </li>
          `;
        })
        .join("");
        
      // Add event listeners for actions
      ordersList.querySelectorAll(".btn-order-action").forEach((btn) => {
        btn.addEventListener("click", handleAdminOrderAction);
      });
    }
  }

  // Handle actions
  function handleAdminOrderAction(e) {
    const btn = e.currentTarget;
    const action = btn.getAttribute("data-action");
    const orderId = btn.getAttribute("data-id");
    const order = allAdminOrders.find((o) => o.id == orderId);
    if (!order) return;
    if (action === "view") showAdminOrderDetails(order);
    if (action === "status") showAdminOrderStatusModal(order);
    if (action === "delete") showAdminOrderDeleteModal(order);
    if (action === "proof") showAdminOrderPaymentProof(order);
  }

  // Pagination
  ordersPrevPage?.addEventListener("click", () => {
    if (adminOrdersPage > 1) {
      showOrdersLoadingOverlay("Loading previous page...");
      adminOrdersPage--;
      setTimeout(() => {
        renderAdminOrdersTable();
      }, 300);
    }
  });
  ordersNextPage?.addEventListener("click", () => {
    if (
      adminOrdersPage <
      Math.ceil(filteredAdminOrders.length / ADMIN_ORDERS_PER_PAGE)
    ) {
      showOrdersLoadingOverlay("Loading next page...");
      adminOrdersPage++;
      setTimeout(() => {
        renderAdminOrdersTable();
      }, 300);
    }
  });

  // Filters and search
  ordersSearchInput?.addEventListener("input", applyAdminOrderFilters);
  ordersStatusFilter?.addEventListener("change", applyAdminOrderFilters);
  ordersPaymentFilter?.addEventListener("change", applyAdminOrderFilters);
  ordersDateFilter?.addEventListener("change", applyAdminOrderFilters);

  // Column toggling
  ordersToggleColumnsBtn?.addEventListener("click", () => {
    ordersColumnToggles.style.display =
      ordersColumnToggles.style.display === "block" ? "none" : "block";
  });
  
  // Close column toggles when clicking outside
  document.addEventListener("click", (e) => {
    if (
      ordersColumnToggles &&
      ordersToggleColumnsBtn &&
      !ordersColumnToggles.contains(e.target) &&
      !ordersToggleColumnsBtn.contains(e.target)
    ) {
      ordersColumnToggles.style.display = "none";
    }
  });
  
  // Handle column toggle checkboxes
  ordersColumnToggles
    ?.querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const col = checkbox.getAttribute("data-column");
        const show = checkbox.checked;
        
        // Store the preference in localStorage
        const columnPreferences = JSON.parse(localStorage.getItem("orderColumnPreferences") || "{}");
        columnPreferences[col] = show;
        localStorage.setItem("orderColumnPreferences", JSON.stringify(columnPreferences));
        
        // Apply the column visibility to the list items
        applyColumnVisibility(col, show);
      });
    });
    
  // Function to apply column visibility
  function applyColumnVisibility(col, show) {
    const ordersList = document.getElementById("orders-list");
    if (!ordersList) return;
    
    switch (col) {
      case "order_id":
        ordersList.querySelectorAll(".order-id").forEach(el => {
          el.style.display = show ? "block" : "none";
        });
        break;
      case "customer":
        ordersList.querySelectorAll(".order-customer").forEach(el => {
          el.style.display = show ? "block" : "none";
        });
        break;
      case "date":
        ordersList.querySelectorAll(".order-date").forEach(el => {
          el.style.display = show ? "block" : "none";
        });
        break;
      case "total":
        ordersList.querySelectorAll(".order-total").forEach(el => {
          el.style.display = show ? "block" : "none";
        });
        break;
      case "status":
        ordersList.querySelectorAll(".order-status").forEach(el => {
          el.style.display = show ? "inline-flex" : "none";
        });
        break;
      case "payment":
        ordersList.querySelectorAll(".payment-status").forEach(el => {
          el.style.display = show ? "inline-flex" : "none";
        });
        break;
      case "items":
        ordersList.querySelectorAll(".order-items-list").forEach(el => {
          el.style.display = show ? "flex" : "none";
        });
        break;
      case "images":
        ordersList.querySelectorAll(".order-images").forEach(el => {
          el.style.display = show ? "flex" : "none";
        });
        break;
      case "actions":
        ordersList.querySelectorAll(".order-actions").forEach(el => {
          el.style.display = show ? "flex" : "none";
        });
        break;
    }
  }
  
  // Load and apply saved column preferences
  function loadColumnPreferences() {
    const columnPreferences = JSON.parse(localStorage.getItem("orderColumnPreferences") || "{}");
    
    // Update checkboxes based on saved preferences
    ordersColumnToggles?.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      const col = checkbox.getAttribute("data-column");
      if (columnPreferences[col] !== undefined) {
        checkbox.checked = columnPreferences[col];
        applyColumnVisibility(col, columnPreferences[col]);
      }
    });
  }
  
  // Load column preferences when page loads
  loadColumnPreferences();

  // Show/hide modals
  function showAdminOrderDetails(order) {
    const modal = document.getElementById("order-details-modal");
    const content = document.getElementById("order-details-content");
    content.innerHTML = `
    <div class="order-details-section">
      <h3>Order Info</h3>
      <div class="order-details-grid">
        <div class="order-detail-item"><span class="order-detail-label">Order ID:</span> <span class="order-detail-value">${
          order.order_reference || order.id
        }</span></div>
        <div class="order-detail-item"><span class="order-detail-label">Date:</span> <span class="order-detail-value">${new Date(
          order.created_at
        ).toLocaleString()}</span></div>
        <div class="order-detail-item"><span class="order-detail-label">Status:</span> <span class="order-detail-value">${
          order.status
        }</span></div>
        <div class="order-detail-item"><span class="order-detail-label">Payment Status:</span> <span class="order-detail-value">${
          order.payment_status
        }</span></div>
        <div class="order-detail-item"><span class="order-detail-label">Total:</span> <span class="order-detail-value">NPR ${parseFloat(
          order.total_amount
        ).toFixed(2)}</span></div>
      </div>
    </div>
    <div class="order-details-section">
      <h3>Customer Info</h3>
      <div class="order-details-grid">
        <div class="order-detail-item"><span class="order-detail-label">Name:</span> <span class="order-detail-value">${
          order.customer_name || "-"
        }</span></div>
        <div class="order-detail-item"><span class="order-detail-label">Email:</span> <span class="order-detail-value">${
          order.customer_email || "-"
        }</span></div>
      </div>
    </div>
    <div class="order-details-section">
      <h3>Shipping Info</h3>
      <div class="order-shipping-info">
        ${
          order.shipping
            ? Object.entries(order.shipping)
                .map(
                  ([k, v]) => `<div><b>${k.replace(/_/g, " ")}:</b> ${v}</div>`
                )
                .join("")
            : "No shipping info."
        }
      </div>
    </div>
    <div class="order-details-section">
      <h3>Items</h3>
      <table class="order-items-table">
        <thead><tr><th>Name</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>
          ${
            order.items && order.items.length > 0
              ? order.items
                  .map(
                    (item) =>
                      `<tr><td>${item.item_name}</td><td>${
                        item.quantity
                      }</td><td>NPR ${parseFloat(item.price).toFixed(
                        2
                      )}</td></tr>`
                  )
                  .join("")
              : '<tr><td colspan="3">No items</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;
    // Add Download Invoice button to modal footer
    const modalFooter = modal.querySelector(".action-modal-footer");
    if (modalFooter && !modalFooter.querySelector(".download-invoice-btn")) {
      const downloadBtn = document.createElement("button");
      downloadBtn.className = "btn btn-primary download-invoice-btn";
      downloadBtn.innerHTML =
        '<i class="fas fa-file-invoice"></i> <span>Download Invoice</span>';
      downloadBtn.onclick = async function () {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML =
          '<span class="loading-spinner"></span><span>Downloading...</span>';
        try {
          const res = await fetch(
            `/api/orders/admin/orders/${order.id}/invoice`,
            {
              method: "GET",
              headers: { "X-CSRF-Token": `bearer ${window.csrfToken}`,
             },
              credentials: "include",
            }
          );

        
     
      
        
          if (!res.ok){
            showToast("Failed to download invoice", TOAST_TYPES.ERROR);
            return
          }
          // Try to get filename from header
          let filename = `invoice-${order.order_reference || order.id}.json`;
          const disposition = res.headers.get("Content-Disposition");
          if (disposition && disposition.indexOf("filename=") !== -1) {
            filename = disposition
              .split("filename=")[1]
              .replace(/"/g, "")
              .trim();
          }
          // Try to detect PDF or JSON
          const contentType = res.headers.get("Content-Type");
          if (contentType && contentType.includes("application/pdf")) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename.replace(/\.json$/, ".pdf");
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              window.URL.revokeObjectURL(url);
              a.remove();
            }, 100);
          } else {
            // Assume JSON
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], {
              type: "application/json",
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              window.URL.revokeObjectURL(url);
              a.remove();
            }, 100);
          }
        } catch (err) {
     
          showToast("Failed to download invoice", TOAST_TYPES.ERROR);
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.innerHTML =
            '<i class="fas fa-file-invoice"></i> <span>Download Invoice</span>';
        }
      };
      modalFooter.insertBefore(downloadBtn, modalFooter.firstChild);
    }
    modal.classList.add("show");
    modal.style.display = "flex";
  }
  window.closeOrderDetailsModal = function () {
    const modal = document.getElementById("order-details-modal");
    modal.classList.remove("show");
    modal.style.display = "none";
  };

  function showAdminOrderStatusModal(order) {
    const modal = document.getElementById("order-status-modal");
    document.getElementById("status-order-id").value = order.id;
    document.getElementById("order-status").value = order.status;
    document.getElementById("payment-status").value = order.payment_status;
    modal.classList.add("show");
    modal.style.display = "flex";
  }
  window.closeOrderStatusModal = function () {
    const modal = document.getElementById("order-status-modal");
    modal.classList.remove("show");
    modal.style.display = "none";
  };
  document
    .getElementById("update-order-status-btn")
    ?.addEventListener("click", async () => {
      const orderId = document.getElementById("status-order-id").value;
      const status = document.getElementById("order-status").value;
      const payment_status = document.getElementById("payment-status").value;
      try {
        const res = await fetch(`/api/orders/admin/orders/${orderId}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${window.csrfToken}`,
          },
          credentials: "include",
          body: JSON.stringify({ status, payment_status }),
        });
        const data = await res.json();
        if (data.status === "error") {
          showToast(data.message, TOAST_TYPES.ERROR);
          return;
        }

        if (!data.success)
          throw new Error(data.message || "Failed to update status");
        showToast("Order status updated", TOAST_TYPES.SUCCESS);
        fetchAdminOrders();

        // Update dashboard stats if we're on the dashboard page
        const currentPage = sessionStorage.getItem(ACTIVE_PAGE_KEY);
        if (currentPage === "dashboard") {
          fetchOrderStats();
        }

        closeOrderStatusModal();
      } catch (err) {
        showToast(err.message || "Failed to update status", TOAST_TYPES.ERROR);
      }
    });

  function showAdminOrderDeleteModal(order) {
    const modal = document.getElementById("order-delete-modal");
    document.getElementById("delete-order-id").textContent =
      order.order_reference || order.id;
    modal.classList.add("show");
    modal.style.display = "flex";
    document.getElementById("confirm-delete-order-btn").onclick =
      async function () {
        try {
          const res = await fetch(`/api/orders/admin/orders/${order.id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": `bearer ${window.csrfToken}`,
            },
            credentials: "include",
          });
          const data = await res.json();

          if (!data.success)
            throw new Error(data.message || "Failed to delete order");
          showToast("Order deleted", TOAST_TYPES.SUCCESS);
          fetchAdminOrders();

          // Update dashboard stats if we're on the dashboard page
          const currentPage = sessionStorage.getItem(ACTIVE_PAGE_KEY);
          if (currentPage === "dashboard") {
            fetchOrderStats();
          }

          closeOrderDeleteModal();
        } catch (err) {
          showToast(err.message || "Failed to delete order", TOAST_TYPES.ERROR);
        }
      };
  }
  window.closeOrderDeleteModal = function () {
    const modal = document.getElementById("order-delete-modal");
    modal.classList.remove("show");
    modal.style.display = "none";
  };

  function showAdminOrderPaymentProof(order) {
    const modal = document.getElementById("payment-proof-modal");
    const content = document.getElementById("payment-proof-content");
    if (order.payment_proof && order.payment_proof.length > 0) {
      content.innerHTML = `<div class="payment-proof-gallery">${order.payment_proof
        .map(
          (proof) =>
            `<div class="payment-proof-item"><img src="${
              proof.file_url
            }" class="payment-proof-image"><div class="payment-proof-caption">${
              proof.file_name || "Proof"
            }</div></div>`
        )
        .join("")}</div>`;
    } else {
      content.innerHTML = "<p>No payment proof uploaded.</p>";
    }
    modal.classList.add("show");
    modal.style.display = "flex";
  }
  window.closePaymentProofModal = function () {
    const modal = document.getElementById("payment-proof-modal");
    modal.classList.remove("show");
    modal.style.display = "none";
  };

  // Show orders page when nav is clicked
  const ordersNavItem = document.querySelector('.nav-item[data-page="orders"]');
  ordersNavItem?.addEventListener("click", () => {
    fetchAdminOrders();
  });

  // If page loaded directly on orders, fetch orders
  if (sessionStorage.getItem(ACTIVE_PAGE_KEY) === "orders") {
    fetchAdminOrders();
  }

  // ========================================
  // ACTIVE SUBSCRIPTIONS MANAGEMENT
  // ========================================

  // Elements
  const activeSubscriptionsPageElement = document.getElementById(
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
  const activeSubscriptionsToggleColumnsBtn = document.getElementById(
    "active-subscriptions-toggle-columns-btn"
  );
  const activeSubscriptionsColumnToggles = document.getElementById(
    "active-subscriptions-column-toggles"
  );
  const createActiveSubscriptionBtn = document.getElementById(
    "create-active-subscription-btn"
  );

  // Modals
  const activeSubscriptionModal = document.getElementById(
    "active-subscription-modal"
  );
  const activeSubscriptionModalTitle = document.getElementById(
    "active-subscription-modal-title"
  );
  const activeSubscriptionForm = document.getElementById(
    "active-subscription-form"
  );
  const activeSubscriptionId = document.getElementById(
    "active-subscription-id"
  );
  const activeSubscriptionUser = document.getElementById(
    "active-subscription-user"
  );
  const activeSubscriptionPlan = document.getElementById(
    "active-subscription-plan"
  );
  const activeSubscriptionStartDate = document.getElementById(
    "active-subscription-start-date"
  );
  const activeSubscriptionEndDate = document.getElementById(
    "active-subscription-end-date"
  );
  const activeSubscriptionStatus = document.getElementById(
    "active-subscription-status"
  );
  const activeSubscriptionAutoRenew = document.getElementById(
    "active-subscription-auto-renew"
  );
  const activeSubscriptionEmail = document.getElementById(
    "active-subscription-email"
  );
  const activeSubscriptionPassword = document.getElementById(
    "active-subscription-password"
  );
  const activeSubscriptionPin = document.getElementById(
    "active-subscription-pin"
  );
  const activeSubscriptionNotes = document.getElementById(
    "active-subscription-notes"
  );
  const closeActiveSubscriptionModalBtn = document.getElementById(
    "close-active-subscription-modal-btn"
  );
  const cancelActiveSubscriptionBtn = document.getElementById(
    "cancel-active-subscription-btn"
  );
  const saveActiveSubscriptionBtn = document.getElementById(
    "save-active-subscription-btn"
  );

  // View Credentials Modal
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

  // Delete Subscription Modal
  const deleteSubscriptionModal = document.getElementById(
    "delete-subscription-modal"
  );
  const closeDeleteSubscriptionModalBtn = document.getElementById(
    "close-delete-subscription-modal-btn"
  );
  const cancelDeleteSubscriptionBtn = document.getElementById(
    "cancel-delete-subscription-btn"
  );
  const confirmDeleteSubscriptionBtn = document.getElementById(
    "confirm-delete-subscription-btn"
  );
  const deleteSubscriptionUsername = document.getElementById(
    "delete-subscription-username"
  );
  const deleteSubscriptionName = document.getElementById(
    "delete-subscription-name"
  );

  // Variables
  let allActiveSubscriptions = [];
  let filteredActiveSubscriptions = [];
  let activeSubscriptionsCurrentPage = 1;
  const ACTIVE_SUBSCRIPTIONS_PER_PAGE = 10;
  let currentSubscriptionId = null;
  let allAvailableUsers = [];

  // Show loading overlay for active subscriptions
  const activeSubscriptionsLoadingOverlay = document.getElementById(
    "active-subscriptions-loading-overlay"
  );

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

  // Format date for display
  function formatSubscriptionDate(dateString) {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Fetch active subscriptions
  async function fetchActiveSubscriptions() {
    try {
      showActiveSubscriptionsLoadingOverlay();

      const res = await fetch("/api/process/active-subscriptions", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
      });

      const data = await res.json();

      if (data.status === "error") {
        showToast(data.message, TOAST_TYPES.ERROR);
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
          <td colspan="9" class="error-row">
            Failed to load subscriptions. Please try again later.
          </td>
        </tr>
      `;
    }
  }

  // Apply filters and search to active subscriptions
  function applyActiveSubscriptionsFilters() {
    showActiveSubscriptionsLoadingOverlay();
    setTimeout(() => {
      const search = activeSubscriptionsSearchInput?.value?.toLowerCase() || "";
      const status = activeSubscriptionsStatusFilter?.value || "";
      const dateFilter = activeSubscriptionsDateFilter?.value || "";

      filteredActiveSubscriptions = allActiveSubscriptions.filter(
        (subscription) => {
          // Search filter
          const matchesSearch =
            !search ||
            (subscription.username &&
              subscription.username.toLowerCase().includes(search)) ||
            (subscription.user_email &&
              subscription.user_email.toLowerCase().includes(search)) ||
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

  // Render active subscriptions table
  function renderActiveSubscriptionsTable() {
    const start =
      (activeSubscriptionsCurrentPage - 1) * ACTIVE_SUBSCRIPTIONS_PER_PAGE;
    const end = Math.min(
      start + ACTIVE_SUBSCRIPTIONS_PER_PAGE,
      filteredActiveSubscriptions.length
    );
    const pageSubscriptions = filteredActiveSubscriptions.slice(start, end);

    // Update pagination info
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
          <td colspan="9" class="error-row">
            No subscriptions found.
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
          <td class="col-username">${subscription.username}</td>
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
              <button class="btn-action edit" title="Edit Subscription" data-action="edit" data-id="${subscription.id}">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-action danger" title="Delete Subscription" data-action="delete" data-id="${subscription.id}">
                <i class="fas fa-trash-alt"></i>
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
  }

  // Handle active subscription actions (view, edit, delete)
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
    } else if (action === "edit") {
      showEditSubscriptionModal(subscription);
    } else if (action === "delete") {
      showDeleteSubscriptionModal(subscription);
    }
  }

  // Show credentials modal
  function showCredentialsModal(subscription) {
    credentialEmail.textContent =
      subscription.subscription_email || "Not provided";
    credentialPassword.textContent =
      subscription.subscription_password || "Not provided";
    credentialPassword.classList.add("password-hidden");
    credentialPin.textContent = subscription.subscription_pin || "Not provided";
    credentialNotes.textContent = subscription.notes || "No notes";

    viewCredentialsModal.classList.add("show");
    viewCredentialsModal.style.display = "flex";
  }

  // Toggle password visibility
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

  // Close credentials modal
  closeCredentialsModalBtn.addEventListener("click", closeCredentialsModal);
  closeViewCredentialsBtn.addEventListener("click", closeCredentialsModal);

  function closeCredentialsModal() {
    viewCredentialsModal.classList.remove("show");
    viewCredentialsModal.style.display = "none";
  }

  // Show create subscription modal
  function showCreateSubscriptionModal() {
    // Reset form
    activeSubscriptionForm.reset();
    activeSubscriptionId.value = "";

    // Update title
    activeSubscriptionModalTitle.innerHTML =
      '<i class="fas fa-id-card"></i> Create Active Subscription';

    // Set default dates
    const today = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(today.getMonth() + 1);

    activeSubscriptionStartDate.value = today.toISOString().split("T")[0];
    activeSubscriptionEndDate.value = oneMonthLater.toISOString().split("T")[0];

    // Load users and plans
    loadUsersAndPlans();

    // Show modal
    activeSubscriptionModal.classList.add("show");
    activeSubscriptionModal.style.display = "flex";
  }

  // Show edit subscription modal
  async function showEditSubscriptionModal(subscription) {
    // Set form values
    activeSubscriptionId.value = subscription.id;

    // Update title
    activeSubscriptionModalTitle.innerHTML =
      '<i class="fas fa-edit"></i> Edit Active Subscription';

    // Load users and plans
    await loadUsersAndPlans();

    // Set values
    activeSubscriptionUser.value = subscription.user_id;
    activeSubscriptionPlan.value = subscription.subscription_plan_id;
    activeSubscriptionStartDate.value = subscription.start_date.split("T")[0];
    activeSubscriptionEndDate.value = subscription.end_date.split("T")[0];
    activeSubscriptionStatus.value = subscription.status;
    activeSubscriptionAutoRenew.checked = subscription.auto_renew === 1;
    activeSubscriptionEmail.value = subscription.subscription_email || "";
    activeSubscriptionPassword.value = subscription.subscription_password || "";
    activeSubscriptionPin.value = subscription.subscription_pin || "";
    activeSubscriptionNotes.value = subscription.notes || "";

    // Show modal
    activeSubscriptionModal.classList.add("show");
    activeSubscriptionModal.style.display = "flex";
  }

  // Load users and plans for the subscription form
  async function loadUsersAndPlans() {
    try {
      // Load users
      const usersRes = await fetch("/api/process/available-users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
      });

      const usersData = await usersRes.json();

      if (usersData.status === "success" && usersData.data) {
        allAvailableUsers = usersData.data;
        renderUserOptions("");
      }

      // Load subscription plans
      const plansRes = await fetch(
        "/api/process/available-subscription-plans",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${window.csrfToken}`,
          },
          credentials: "include",
        }
      );

      const plansData = await plansRes.json();

      if (plansData.status === "error") {
        showToast(plansData.message, TOAST_TYPES.ERROR);
        return;
      }

      if (plansData.status === "success" && plansData.data) {
        // Group plans by subscription
        const subscriptionPlans = {};

        plansData.data.forEach((plan) => {
          if (!subscriptionPlans[plan.subscription_name]) {
            subscriptionPlans[plan.subscription_name] = [];
          }
          subscriptionPlans[plan.subscription_name].push(plan);
        });

        // Create option groups
        activeSubscriptionPlan.innerHTML = `
          <option value="">Select Plan</option>
          ${Object.keys(subscriptionPlans)
            .map(
              (subscriptionName) => `
            <optgroup label="${subscriptionName}">
              ${subscriptionPlans[subscriptionName]
                .map(
                  (plan) => `
                <option value="${plan.id}">${plan.plan_name} (${plan.price} ${plan.currency})</option>
              `
                )
                .join("")}
            </optgroup>
          `
            )
            .join("")}
        `;
      }
    } catch (error) {
      console.error("Error loading users and plans:", error);
      showToast("Failed to load users and plans", TOAST_TYPES.ERROR);
    }
  }

  // Close subscription modal
  closeActiveSubscriptionModalBtn.addEventListener(
    "click",
    closeActiveSubscriptionModal
  );
  cancelActiveSubscriptionBtn.addEventListener(
    "click",
    closeActiveSubscriptionModal
  );

  function closeActiveSubscriptionModal() {
    activeSubscriptionModal.classList.remove("show");
    activeSubscriptionModal.style.display = "none";
  }

  // Save subscription
  saveActiveSubscriptionBtn.addEventListener("click", async () => {
    // Validate form
    if (!activeSubscriptionForm.checkValidity()) {
      activeSubscriptionForm.reportValidity();
      return;
    }

    // Get form data
    const formData = {
      user_id: activeSubscriptionUser.value,
      subscription_plan_id: activeSubscriptionPlan.value,
      start_date: activeSubscriptionStartDate.value,
      end_date: activeSubscriptionEndDate.value,
      status: activeSubscriptionStatus.value,
      auto_renew: activeSubscriptionAutoRenew.checked,
      subscription_email: activeSubscriptionEmail.value,
      subscription_password: activeSubscriptionPassword.value,
      subscription_pin: activeSubscriptionPin.value,
      notes: activeSubscriptionNotes.value,
    };

    try {
      saveActiveSubscriptionBtn.disabled = true;
      saveActiveSubscriptionBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Saving...';

      let url, method;

      if (activeSubscriptionId.value) {
        // Update existing subscription
        url = `/api/process/active-subscriptions/${activeSubscriptionId.value}`;
        method = "PUT";
      } else {
        // Create new subscription
        url = "/api/process/active-subscriptions";
        method = "POST";
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.status === "error") {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }

      if (!data.status || data.status !== "success") {
        throw new Error(data.message || "Failed to save subscription");
      }

      showToast(
        activeSubscriptionId.value
          ? "Subscription updated successfully"
          : "Subscription created successfully",
        TOAST_TYPES.SUCCESS
      );

      closeActiveSubscriptionModal();
      fetchActiveSubscriptions();
    } catch (error) {
      console.error("Error saving subscription:", error);
      showToast(
        error.message || "Failed to save subscription",
        TOAST_TYPES.ERROR
      );
    } finally {
      saveActiveSubscriptionBtn.disabled = false;
      saveActiveSubscriptionBtn.innerHTML =
        '<i class="fas fa-save"></i> Save Subscription';
    }
  });

  // Show delete subscription modal
  function showDeleteSubscriptionModal(subscription) {
    deleteSubscriptionUsername.textContent = subscription.username;
    deleteSubscriptionName.textContent = `${subscription.subscription_name} - ${subscription.plan_name}`;
    currentSubscriptionId = subscription.id;

    deleteSubscriptionModal.classList.add("show");
    deleteSubscriptionModal.style.display = "flex";
  }

  // Close delete subscription modal
  closeDeleteSubscriptionModalBtn.addEventListener(
    "click",
    closeDeleteSubscriptionModal
  );
  cancelDeleteSubscriptionBtn.addEventListener(
    "click",
    closeDeleteSubscriptionModal
  );

  function closeDeleteSubscriptionModal() {
    deleteSubscriptionModal.classList.remove("show");
    deleteSubscriptionModal.style.display = "none";
    currentSubscriptionId = null;
  }

  // Delete subscription
  confirmDeleteSubscriptionBtn.addEventListener("click", async () => {
    if (!currentSubscriptionId) return;

    try {
      confirmDeleteSubscriptionBtn.disabled = true;
      confirmDeleteSubscriptionBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Deleting...';

      const res = await fetch(
        `/api/process/active-subscriptions/${currentSubscriptionId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${window.csrfToken}`,
          },
          credentials: "include",
        }
      );

      const data = await res.json();

      if (data.status === "error") {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }

      if (!data.status || data.status !== "success") {
        throw new Error(data.message || "Failed to delete subscription");
      }

      showToast("Subscription deleted successfully", TOAST_TYPES.SUCCESS);
      closeDeleteSubscriptionModal();
      fetchActiveSubscriptions();
    } catch (error) {
      console.error("Error deleting subscription:", error);
      showToast(
        error.message || "Failed to delete subscription",
        TOAST_TYPES.ERROR
      );
    } finally {
      confirmDeleteSubscriptionBtn.disabled = false;
      confirmDeleteSubscriptionBtn.innerHTML =
        '<i class="fas fa-trash-alt"></i> Delete Subscription';
    }
  });

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
  createActiveSubscriptionBtn?.addEventListener(
    "click",
    showCreateSubscriptionModal
  );

  // Pagination
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

  // Column toggling
  activeSubscriptionsToggleColumnsBtn?.addEventListener("click", () => {
    activeSubscriptionsColumnToggles.style.display =
      activeSubscriptionsColumnToggles.style.display === "block"
        ? "none"
        : "block";
  });

  activeSubscriptionsColumnToggles
    ?.querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const col = checkbox.getAttribute("data-column");
        const show = checkbox.checked;

        document.querySelectorAll(`.col-${col}`).forEach((cell) => {
          cell.style.display = show ? "" : "none";
        });
      });
    });

  // Show active subscriptions page when nav is clicked
  const activeSubscriptionsNavItem = document.querySelector(
    '.nav-item[data-page="activeSubscriptions"]'
  );
  activeSubscriptionsNavItem?.addEventListener("click", () => {
    fetchActiveSubscriptions();
  });

  // If page loaded directly on active subscriptions, fetch subscriptions
  if (sessionStorage.getItem(ACTIVE_PAGE_KEY) === "activeSubscriptions") {
    fetchActiveSubscriptions();
  }

  function renderUserOptions(searchTerm) {
    const filtered = !searchTerm
      ? allAvailableUsers
      : allAvailableUsers.filter(
          (user) =>
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    activeSubscriptionUser.innerHTML = `
      <option value="">Select User</option>
      ${filtered
        .map(
          (user) => `
        <option value="${user.id}">${user.username} (${user.email})</option>
      `
        )
        .join("")}
    `;
  }

  const userSearchInput = document.getElementById("user-search-input");
  userSearchInput?.addEventListener("input", (e) => {
    renderUserOptions(e.target.value);
  });

  // --- Support Section Logic ---

  const supportLink = document.getElementById("supportLink");
  const supportPage = document.getElementById("supportPage");
  const supportTableBody = document.getElementById("supportTableBody");
  const supportStatusFilter = document.getElementById("support-status-filter");
  const supportDateFilter = document.getElementById("support-date-filter");
  const supportSearchInput = document.getElementById("support-search-input");

  // Modals
  const supportViewModal = document.getElementById("support-view-modal");
  const supportStatusModal = document.getElementById("support-status-modal");
  const supportDeleteModal = document.getElementById("support-delete-modal");
  const supportReplyModal = document.getElementById("support-reply-modal");

  // Modal fields
  const supportViewUsername = document.getElementById("support-view-username");
  const supportViewEmail = document.getElementById("support-view-email");
  const supportViewSubject = document.getElementById("support-view-subject");
  const supportViewDate = document.getElementById("support-view-date");
  const supportViewMessage = document.getElementById("support-view-message");

  const supportStatusTicketId = document.getElementById(
    "support-status-ticket-id"
  );
  const supportStatusSelect = document.getElementById("support-status-select");

  const deleteSupportUsername = document.getElementById(
    "delete-support-username"
  );
  const deleteSupportSubject = document.getElementById(
    "delete-support-subject"
  );

  const supportReplyTicketId = document.getElementById(
    "support-reply-ticket-id"
  );
  const supportReplyMessage = document.getElementById("support-reply-message");

  // Modal close buttons
  const closeSupportViewModal = document.getElementById(
    "close-support-view-modal"
  );
  const closeSupportViewBtn = document.getElementById("close-support-view-btn");
  const closeSupportStatusModal = document.getElementById(
    "close-support-status-modal"
  );
  const cancelSupportStatusBtn = document.getElementById(
    "cancel-support-status-btn"
  );
  const closeSupportDeleteModal = document.getElementById(
    "close-support-delete-modal"
  );
  const cancelDeleteSupportBtn = document.getElementById(
    "cancel-delete-support-btn"
  );
  const closeSupportReplyModal = document.getElementById(
    "close-support-reply-modal"
  );
  const cancelSupportReplyBtn = document.getElementById(
    "cancel-support-reply-btn"
  );

  // Action buttons
  const saveSupportStatusBtn = document.getElementById(
    "save-support-status-btn"
  );
  const confirmDeleteSupportBtn = document.getElementById(
    "confirm-delete-support-btn"
  );
  const sendSupportReplyBtn = document.getElementById("send-support-reply-btn");

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
    const status = supportStatusFilter.value;
    const date = supportDateFilter.value;
    const q = supportSearchInput.value.trim();
    let url = `/api/support/support-tickets?`;
    if (status) url += `status=${encodeURIComponent(status)}&`;
    if (date) url += `date=${encodeURIComponent(date)}&`;
    if (q) url += `q=${encodeURIComponent(q)}&`;
    try {
      const res = await fetch(url, {
        headers: {
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
      });
      supportTickets = await res.json();

      if (supportTickets.status === "error") {
        showToast(supportTickets.message, TOAST_TYPES.ERROR);
        return;
      }

      // Update the support badge counter
      updateSupportBadgeCount(supportTickets);

      renderSupportTable();
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
    if (supportBadge) {
      supportBadge.textContent = needAttentionCount;
      support2.textContent = needAttentionCount;
      // Show/hide badge based on count
      supportBadge.style.display = needAttentionCount > 0 ? "flex" : "none";
      support2.style.display = needAttentionCount > 0 ? "flex" : "none";
    }

    // Also update the dashboard support tickets card if we're on the dashboard
    if (document.getElementById("dashboardPage").classList.contains("active")) {
      loadDashboardSupportTickets(tickets);
    }
  }

  // Function to show skeleton loading for dashboard support tickets
  function showDashboardSupportTicketsSkeleton() {
    const supportTicketsContainer = document.getElementById(
      "dashboard-support-tickets"
    );
    if (!supportTicketsContainer) return;

    let skeletonHTML = "";
    for (let i = 0; i < 3; i++) {
      skeletonHTML += `
        <div class="activity-skeleton" style="display: flex; padding: 12px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
          <div class="skeleton-text" style="flex: 1;">
            <div class="skeleton-line medium" style="margin-bottom: 6px;"></div>
            <div class="skeleton-line short" style="margin-bottom: 4px;"></div>
          </div>
          <div class="skeleton-badge" style="width: 60px; height: 24px; border-radius: 12px;"></div>
        </div>
      `;
    }
    supportTicketsContainer.innerHTML = skeletonHTML;
  }

  // Function to load and display support tickets in the dashboard
  async function loadDashboardSupportTickets(existingTickets = null) {
    const supportTicketsContainer = document.getElementById(
      "dashboard-support-tickets"
    );
    if (!supportTicketsContainer) return;

    try {
      // Show skeleton loading
      showDashboardSupportTicketsSkeleton();

      // Use existing tickets if provided, otherwise fetch them
      let tickets = existingTickets;

      if (!tickets) {
        try {
          const res = await fetch("/api/support/support-tickets", {
            headers: {
              "X-CSRF-Token": `bearer ${window.csrfToken}`,
            },
            credentials: "include",
          });
          tickets = await res.json();
          if (tickets.status === "error") {
            supportTicketsContainer.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-exclamation-circle"></i>
              <h3>Failed to load tickets</h3>
              <p>There was an error loading support tickets.</p>
            </div>
          `;
            showToast(tickets.message, TOAST_TYPES.ERROR);
            return;
          }
        } catch (error) {
          console.error("Error fetching support tickets for dashboard:", error);
          supportTicketsContainer.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-exclamation-circle"></i>
              <h3>Failed to load tickets</h3>
              <p>There was an error loading support tickets.</p>
            </div>
          `;
          return;
        }
      }

      // If no tickets or empty array
      if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
        supportTicketsContainer.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-headset"></i>
            <h3>No support tickets</h3>
            <p>Support tickets will appear here when customers need assistance.</p>
          </div>
        `;
        return;
      }

      // Get the 3 most recent tickets
      const recentTickets = tickets
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3);

      // Render tickets
      const ticketsHTML = recentTickets
        .map((ticket) => {
          // Determine status badge class
          let statusClass = "";
          switch (ticket.status) {
            case "open":
              statusClass = "status-badge status-enabled";
              break;
            case "pending":
              statusClass = "status-badge status-pending";
              break;
            case "resolved":
              statusClass = "status-badge status-resolved";
              break;
            case "closed":
              statusClass = "status-badge status-disabled";
              break;
            default:
              statusClass = "status-badge";
          }

          // Format date
          const ticketDate = new Date(ticket.created_at);
          const formattedDate = ticketDate.toLocaleDateString();

          // Truncate message if too long
          const shortMessage =
            ticket.message.length > 80
              ? ticket.message.substring(0, 80) + "..."
              : ticket.message;

          return `
          <div class="support-ticket-item" style="padding: 12px; border-bottom: 1px solid #f1f5f9;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <div style="font-weight: 500;">${ticket.subject}</div>
              <span class="${statusClass}" style="font-size: 11px; padding: 2px 8px;">
                ${
                  ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)
                }
              </span>
            </div>
            <div style="font-size: 13px; color: #64748b; margin-bottom: 6px;">
              ${shortMessage}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8;">
              <span>From: ${ticket.username}</span>
              <span>${formattedDate}</span>
            </div>
          </div>
        `;
        })
        .join("");

      supportTicketsContainer.innerHTML = ticketsHTML;
    } catch (error) {
      console.error("Error in loadDashboardSupportTickets:", error);
      supportTicketsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <h3>Failed to load tickets</h3>
          <p>There was an error loading support tickets.</p>
        </div>
      `;
    }
  }

  // Call this function when the page loads
  document.addEventListener("DOMContentLoaded", () => {
    // Only load support tickets if we're on the dashboard page
    if (document.getElementById("dashboardPage").classList.contains("active")) {
      loadDashboardSupportTickets();
    }
  });

  fetchSupportTickets();

  function renderSupportTable() {
    if (!supportTickets.length) {
      supportTableBody.innerHTML = `<tr><td colspan="5">No support tickets found</td></tr>`;
      return;
    }
    supportTableBody.innerHTML = "";
    supportTickets.forEach((ticket) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ticket.username}</td>
        <td>${ticket.subject}</td>
        <td><span class="status-badge status-${ticket.status}">${
        ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)
      }</span></td>
        <td>${
          ticket.message.length > 60
            ? ticket.message.slice(0, 60) + "..."
            : ticket.message
        }</td>
        <td class="action-buttons">
          <button class="btn-action" title="View" data-action="view" data-id="${
            ticket.id
          }"><i class="fas fa-eye"></i></button>
          <button class="btn-action" title="Change Status" data-action="status" data-id="${
            ticket.id
          }"><i class="fas fa-exchange-alt"></i></button>
          <button class="btn-action" title="Reply" data-action="reply" data-id="${
            ticket.id
          }"><i class="fas fa-reply"></i></button>
          <button class="btn-action" title="Delete" data-action="delete" data-id="${
            ticket.id
          }"><i class="fas fa-trash-alt"></i></button>
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
    const action = btn.getAttribute("data-action");
    const ticket = supportTickets.find((t) => t.id == id);
    if (!ticket) return;
    selectedSupportTicket = ticket;
    if (action === "view") showSupportViewModal(ticket);
    if (action === "status") showSupportStatusModal(ticket);
    if (action === "delete") showSupportDeleteModal(ticket);
    if (action === "reply") showSupportReplyModal(ticket);
  });

  // Modal open/close logic
  function showSupportViewModal(ticket) {
    supportViewUsername.textContent = ticket.username;
    supportViewEmail.textContent = ticket.email;
    supportViewSubject.textContent = ticket.subject;
    supportViewDate.textContent = new Date(ticket.created_at).toLocaleString();
    supportViewMessage.textContent = ticket.message;
    supportViewModal.classList.add("show");
    supportViewModal.style.display = "flex";
  }
  function closeSupportView() {
    supportViewModal.classList.remove("show");
    supportViewModal.style.display = "none";
  }
  closeSupportViewModal.onclick = closeSupportView;
  closeSupportViewBtn.onclick = closeSupportView;

  function showSupportStatusModal(ticket) {
    supportStatusTicketId.value = ticket.id;
    supportStatusSelect.value = ticket.status;
    supportStatusModal.classList.add("show");
    supportStatusModal.style.display = "flex";
  }
  function closeSupportStatus() {
    supportStatusModal.classList.remove("show");
    supportStatusModal.style.display = "none";
  }
  closeSupportStatusModal.onclick = closeSupportStatus;
  cancelSupportStatusBtn.onclick = closeSupportStatus;

  function showSupportDeleteModal(ticket) {
    deleteSupportUsername.textContent = ticket.username;
    deleteSupportSubject.textContent = ticket.subject;
    supportDeleteModal.classList.add("show");
    supportDeleteModal.style.display = "flex";
  }
  function closeSupportDelete() {
    supportDeleteModal.classList.remove("show");
    supportDeleteModal.style.display = "none";
  }
  closeSupportDeleteModal.onclick = closeSupportDelete;
  cancelDeleteSupportBtn.onclick = closeSupportDelete;

  function showSupportReplyModal(ticket) {
    supportReplyTicketId.value = ticket.id;
    supportReplyMessage.value = "";
    supportReplyModal.classList.add("show");
    supportReplyModal.style.display = "flex";
  }
  function closeSupportReply() {
    supportReplyModal.classList.remove("show");
    supportReplyModal.style.display = "none";
  }
  closeSupportReplyModal.onclick = closeSupportReply;
  cancelSupportReplyBtn.onclick = closeSupportReply;

  // Modal actions
  saveSupportStatusBtn.onclick = async function () {
    const id = supportStatusTicketId.value;
    const status = supportStatusSelect.value;
    try {
      await fetch(`/api/support/support-tickets/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
   
      closeSupportStatus();
      fetchSupportTickets();
      showToast("Status updated successfully", TOAST_TYPES.SUCCESS);
    } catch (err) {
    showToast("Failed to update status", TOAST_TYPES.ERROR);
    }
  };
  confirmDeleteSupportBtn.onclick = async function () {
    const id = selectedSupportTicket.id;
    try {
      await fetch(`/api/support/support-tickets/${id}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
      });
   
      closeSupportDelete();
      fetchSupportTickets();
      showToast("Ticket deleted successfully", TOAST_TYPES.SUCCESS);
    } catch (err) {
      showToast("Failed to delete ticket", TOAST_TYPES.ERROR);
    }
  };
  sendSupportReplyBtn.onclick = async function () {
    const id = supportReplyTicketId.value;
    const message = supportReplyMessage.value.trim();
    if (!message) return alert("Message required");
    try {
      await fetch(`/api/support/support-tickets/${id}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },

        credentials: "include",
        body: JSON.stringify({ message }),
      });
      
      closeSupportReply();
      fetchSupportTickets();
      showToast("Reply sent successfully", TOAST_TYPES.SUCCESS);
    } catch (err) {
      showToast("Failed to send reply", TOAST_TYPES.ERROR);
    }
  };

  // Chat functionality - Starting from line 3960
  // Chat WebSocket connection and state management
  let chatSocket = null;
  let chatReconnectInterval = null;
  let chatUserId = null;
  let chatUserName = null;
  let activeChat = null;
  let activeCustomer = null;
  const CHAT_RECONNECT_DELAY = 5000; // 5 seconds

  setTimeout(() => {
    chatUserId = window.chatUserId;
    chatUserName = window.chatUserName;
  }, 2000);

  // Initialize chat functionality
  const initAdminChat = () => {
    if (!chatUserId) {
      console.error("Admin ID not found for chat initialization");
      return;
    }

    // DOM elements
    const chatSidebar = document.getElementById("chatSidebar");
    const chatContent = document.getElementById("chatContent");
    const chatList = document.getElementById("chatList");
    const chatMessages = document.getElementById("chatMessages");

    const chatInput = document.getElementById("chatInput");
    const chatSendBtn = document.getElementById("chatSendBtn");
    const chatFileBtn = document.getElementById("chatFileBtn");
    const chatFileInput = document.getElementById("chatFileInput");
    const chatFilePreview = document.getElementById("chatFilePreview");
    const chatRefreshBtn = document.getElementById("chatRefreshBtn");
    const chatBackBtn = document.getElementById("chatBackBtn");
    const chatSearchInput = document.getElementById("chatSearchInput");
    const chatFilters = document.querySelectorAll(".chat-filter");
    const chatInterface = document.getElementById("chatInterface");
    const chatContentEmptyState = document.getElementById(
      "chatContentEmptyState"
    );
    const chatPriorityBtn = document.getElementById("chatPriorityBtn");
    const chatTemplateBtn = document.getElementById("chatTemplateBtn");
    const priorityModal = document.getElementById("priorityModal");
    const templatesModal = document.getElementById("templatesModal");
    const prioritySelect = document.getElementById("prioritySelect");
    const prioritySaveBtn = document.getElementById("prioritySaveBtn");
    const priorityCancelBtn = document.getElementById("priorityCancelBtn");
    const priorityModalClose = document.getElementById("priorityModalClose");
    const templatesModalClose = document.getElementById("templatesModalClose");
    const templatesCancelBtn = document.getElementById("templatesCancelBtn");
    const templateSearchInput = document.getElementById("templateSearchInput");
    const templatesList = document.getElementById("templatesList");
    const chatImageModal = document.getElementById("chatImageModal");
    const chatModalImage = document.getElementById("chatModalImage");
    const chatImageClose = document.getElementById("chatImageClose");
    const chatUserNameElement = document.getElementById("chatUserName");
    const chatUserStatus = document.getElementById("chatUserStatus");
    const chatUserAvatar = document.getElementById("chatUserAvatar");
    const chatUserInfoBtn = document.getElementById("chatUserInfoBtn");

    // Selected file for upload
    let selectedFile = null;

    // Connect to WebSocket
    const connectChatWebSocket = () => {
      // Clear any existing reconnect interval
      if (chatReconnectInterval) {
        clearInterval(chatReconnectInterval);
        chatReconnectInterval = null;
      }
      
      // Close existing socket if open
      if (chatSocket !== null) {
        try {
          if (chatSocket.readyState === WebSocket.OPEN || 
              chatSocket.readyState === WebSocket.CONNECTING) {
            chatSocket.close();
          }
        } catch (e) {
          console.warn("Error closing existing WebSocket:", e);
        }
      }

      // Create WebSocket connection
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/admin/chat/${chatUserId}/`;
      
     
      chatSocket = new WebSocket(wsUrl);

        chatSocket.onopen = () => {
         
          if (chatReconnectInterval) {
            clearInterval(chatReconnectInterval);
            chatReconnectInterval = null;
          }

          // Load chat conversations
          loadChatConversations();

          // Update unread count
          updateChatUnreadCount();
          
          // Update UI to show connected state
          const retryBtn = document.getElementById('retry-chat-connection');
          if (retryBtn) {
            retryBtn.parentNode.innerHTML = `
              <i class="fas fa-check-circle" style="color: var(--success-color); font-size: 2rem; margin-bottom: var(--space-4);"></i>
              <h3>Connected</h3>
              <p>Successfully connected to chat server.</p>
            `;
            setTimeout(() => {
              // Reload conversations after showing success message
              loadChatConversations();
            }, 1000);
          }
        };

      chatSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
       

        if (data.type === "chat_message") {
          // Add message to chat if it's for the active conversation
          if (activeChat === data.message.conversation_id) {
            addMessageToChat(data.message);

            // Mark as read if it's from a customer
            if (data.message.sender_type === "user") {
              markMessageAsRead(data.message.id);
            }
          }

          // Update conversation list
          updateConversationList();

          // Update unread count
          updateChatUnreadCount();
        } else if (data.type === "chat_history") {
          // Display chat history
         
          displayChatHistory(data.messages);
        } else if (data.type === "conversations") {
          // Check if this is a response to the "all" filter
          const isAllFilter = document.querySelector('.chat-filter[data-filter="all"].active') !== null;
          
         
          
          // Display conversations
          displayConversations(data.conversations);
          
          // Store all conversations for client-side filtering
          // This ensures we always have the latest data for filtering
          if (Array.isArray(data.conversations)) {
           
            allChatConversations = [...data.conversations];
          }
        } else if (data.type === "message_read") {
          // Update message read status
          updateMessageReadStatus(data.message_id);
        } else if (data.type === "unread_count") {
          // Update unread count badge
          updateUnreadBadge(data.count);
        } else if (data.type === "filter_error") {
          // Handle filter errors
          console.error("Server filter error:", data.error);
          // Fall back to client-side filtering
          applyClientSideFiltering(data.filter);
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
        console.error("Admin Chat WebSocket error:", error);
      };
    };

    // Load chat conversations
    const loadChatConversations = () => {
      if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(
          JSON.stringify({
            type: "get_conversations",
          })
        );
        return true;
      } else {
        console.warn("WebSocket is not connected. Attempting to reconnect...");
        // Try to reconnect WebSocket
        connectChatWebSocket();
        
        // Show connecting message
        chatList.innerHTML = `
          <div class="chat-loading-state">
            <div class="loading-spinner"></div>
            <p>Connecting to chat server...</p>
          </div>
        `;
        
        // Set a timeout to check if connection was established
        setTimeout(() => {
          if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.send(
              JSON.stringify({
                type: "get_conversations",
              })
            );
          } else {
            // Still not connected, show error
            chatList.innerHTML = `
              <div class="chat-empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Connection Failed</h3>
                <p>Unable to connect to chat server. Please check your connection and try again.</p>
                <button class="btn btn-primary mt-4" id="retry-chat-connection">Retry Connection</button>
              </div>
            `;
            
            // Add event listener to retry button
            const retryBtn = document.getElementById('retry-chat-connection');
            if (retryBtn) {
              retryBtn.addEventListener('click', () => {
                connectChatWebSocket();
                loadChatConversations();
              });
            }
          }
        }, 2000);
        
        return false;
      }
    };

    // Display conversations
    const displayConversations = (conversations) => {
      // Defensive: ensure conversations is always an array
      if (!Array.isArray(conversations)) {
        console.warn(
          "Expected conversations to be an array, got:",
          conversations
        );
        conversations = [];
      }
      
      // Store conversations for client-side filtering
      // Only update the stored conversations if this is not a filtered result
      // or if we don't have any stored conversations yet
      const activeFilter = document.querySelector('.chat-filter.active');
      if (!activeFilter || activeFilter.dataset.filter === 'all' || allChatConversations.length === 0) {
        allChatConversations = [...conversations];
      }
      
      // Clear existing conversations
      chatList.innerHTML = "";

      if (conversations.length === 0) {
        // Show empty state if no conversations
        chatList.innerHTML = `
          <div class="chat-empty-state" id="chatListEmptyState">
            <i class="fas fa-comments"></i>
            <h3>No conversations</h3>
            <p>Customer conversations will appear here.</p>
          </div>
        `;
        // Clear chat view and reset activeChat
        chatMessages.innerHTML = "";
        activeChat = null;
        // Also update badge to 0
        updateUnreadBadge(0);
        return;
      }

      // Sort conversations by last message timestamp (most recent first)
      conversations.sort(
        (a, b) => new Date(b.last_message_time) - new Date(a.last_message_time)
      );

      // Display conversations
      conversations.forEach((conversation) => {
        const lastMessageTime = new Date(conversation.last_message_time);
        const timeString = formatConversationTime(lastMessageTime);

        // Create conversation item
        const conversationItem = document.createElement("li");
        conversationItem.className = `chat-list-item ${
          activeChat === conversation.id ? "active" : ""
        }`;
        conversationItem.dataset.id = conversation.id;
        conversationItem.dataset.customerId = conversation.customer_id;
        conversationItem.dataset.customerName = conversation.customer_name;

        // Determine priority class
        let priorityClass = "";
        if (conversation.priority === "high") {
          priorityClass = "chat-priority high";
        } else if (conversation.priority === "medium") {
          priorityClass = "chat-priority medium";
        } else if (conversation.priority === "low") {
          priorityClass = "chat-priority low";
        }

        // Determine if there are unread messages
        const unreadBadge =
          conversation.unread_count > 0
            ? `<div class="chat-list-badge">${
                conversation.unread_count > 99
                  ? "99+"
                  : conversation.unread_count
              }</div>`
            : "";

        conversationItem.innerHTML = `
          <div class="${priorityClass}"></div>
          <div class="chat-list-avatar">
            <img src="../noice/placeholder.webp" alt="${conversation.customer_name}">
          </div>
          <div class="chat-list-content">
            <div class="chat-list-header">
              <div class="chat-list-name">${conversation.customer_name}</div>
              <div class="chat-list-time">${timeString}</div>
            </div>
            <div class="chat-list-message">${conversation.last_message}</div>
          </div>
          ${unreadBadge}
        `;

        // Add click event to open conversation
        conversationItem.addEventListener("click", () => {
          openConversation(conversation);
        });

        chatList.appendChild(conversationItem);
      });

      // --- NEW: Update unread badge by summing unread_count ---
      let totalUnread = 0;
      if (Array.isArray(conversations)) {
        totalUnread = conversations.reduce(
          (sum, c) => sum + (c.unread_count || 0),
          0
        );
      }
      updateUnreadBadge(totalUnread);

      // ---
      const stillExists = conversations.some((c) => c.id === activeChat);
      if (activeChat && stillExists) {
        // Reload messages for the active chat
        loadChatHistory(activeChat);
        // Highlight the active chat in the list
        const activeItem = chatList.querySelector(
          `.chat-list-item[data-id="${activeChat}"]`
        );
        if (activeItem) activeItem.classList.add("active");
      } else {
        // If the previously active chat is gone, clear the chat view
        chatMessages.innerHTML = "";
        activeChat = null;
      }
    };

    // Format conversation time
    const formatConversationTime = (timestamp) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (timestamp >= today) {
        // Today - show time
        return timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (timestamp >= yesterday) {
        // Yesterday
        return "Yesterday";
      } else {
        // Earlier - show date
        return timestamp.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });
      }
    };

    // Open conversation
    const openConversation = (conversation) => {
      // Defensive: check if chatMessages exists
      const chatMessages = document.getElementById("chatMessages");
      if (!chatMessages) {
        console.warn("chatMessages element not found in openConversation");
        return;
      }
      // Set active conversation
      activeChat = conversation.id;
      activeCustomer = {
        id: conversation.customer_id,
        name: conversation.customer_name,
      };

      // Update UI
      document.querySelectorAll(".chat-list-item").forEach((item) => {
        item.classList.remove("active");
      });

      const conversationItem = document.querySelector(
        `.chat-list-item[data-id="${conversation.id}"]`
      );
      if (conversationItem) {
        conversationItem.classList.add("active");

        // Remove unread badge
        const unreadBadge = conversationItem.querySelector(".chat-list-badge");
        if (unreadBadge) {
          unreadBadge.remove();
        }
      }

      // Show chat interface
      chatContentEmptyState.style.display = "none";
      chatInterface.style.display = "flex";

      // Update customer info
      chatUserNameElement.textContent = conversation.customer_name;

      // Show mobile sidebar toggle for mobile
      if (window.innerWidth <= 768) {
        chatSidebar.classList.remove("show");
        chatContent.classList.add("show");
        chatInterface.classList.add("show");
      }

      // Load chat history
      loadChatHistory(conversation.id);
    };

    // Load chat history
    const loadChatHistory = (conversationId) => {
      if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        // Check if the "All" filter is active
        const isAllFilterActive = document.querySelector('.chat-filter[data-filter="all"].active') !== null;
        
       
        
        chatSocket.send(
          JSON.stringify({
            type: "get_history",
            conversation_id: conversationId,
            include_all: isAllFilterActive // Send flag to include all messages when "All" filter is active
          })
        );
      } else {
        console.error("WebSocket is not connected. Cannot load chat history.");
      }
    };

    // Display chat history
    const displayChatHistory = (messages) => {
      // Clear existing messages
      chatMessages.innerHTML = "";

      if (messages.length === 0) {
        // Show empty state if no messages
        chatMessages.innerHTML = `
          <div class="chat-empty-state">
            <i class="fas fa-comments"></i>
            <h3>No messages yet</h3>
            <p>Start a conversation with this customer.</p>
          </div>
        `;
        return;
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

      // Mark all messages from customer as read
      messages.forEach((message) => {
        if (message.sender_type === "user" && !message.is_read) {
          markMessageAsRead(message.id);
        }
      });
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
      const messageElement = document.createElement("div");
      messageElement.className = `chat-message ${
        message.sender_type === "admin" ? "sent" : "received"
      }`;
      messageElement.dataset.id = message.id;

      const timestamp = new Date(message.timestamp);
      const timeString = timestamp.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      let mediaHtml = "";
      if (message.media_url) {
        const fileExtension = message.media_url.split(".").pop().toLowerCase();
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
            message.sender_type === "admin"
              ? "../noice/placeholder.webp"
              : "../noice/placeholder.webp"
          }" alt="${message.sender_type === "admin" ? "You" : "Customer"}">
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
      const content = sanitizeChatInput(chatInput.value.trim());

      if (!content && !selectedFile) {
        return; // Don't send empty messages
      }

      if (!activeChat) {
        showToast("No active conversation selected.", TOAST_TYPES.ERROR);
        return;
      }

      if (selectedFile) {
        // Upload file first, then send message with file URL
        uploadFile(selectedFile, content);
      } else {
        // Send text-only message
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
          chatSocket.send(
            JSON.stringify({
              type: "chat_message",
              content: content,
              conversation_id: activeChat,
              customer_id: activeCustomer.id,
              sender_id: chatUserId,
              sender_name: chatUserName,
              sender_type: "admin",
            })
          );

          // Clear input
          chatInput.value = "";
          chatSendBtn.disabled = true;

          // Auto-resize textarea
          chatInput.style.height = "auto";
        } else {
          showToast(
            "Chat connection is not available. Please try again later.",
            TOAST_TYPES.ERROR
          );
        }
      }
    };

    // Upload file
    const uploadFile = async (file, content) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("admin_id", chatUserId);
        formData.append("conversation_id", activeChat);
        formData.append("csrf_token", csrftoken);

        // Show loading state
        chatSendBtn.disabled = true;
        chatSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const response = await fetch("/api/admin/chat/upload", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });

        const data = await response.json();
        if (data.status === "error") {
          showToast(data.message, TOAST_TYPES.ERROR);
          return;
        }

        if (!response.ok) {
          throw new Error("File upload failed");
        }

        // Send message with file URL
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
          chatSocket.send(
            JSON.stringify({
              type: "chat_message",
              content: content,
              media_url: data.file_url,
              media_type: file.type,
              conversation_id: activeChat,
              customer_id: activeCustomer.id,
              sender_id: chatUserId,
              sender_name: chatUserName,
              sender_type: "admin",
            })
          );

          // Clear input and file preview
          chatInput.value = "";
          clearFilePreview();
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        showToast(
          "Failed to upload file. Please try again.",
          TOAST_TYPES.ERROR
        );
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

    // Update customer status
    const updateCustomerStatus = (customerId, isOnline) => {
      if (activeCustomer && activeCustomer.id === customerId) {
        chatUserStatus.innerHTML = isOnline
          ? '<i class="fas fa-circle"></i> Online'
          : '<i class="fas fa-circle"></i> Offline';
        chatUserStatus.classList.toggle("online", isOnline);
      }
      // Update conversation list item if exists
      const conversationItem = document.querySelector(
        `.chat-list-item[data-customer-id="${customerId}"]`
      );
      if (conversationItem) {
        if (isOnline) {
          conversationItem.classList.add("online");
        } else {
          conversationItem.classList.remove("online");
        }
      }
    };

    // Update conversation list
    const updateConversationList = () => {
      loadChatConversations();
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
      const chatBadge = document.getElementById("chatBadge");
      if (count > 0) {
        chatBadge.textContent = count > 99 ? "99+" : count;
        chatBadge.style.display = "flex";
      } else {
        chatBadge.style.display = "none";
      }
    };

    // Store all conversations for client-side filtering
    let allChatConversations = [];
    
    // Filter conversations
    const filterConversations = (filter) => {
      // Update active filter button UI
      chatFilters.forEach((btn) => {
        btn.classList.remove("active");
      });

      document
        .querySelector(`.chat-filter[data-filter="${filter}"]`)
        .classList.add("active");

      // Show loading state
      chatList.innerHTML = `
        <div class="chat-loading-state">
          <div class="loading-spinner"></div>
          <p>Loading conversations...</p>
        </div>
      `;
      
      // For "all" filter, load all conversations and ensure we get complete data
      if (filter === 'all') {
       
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
          // Request fresh conversations from server
          chatSocket.send(
            JSON.stringify({
              type: "get_conversations"
            })
          );
          
          // Set a timeout for fallback
          setTimeout(() => {
            if (chatList.querySelector('.chat-loading-state')) {
             
              applyClientSideFiltering(filter);
            }
          }, 2000);
        } else {
          applyClientSideFiltering(filter);
        }
        return;
      }
      
      // For "today" and "yesterday" filters, use client-side filtering directly
      // as we know there's a server-side SQL issue with these filters
      if (filter === 'today' || filter === 'yesterday') {
       
        applyClientSideFiltering(filter);
        return;
      }
      
      // Try server-side filtering for other filters
      if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(
          JSON.stringify({
            type: "filter_conversations",
            filter: filter,
          })
        );
        
        // Set a timeout for fallback to client-side filtering
        setTimeout(() => {
          // If the chat list still shows loading, apply client-side filtering
          if (chatList.querySelector('.chat-loading-state')) {
            applyClientSideFiltering(filter);
          }
        }, 2000); // Wait 2 seconds for server response before fallback
      } else {
        // If no WebSocket connection, use client-side filtering immediately
        applyClientSideFiltering(filter);
      }
    };
    
    // Apply client-side filtering as a fallback
    const applyClientSideFiltering = (filter) => {
      
      
      if (!Array.isArray(allChatConversations) || allChatConversations.length === 0) {
       
        
        // If we don't have conversations cached and WebSocket is not connected,
        // show a connection error message
        if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) {
          chatList.innerHTML = `
            <div class="chat-empty-state">
              <i class="fas fa-exclamation-circle"></i>
              <h3>Connection Error</h3>
              <p>Unable to connect to chat server. Please check your connection and try again.</p>
              <button class="btn btn-primary mt-4" id="retry-chat-connection">Retry Connection</button>
            </div>
          `;
          
          // Add event listener to retry button
          setTimeout(() => {
            const retryBtn = document.getElementById('retry-chat-connection');
            if (retryBtn) {
              retryBtn.addEventListener('click', () => {
                connectChatWebSocket();
                filterConversations(filter);
              });
            }
          }, 100);
          return;
        }
        
        // If WebSocket is connected but we don't have conversations, try to load them
       
        loadChatConversations();
        
        // Set a timeout to try filtering again once conversations are loaded
        setTimeout(() => {
          if (Array.isArray(allChatConversations) && allChatConversations.length > 0) {
           console.log();
            applyClientSideFiltering(filter);
          } else {
          
            chatList.innerHTML = `
              <div class="chat-empty-state">
                <i class="fas fa-search"></i>
                <h3>No Conversations</h3>
                <p>No conversations found for the selected filter.</p>
              </div>
            `;
          }
        }, 2000);
        
        return;
      }
      
      
      let filteredConversations = [...allChatConversations];
      
      // Apply filters based on the selected filter
      switch (filter) {
        case 'unread':
          filteredConversations = filteredConversations.filter(conv => conv.unread_count > 0);
          break;
        case 'today':
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          
          filteredConversations = filteredConversations.filter(conv => {
            if (!conv.last_message_time) return false;
            const msgDate = new Date(conv.last_message_time);
            return msgDate >= today && msgDate < tomorrow;
          });
          break;
        case 'yesterday':
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          
          const dayAfterYesterday = new Date();
          dayAfterYesterday.setHours(0, 0, 0, 0);
          
          filteredConversations = filteredConversations.filter(conv => {
            if (!conv.last_message_time) return false;
            const msgDate = new Date(conv.last_message_time);
            return msgDate >= yesterday && msgDate < dayAfterYesterday;
          });
          break;
        case 'high':
          filteredConversations = filteredConversations.filter(conv => conv.priority === 'high');
          break;
        case 'medium':
          filteredConversations = filteredConversations.filter(conv => conv.priority === 'medium');
          break;
        case 'low':
          filteredConversations = filteredConversations.filter(conv => conv.priority === 'low');
          break;
        case 'all':
          // For 'all' filter, make sure we sort by most recent first
          filteredConversations.sort((a, b) => {
            const dateA = a.last_message_time ? new Date(a.last_message_time) : new Date(0);
            const dateB = b.last_message_time ? new Date(b.last_message_time) : new Date(0);
            return dateB - dateA; // Sort descending (newest first)
          });
          
          break;
        default:
          // No filtering needed for unknown filters
          break;
      }
      
      // Display the filtered conversations
      displayConversations(filteredConversations);
    };

    // Search conversations
    const searchConversations = (query) => {
      if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(
          JSON.stringify({
            type: "search_conversations",
            query: query,
          })
        );
      }
    };

    // Set conversation priority
    const setConversationPriority = (priority) => {
      if (!activeChat) {
        showToast("No active conversation selected.", TOAST_TYPES.ERROR);
        return;
      }

      if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(
          JSON.stringify({
            type: "set_priority",
            conversation_id: activeChat,
            priority: priority,
          })
        );

        // Update conversation list
        updateConversationList();

        showToast(`Priority set to ${priority}.`, TOAST_TYPES.SUCCESS);
      } else {
        showToast(
          "Chat connection is not available. Please try again later.",
          TOAST_TYPES.ERROR
        );
      }
    };

    // Handle template selection
    const useTemplate = (template) => {
      chatInput.value = template;
      chatSendBtn.disabled = false;

      // Close templates modal
      closeTemplatesModal();

      // Focus input
      chatInput.focus();
    };

    // Open priority modal
    const openPriorityModal = () => {
      priorityModal.style.display = "flex";
      setTimeout(() => {
        priorityModal.style.opacity = "1";
      }, 10);
    };

    // Close priority modal
    const closePriorityModal = () => {
      priorityModal.style.opacity = "0";
      setTimeout(() => {
        priorityModal.style.display = "none";
      }, 300);
    };

    // Open templates modal
    const openTemplatesModal = () => {
      templatesModal.style.display = "flex";
      setTimeout(() => {
        templatesModal.style.opacity = "1";
      }, 10);
    };

    // Close templates modal
    const closeTemplatesModal = () => {
      templatesModal.style.opacity = "0";
      setTimeout(() => {
        templatesModal.style.display = "none";
      }, 300);
    };

    // Auto-resize textarea
    const autoResizeTextarea = (textarea) => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };

    // Event Listeners
    chatInput.addEventListener("input", () => {
      chatSendBtn.disabled = !(chatInput.value.trim() || selectedFile);
      autoResizeTextarea(chatInput);
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
      updateConversationList();
      chatRefreshBtn.classList.add("fa-spin");
      setTimeout(() => {
        chatRefreshBtn.classList.remove("fa-spin");
      }, 1000);
    });

    chatBackBtn.addEventListener("click", () => {
      // Show sidebar on mobile
      chatSidebar.classList.add("show");
      chatContent.classList.remove("show");
    });

    chatSearchInput.addEventListener(
      "input",
      debounce((e) => {
        searchConversations(e.target.value.trim());
      }, 300)
    );

    chatFilters.forEach((filter) => {
      filter.addEventListener("click", () => {
        filterConversations(filter.dataset.filter);
      });
    });

    chatPriorityBtn.addEventListener("click", openPriorityModal);
    priorityModalClose.addEventListener("click", closePriorityModal);
    priorityCancelBtn.addEventListener("click", closePriorityModal);

    prioritySaveBtn.addEventListener("click", () => {
      const priority = prioritySelect.value;
      setConversationPriority(priority);
      closePriorityModal();
    });

    chatTemplateBtn.addEventListener("click", openTemplatesModal);
    templatesModalClose.addEventListener("click", closeTemplatesModal);
    templatesCancelBtn.addEventListener("click", closeTemplatesModal);

    templateSearchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      const templates = document.querySelectorAll(".template-item");

      templates.forEach((template) => {
        const content = template.dataset.template.toLowerCase();
        if (content.includes(query)) {
          template.style.display = "flex";
        } else {
          template.style.display = "none";
        }
      });
    });

    // Add event listeners to template items
    document.querySelectorAll(".template-use-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const template = btn.closest(".template-item").dataset.template;
        useTemplate(template);
      });
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
          if (activeChat) {
            const unreadMessages = document.querySelectorAll(
              ".chat-message.received:not(.read)"
            );
            unreadMessages.forEach((message) => {
              markMessageAsRead(message.dataset.id);
            });

            // Update unread count
            updateChatUnreadCount();
          }
        }, 500);
      });
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) {
        chatContent.classList.remove("show");
        // chatSidebar.classList.remove('show');
      }
    });

    // Initialize chat interface
    if (document.getElementById("chatPage")) {
      // Set default filter to 'all'
      filterConversations("all");
    }
  };

  // Function to show skeleton loading for recent orders
  function showRecentOrdersSkeleton() {
    const recentOrdersContainer = document.querySelector(
      ".content-card:first-child .content-card-body"
    );
    if (!recentOrdersContainer) return;

    let skeletonHTML = "";
    for (let i = 0; i < 4; i++) {
      skeletonHTML += `
        <div class="activity-skeleton" style="display: flex; padding: 12px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
          <div class="skeleton-avatar" style="width: 40px; height: 40px; border-radius: 4px; margin-right: 12px;"></div>
          <div class="skeleton-text" style="flex: 1;">
            <div class="skeleton-line medium" style="margin-bottom: 6px;"></div>
            <div class="skeleton-line short" style="margin-bottom: 4px;"></div>
          </div>
          <div class="skeleton-badge" style="width: 60px; height: 24px; border-radius: 12px;"></div>
        </div>
      `;
    }
    recentOrdersContainer.innerHTML = skeletonHTML;
  }

  // Function to fetch and display recent orders in dashboard
  async function loadRecentOrders() {
    const recentOrdersContainer = document.querySelector(
      ".content-card:first-child .content-card-body"
    );
    if (!recentOrdersContainer) return;

    try {
      // Show skeleton loading
      showRecentOrdersSkeleton();

      // Fetch orders with a 3-second delay for skeleton effect
      setTimeout(async () => {
        try {
          const response = await fetch("/api/orders/admin/orders", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": `bearer ${window.csrfToken}`,
            },
            credentials: "include",
          });
          const data = await response.json();

          if (data.status === "error") {
            showToast(data.message, TOAST_TYPES.ERROR);
            return;
          }

          if (!response.ok) {
            throw new Error("Failed to fetch orders");
          }

          if (!data.success || !Array.isArray(data.orders)) {
            throw new Error(data.message || "Invalid order data");
          }

          // Get the 4 most recent orders
          const recentOrders = data.orders
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 4);

          if (recentOrders.length === 0) {
            recentOrdersContainer.innerHTML = `
               <div class="empty-state">
                 <i class="fas fa-shopping-bag"></i>
                 <h3>No recent orders</h3>
                 <p>Your order history will appear here once you make your first purchase.</p>
               </div>
             `;
            return;
          }

          // Render recent orders
          const ordersHTML = recentOrders
            .map((order) => {
              // Determine status badge color
              let statusClass = "";
              switch (order.status) {
                case "pending":
                  statusClass = "order-status pending";
                  break;
                case "processing":
                  statusClass = "order-status processing";
                  break;
                case "completed":
                  statusClass = "order-status completed";
                  break;
                case "cancelled":
                  statusClass = "order-status cancelled";
                  break;
                case "failed":
                  statusClass = "order-status failed";
                  break;
                default:
                  statusClass = "order-status pending";
              }

              // Get order items
              const orderItems = Array.isArray(order.items) ? order.items : [];

              // Format items text based on the actual data structure
              const itemsText =
                orderItems.length > 0
                  ? orderItems
                      .map((item) => `${item.item_name} (${item.quantity})`)
                      .join(", ")
                  : "No items";

              // Get order image if available - handle different image URL formats
              let imageUrl = "";
              if (orderItems.length > 0) {
                // Try to get image from the first item
                const firstItem = orderItems[0];
                if (firstItem.image_url) {
                  // Remove any leading '/' if the URL already has http or https
                  imageUrl = firstItem.image_url.startsWith("/http")
                    ? firstItem.image_url.substring(1)
                    : firstItem.image_url;
                }
              }

              const orderImage = imageUrl
                ? `<img src="${imageUrl}" alt="Product" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">`
                : `<div style="width: 40px; height: 40px; border-radius: 4px; background: #f1f5f9; display: flex; align-items: center; justify-content: center;"><i class="fas fa-box"></i></div>`;

              // Format date
              const orderDate = new Date(order.created_at);
              const formattedDate = orderDate.toLocaleDateString();

              // Use order_reference or id for the order ID
              const orderId = order.order_reference || `#${order.id}`;

              return `
               <div class="recent-order-item" style="display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #f1f5f9;">
                 <div class="order-image" style="margin-right: 12px;">
                   ${orderImage}
                 </div>
                 <div class="order-details" style="flex: 1;">
                   <div style="font-weight: 500; margin-bottom: 4px;">Order ${orderId}</div>
                   <div style="font-size: 13px; color: #64748b;">${itemsText}</div>
                   <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${formattedDate}</div>
                 </div>
                 <div class="${statusClass}" style="margin-left: 8px;">
                   ${order.status}
                 </div>
               </div>
             `;
            })
            .join("");

          recentOrdersContainer.innerHTML = ordersHTML;
        } catch (error) {
          console.error("Error loading recent orders:", error);
          recentOrdersContainer.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-exclamation-circle"></i>
              <h3>Failed to load orders</h3>
              <p>There was an error loading recent orders.</p>
            </div>
          `;
        }
      }, 3000); // 3-second delay for skeleton effect
    } catch (error) {
      console.error("Error in loadRecentOrders:", error);
      recentOrdersContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle"></i>
          <h3>Failed to load orders</h3>
          <p>There was an error loading recent orders.</p>
        </div>
      `;
    }
  }

  // Call the function when the page loads
  document.addEventListener("DOMContentLoaded", () => {
    // Only load recent orders if we're on the dashboard page
    if (document.getElementById("dashboardPage").classList.contains("active")) {
      loadRecentOrders();
    }
  });

  setTimeout(() => {
    initAdminChat();
  }, 3000);

  // Support Tickets End

  // Email Marketing Functions
  const initEmailMarketing = () => {
    // Load subscribers when the page is shown
    loadNewsletterSubscribers();
    loadEmailHistory();

    // Setup event listeners
    document
      .getElementById("emailRecipientType")
      .addEventListener("change", handleRecipientTypeChange);
    document
      .getElementById("emailMarketingForm")
      .addEventListener("submit", handleSendEmail);
    document
      .getElementById("specificUserSearch")
      .addEventListener("input", debounce(handleUserSearch, 300));
    document
      .getElementById("subscriberSearch")
      .addEventListener("input", debounce(filterSubscribers, 300));

    // Setup template selection
    document
      .getElementById("emailTemplate")
      .addEventListener("change", handleTemplateChange);
  };

  const loadNewsletterSubscribers = async () => {
    try {
      showLoadingOverlay("Loading subscribers...");

      const response = await fetch("/api/users/email/subscribers", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
      });

      const data = await response.json();

      if (data.status === "error") {
        showToast(
          data.message || "Failed to load subscribers",
          TOAST_TYPES.ERROR
        );
        return;
      }

      if (!data.success) {
        console.error("Failed to load subscribers:", data.message);
        hideLoadingOverlay();
        // showToast('error', 'Failed to load subscribers', TOAST_TYPES.ERROR);
        return;
      }

      renderSubscribersTable(data.subscribers);
      hideLoadingOverlay();
    } catch (error) {
      console.error("Error loading subscribers:", error);
      hideLoadingOverlay();
      // showToast('error', 'Error loading subscribers', TOAST_TYPES.ERROR);
    }
  };

  const renderSubscribersTable = (subscribers) => {
    const tableBody = document.getElementById("subscribersTableBody");
    tableBody.innerHTML = "";

    if (!subscribers || subscribers.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `
        <td colspan="5" style="text-align: center;">
          <div class="empty-state">
            <i class="fas fa-envelope"></i>
            <h3>No subscribers found</h3>
            <p>No newsletter subscribers in the database.</p>
          </div>
        </td>
      `;
      tableBody.appendChild(emptyRow);
      return;
    }

    subscribers.forEach((subscriber) => {
      const row = document.createElement("tr");
      row.dataset.email = subscriber.email;

      const name =
        subscriber.first_name && subscriber.last_name
          ? `${subscriber.first_name} ${subscriber.last_name}`
          : "Not provided";

      const statusClass = subscriber.is_active
        ? "status-badge active"
        : "status-badge locked";
      const statusText = subscriber.is_active ? "Active" : "Unsubscribed";

      row.innerHTML = `
        <td>${subscriber.email}</td>
        <td>${name}</td>
        <td>${new Date(subscriber.subscribed_at).toLocaleDateString()}</td>
        <td><span class="${statusClass}">${statusText}</span></td>
        <td class="action-buttons">
          <button class="btn-action" onclick="sendEmailToSubscriber('${
            subscriber.email
          }')">
            <i class="fas fa-envelope"></i>
          </button>
          ${
            subscriber.is_active
              ? `
            <button class="btn-action danger" onclick="unsubscribeUser('${subscriber.id}')">
              <i class="fas fa-user-slash"></i>
            </button>
          `
              : ""
          }
        </td>
      `;

      tableBody.appendChild(row);
    });
  };

  const filterSubscribers = () => {
    const searchTerm = document
      .getElementById("subscriberSearch")
      .value.toLowerCase();
    const rows = document.querySelectorAll("#subscribersTableBody tr");

    rows.forEach((row) => {
      if (row.dataset.email) {
        const email = row.dataset.email.toLowerCase();
        const shouldShow = email.includes(searchTerm);
        row.style.display = shouldShow ? "" : "none";
      }
    });
  };

  const loadEmailHistory = async () => {
    try {
      const response = await fetch("/api/users/email/history", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
      });

      const data = await response.json();

      if (data.status === "error") {
        showToast(
          data.message || "Failed to load email history",
          TOAST_TYPES.ERROR
        );
        return;
      }

      if (!data.success) {
        console.error("Failed to load email history:", data.message);
        return;
      }

      renderEmailHistoryTable(data.history);
    } catch (error) {
      console.error("Error loading email history:", error);
    }
  };

  const renderEmailHistoryTable = (history) => {
    const tableBody = document.getElementById("emailHistoryTableBody");
    tableBody.innerHTML = "";

    if (!history || history.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `
        <td colspan="5" style="text-align: center;">
          <div class="empty-state">
            <i class="fas fa-history"></i>
            <h3>No email history</h3>
            <p>No emails have been sent yet.</p>
          </div>
        </td>
      `;
      tableBody.appendChild(emptyRow);
      return;
    }

    history.forEach((item) => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${new Date(item.sent_at).toLocaleString()}</td>
        <td>${item.subject}</td>
        <td>${item.recipient_type} (${item.recipient_count})</td>
        <td>${item.username || "Unknown"}</td>
        
      `;

      tableBody.appendChild(row);
    });
  };

  const handleRecipientTypeChange = () => {
    const recipientType = document.getElementById("emailRecipientType").value;
    const specificUserGroup = document.getElementById("specificUserGroup");

    if (recipientType === "specific_user") {
      specificUserGroup.style.display = "block";
    } else {
      specificUserGroup.style.display = "none";
    }
  };

  const handleUserSearch = async () => {
    const searchTerm = document.getElementById("specificUserSearch").value;
    const resultsContainer = document.getElementById("userSearchResults");

    if (searchTerm.length < 2) {
      resultsContainer.style.display = "none";
      return;
    }

    try {
      const response = await fetch(
        `/api/users/email/search-users?query=${encodeURIComponent(searchTerm)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${window.csrfToken}`,
          },
          credentials: "include",
        }
      );

      const data = await response.json();

      if (data.status === "error") {
        showToast(data.message || "Failed to send email", TOAST_TYPES.ERROR);
        return;
      }

      if (!data.success) {
        console.error("Failed to search users:", data.message);
        return;
      }

      renderUserSearchResults(data.users);
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  const renderUserSearchResults = (users) => {
    const resultsContainer = document.getElementById("userSearchResults");
    resultsContainer.innerHTML = "";

    if (!users || users.length === 0) {
      resultsContainer.innerHTML =
        '<div class="search-result-item">No users found</div>';
      resultsContainer.style.display = "block";
      return;
    }

    users.forEach((user) => {
      const item = document.createElement("div");
      item.className = "search-result-item";
      item.innerHTML = `
        <div>${user.username} (${user.email})</div>
      `;
      item.addEventListener("click", () => selectUser(user));

      resultsContainer.appendChild(item);
    });

    resultsContainer.style.display = "block";
  };

  const selectUser = (user) => {
    document.getElementById(
      "specificUserSearch"
    ).value = `${user.username} (${user.email})`;
    document.getElementById("selectedUserId").value = user.email;
    document.getElementById("userSearchResults").style.display = "none";
  };

  const handleTemplateChange = () => {
    const template = document.getElementById("emailTemplate").value;
    const contentField = document.getElementById("emailContent");

    switch (template) {
      case "newsletter":
        contentField.value = `<h2>Our Latest Updates</h2>
<p>Dear Customer,</p>
<p>We're excited to share our latest news with you!</p>
<ul>
  <li>New products have arrived</li>
  <li>Check out our summer sale</li>
  <li>Join our upcoming events</li>
</ul>
<p>Thank you for being a valued subscriber!</p>`;
        break;
      case "promotion":
        contentField.value = `<h2>Special Offer Just For You!</h2>
<p>Dear Customer,</p>
<p>We're excited to offer you an exclusive discount:</p>
<p style="font-size: 24px; font-weight: bold; color: #ff6b6b;">20% OFF</p>
<p>Use code: <strong>SUMMER20</strong> at checkout</p>
<p>Hurry! Offer ends soon.</p>`;
        break;
      case "announcement":
        contentField.value = `<h2>Important Announcement</h2>
<p>Dear Customer,</p>
<p>We have an important update to share with you.</p>
<p>Our website will be undergoing maintenance on July 15th from 2:00 AM to 4:00 AM UTC. During this time, our services will be temporarily unavailable.</p>
<p>We apologize for any inconvenience this may cause and appreciate your understanding.</p>`;
        break;
      case "custom":
        contentField.value = "";
        break;
    }
  };

  const handleSendEmail = async (event) => {
    event.preventDefault();

    const recipientType = document.getElementById("emailRecipientType").value;
    const subject = document.getElementById("emailSubject").value;
    const content = document.getElementById("emailContent").value;
    const template = document.getElementById("emailTemplate").value || "custom";

    if (!recipientType || !subject || !content) {
      showToast("Please fill in all required fields", TOAST_TYPES.ERROR);
      return;
    }

    let recipients = null;
    if (recipientType === "specific_user") {
      recipients = document.getElementById("selectedUserId").value;
      if (!recipients) {
        showToast("Please select a user", TOAST_TYPES.ERROR);
        return;
      }
    }

    try {
      showLoadingOverlay("Sending email...");

      const response = await fetch("/api/users/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": `bearer ${window.csrfToken}`,
        },
        credentials: "include",
        body: JSON.stringify({
          recipientType,
          recipients,
          subject,
          content,
          template,
        }),
      });

      const data = await response.json();

      hideLoadingOverlay();

      if (data.status === "error") {
        showToast(data.message || "Failed to send email", TOAST_TYPES.ERROR);
        return;
      }

      if (!data.success) {
        console.error("Failed to send email:", data.message);
        showToast(`Failed to send email: ${data.message}`, TOAST_TYPES.ERROR);
        return;
      }

      showToast("Email sent successfully", TOAST_TYPES.SUCCESS);
      document.getElementById("emailMarketingForm").reset();
      document.getElementById("specificUserGroup").style.display = "none";

      // Refresh email history
      loadEmailHistory();
    } catch (error) {
      console.error("Error sending email:", error);
      hideLoadingOverlay();
      showToast("Error sending email", TOAST_TYPES.ERROR);
    }
  };

  const showLoadingOverlay = (message = "Loading...") => {
    const overlay = document.createElement("div");
    overlay.id = "email-loading-overlay";
    overlay.className = "loading-overlay";
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p>${message}</p>
      </div>
    `;
    document.body.appendChild(overlay);
  };

  const hideLoadingOverlay = () => {
    const overlay = document.getElementById("email-loading-overlay");
    if (overlay) {
      overlay.remove();
    }
  };

  // Global functions for email marketing
  window.sendEmailToSubscriber = (email) => {
    document.getElementById("emailRecipientType").value = "specific_user";
    document.getElementById("specificUserGroup").style.display = "block";
    document.getElementById("specificUserSearch").value = email;
    document.getElementById("selectedUserId").value = email;

    // Switch to email marketing tab
    showPage("emailMarketing");

    // Scroll to form
    document
      .getElementById("emailMarketingForm")
      .scrollIntoView({ behavior: "smooth" });
  };

  window.unsubscribeUser = async (subscriberId) => {
    if (!confirm("Are you sure you want to unsubscribe this user?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/users/email/unsubscribe/${subscriberId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${window.csrfToken}`,
          },
          credentials: "include",
        }
      );

      const data = await response.json();

      if (data.status === "error") {
        showToast(
          data.message || "Failed to unsubscribe user",
          TOAST_TYPES.ERROR
        );
        return;
      }

      if (!data.success) {
        console.error("Failed to unsubscribe user:", data.message);
        showToast(
          data.message || "Failed to unsubscribe user",
          TOAST_TYPES.ERROR
        );
        return;
      }

      showToast("User unsubscribed successfully", TOAST_TYPES.SUCCESS);
      loadNewsletterSubscribers();
    } catch (error) {
      console.error("Error unsubscribing user:", error);
      showToast(error.message || "Error unsubscribing user", TOAST_TYPES.ERROR);
    }
  };

  // Add CSS for email marketing
  const addEmailMarketingStyles = () => {
    const style = document.createElement("style");
    style.textContent = `
      .search-results {
        position: absolute;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        max-height: 200px;
        overflow-y: auto;
        width: 100%;
        z-index: 100;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }
      
      .search-result-item {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
      }
      
      .search-result-item:hover {
        background-color: #f5f5f5;
      }
      
      .search-result-item:last-child {
        border-bottom: none;
      }
    `;
    document.head.appendChild(style);
  };

  addEmailMarketingStyles();
  setTimeout(() => {
    initEmailMarketing();
  }, 1000);

  // --- Send Notification Logic ---
  const sendNotificationBtn = document.getElementById("sendNotificationBtn");
  const notificationMessage = document.getElementById("notificationMessage");
  const notificationFeedback = document.getElementById("notificationFeedback");

  function sanitizeNotificationMessage(str) {
    // Remove HTML tags, trim, collapse whitespace, limit length
    return str
      .replace(/<[^>]*>?/gm, "")
      .replace(/[\r\n]+/g, "\n")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500); // Limit to 500 chars
  }

  if (sendNotificationBtn && notificationMessage) {
    sendNotificationBtn.addEventListener("click", async () => {
      let msg = notificationMessage.value;
      msg = sanitizeNotificationMessage(msg);
      notificationFeedback.textContent = "";
      if (!msg || msg.length < 3) {
        notificationFeedback.textContent =
          "Message must be at least 3 characters.";
        notificationFeedback.style.color = "red";
        return;
      }
      sendNotificationBtn.disabled = true;
      sendNotificationBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Sending...';
      try {
        const res = await fetch("/api/users/notifications/admin/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": `bearer ${window.csrfToken}`,
          },
          credentials: "include",
          body: JSON.stringify({ message: msg }),
        });
        const data = await res.json();

        if (data.status === "error" || !res.ok) {
          notificationFeedback.textContent =
            data.message || "Failed to send notification.";
          notificationFeedback.style.color = "red";
        } else {
          notificationFeedback.textContent = "Notification sent successfully!";
          notificationFeedback.style.color = "green";
          notificationMessage.value = "";
        }
      } catch (err) {
        notificationFeedback.textContent = "Failed to send notification.";
        notificationFeedback.style.color = "red";
      } finally {
        sendNotificationBtn.disabled = false;
        sendNotificationBtn.innerHTML =
          '<i class="fas fa-paper-plane"></i> Send';
      }
    });
  }
});
