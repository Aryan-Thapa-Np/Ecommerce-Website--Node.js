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
        this.gap = options.gap || 16;
        this.cardSelector = options.cardSelector || '.plan-card, .product-card';
        this._initItemWidth(options.itemWidth);
        this._touchStartX = 0;
        this._touchEndX = 0;
        this._touching = false;
        if (!this.track || !this.prevBtn || !this.nextBtn) {
            console.error('Carousel elements not found:', options);
            return;
        }
        this.bindEvents();
        this.updateButtons();
    }

    _initItemWidth(defaultWidth) {
        // On small screens, always use 200px for itemWidth
        if (window.innerWidth <= 600) {
            this.itemWidth = 200;
            return;
        }
        // Dynamically measure the first card's width for larger screens
        const card = this.track.querySelector(this.cardSelector);
        if (card) {
            // Use offsetWidth (includes padding/border, not margin)
            const cardWidth = card.offsetWidth;
            // Get flex gap from computed style of the track
            const style = window.getComputedStyle(this.track);
            const gap = parseInt(style.gap) || 0;
            this.itemWidth = cardWidth + gap;
        } else {
            this.itemWidth = defaultWidth || 300;
        }
    }

    bindEvents() {
        this.prevBtn.addEventListener('click', () => this.navigate('prev'));
        this.nextBtn.addEventListener('click', () => this.navigate('next'));
        // Touch events for swipe
        this.track.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
        this.track.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: true });
        this.track.addEventListener('touchend', (e) => this.onTouchEnd(e));
        // Recalculate itemWidth on resize
        window.addEventListener('resize', () => {
            this._initItemWidth(this.itemWidth);
            this.updatePosition();
        });
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
        const threshold = 50; // Minimum px to consider a swipe
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
        const totalItems = this.track.children.length;
        if (direction === 'prev' && this.currentIndex > 0) {
            this.currentIndex--;
        } else if (direction === 'next' && this.currentIndex < totalItems - 1) {
            this.currentIndex++;
        }
        this.updatePosition();
        this.updateButtons();
    }

    updatePosition() {
        const offset = this.currentIndex * this.itemWidth;
        this.track.style.transform = `translateX(-${offset}px)`;
    }

    updateButtons() {
        const totalItems = this.track.children.length;
        this.prevBtn.disabled = this.currentIndex === 0;
        this.nextBtn.disabled = this.currentIndex === totalItems - 1;
    }

    destroy() {
        this.prevBtn.removeEventListener('click', () => this.navigate('prev'));
        this.nextBtn.removeEventListener('click', () => this.navigate('next'));
        this.track.removeEventListener('touchstart', this.onTouchStart);
        this.track.removeEventListener('touchmove', this.onTouchMove);
        this.track.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('resize', this._initItemWidth);
    }
}

class SubscriptionDetails {
    constructor() {
        this.csrfToken = "";
        this.subscriptionId = window.location.pathname.split('/')[2];
        this.planCarousel = null;
        this.similarCarousel = null;
        this.currentRating = 0;
        this.vouchPage = 1;
        this.hasMoreVouches = true;
        this.currentUserId = null;
        this.deleteModal = document.getElementById('delete-vouch-modal');
        this.pendingDeleteVouchId = null;

        // DOM Elements
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
            await this.loadSubscriptionDetails();
            this.bindEvents();
            await this.loadSimilarSubscriptions();
            await this.loadVouches();
            this.initVouchForm();
            this.initDeleteModal();
        } catch (error) {
            console.error('Error initializing subscription details:', error);
            showToast('Failed to initialize subscription details', TOAST_TYPES.ERROR);
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
            console.log();
        }
    }

    async loadSubscriptionDetails() {
        try {
            const response = await fetch(`/api/products/subscriptions/${this.subscriptionId}`, {
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

            if (data.status === "success" && data.data) {
                this.renderPlans(data.data.plans || []);
            } else {
                throw new Error(data.message || 'Failed to load subscription details');
            }
        } catch (error) {

            showToast('Failed to load subscription details', TOAST_TYPES.ERROR);
        }
    }

    renderPlans(plans) {
        const planTrack = document.getElementById('plan-track');
        if (!planTrack) return;

        if (!plans.length) {
            planTrack.innerHTML = '<div class="no-plans"><p>No plans available</p></div>';
            return;
        }

        planTrack.innerHTML = plans.map(plan => `
            <div class="plan-card" data-plan-id="${plan.id}">
                <h3>${plan.plan_name}</h3>
                <div class="plan-price">NPR${parseFloat(plan.price).toFixed(2)}/${plan.billing_cycle}</div>
                <div class="plan-features">
                    ${this.renderFeatures(plan.features)}
                </div>
            </div>
        `).join('');

        // Add click handlers for plan selection
        const planCards = planTrack.querySelectorAll('.plan-card');
        planCards.forEach(card => {
            card.addEventListener('click', () => {
                planCards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
        });

        // Initialize plan carousel with measured card width
        setTimeout(() => {
            this.planCarousel = new Carousel({
                trackId: 'plan-track',
                prevBtnId: 'plan-prev',
                nextBtnId: 'plan-next',
                cardSelector: '.plan-card',
            });
        }, 0);
    }

    renderFeatures(features) {
        try {
            const featureList = JSON.parse(features);
            return featureList.map(feature => `
                <div class="feature-item ${!feature.available ? 'unavailable' : ''}">
                    <i class="fa-solid ${feature.available ? 'fa-check' : 'fa-times'}"></i>
                    <span>${feature.text}</span>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error parsing features:', error);
            return '';
        }
    }

    async loadSimilarSubscriptions() {
        const similarTrack = document.getElementById('similar-track');
        if (!similarTrack) return;

        similarTrack.innerHTML = `
            <div class="loading-similar">
                <div class="spinner"></div>
                <p>Loading similar subscriptions...</p>
            </div>
        `;

        try {
            const response = await fetch(`/api/products/subscriptions?limit=10`, {
                credentials: 'include'
            });
            const data = await response.json();
            if (data.status === "error") {

                return;
            }

            if (data.success && data.data?.length > 0) {
                const filteredSubscriptions = data.data.filter(sub => sub.id !== this.subscriptionId);
                if (filteredSubscriptions.length > 0) {
                    this.renderSimilarSubscriptions(filteredSubscriptions.slice(0, 8));
                } else {
                    this.showNoSimilarSubscriptions();
                }
            } else {
                this.showNoSimilarSubscriptions();
            }
        } catch (error) {
            showToast("Error loading similar subscriptions", TOAST_TYPES.ERROR);
            this.showNoSimilarSubscriptions();
        }
    }

    showNoSimilarSubscriptions() {
        const similarTrack = document.getElementById('similar-track');
        if (similarTrack) {
            similarTrack.innerHTML = `
                <div class="no-similar-subscriptions">
                    <p>No similar subscriptions available</p>
                </div>
            `;
        }
    }

    renderSimilarSubscriptions(subscriptions) {
        const similarTrack = document.getElementById('similar-track');
        if (!similarTrack) return;

        similarTrack.innerHTML = subscriptions.map(subscription => `
            <div class="product-card" data-subscription-id="${subscription.id}">
                <img class="product-img2" src="${subscription.logo_url}" alt="${subscription.name}">
                <div class="product-content">
                    <h3 class="product-title2">${subscription.name}</h3>
                    <div class="product-meta">
                        <div class="stock-status ${subscription.is_active ? 'in_stock' : 'out_of_stock'}">
                            <i class="fa-solid fa-${subscription.is_active ? 'check' : 'times'}-circle"></i>
                            ${subscription.is_active ? 'Available' : 'Unavailable'}
                        </div>
                    </div>
                    <p class="product-description">${subscription.description || ''}</p>
                    ${subscription.starting_price ? `
                        <div class="price-info">
                            <span class="label">Starting from</span>
                            <span class="price">NPR ${parseFloat(subscription.starting_price).toFixed(2)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Add click handlers for subscription cards
        similarTrack.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const subscriptionId = card.dataset.subscriptionId;
                if (subscriptionId) window.location.href = `/subscription/${subscriptionId}`;
            });
        });

        // Initialize similar subscriptions carousel with measured card width
        setTimeout(() => {
            this.similarCarousel = new Carousel({
                trackId: 'similar-track',
                prevBtnId: 'similar-prev',
                nextBtnId: 'similar-next',
                cardSelector: '.product-card',
            });
        }, 0);
    }

    bindEvents() {
        this.addToCartBtn?.addEventListener('click', () => this.addToCart());
        this.addToWishlistBtn?.addEventListener('click', () => this.addToWishlist());

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.planCarousel) {
                this.planCarousel.destroy();
                setTimeout(() => {
                    this.planCarousel = new Carousel({
                        trackId: 'plan-track',
                        prevBtnId: 'plan-prev',
                        nextBtnId: 'plan-next',
                        cardSelector: '.plan-card',
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
  


        const selectedPlan = document.querySelector('.plan-card.selected');
        if (!selectedPlan) {
            showToast('Please select a subscription plan', TOAST_TYPES.ERROR);
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
                    itemType: 'subscription_plan',
                    itemId: selectedPlan.dataset.planId,
                    quantity: 1
                })
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
                    showToast('Subscription plan added to cart!', TOAST_TYPES.SUCCESS);
                    loadCartItems();
                }, 1000);
                
            } else {
                throw new Error(data.message || 'Failed to add subscription to cart');
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

     

        const selectedPlan = document.querySelector('.plan-card.selected');
        if (!selectedPlan) {
            showToast('Please select a subscription plan', TOAST_TYPES.ERROR);
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
                    itemType: 'subscription_plan',
                    itemId: selectedPlan.dataset.planId
                })
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
                    showToast('Subscription plan added to wishlist!', TOAST_TYPES.SUCCESS);
                    loadWishlistItems();
                    this.addToWishlistBtn.classList.add('in-wishlist');
                    this.addToWishlistBtn.innerHTML = '<i class="fa-solid fa-heart"></i> In Wishlist';
                }, 1000);

            } else {
                throw new Error(data.message || 'Failed to add to wishlist');
            }
        } catch (error) {

            showToast(error.message || 'An error occurred while adding to wishlist', TOAST_TYPES.ERROR);
            if (this.addToWishlistBtn) {
                this.addToWishlistBtn.disabled = false;
                this.addToWishlistBtn.innerHTML = originalText;
            }
        } finally {
            setTimeout(() => {
                this.addToWishlistBtn.disabled = false;
                this.addToWishlistBtn.innerHTML = originalText;
            }, 1000);
        }
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

        // Handle load more
        this.loadMoreVouchesBtn?.addEventListener('click', () => this.loadMoreVouches());
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
                this.vouchPage = 1;
                await this.loadVouches(true);
            } else {
                throw new Error(data.message || 'Failed to delete vouch');
            }
        } catch (error) {

            showToast(error.message || 'An error occurred while deleting vouch', TOAST_TYPES.ERROR);
        }
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

    // Add sanitizeInput method
    sanitizeInput(input) {
        // Remove or escape dangerous characters ; } ] < / ~
        return input
            .replace(/[;}\]\[<\/~]/g, '') // Remove ; } ] [ < / ~
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
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
                    subscription_id: this.subscriptionId,
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
                this.vouchPage = 1;

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
                await this.loadVouches(true); // Reload vouches
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

    async loadVouches(reset = false) {
        const vouchesList = document.getElementById('vouches-list');
        if (!vouchesList) return;

        if (reset) {
            vouchesList.innerHTML = '';
            this.vouchPage = 1;
            this.hasMoreVouches = true;
        }

        if (!this.hasMoreVouches) return;

        const loadingHtml = `
            <div class="loading-vouches">
                <div class="spinner"></div>
                <p>Loading vouches...</p>
            </div>
        `;

        if (this.vouchPage === 1) {
            vouchesList.innerHTML = loadingHtml;
        }

        try {
            const response = await fetch(`/api/vouch?page=${this.vouchPage}&limit=5&subscription_id=${this.subscriptionId}`, {
                credentials: 'include'
            });
            const result = await response.json();
            if (result.status === "error") {

                return;
            }


            if (this.vouchPage === 1) {
                vouchesList.innerHTML = '';
                this.updateVouchStats(result.data.stats);
            }

            if (result.success && result.data.vouches?.length > 0) {
                this.renderVouches(result.data.vouches, vouchesList);
                this.vouchPage++;
                this.hasMoreVouches = result.data.pagination.hasNextPage;
            } else {
                this.hasMoreVouches = false;
                if (this.vouchPage === 1) {
                    vouchesList.innerHTML = '<div class="no-vouches">No vouches yet. Be the first to vouch!</div>';
                }
            }

            if (this.loadMoreVouchesBtn) {
                this.loadMoreVouchesBtn.style.display = this.hasMoreVouches ? 'block' : 'none';
            }
        } catch (error) {
            showToast("Error loading vouches", TOAST_TYPES.ERROR);
            if (this.vouchPage === 1) {
                vouchesList.innerHTML = '<div class="error-message">Failed to load vouches</div>';
            }
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

    async loadMoreVouches() {
        if (!this.loadMoreVouchesBtn) return;

        this.loadMoreVouchesBtn.disabled = true;
        this.loadMoreVouchesBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

        await this.loadVouches();

        this.loadMoreVouchesBtn.disabled = false;
        this.loadMoreVouchesBtn.innerHTML = 'Load More';
    }

    cleanup() {
        if (this.planCarousel) {
            this.planCarousel.destroy();
        }
        if (this.similarCarousel) {
            this.similarCarousel.destroy();
        }
    }
}

// Initialize when DOM is loaded
let subscriptionDetails;
document.addEventListener('DOMContentLoaded', () => {
    subscriptionDetails = new SubscriptionDetails();
    subscriptionDetails.init();
});

// Cleanup when navigating away
window.addEventListener('beforeunload', () => {
    if (subscriptionDetails) {
        subscriptionDetails.cleanup();
    }
});
