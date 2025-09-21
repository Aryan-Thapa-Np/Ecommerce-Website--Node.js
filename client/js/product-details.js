// Import required utilities
import Auth from "./utils/Authentication.js";
import { csrftoken } from "./utils/generateCsrf.js";
import { showToast, TOAST_TYPES } from "./utils/toast.js";
import { loadCartItems, loadWishlistItems } from "./header.js";

// Global variables
let csrfToken = "";
let productId = null;
let categoryId = null;
let isAuthenticated = false;
let currentPage = 1;
const reviewsPerPage = 5;
let currentSort = 'newest';
let productSlug = window.location.pathname.split('/').pop();
let quantity = 1;
let similarProductsSlider = null;

// Function to view product details
function viewProductDetails(productSlug) {
    window.location.href = `/product-details/${productSlug}`;
}

// Initialize the page
async function init() {

    csrfToken = await csrftoken();
    window.csrfToken = csrfToken;
 

    try {
        const response = await fetch(`/api/products/products/slug/${productSlug}`, {
            credentials: 'include',
            headers: {
                'X-CSRF-Token': `bearer ${csrfToken}`
            }
        });
        const data = await response.json();
        if (data.status === "error") {

            return;
        }


        if (data.success) {

            productId = data.data.id;
            categoryId = data.data.category;
            bindEvents();
            loadReviews();
            loadSimilarProducts();
            initQuantityControls();
        } else {
            showToast('Failed to load product details', TOAST_TYPES.ERROR);
        }
    } catch (error) {

        showToast('Failed to load product details', TOAST_TYPES.ERROR);
    }
}

// Refresh authentication state and CSRF token
async function refreshAuthState() {
    try {
        isAuthenticated = await Auth.ensureAuthenticated();
      


       
    } catch (error) {
        console.error('Error refreshing auth state:', error);
        isAuthenticated = false;
        csrfToken = "";
    }
}

// Initialize quantity controls
function initQuantityControls() {
    // Add event listeners for quantity controls
    const minusBtn = document.querySelector('.quantity-btn.minus');
    const plusBtn = document.querySelector('.quantity-btn.plus');
    const quantityInput = document.querySelector('.quantity-input');

    minusBtn?.addEventListener('click', () => updateQuantity('decrease'));
    plusBtn?.addEventListener('click', () => updateQuantity('increase'));
    quantityInput?.addEventListener('change', (e) => {
        let newQuantity = parseInt(e.target.value);
        if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;
        if (newQuantity > 99) newQuantity = 99;
        quantity = newQuantity;
        e.target.value = quantity;
    });
}

// Update quantity
function updateQuantity(action) {
    const quantityInput = document.querySelector('.quantity-input');
    if (!quantityInput) return;

    if (action === 'increase' && quantity < 99) {
        quantity++;
    } else if (action === 'decrease' && quantity > 1) {
        quantity--;
    }

    quantityInput.value = quantity;
}

// Bind all event listeners
function bindEvents() {
    // Product buttons
    const addToCartBtn = document.querySelector('.add-to-cart-btn');
    const addToWishlistBtn = document.querySelector('.add-to-wishlist-btn');
    const writeReviewBtn = document.querySelector('.write-review-btn');
    const reviewModal = document.querySelector('.review-modal');
    const closeModalBtn = reviewModal?.querySelector('.modal-close');
    const cancelReviewBtn = reviewModal?.querySelector('.cancel-review');
    const reviewForm = document.getElementById('reviewForm');
    const sortReviews = document.querySelector('.sort-reviews');

    addToCartBtn?.addEventListener('click', addToCart);
    addToWishlistBtn?.addEventListener('click', addToWishlist);
    writeReviewBtn?.addEventListener('click', openReviewModal);
    closeModalBtn?.addEventListener('click', closeReviewModal);
    cancelReviewBtn?.addEventListener('click', closeReviewModal);
    reviewForm?.addEventListener('submit', handleReviewSubmit);

    if (sortReviews) {
        sortReviews.addEventListener('change', (e) => {
            currentSort = e.target.value;
            loadReviews();
        });
    }
}





// Add to cart functionality
async function addToCart() {
    // Always refresh auth state before checking
    await refreshAuthState();

    if (!isAuthenticated) {
       window.location.href = "/login";
    }

    // Check if product is in stock
    const stockStatus = document.querySelector('.stock-status');
    if (stockStatus && stockStatus.classList.contains('out_of_stock')) {
        showToast('Sorry, this product is out of stock', TOAST_TYPES.ERROR);
        return;
    }

    // Disable button to prevent double clicks
    const addToCartBtn = document.querySelector('.add-to-cart-btn');
    const originalText = addToCartBtn?.innerHTML;
    if (addToCartBtn) {
        addToCartBtn.disabled = true;
        addToCartBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
    }

    try {
        const response = await fetch('/api/products/cart/add', {
            method: 'POST',
            body: JSON.stringify({
                itemType: 'product',
                itemId: productId,
                quantity: quantity
            }),
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': `bearer ${csrfToken}`
            }
        });

        const data = await response.json();

        if (data.status === "error") {
            setTimeout(() => {
                showToast(data.message, TOAST_TYPES.ERROR);
            }, 1000);
            return;
        }

        if (data.status === "success") {
            setTimeout(() => {
                showToast('Product added to cart!', TOAST_TYPES.SUCCESS);
                loadCartItems();


                // Optionally update cart counter in header if exists
                const cartCounter = document.querySelector('.cart-counter');
                if (cartCounter) {
                    const currentCount = parseInt(cartCounter.textContent || '0');
                    cartCounter.textContent = currentCount + quantity;
                }
            }, 1000);
        } else {
            showToast(data.message || 'Failed to add product to cart', TOAST_TYPES.ERROR);
        }
    } catch (error) {

        showToast('An error occurred while adding to cart', TOAST_TYPES.ERROR);
    } finally {
        // Re-enable button
        setTimeout(() => {
            if (addToCartBtn) {
                addToCartBtn.disabled = false;
                addToCartBtn.innerHTML = originalText;
            }
        }, 1000);
    }
}


// Add to wishlist functionality
async function addToWishlist() {
    // Always refresh auth state before checking
    await refreshAuthState();


    if (!isAuthenticated) {
        window.location.href = "/login";
    }

    // Disable button to prevent double clicks
    const wishlistBtn = document.querySelector('.add-to-wishlist-btn');
    const originalText = wishlistBtn?.innerHTML;
    if (wishlistBtn) {
        wishlistBtn.disabled = true;
        wishlistBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
    }

    try {
        const response = await fetch('/api/products/wishlist/add', {
            method: 'POST',
            body: JSON.stringify({
                itemType: 'product',
                itemId: productId,
               
            }),
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': `bearer ${csrfToken}`
            }
        });

        const data = await response.json();
        if (data.status === "error") {
            setTimeout(() => {
                showToast(data.message, TOAST_TYPES.ERROR);
            }, 1000);
            return;
        }
       



        if (data.success) {
            setTimeout(() => {
                showToast('Product added to wishlist!', TOAST_TYPES.SUCCESS);
                loadWishlistItems();
            }, 1000);


        } else {

            showToast(data.message || 'Failed to add to wishlist', TOAST_TYPES.ERROR);
        }
    } catch (error) {

        showToast('An error occurred while adding to wishlist', TOAST_TYPES.ERROR);
    } finally {
        // Re-enable button if it's not in wishlist
        setTimeout(() => {
            if (wishlistBtn && !wishlistBtn.classList.contains('in-wishlist')) {
                wishlistBtn.disabled = false;
                wishlistBtn.innerHTML = originalText;
            }
        }, 1000);
    }
}


// Load reviews
async function loadReviews() {
    const reviewsList = document.querySelector('.reviews-list');
    if (!reviewsList) return;

    reviewsList.innerHTML = `
        <div class="loading-reviews">
            <div class="spinner"></div>
            <p>Loading reviews...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/products/products/${productId}/reviews?page=${currentPage}&limit=${reviewsPerPage}&sort=${currentSort}`, {
            credentials: 'include',
            headers: {
                'X-CSRF-Token': `bearer ${csrfToken}`
            }
        });
        const data = await response.json();
        if (data.status === "error") {

            return;
        }

        if (data.status === "success") {
            renderReviews(data.data.reviews, data.data.pagination);
        } else {
            showToast(data.message || 'Failed to load reviews', TOAST_TYPES.ERROR);
        }
    } catch (error) {

        showToast('Failed to load reviews', TOAST_TYPES.ERROR);
    }
}

// Render reviews
function renderReviews(reviews, pagination) {
    const reviewsList = document.querySelector('.reviews-list');
    if (!reviewsList) return;

    if (reviews.length === 0) {
        reviewsList.innerHTML = `
            <div class="no-reviews-message">
                <p>No reviews yet. Be the first to review this product!</p>
            </div>
        `;
        return;
    }

    reviewsList.innerHTML = reviews.map(review => `
        <div class="review-item">
            <div class="review-header">
                <div class="reviewer-info">
                    <img src="${review.avatar_url || 'https://via.placeholder.com/40'}" 
                         alt="${review.username}" 
                         class="reviewer-avatar">
                    <div>
                        <div class="reviewer-name">${review.username}</div>
                        <div class="review-date">${new Date(review.created_at).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="review-rating">
                    ${generateStarRating(review.rating)}
                </div>
            </div>
            <h4 class="review-title">${review.title}</h4>
            <p class="review-text">${review.review_text}</p>
            ${review.pros ? `<div class="review-pros"><strong>Pros:</strong> ${review.pros}</div>` : ''}
            ${review.cons ? `<div class="review-cons"><strong>Cons:</strong> ${review.cons}</div>` : ''}
            <div class="review-meta">
                <div class="review-badges">
                    ${review.is_verified_purchase ? `
                        <span class="review-badge badge-verified">
                            <i class="fa-solid fa-check"></i> Verified Purchase
                        </span>
                    ` : ''}
                </div>
                
            </div>
        </div>
    `).join('');

    renderPagination(pagination);
}

// Render pagination
function renderPagination(pagination) {
    const paginationContainer = document.querySelector('.reviews-pagination');
    if (!paginationContainer) return;

    const pages = [];
    const totalPages = pagination.pages;

    pages.push(`
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}"
                onclick="changePage(${currentPage - 1})"
                ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `);

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            pages.push(`
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}"
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            pages.push('<span class="pagination-ellipsis">...</span>');
        }
    }

    pages.push(`
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}"
                onclick="changePage(${currentPage + 1})"
                ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `);

    paginationContainer.innerHTML = pages.join('');
}

// Load similar products by category
async function loadSimilarProducts() {
    const similarProductsContainer = document.querySelector('.similar-products-section');
    if (!similarProductsContainer) return;

    // Show loading state
    similarProductsContainer.innerHTML = `
        <h2 class="section-title">Similar Products</h2>
        <div class="loading-similar">
            <div class="spinner"></div>
            <p>Loading similar products...</p>
        </div>
    `;

    // If no category ID is available, show no products message
    if (!categoryId) {
        similarProductsContainer.innerHTML = `
            <h2 class="section-title">Similar Products</h2>
            <div class="no-similar-products">
                <p>No similar products available</p>
            </div>
        `;
        return;
    }

    try {
        // Use category endpoint instead of similar products endpoint
        const response = await fetch(`/api/products/categories/${categoryId}/products?limit=10`, {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.status === "error") {

            return;
        }


        if (data.success && data.data && data.data.products && data.data.products.length > 0) {
            // Filter out the current product
            const filteredProducts = data.data.products.filter(product => product.id !== productId);

            if (filteredProducts.length > 0) {
                renderSimilarProductsCarousel(filteredProducts);
            } else {
                // No products left after filtering
                showNoSimilarProducts(similarProductsContainer);
            }
        } else {
            // Category not found or no products in category
            showNoSimilarProducts(similarProductsContainer);

            // Only show toast for errors other than "Category not found"
            if (data.message && !data.message.includes("Category not found")) {
                showToast(data.message || 'Failed to load similar products', TOAST_TYPES.ERROR);
            }
        }
    } catch (error) {

        showNoSimilarProducts(similarProductsContainer);
    }
}

// Helper function to show "No similar products" message
function showNoSimilarProducts(container) {
    container.innerHTML = `
        <h2 class="section-title">Similar Products</h2>
        <div class="no-similar-products">
            <p>No similar products available</p>
        </div>
    `;
}

// Add normalizeImageUrl function
function normalizeImageUrl(url) {
    if (!url) return url;
    url = url.replace(/\\/g, '/');
    if (url.startsWith('public/')) return '/' + url.slice(7);
    if (url.startsWith('/public/')) return '/' + url.slice(8);
    return url;
}

// Render similar products as a carousel
function renderSimilarProductsCarousel(products) {
    const similarProductsContainer = document.querySelector('.similar-products-section');
    if (!similarProductsContainer) return;

    if (!products || products.length === 0) {
        similarProductsContainer.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Similar Products</h2>
            </div>
            <div class="no-similar-products">
                <p>No similar products found.</p>
            </div>
        `;
        return;
    }

    // Create carousel HTML structure with nav buttons in header
    similarProductsContainer.innerHTML = `
        <div class="section-header" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <h2 class="section-title" style="margin: 0;">Similar Products</h2>
            </div>
            <div class="carousel-header-nav" style="display: flex; gap: 0.5rem;">
                <button class="carousel-nav prev" aria-label="Previous products">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button class="carousel-nav next" aria-label="Next products">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        </div>
        <div class="similar-products-carousel">
            <div class="carousel-container">
                <div class="carousel-track">
                    ${products.map(product => `
                        <div class="product-card" data-product-id="${product.id}" data-product-slug="${product.slug}" onclick="viewProductDetails('${product.slug}')" style="cursor: pointer;">
                            <img class="product-img" src="${normalizeImageUrl(product.image_url)}" alt="${product.name}">
                            <div class="product-content">
                                <div class="product-tags">
                                    ${product.tags ? JSON.parse(product.tags).map(tag => `
                                        <span class="tag ${tag.includes('New') ? 'tag-new' : tag.includes('-') ? 'tag-discount' : ''}">
                                            ${tag}
                                        </span>
                                    `).join('') : ''}
                                </div>
                                <h3 class="product-title">${product.name}</h3>
                                <div class="product-price">
                                    NPR ${product.current_price.toLocaleString()}
                                    ${product.original_price && product.original_price > product.current_price ? `
                                        <span class="price-original">NPR ${product.original_price.toLocaleString()}</span>
                                    ` : ''}
                                </div>
                                <div class="product-meta">
                                    <div class="product-rating">
                                        <i class="fa-solid fa-star"></i> ${product.rating} (${product.review_count} reviews)
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Initialize carousel functionality
    initSimilarProductsCarousel();
}

// Initialize carousel functionality
function initSimilarProductsCarousel() {
    const track = document.querySelector('.carousel-track');
    // Select nav buttons from header
    const prevButton = document.querySelector('.section-header .carousel-nav.prev');
    const nextButton = document.querySelector('.section-header .carousel-nav.next');
    const container = document.querySelector('.carousel-container');

    if (!track || !prevButton || !nextButton || !container) return;

    let currentIndex = 0;
    let cardWidth = 0;
    let slidesPerView = 1;
    let totalCards = track.children.length;
    let maxIndex = 0;

    // Calculate dimensions based on viewport and card width
    function calculateDimensions() {
        // Get the first card's width (they should all be the same)
        if (track.children.length > 0) {
            cardWidth = track.children[0].getBoundingClientRect().width;
        } else {
            cardWidth = 220; // fallback
        }
        const containerWidth = container.offsetWidth;
        slidesPerView = Math.max(1, Math.floor(containerWidth / cardWidth));
        maxIndex = Math.max(0, totalCards - slidesPerView);
        // Snap currentIndex to valid range
        if (currentIndex > maxIndex) currentIndex = maxIndex;
        updateCarouselPosition();
        updateNavigation();
    }

    // Update carousel position
    function updateCarouselPosition() {
        track.style.transform = `translateX(${-currentIndex * cardWidth}px)`;
    }

    // Update navigation buttons visibility and disabled state
    function updateNavigation() {
        if (totalCards > slidesPerView) {
            prevButton.style.display = 'flex';
            nextButton.style.display = 'flex';
            prevButton.disabled = currentIndex === 0;
            nextButton.disabled = currentIndex === maxIndex;
            prevButton.classList.toggle('disabled', currentIndex === 0);
            nextButton.classList.toggle('disabled', currentIndex === maxIndex);
        } else {
            prevButton.style.display = 'none';
            nextButton.style.display = 'none';
        }
    }

    // Navigation button events
    prevButton.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            updateCarouselPosition();
            updateNavigation();
        }
    });
    nextButton.addEventListener('click', () => {
        if (currentIndex < maxIndex) {
            currentIndex++;
            updateCarouselPosition();
            updateNavigation();
        }
    });

    // Touch events for swiping
    let touchStartX = 0;
    let touchEndX = 0;
    track.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    track.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        handleSwipe();
    }, { passive: true });
    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        const minSwipeDistance = 50;
        if (swipeDistance > minSwipeDistance && currentIndex > 0) {
            // Swipe right
            currentIndex--;
            updateCarouselPosition();
            updateNavigation();
        } else if (swipeDistance < -minSwipeDistance && currentIndex < maxIndex) {
            // Swipe left
            currentIndex++;
            updateCarouselPosition();
            updateNavigation();
        }
    }

    // Recalculate on resize
    window.addEventListener('resize', calculateDimensions);
    // Initial calculation
    setTimeout(calculateDimensions, 50); // Wait for DOM paint

    // Store reference to cleanup on page change
    similarProductsSlider = {
        cleanup: () => {
            window.removeEventListener('resize', calculateDimensions);
        }
    };
}

// Generate star rating HTML
function generateStarRating(rating) {
    return Array.from({ length: 5 }, (_, i) => `
        <i class="fa-${i < Math.round(rating) ? 'solid' : 'regular'} fa-star"></i>
    `).join('');
}

// Review modal functions
function openReviewModal() {
    const modal = document.querySelector('.review-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeReviewModal() {
    const modal = document.querySelector('.review-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('reviewForm').reset();
    }
}

// Handle review submission
async function handleReviewSubmit(e) {
    e.preventDefault();

    // Refresh auth state before checking
    await refreshAuthState();

    if (!isAuthenticated) {
        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        return;
    }

    const formData = new FormData(e.target);
    const reviewData = {
        rating: parseFloat(formData.get('rating')),
        title: formData.get('title'),
        review_text: formData.get('review_text'),
        pros: formData.get('pros'),
        cons: formData.get('cons')
    };

    if (!reviewData.rating || !reviewData.title || !reviewData.review_text) {
        showToast('Please fill in all required fields', TOAST_TYPES.ERROR);
        return;
    }

    try {
        const response = await makeApiRequest(`/api/products/products/${productId}/reviews`, {
            method: 'POST',
            body: JSON.stringify(reviewData)
        });

        const data = await response.json();
        if (data.status === "error") {
            showToast(data.message, TOAST_TYPES.ERROR);
            return;
        }

        if (data.success) {
            showToast('Review submitted successfully!', TOAST_TYPES.SUCCESS);
            closeReviewModal();
            loadReviews();
        } else {
            showToast(data.message || 'Failed to submit review', TOAST_TYPES.ERROR);
        }
    } catch (error) {

        showToast('Failed to submit review', TOAST_TYPES.ERROR);
    }
}


// Change page function
function changePage(page) {
    currentPage = page;
    loadReviews();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Add global functions
    window.changePage = changePage;

    window.viewProductDetails = viewProductDetails;
});

// Cleanup when navigating away
window.addEventListener('beforeunload', () => {
    // Clean up carousel event listeners
    if (similarProductsSlider && typeof similarProductsSlider.cleanup === 'function') {
        similarProductsSlider.cleanup();
    }
});