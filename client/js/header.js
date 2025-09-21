import Auth from "./utils/Authentication.js";
import { csrftoken as generateCsrfToken } from "./utils/generateCsrf.js";
import { showToast, TOAST_TYPES } from "./utils/toast.js";

// State variables
let userData = null;
let categories = [];
let cartItems = [];
let wishlistItems = [];
let notifications = [];
let searchTimeout = null;
let isSearchActive = false;
let isAuthenticated = false;
let currentCsrfToken = '';

// DOM Elements
const searchInput = document.querySelector('.search-input');
const mobileSearchInput = document.querySelector('.mobile-search-input');
const searchResults = document.querySelector('.search-results');
const userAvatar = document.querySelector('.user-avatar');
const userName = document.querySelector('.user-info h4');
const megaMenu = document.querySelector('.mega-menu');
const mobileSearchBtn = document.querySelector('.mobile-search-btn');
const mobileSearchContainer = document.querySelector('.mobile-search-container');
const mobileProfileBtn = document.querySelector('.mobile-nav-profile');

// Dropdown elements
const cartBadge = document.querySelector('.header-btn[title="Cart"] .notification-badge');
const cartmobilebadgr = document.getElementById('mobilecartnoti');
const wishlistBadge = document.querySelector('.header-btn[title="Wishlist"] .notification-badge');
const notificationBadge = document.querySelector('.header-btn[title="Notifications"] .notification-badge');
const cartDropdownContent = document.querySelector('.dropdown-content-cart');
const wishlistDropdownContent = document.querySelector('.dropdown-content-wishlist');
const notificationDropdownContent = document.querySelector('.dropdown-content-notification');

// Initialize header functionality
async function init() {






    isAuthenticated = await Auth.ensureAuthenticated();






    await loadUserData();
    await loadCategories();

    // Only load these if the user is authenticated
    if (isAuthenticated) {
        await Promise.all([
            loadCartItems(),
            loadWishlistItems(),
            loadNotifications()
        ]);
    } else {
        // Show "Login to view" for non-authenticated users
        updateUnauthenticatedDropdowns();
    }

    setupEventListeners();
}

async function loadUserData() {
    if (!isAuthenticated) {
        updateUserUI();
        return;
    }

    try {
        const response = await fetch('/api/users/profile', {
            headers: {
                "X-CSRF-Token": `bearer ${currentCsrfToken}`,
            },
            credentials: 'include',
        });

        const data = await response.json();
        if (data.status === "error") {
            return;
        }

        if (data.success) {
            userData = data.profile;
            updateUserUI();
        }
    } catch (error) {
        console.log();
    }
}

function transformCategories(flatCategories) {
    // First pass: Group by main category and collect unique main category info
    const mainCategories = [];
    const groupedByMain = {};

    flatCategories.forEach(item => {
        if (!item || !item.main_category_name) return;

        const mainCatName = item.main_category_name;

        // If we haven't seen this main category before, add its info
        if (!groupedByMain[mainCatName]) {
            groupedByMain[mainCatName] = [];
            mainCategories.push({
                main_category_id: item.main_category_id,
                main_category_name: mainCatName,
                icon: `fa-solid ${item.main_category_icon || 'fa-folder'}`, // Provide default icon
                sub_categories: groupedByMain[mainCatName]
            });
        }

        // Add subcategory to the array only if it has a valid ID and name
        if (item.sub_category_id && item.sub_category_name) {
            groupedByMain[mainCatName].push({
                id: item.sub_category_id,
                name: item.sub_category_name,
                count: item.count || 0 // Default to 0 if count is missing
            });
        }
    });

    return mainCategories;
}

async function loadCategories() {
    try {
        const response = await fetch('/api/products/categories', {
            headers: {
                "X-CSRF-Token": `bearer ${currentCsrfToken}`,
            },
            credentials: 'include',
        });
        const data = await response.json();

        if (data.status === "error") {
            return;
        }

        if (data.success) {

            // Transform the flat array into nested structure
            categories = transformCategories(data.data);
            updateCategoryDropdown();
        }
    } catch (error) {
        console.log();
    }
}

// Load cart items for authenticated users
async function loadCartItems() {
    if (!isAuthenticated) return;

    try {
        const response = await fetch('/api/products/cart', {
            headers: {
                "X-CSRF-Token": `bearer ${currentCsrfToken}`,
            },
            credentials: 'include',
        });
        const data = await response.json();

        if (data.status === "error") {
            return;
        }


        if (data.success) {
            // Ensure cartItems is an array
            cartItems = Array.isArray(data.data) ? data.data :
                (data.data && Array.isArray(data.data.items)) ? data.data.items : [];
            updateCartDropdown();
        }
    } catch (error) {
        console.log();
    }
}

// Load wishlist items for authenticated users
async function loadWishlistItems() {
    if (!isAuthenticated) return;

    try {
        const response = await fetch('/api/products/wishlist', {
            headers: {
                "X-CSRF-Token": `bearer ${currentCsrfToken}`,
            },
            credentials: 'include',
        });
        const data = await response.json();
        if (data.status === "error") {
            return;
        }



        if (data.success) {
            // Ensure wishlistItems is an array
            wishlistItems = Array.isArray(data.data) ? data.data :
                (data.data && Array.isArray(data.data.items)) ? data.data.items : [];
            updateWishlistDropdown();
        }
    } catch (error) {
        console.log();
    }
}

// Load notifications (using API endpoint if available)
async function loadNotifications() {
    if (!isAuthenticated) return;

    try {
        // Use actual API endpoint for notifications
        const response = await fetch('/api/products/notifications', {
            headers: {
                "X-CSRF-Token": `bearer ${currentCsrfToken}`,
            },
            credentials: 'include',
        });

        const data = await response.json();

        if (data.status === "error") {
            return;
        }

        if (data.success) {
            notifications = Array.isArray(data.data) ? data.data :
                (data.data && Array.isArray(data.data.items)) ? data.data.items : [];
            updateNotificationDropdown();
        } else {
            // Initialize as empty array if API call failed
            notifications = [];
            updateNotificationDropdown();
        }
    } catch (error) {
        console.log();
        // Initialize as empty array if API call failed
        notifications = [];
        updateNotificationDropdown();
    }
}

function updateUserUI() {
    if (isAuthenticated && userData) {
        if (userAvatar) {


            userAvatar.style.display = 'block';
        }
        if (userName) {

            userName.style.display = 'block';
        }
    } else {

        if (userName) {
            userName.textContent = 'Login / Register';
            userName.style.display = 'block';
            userName.closest('.user-info').style.cursor = 'pointer';
            userName.closest('.user-info').onclick = () => window.location.href = '/login';
        }
    }
}

function updateCategoryDropdown() {
    const megaMenu = document.querySelector('.dropdown-content.mega-menu');
    if (!megaMenu) return;

    let html = '';

    // Generate HTML for each main category and its subcategories
    categories.forEach(mainCat => {
        if (!mainCat) return;

        const subCategories = mainCat.sub_categories || [];
        const hasValidSubcategories = subCategories.length > 0 &&
            subCategories.some(sub => sub && sub.id && sub.name);

        html += `
            <div class="mega-menu-item">
                <div class="main-category">
                    <i class="${mainCat.icon || 'fa-solid fa-folder'}"></i>
                    <span>${mainCat.main_category_name || 'Category'}</span>
                </div>
                <div class="sub-categories">
                    ${hasValidSubcategories
                ? subCategories
                    .filter(subCat => subCat && subCat.id && subCat.name) // Filter out invalid items
                    .map(subCat => `
                                <a href="/search?q=${encodeURIComponent(subCat.name)}" class="sub-category-item">
                                    ${subCat.name}
                                    ${subCat.count ? `<span class="count">(${subCat.count})</span>` : ''}
                                </a>
                            `).join('')
                : '<div class="no-subcategories">No subcategories available</div>'
            }
                </div>
            </div>
        `;
    });

    megaMenu.innerHTML = html;

    // Setup hover events for the dropdown
    const categoryBtn = document.querySelector('.category-btn');
    const dropdownContent = document.querySelector('.dropdown-content');

    if (categoryBtn && dropdownContent) {
        categoryBtn.addEventListener('mouseenter', () => {
            dropdownContent.style.display = 'grid';
        });

        const dropdown = document.querySelector('.dropdown');
        if (dropdown) {
            dropdown.addEventListener('mouseleave', () => {
                dropdownContent.style.display = 'none';
            });

            // Add initial state
            dropdownContent.style.display = 'none';
        }
    }
}

// Update cart dropdown with items
function updateCartDropdown() {
    if (!cartDropdownContent) return;

    // Update badge count
    if (cartBadge) {
        cartBadge.textContent = cartItems.length;
        cartBadge.style.display = cartItems.length > 0 ? 'block' : 'none';
    }

    if(cartmobilebadgr){
         cartmobilebadgr.textContent = cartItems.length;
        cartmobilebadgr.style.display = cartItems.length > 0 ? 'block' : 'none';
    }

    // If no items, show empty state
    if (!cartItems || cartItems.length === 0) {
        cartDropdownContent.innerHTML = `
            <div class="empty-dropdown">
                <i class="fa-solid fa-cart-shopping"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        return;
    }

    // Generate HTML for cart items
    let html = '';
    cartItems.forEach(item => {
        // Check if item has required properties
        if (!item || !item.id) return;

        html += `
            <div class="dropdown-item-cart" data-id="${item.id}">
                <img src="${item.item_image || '/noice/placeholder.webp'}" alt="${item.item_name || 'Product'}" class="dropdown-item-img">
                <div class="dropdown-item-content">
                    <div class="dropdown-item-title">${item.item_name || 'Product'}</div>
                    <div class="dropdown-item-price">NPR ${parseFloat(item.price || 0).toLocaleString()}</div>
                    <div class="dropdown-item-quantity">Qty: ${item.quantity || 1}</div>
                </div>
                <button class="dropdown-remove" data-id="${item.id}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
    });

    cartDropdownContent.innerHTML = html || `
        <div class="empty-dropdown">
            <i class="fa-solid fa-cart-shopping"></i>
            <p>Your cart is empty</p>
        </div>
    `;

    // Add event listeners to remove buttons
    const removeButtons = cartDropdownContent.querySelectorAll('.dropdown-remove');
    removeButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const itemId = button.getAttribute('data-id');
            if (!itemId) return;

            try {
                const response = await fetch(`/api/products/cart/remove/${itemId}`, {
                    method: 'DELETE',
                    headers: {
                        "X-CSRF-Token": `bearer ${currentCsrfToken}`,
                    },
                    credentials: 'include',
                });

                const data = await response.json();

                if (data.status === "error") {
                    showToast(data.message, TOAST_TYPES.ERROR);
                    return;
                }

                if (data.success) {
                    // Refresh cart items
                    await loadCartItems();
                }
            } catch (error) {
                console.log();
            }
        });
    });
}

// Update wishlist dropdown with items
function updateWishlistDropdown() {
    if (!wishlistDropdownContent) return;

    // Update badge count
    if (wishlistBadge) {
        wishlistBadge.textContent = wishlistItems.length;
        wishlistBadge.style.display = wishlistItems.length > 0 ? 'block' : 'none';
    }

    // If no items, show empty state
    if (!wishlistItems || wishlistItems.length === 0) {
        wishlistDropdownContent.innerHTML = `
            <div class="empty-dropdown">
                <i class="fa-solid fa-heart"></i>
                <p>Your wishlist is empty</p>
            </div>
        `;
        return;
    }

    // Generate HTML for wishlist items
    let html = '';
    wishlistItems.forEach(item => {
        // Check if item has required properties
        if (!item || !item.id) return;

        html += `
            <div class="dropdown-item-wishlist" data-id="${item.id}">
                <img src="${item.item_image || '/noice/placeholder.webp'}" alt="${item.item_name || 'Product'}" class="dropdown-item-img">
                <div class="dropdown-item-content">
                    <div class="dropdown-item-title">${item.item_name || 'Product'}</div>
                    <div class="dropdown-item-price">NPR ${parseFloat(item.item_price || 0).toLocaleString()}</div>
                </div>
                <button class="dropdown-remove" data-id="${item.id}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
    });

    wishlistDropdownContent.innerHTML = html || `
        <div class="empty-dropdown">
            <i class="fa-solid fa-heart"></i>
            <p>Your wishlist is empty</p>
        </div>
    `;

    // Add event listeners to remove buttons
    const removeButtons = wishlistDropdownContent.querySelectorAll('.dropdown-remove');
    removeButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const itemId = button.getAttribute('data-id');
            if (!itemId) return;




            try {
                const response = await fetch(`/api/products/wishlist/remove/${itemId}`, {
                    method: 'DELETE',
                    headers: {
                        "X-CSRF-Token": `bearer ${currentCsrfToken}`,
                    },
                    credentials: 'include',
                });

                const data = await response.json();
                if (data.status === "error") {
                    showToast(data.message, TOAST_TYPES.ERROR);
                    return;
                }

                if (data.success) {
                    // Refresh wishlist items
                    await loadWishlistItems();
                }
            } catch (error) {
                console.log();
            }
        });
    });
}

// Update notification dropdown
function updateNotificationDropdown() {
    if (!notificationDropdownContent) return;

    // Update badge count - only count unread/new notifications
    const unreadCount = notifications.filter(n => n.is_new === 1 || n.viewed === 0).length;
    if (notificationBadge) {
        notificationBadge.textContent = unreadCount;
        notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    // If no notifications, show empty state
    if (!notifications || notifications.length === 0) {
        notificationDropdownContent.innerHTML = `
            <div class="empty-dropdown">
                <i class="fa-solid fa-bell"></i>
                <p>No notifications</p>
            </div>
        `;
        return;
    }

    // Generate HTML for notifications
    let html = '';
    notifications.forEach(notification => {
        // Check if notification has required properties
        if (!notification || !notification.id) return;

        // Determine if notification is unread
        const isUnread = notification.is_new === 1 || notification.viewed === 0;

        html += `
            <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notification.id}">
                <div class="notification-icon" style="background: ${notification.icon_background || 'var(--primary)'};">
                    <i class="fa-solid ${notification.icon_class || 'fa-bell'}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title || 'Notification'}</div>
                    <div class="notification-message">${notification.message || ''}</div>
                    <div class="notification-time">${notification.relative_time || ''}</div>
                </div>
            </div>
        `;
    });

    notificationDropdownContent.innerHTML = html || `
        <div class="empty-dropdown">
            <i class="fa-solid fa-bell"></i>
            <p>No notifications</p>
        </div>
    `;

    // Add event listeners to notifications to mark as read
    const notificationItems = notificationDropdownContent.querySelectorAll('.notification-item');
    notificationItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            const notificationId = item.getAttribute('data-id');
            if (!notificationId) return;

            try {
                // Send API request to mark notification as read
                const response = await fetch(`/api/products/notifications/${notificationId}/read`, {
                    method: 'PUT',
                    headers: {
                        "X-CSRF-Token": `bearer ${currentCsrfToken}`,
                        "Content-Type": "application/json"
                    },
                    credentials: 'include',
                });

                const data = await response.json();
                if (data.status === "error") {
                    return;
                }

                if (data.success) {
                    // Update local data
                    notifications = notifications.map(n => {
                        if (n.id.toString() === notificationId) {
                            return { ...n, viewed: 1, is_new: 0 };
                        }
                        return n;
                    });

                    // Update UI
                    updateNotificationDropdown();
                }
            } catch (error) {
                console.log();
            }
        });
    });
}

// Show "Login to view" for non-authenticated users
function updateUnauthenticatedDropdowns() {
    // For Cart dropdown
    if (cartDropdownContent) {
        cartDropdownContent.innerHTML = `
            <div class="empty-dropdown">
                <i class="fa-solid fa-right-to-bracket"></i>
                <p>Login to view your cart</p>
                <a href="/login" class="dropdown-btn">Login</a>
            </div>
        `;
    }

    // Hide cart footer buttons for unauthenticated users
    const cartFooter = document.querySelector('.dropdown-footer-cart');
    if (cartFooter) {
        cartFooter.style.display = 'none';
    }

    // For Wishlist dropdown
    if (wishlistDropdownContent) {
        wishlistDropdownContent.innerHTML = `
            <div class="empty-dropdown">
                <i class="fa-solid fa-right-to-bracket"></i>
                <p>Login to view your wishlist</p>
                <a href="/login" class="dropdown-btn">Login</a>
            </div>
        `;
    }

    // Hide wishlist footer buttons for unauthenticated users
    const wishlistFooter = document.querySelector('.dropdown-footer-wishlist');
    if (wishlistFooter) {
        wishlistFooter.style.display = 'none';
    }

    // For Notification dropdown
    if (notificationDropdownContent) {
        notificationDropdownContent.innerHTML = `
            <div class="empty-dropdown">
                <i class="fa-solid fa-right-to-bracket"></i>
                <p>Login to view notifications</p>
                <a href="/login" class="dropdown-btn">Login</a>
            </div>
        `;
    }

    // Hide badge counts
    if (cartBadge) cartBadge.style.display = 'none';
    if(cartmobilebadgr)cartmobilebadgr.style.display = 'none';
    if (wishlistBadge) wishlistBadge.style.display = 'none';
    if (notificationBadge) notificationBadge.style.display = 'none';
}

function setupEventListeners() {
    // Search functionality
    if (searchInput) {
        // Remove input event redirect
        // searchInput.addEventListener('input', ...)

        // Redirect on Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const sanitized = sanitizeQuery(searchInput.value);
                if (sanitized) {
                    window.location.href = `/search?q=${encodeURIComponent(sanitized)}`;
                }
            }
        });
        // Redirect on search icon click
        const searchIcon = document.querySelector('.search-bar .search-icon');
        if (searchIcon) {
            searchIcon.addEventListener('click', () => {
                const sanitized = sanitizeQuery(searchInput.value);
                if (sanitized) {
                    window.location.href = `/search?q=${encodeURIComponent(sanitized)}`;
                }
            });
        }
    }

    // Mobile navigation auth checks
    if (mobileProfileBtn) {
        mobileProfileBtn.addEventListener('click', (e) => {
            if (!isAuthenticated) {
                e.preventDefault();
                window.location.href = '/login?redirect=' + encodeURIComponent('/customer');
            }
        });
    }

    // Mobile search functionality
    if (mobileSearchBtn && mobileSearchContainer) {
        mobileSearchBtn.addEventListener('click', () => {
            mobileSearchContainer.classList.toggle('active');
            if (mobileSearchContainer.classList.contains('active')) {
                mobileSearchInput.focus();
            }
        });

        // Close mobile search when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileSearchBtn.contains(e.target) &&
                !mobileSearchContainer.contains(e.target)) {
                mobileSearchContainer.classList.remove('active');
            }
        });

        // Remove input event redirect
        // mobileSearchInput.addEventListener('input', ...)

        // Redirect on Enter key
        if (mobileSearchInput) {
            mobileSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const sanitized = sanitizeQuery(mobileSearchInput.value);
                    if (sanitized) {
                        window.location.href = `/search?q=${encodeURIComponent(sanitized)}`;
                    }
                }
            });
        }
        // Redirect on search icon click (button)
        const mobileSearchForm = document.querySelector('.mobile-search-form');
        if (mobileSearchForm) {
            mobileSearchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const sanitized = sanitizeQuery(mobileSearchInput.value);
                if (sanitized) {
                    window.location.href = `/search?q=${encodeURIComponent(sanitized)}`;
                }
            });
        }
    }

    // Handle click events for dropdowns
    document.addEventListener('click', (e) => {
        // Close search results when clicking outside
        if (!searchInput?.contains(e.target) && !searchResults?.contains(e.target)) {
            hideSearchResults();
        }
    });

    // Add event listener for Clear All notifications
    const clearNotificationsBtn = document.querySelector('.notification-dropdown .dropdown-view-all');
    if (clearNotificationsBtn) {
        clearNotificationsBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            try {
                // Add animation class to notification dropdown
                const notificationDropdown = document.querySelector('.notification-dropdown');
                if (notificationDropdown) {
                    notificationDropdown.classList.add('clearing');
                }

                // Wait for animation to complete (500ms + a little extra)
                await new Promise(resolve => setTimeout(resolve, 600));

                // Send API request to clear all notifications
                const response = await fetch('/api/products/notifications/clear', {
                    method: 'DELETE',
                    headers: {
                        "X-CSRF-Token": `bearer ${currentCsrfToken}`,
                    },
                    credentials: 'include',
                });

                const data = await response.json();
                if (data.status === "error") {
                    showToast(data.message, TOAST_TYPES.ERROR);
                    return;
                }

                if (data.success) {
                    // Clear local notifications
                    notifications = [];
                    updateNotificationDropdown();

                    // Remove animation class
                    if (notificationDropdown) {
                        notificationDropdown.classList.remove('clearing');
                    }
                }
            } catch (error) {
                console.log();

                // Remove animation class in case of error
                const notificationDropdown = document.querySelector('.notification-dropdown');
                if (notificationDropdown) {
                    notificationDropdown.classList.remove('clearing');
                }
            }
        });
    }
}

async function handleSearch(query) {
    if (!query.trim()) {
        hideSearchResults();
        return;
    }

    // Redirect to search page with query
    window.location.href = `/search?q=${encodeURIComponent(query)}`;
}

function showSearchResults(products) {
    if (!searchResults) return;

    let html = '';
    if (products.length > 0) {
        products.forEach(product => {
            html += `
                <a href="/product/${product.slug}" class="search-result-item">
                    <img src="${product.image_url}" alt="${product.name}" class="search-result-image">
                    <div class="search-result-info">
                        <div class="search-result-name">${product.name}</div>
                        <div class="search-result-price">NPR ${product.current_price.toLocaleString()}</div>
                    </div>
                </a>
            `;
        });
    } else {
        html = '<div class="no-results">No products found</div>';
    }

    searchResults.innerHTML = html;
    searchResults.style.display = 'block';
    isSearchActive = true;
}

function hideSearchResults() {
    if (searchResults) {
        searchResults.style.display = 'none';
        isSearchActive = false;
    }
}



function sanitizeEmail(email) {
    return email.replace(/[<>;"'`]/g, '').trim().slice(0, 100);
}


const emailForm = document.getElementById('newsletterForm');
emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
        window.location.href = "/login";
        return;
    }
    const formdata = new FormData(emailForm);

    const data = {
        email: formdata.get("email"),
    };;

    const email = sanitizeEmail(data.email);

    if (!data.email) {
        showToast('Email is required', TOAST_TYPES.ERROR);
        return;
    }

    try {

        const response = await fetch('/api/users/email/les/subscriber/it', {
            method: 'POST',
            headers: {
                "X-CSRF-Token": `bearer ${currentCsrfToken}`,
                "Content-Type": "application/json"
            },
            credentials: 'include',
            body: JSON.stringify({
                email: email
            })
        });

        const data = await response.json();
        if (data.status === "error") {
            showToast(data.message, TOAST_TYPES.ERROR);
            return;
        }

        if (data.success) {
            showToast(data.message, TOAST_TYPES.SUCCESS);
            return;
        }


    } catch (error) {
        showToast(error.message || 'Failed to subscribe to newsletter', TOAST_TYPES.ERROR);
    }

});





// Add sanitizeQuery function
function sanitizeQuery(query) {
    return query.replace(/[<>;"'`]/g, '').trim().slice(0, 100);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    setTimeout(() => {
        currentCsrfToken = window.csrfToken;

    }, 1000);
    init();
});


const customerSupportBtn = document.getElementById('customer-support-btn');
customerSupportBtn.addEventListener('click', (e) => {
    sessionStorage.removeItem('customer_active_page');
    sessionStorage.setItem('customer_active_page', 'chat');
    window.location.href = "/user/dashboard";
});

const customerSupportBtn2 = document.getElementById('customer-support-btn2');
if (customerSupportBtn2) {
    customerSupportBtn2.addEventListener('click', (e) => {
        sessionStorage.removeItem('customer_active_page');
        sessionStorage.setItem('customer_active_page', 'chat');
        window.location.href = "/user/dashboard";
    });
}


const cartView = document.querySelectorAll('.cartview');
cartView.forEach(item => {
    item.addEventListener('click', (e) => {
        sessionStorage.removeItem('customer_active_page');
        sessionStorage.setItem('customer_active_page', 'cart');
        window.location.href = "/user/dashboard";
    });
}); 

const viewAllWishlist = document.querySelectorAll('.wishlsitview');
viewAllWishlist.forEach(item => {
    item.addEventListener('click', (e) => {

        sessionStorage.removeItem('customer_active_page');
        sessionStorage.setItem('customer_active_page', 'wishlist');

        window.location.href = "/user/dashboard";
    });
}); 




export { loadCartItems, loadWishlistItems };