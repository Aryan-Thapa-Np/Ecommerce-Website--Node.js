// Import required utilities
import Auth from "./utils/Authentication.js";
import { csrftoken } from "./utils/generateCsrf.js";
import { showToast, TOAST_TYPES } from "./utils/toast.js";
import { loadCartItems, loadWishlistItems } from "./header.js";
let isAuthenticated = false;
class Carousel {
    constructor(options) {
        this.track = document.getElementById(options.trackId);
        this.prevBtn = document.getElementById(options.prevBtnId);
        this.nextBtn = document.getElementById(options.nextBtnId);
        this.currentIndex = 0;
        this.cardSelector = options.cardSelector || '.variant-card, .product-card';
        this._touchStartX = 0;
        this._touchEndX = 0;
        this._touching = false;
        this.cardWidth = 0;
        this.slidesPerView = 1;
        this.totalCards = 0;
        this.maxIndex = 0;
        if (!this.track || !this.prevBtn || !this.nextBtn) {
            console.error('Carousel elements not found:', options);
            return;
        }
        this.calculateDimensions = this.calculateDimensions.bind(this);
        this.bindEvents();
        setTimeout(this.calculateDimensions, 50);
    }

    calculateDimensions() {
        const cards = this.track.querySelectorAll(this.cardSelector);
        this.totalCards = cards.length;
        if (cards.length > 0) {
            this.cardWidth = cards[0].getBoundingClientRect().width;
        } else {
            this.cardWidth = 220;
        }
        const container = this.track.parentElement;
        const containerWidth = container ? container.offsetWidth : this.cardWidth;
        this.slidesPerView = Math.max(1, Math.floor(containerWidth / this.cardWidth));
        this.maxIndex = Math.max(0, this.totalCards - this.slidesPerView);
        if (this.currentIndex > this.maxIndex) this.currentIndex = this.maxIndex;
        this.updatePosition();
        this.updateButtons();
    }

    bindEvents() {
        this.prevBtn.addEventListener('click', () => this.navigate('prev'));
        this.nextBtn.addEventListener('click', () => this.navigate('next'));
        this.track.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
        this.track.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: true });
        this.track.addEventListener('touchend', (e) => this.onTouchEnd(e));
        window.addEventListener('resize', this.calculateDimensions);
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            this._touchStartX = e.touches[0].clientX;
            this._touching = true;
        }
    }

    onTouchMove(e) {
        if (!this._touching) return;
        this._touchEndX = e.touches[0].clientX;
    }

    onTouchEnd(e) {
        if (!this._touching) return;
        const deltaX = this._touchEndX - this._touchStartX;
        const threshold = 50;
        if (deltaX > threshold) {
            this.navigate('prev');
        } else if (deltaX < -threshold) {
            this.navigate('next');
        }
        this._touching = false;
        this._touchStartX = 0;
        this._touchEndX = 0;
    }

    navigate(direction) {
        if (direction === 'prev' && this.currentIndex > 0) {
            this.currentIndex--;
        } else if (direction === 'next' && this.currentIndex < this.maxIndex) {
            this.currentIndex++;
        }
        this.updatePosition();
        this.updateButtons();
    }

    updatePosition() {
        this.track.style.transform = `translateX(${-this.currentIndex * this.cardWidth}px)`;
    }

    updateButtons() {
        this.prevBtn.disabled = this.currentIndex === 0;
        this.nextBtn.disabled = this.currentIndex === this.maxIndex;
    }

    destroy() {
        this.prevBtn.removeEventListener('click', () => this.navigate('prev'));
        this.nextBtn.removeEventListener('click', () => this.navigate('next'));
        this.track.removeEventListener('touchstart', this.onTouchStart);
        this.track.removeEventListener('touchmove', this.onTouchMove);
        this.track.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('resize', this.calculateDimensions);
    }
}

class GameTopupDetails {
    constructor() {
        this.csrfToken = "";
        this.productId = null;
        this.quantity = 1;
        this.gameId = window.location.pathname.split('/')[2];
        this.variantCarousel = null;
        this.similarCarousel = null;
        // Vouch-related
        this.currentRating = 0;
        this.currentUserId = null;
        this.deleteModal = document.getElementById('delete-vouch-modal');
        this.pendingDeleteVouchId = null;
        // DOM Elements
        this.quantityInput = document.getElementById('quantity-input');
        this.addToCartBtn = document.getElementById('add-to-cart');
        this.addToWishlistBtn = document.getElementById('add-to-wishlist');
        this.vouchForm = document.getElementById('vouch-form');
        this.loadMoreVouchesBtn = document.getElementById('load-more-vouches');
    }

    async init() {
        try {

            isAuthenticated = await Auth.ensureAuthenticated();
            this.csrfToken = await csrftoken();
            window.csrfToken = this.csrfToken;
            await this.getCurrentUserId();
            await this.loadGameDetails();
            this.initQuantityControls();
            this.bindEvents();
            await this.loadSimilarGames();
            await this.loadVouches();
            this.initVouchForm();
            this.initDeleteModal();
        } catch (error) {
            console.error('Error initializing game details:', error);
            showToast('Failed to initialize game details', TOAST_TYPES.ERROR);
        }
    }

    async getCurrentUserId() {
        try {
            const response = await fetch('/api/users/profile/userid', {
                credentials: 'include',
                headers: {
                    'X-CSRF-Token': `bearer ${this.csrfToken}`
                }
            });
            const data = await response.json();
            if (data.status === "error") {
                return;
            }
            if (data.success) {
                this.currentUserId = data.user[0].id;
            }
        } catch (error) {
            // ignore
        }
    }

    async loadGameDetails() {
        try {
            const response = await fetch(`/api/products/games/${this.gameId}`, {
                credentials: 'include',
                headers: {
                    'X-CSRF-Token': `bearer ${this.csrfToken}`
                }
            });
            const data = await response.json();
            if(data.status === "error"){
               
                return;
            }

            if (data.status === "success" && data.data) {
                this.productId = data.data.id;
                this.renderVariants(data.data.variants || []);
            } else {
                throw new Error(data.message || 'Failed to load game details');
            }
        } catch (error) {
           
            showToast('Failed to load game details', TOAST_TYPES.ERROR);
        }
    }

    renderVariants(variants) {
        const variantTrack = document.getElementById('variant-track');
        if (!variantTrack) return;

        // Get page type from URL
        const isGamePass = window.location.pathname.includes('/pass');
        
        // Filter variants based on page type
        const filteredVariants = variants.filter(variant => 
            isGamePass ? variant.topup_type === 'pass' : variant.topup_type === 'in_game'
        );

        if (!filteredVariants.length) {
            variantTrack.innerHTML = '<div class="no-variants"><p>No variants available</p></div>';
            return;
        }

        variantTrack.innerHTML = filteredVariants.map(variant => `
            <div class="variant-card" data-variant-id="${variant.id}">
                <h3>${variant.variant_name}</h3>
                <p class="variant-description">${variant.description}</p>
                <div class="variant-price">NPR${parseFloat(variant.price).toFixed(2)}</div>
            </div>
        `).join('');

        // Add click handlers for variant selection
        const variantCards = variantTrack.querySelectorAll('.variant-card');
        variantCards.forEach(card => {
            card.addEventListener('click', () => {
                variantCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });

        // Initialize variant carousel with measured card width
        setTimeout(() => {
            this.variantCarousel = new Carousel({
                trackId: 'variant-track',
                prevBtnId: 'variant-prev',
                nextBtnId: 'variant-next',
                cardSelector: '.variant-card',
            });
        }, 0);
    }

    async loadSimilarGames() {
        const similarTrack = document.getElementById('similar-track');
        if (!similarTrack) return;

        similarTrack.innerHTML = `
            <div class="loading-similar">
                <div class="spinner"></div>
                <p>Loading similar games...</p>
            </div>
        `;

        try {
            const response = await fetch(`/api/products/games?limit=10`, {
                credentials: 'include'
            });
            const data = await response.json();
            if(data.status === "error"){
               
                return;
            }

            if (data.status === "success" && data.data?.length > 0) {
                const filteredGames = data.data.filter(game => game.id !== this.productId);
                if (filteredGames.length > 0) {
                    this.renderSimilarGames(filteredGames.slice(0, 8));
                } else {
                    this.showNoSimilarGames();
                }
            } else {
                this.showNoSimilarGames();
            }
        } catch (error) {
           
            this.showNoSimilarGames();
        }
    }

    showNoSimilarGames() {
        const similarTrack = document.getElementById('similar-track');
        if (similarTrack) {
            similarTrack.innerHTML = `
                <div class="no-similar-games">
                    <p>No similar games available</p>
                </div>
            `;
        }
    }

    renderSimilarGames(games) {
        const similarTrack = document.getElementById('similar-track');
        if (!similarTrack) return;

        // Get page type from URL
        const isGamePass = window.location.pathname.includes('/pass');

        similarTrack.innerHTML = games.map(game => `
            <div class="product-card" data-game-id="${game.id}">
                <img class="product-img2" src="${game.game_image_url}" alt="${game.game_name}">
                <div class="product-content">
                    <h3 class="product-title2">${game.game_name}</h3>
                    <div class="product-meta">
                        <div class="stock-status ${game.is_active ? 'in_stock' : 'out_of_stock'}">
                            <i class="fa-solid fa-${game.is_active ? 'check' : 'times'}-circle"></i>
                            ${game.is_active ? 'Available' : 'Unavailable'}
                        </div>
                    </div>
                    <p class="product-description">${game.description || ''}</p>
                    ${game.starting_price ? `
                        <div class="price-info">
                            <span class="label">Starting from</span>
                            <span class="price">NPR ${parseFloat(game.starting_price).toFixed(2)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Add click handlers for game cards
        similarTrack.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const gameId = card.dataset.gameId;
                if (gameId) window.location.href = `/game/${gameId}/${isGamePass ? 'pass' : 'topup'}`;
            });
        });

        // Initialize similar games carousel with measured card width
        setTimeout(() => {
            this.similarCarousel = new Carousel({
                trackId: 'similar-track',
                prevBtnId: 'similar-prev',
                nextBtnId: 'similar-next',
                cardSelector: '.product-card',
            });
        }, 0);
    }

    initQuantityControls() {
        const minusBtn = document.getElementById('quantity-minus');
        const plusBtn = document.getElementById('quantity-plus');

        minusBtn?.addEventListener('click', () => this.updateQuantity('decrease'));
        plusBtn?.addEventListener('click', () => this.updateQuantity('increase'));
        this.quantityInput?.addEventListener('change', (e) => {
            let newQuantity = parseInt(e.target.value);
            if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;
            if (newQuantity > 99) newQuantity = 99;
            this.quantity = newQuantity;
            e.target.value = this.quantity;
        });
    }

    updateQuantity(action) {
        if (!this.quantityInput) return;

        if (action === 'increase' && this.quantity < 99) {
            this.quantity++;
        } else if (action === 'decrease' && this.quantity > 1) {
            this.quantity--;
        }

        this.quantityInput.value = this.quantity;
    }

    bindEvents() {
        this.addToCartBtn?.addEventListener('click', () => this.addToCart());
        this.addToWishlistBtn?.addEventListener('click', () => this.addToWishlist());

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.variantCarousel) {
                this.variantCarousel.destroy();
                setTimeout(() => {
                    this.variantCarousel = new Carousel({
                        trackId: 'variant-track',
                        prevBtnId: 'variant-prev',
                        nextBtnId: 'variant-next',
                        cardSelector: '.variant-card',
                    });
                }, 0);
            }
            if (this.similarCarousel) {
                this.similarCarousel.destroy();
                setTimeout(() => {
                    this.similarCarousel = new Carousel({
                        trackId: 'similar-track',
                        prevBtnId: 'similar-prev',
                        nextBtnId: 'similar-next',
                        cardSelector: '.product-card',
                    });
                }, 0);
            }
        });
    }

    async addToCart() {
        if(!isAuthenticated){
            window.location.href = "/login";
            return;
        }

        const selectedVariant = document.querySelector('.variant-card.selected');
        if (!selectedVariant) {
            showToast('Please select a top-up amount', TOAST_TYPES.ERROR);
            return;
        }

        if (!this.addToCartBtn) return;

        const originalText = this.addToCartBtn.innerHTML;
        this.addToCartBtn.disabled = true;
        this.addToCartBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

        try {
            const response = await fetch('/api/products/cart/add', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': `bearer ${this.csrfToken}`
                },
                body: JSON.stringify({
                    itemType: 'game_topup_variant',
                    itemId: selectedVariant.dataset.variantId,
                    quantity: this.quantity
                })
            });

            const data = await response.json();

            if(data.status === "error"){
                setTimeout(() => {
                    showToast(data.message, TOAST_TYPES.ERROR);
                }, 1000);
                return;
            }

            if (data.status === "success") {
                setTimeout(() => {
                    showToast('Game added to cart!', TOAST_TYPES.SUCCESS);
                    loadCartItems();
                }, 1000);
            } else {
                throw new Error(data.message || 'Failed to add game to cart');
            }
        } catch (error) {
          
            showToast(error.message || 'An error occurred while adding to cart', TOAST_TYPES.ERROR);
        } finally {
            setTimeout(() => {
                if (this.addToCartBtn) {
                    this.addToCartBtn.disabled = false;
                    this.addToCartBtn.innerHTML = originalText;
                }
            }, 1000);
        }
    }

    async addToWishlist() {
     if(!isAuthenticated){
        window.location.href = "/login";
        return;
     }

        const selectedVariant = document.querySelector('.variant-card.selected');
        if (!selectedVariant) {
            showToast('Please select a variant first', TOAST_TYPES.ERROR);
            return;
        }

        if (!this.addToWishlistBtn) return;

        const originalText = this.addToWishlistBtn.innerHTML;
        this.addToWishlistBtn.disabled = true;
        this.addToWishlistBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';

        try {
            const response = await fetch('/api/products/wishlist/add', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': `bearer ${this.csrfToken}`
                },
                body: JSON.stringify({
                    itemType: 'game_topup_variant',
                    itemId: selectedVariant.dataset.variantId
                })
            });

            const data = await response.json();

            if(data.status === "error"){
                setTimeout(() => {
                    showToast(data.message, TOAST_TYPES.ERROR);
                }, 1000);
                return;
            }

            if (data.status === "success") {
                setTimeout(() => {
                showToast('Game added to wishlist!', TOAST_TYPES.SUCCESS);
                loadWishlistItems();
                }, 1000);
            } else {
                throw new Error(data.message || 'Failed to add to wishlist');
            }
        } catch (error) {
           
            showToast(error.message || 'An error occurred while adding to wishlist', TOAST_TYPES.ERROR);
            
        } finally {
            setTimeout(() => {
                if (this.addToWishlistBtn) {
                    this.addToWishlistBtn.disabled = false;
                    this.addToWishlistBtn.innerHTML = originalText;
                }
            }, 1000);
        }
    }

    // VOUCH LOGIC STARTS HERE
    sanitizeInput(input) {
        // Remove or escape dangerous characters ; } ] [ < / ~ " ' | \
        return input
            .replace(/[;}\]\[<\/~"'|\\]/g, '')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    async loadVouches() {
        const vouchesList = document.getElementById('vouches-list');
        if (!vouchesList) return;
        vouchesList.innerHTML = `
            <div class="loading-vouches">
                <div class="spinner"></div>
                <p>Loading vouches...</p>
            </div>
        `;
        try {
            const response = await fetch(`/api/vouch?game_id=${this.gameId}`, {
                credentials: 'include'
            });
            const result = await response.json();
            if (result.status === "error") {
                vouchesList.innerHTML = '<div class="error-message">Failed to load vouches</div>';
                return;
            }
            vouchesList.innerHTML = '';
            this.updateVouchStats(result.data.stats);
            if (result.success && result.data.vouches?.length > 0) {
                this.renderVouches(result.data.vouches, vouchesList);
            } else {
                vouchesList.innerHTML = '<div class="no-vouches">No vouches yet. Be the first to vouch!</div>';
            }
        } catch (error) {
            showToast("Error loading vouches", TOAST_TYPES.ERROR);
            vouchesList.innerHTML = '<div class="error-message">Failed to load vouches</div>';
        }
    }

    updateVouchStats(stats) {
        const ratingValue = document.getElementById('rating-value');
        const totalVouches = document.getElementById('total-vouches');
        const stars = document.getElementById('rating-stars');
        if (ratingValue && stats) {
            ratingValue.textContent = parseFloat(stats.average_rating || 0).toFixed(1);
        }
        if (totalVouches && stats) {
            const vouchCount = parseInt(stats.total_vouches || 0);
            totalVouches.textContent = `(${vouchCount} ${vouchCount === 1 ? 'vouch' : 'vouches'})`;
        }
        if (stars && stats) {
            const avgRating = parseFloat(stats.average_rating || 0);
            stars.innerHTML = Array.from({ length: 5 }).map((_, i) => {
                const starClass = i < Math.floor(avgRating) ? 'fa-solid' : 'fa-regular';
                const halfStar = i === Math.floor(avgRating) && avgRating % 1 >= 0.5;
                return `<i class="${starClass} ${halfStar ? 'fa-star-half-stroke' : 'fa-star'}"></i>`;
            }).join('');
        }
    }

    renderVouches(vouches, container) {
        const vouchesHtml = vouches.map(vouch => `
            <div class="vouch-item" data-vouch-id="${vouch.id}">
                <div class="vouch-header">
                    <img src="${vouch.avatar_url || '/img/default-avatar.png'}" 
                         alt="${vouch.username}" 
                         class="vouch-user-avatar">
                    <div class="vouch-user-info">
                        <div class="vouch-username">${vouch.username}</div>
                        <div class="vouch-date">${new Date(vouch.created_at).toLocaleDateString()}</div>
                    </div>
                    <div class="vouch-rating">
                        ${Array.from({ length: 5 }).map((_, i) =>
            `<i class="fa-${i < parseFloat(vouch.rating) ? 'solid' : 'regular'} fa-star"></i>`
        ).join('')}
                    </div>
                    ${vouch.user_id === this.currentUserId ? `
                        <button class="delete-vouch-btn" aria-label="Delete vouch">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
                ${vouch.vouch_text ? `<div class="vouch-text">${vouch.vouch_text}</div>` : ''}
            </div>
        `).join('');
        container.insertAdjacentHTML('beforeend', vouchesHtml);
        // Add event listeners for delete buttons
        container.querySelectorAll('.delete-vouch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const vouchItem = btn.closest('.vouch-item');
                const vouchId = vouchItem.dataset.vouchId;
                this.pendingDeleteVouchId = vouchId;
                this.deleteModal.classList.add('active');
            });
        });
    }

    initVouchForm() {
        const starRating = document.querySelector('.star-rating');
        if (!starRating) return;
        // Handle star rating
        starRating.querySelectorAll('i').forEach(star => {
            star.addEventListener('mouseover', () => this.handleStarHover(star));
            star.addEventListener('mouseout', () => this.handleStarHoverOut());
            star.addEventListener('click', () => this.handleStarClick(star));
        });
        // Handle form submission
        this.vouchForm?.addEventListener('submit', (e) => this.handleVouchSubmit(e));
    }

    initDeleteModal() {
        // Close modal handlers
        document.getElementById('close-delete-modal')?.addEventListener('click', () => {
            this.deleteModal.classList.remove('active');
        });
        document.getElementById('cancel-delete')?.addEventListener('click', () => {
            this.deleteModal.classList.remove('active');
        });
        // Confirm delete handler
        document.getElementById('confirm-delete')?.addEventListener('click', () => {
            this.deleteVouch(this.pendingDeleteVouchId);
            this.deleteModal.classList.remove('active');
        });
        // Close modal when clicking outside
        this.deleteModal?.addEventListener('click', (e) => {
            if (e.target === this.deleteModal) {
                this.deleteModal.classList.remove('active');
            }
        });
    }

    handleStarHover(hoveredStar) {
        const rating = parseInt(hoveredStar.dataset.rating);
        const stars = document.querySelectorAll('.star-rating i');
        stars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= rating) {
                star.classList.remove('fa-regular');
                star.classList.add('fa-solid');
                star.classList.add('active');
            }
        });
    }

    handleStarHoverOut() {
        const stars = document.querySelectorAll('.star-rating i');
        stars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= this.currentRating) {
                star.classList.remove('fa-regular');
                star.classList.add('fa-solid');
                star.classList.add('active');
            } else {
                star.classList.remove('fa-solid', 'active');
                star.classList.add('fa-regular');
            }
        });
    }

    handleStarClick(clickedStar) {
        this.currentRating = parseInt(clickedStar.dataset.rating);
        this.handleStarHoverOut();
    }

    async handleVouchSubmit(e) {
        e.preventDefault();
        if(!isAuthenticated){
            window.location.href = "/login";
            return;
        }

        if (!this.currentRating) {
            showToast('Please select a rating', TOAST_TYPES.ERROR);
            return;
        }
        const textarea = this.vouchForm.querySelector('textarea');
        const submitBtn = this.vouchForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        try {
            const response = await fetch('/api/vouch', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': `bearer ${this.csrfToken}`
                },
                body: JSON.stringify({
                    rating: this.currentRating,
                    vouch_text: this.sanitizeInput(textarea.value.trim())
                })
            });
            const data = await response.json();
            if (data.status === "error") {
                showToast(data.message, TOAST_TYPES.ERROR);
                return;
            }
            if (data.status === "success") {
                showToast('Thank you for your vouch!', TOAST_TYPES.SUCCESS);
                textarea.value = '';
                this.currentRating = 0;
                this.handleStarHoverOut();
                // Show loading state for vouches
                const vouchesList = document.getElementById('vouches-list');
                if (vouchesList) {
                    vouchesList.innerHTML = `
                        <div class="loading-vouches">
                            <div class="spinner"></div>
                            <p>Loading vouches...</p>
                        </div>
                    `;
                }
                // Add a delay before reloading vouches
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.loadVouches();
            } else {
                throw new Error(data.message || 'Failed to submit vouch');
            }
        } catch (error) {
            showToast(error.message || 'An error occurred while submitting vouch', TOAST_TYPES.ERROR);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    async deleteVouch(vouchId) {

        if(!isAuthenticated){
            window.location.href = "/login";
            return;
        }

        const container = document.getElementById('vouches-list');
        if (!container) return;
        try {
            const response = await fetch(`/api/vouch/${vouchId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'X-CSRF-Token': `bearer ${this.csrfToken}`
                }
            });
            const data = await response.json();
            if (data.status === "error") {
                showToast(data.message, TOAST_TYPES.ERROR);
                return;
            }
            if (data.status === "success") {
                showToast('Vouch deleted successfully', TOAST_TYPES.SUCCESS);
                // Show loading state
                container.innerHTML = `
                    <div class="loading-vouches">
                        <div class="spinner"></div>
                        <p>Loading vouches...</p>
                    </div>
                `;
                // Add delay before reloading
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.loadVouches();
            } else {
                throw new Error(data.message || 'Failed to delete vouch');
            }
        } catch (error) {
            showToast(error.message || 'An error occurred while deleting vouch', TOAST_TYPES.ERROR);
        }
    }

    cleanup() {
        if (this.variantCarousel) {
            this.variantCarousel.destroy();
        }
        if (this.similarCarousel) {
            this.similarCarousel.destroy();
        }
    }
}

// Initialize when DOM is loaded
let gameTopupDetails;
document.addEventListener('DOMContentLoaded', () => {
    gameTopupDetails = new GameTopupDetails();
    gameTopupDetails.init();
});

// Cleanup when navigating away
window.addEventListener('beforeunload', () => {
    if (gameTopupDetails) {
        gameTopupDetails.cleanup();
    }
});