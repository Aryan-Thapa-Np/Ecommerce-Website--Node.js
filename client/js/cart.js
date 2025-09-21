// Cart Page JavaScript
class CartPage {
    constructor() {
        this.cartItems = [];
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.loadHeaderAndFooter();
        this.bindEvents();
        this.loadCart();
    }

    async loadHeaderAndFooter() {
        try {
            // Load header
            const headerResponse = await fetch('/api/partials/header');
            if (headerResponse.ok) {
                const headerHtml = await headerResponse.text();
                document.getElementById('header-placeholder').innerHTML = headerHtml;
            }

            // Load footer
            const footerResponse = await fetch('/api/partials/footer');
            if (footerResponse.ok) {
                const footerHtml = await footerResponse.text();
                document.getElementById('footer-placeholder').innerHTML = footerHtml;
            }
        } catch (error) {
            console.error('Error loading header/footer:', error);
        }
    }

    bindEvents() {
        // Clear cart button
        document.getElementById('clearCartBtn').addEventListener('click', () => {
            this.clearCart();
        });

        // Checkout button
        document.getElementById('checkoutBtn').addEventListener('click', () => {
            this.proceedToCheckout();
        });

        // Continue shopping button
        document.getElementById('continueShoppingBtn').addEventListener('click', () => {
            window.location.href = '/';
        });

        // Promo code
        document.getElementById('applyPromoBtn').addEventListener('click', () => {
            this.applyPromoCode();
        });

        // Promo code input enter key
        document.getElementById('promoCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyPromoCode();
            }
        });
    }

    async loadCart() {
        this.showLoading();

        try {
            const response = await fetch('/api/products/cart');
            
            if (!response.ok) {
                if (response.status === 401) {
                    // User not logged in, redirect to login
                    window.location.href = '/login';
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.cartItems = data.data.items || [];
                this.displayCart();
            } else {
                this.showEmptyCart();
            }
        } catch (error) {
            console.error('Error loading cart:', error);
            this.showEmptyCart();
        }
    }

    displayCart() {
        if (this.cartItems.length === 0) {
            this.showEmptyCart();
            return;
        }

        // Update cart item count
        document.getElementById('cartItemCount').textContent = `${this.cartItems.length} item${this.cartItems.length !== 1 ? 's' : ''}`;

        // Display cart items
        this.displayCartItems();

        // Update summary
        this.updateSummary();

        // Show cart content
        this.hideLoading();
        document.getElementById('cartContent').style.display = 'block';
    }

    displayCartItems() {
        const cartItemsList = document.getElementById('cartItemsList');
        
        cartItemsList.innerHTML = this.cartItems.map(item => this.createCartItemHTML(item)).join('');

        // Bind quantity control events
        this.bindQuantityEvents();
    }

    createCartItemHTML(item) {
        const itemType = this.getItemType(item.item_type);
        const typeClass = this.getTypeClass(itemType);
        const typeLabel = this.getTypeLabel(itemType);
        const image = item.item_image || 'https://via.placeholder.com/80x80?text=No+Image';
        const title = item.item_name || 'Unknown Item';
        const price = item.price || 0;
        const quantity = item.quantity || 1;

        return `
            <div class="cart-item" data-item-id="${item.id}">
                <div class="cart-item-image">
                    <img src="${image}" alt="${title}" onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'">
                </div>
                
                <div class="cart-item-details">
                    <div class="cart-item-title">${title}</div>
                    <span class="cart-item-type ${typeClass}">${typeLabel}</span>
                    <div class="cart-item-price">NPR ${price.toLocaleString()}</div>
                </div>
                
                <div class="cart-item-actions">
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="cartPage.updateQuantity(${item.id}, -1)" ${quantity <= 1 ? 'disabled' : ''}>-</button>
                        <input type="number" class="quantity-input" value="${quantity}" min="1" max="99" onchange="cartPage.updateQuantityInput(${item.id}, this.value)">
                        <button class="quantity-btn" onclick="cartPage.updateQuantity(${item.id}, 1)">+</button>
                    </div>
                    <button class="remove-btn" onclick="cartPage.removeItem(${item.id})">
                        <i class="fa-solid fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }

    getItemType(itemType) {
        switch (itemType) {
            case 'subscription_plan':
                return 'subscription';
            case 'game_topup_variant':
                return 'game';
            case 'product':
                return 'product';
            default:
                return 'product';
        }
    }

    getTypeClass(type) {
        const classes = {
            subscription: 'subscription',
            game: 'game',
            product: 'product'
        };
        return classes[type] || 'product';
    }

    getTypeLabel(type) {
        const labels = {
            subscription: 'Subscription',
            game: 'Game',
            product: 'Product'
        };
        return labels[type] || 'Product';
    }

    bindQuantityEvents() {
        // Quantity events are handled inline for simplicity
        // In a more complex implementation, you might want to use event delegation
    }

    async updateQuantity(itemId, change) {
        const item = this.cartItems.find(item => item.id == itemId);
        if (!item) return;

        const newQuantity = Math.max(1, Math.min(99, item.quantity + change));
        
        if (newQuantity === item.quantity) return;

        try {
            const response = await fetch(`/api/products/cart/update/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quantity: newQuantity
                })
            });

            const data = await response.json();
            if(data.status === 'error'){
                showToast(data.message || 'Failed to update cart', 'error');
                return;
            }

            if (data.success) {
                item.quantity = newQuantity;
                this.updateCartItemDisplay(itemId, newQuantity);
                this.updateSummary();
                showToast('Cart updated successfully!', 'success');
            } else {
                showToast(data.message || 'Failed to update cart', 'error');
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            showToast('An error occurred while updating cart', 'error');
        }
    }

    async updateQuantityInput(itemId, value) {
        const quantity = parseInt(value) || 1;
        const item = this.cartItems.find(item => item.id == itemId);
        if (!item || quantity === item.quantity) return;

        try {
            const response = await fetch(`/api/products/cart/update/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quantity: quantity
                })
            });

            const data = await response.json();

            if(data.status === 'error'){
                showToast(data.message || 'Failed to update cart', 'error');
                return;
            }

            if (data.success) {
                item.quantity = quantity;
                this.updateSummary();
                showToast('Cart updated successfully!', 'success');
            } else {
                showToast(data.message || 'Failed to update cart', 'error');
                // Reset input to original value
                const input = document.querySelector(`[data-item-id="${itemId}"] .quantity-input`);
                if (input) input.value = item.quantity;
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            showToast('An error occurred while updating cart', 'error');
            // Reset input to original value
            const input = document.querySelector(`[data-item-id="${itemId}"] .quantity-input`);
            if (input) input.value = item.quantity;
        }
    }

    updateCartItemDisplay(itemId, quantity) {
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemElement) {
            const input = itemElement.querySelector('.quantity-input');
            const decreaseBtn = itemElement.querySelector('.quantity-btn:first-child');
            
            if (input) input.value = quantity;
            if (decreaseBtn) {
                decreaseBtn.disabled = quantity <= 1;
            }
        }
    }

    async removeItem(itemId) {
        if (!confirm('Are you sure you want to remove this item from your cart?')) {
            return;
        }

        try {
            const response = await fetch(`/api/products/cart/remove/${itemId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if(data.status === 'error'){
                showToast(data.message || 'Failed to remove item', 'error');
                return;
            }

            if (data.success) {
                this.cartItems = this.cartItems.filter(item => item.id != itemId);
                
                if (this.cartItems.length === 0) {
                    this.showEmptyCart();
                } else {
                    this.displayCart();
                }
                
                showToast('Item removed from cart', 'success');
            } else {
                showToast(data.message || 'Failed to remove item', 'error');
            }
        } catch (error) {
            console.error('Error removing item:', error);
            showToast('An error occurred while removing item', 'error');
        }
    }

    async clearCart() {
        if (!confirm('Are you sure you want to clear your entire cart?')) {
            return;
        }

        try {
            const response = await fetch('/api/products/cart/clear', {
                method: 'DELETE'
            });

            const data = await response.json();

            if(data.status === 'error'){
                showToast(data.message || 'Failed to clear cart', 'error');
                return;
            }

            if (data.success) {
                this.cartItems = [];
                this.showEmptyCart();
                showToast('Cart cleared successfully', 'success');
            } else {
                showToast(data.message || 'Failed to clear cart', 'error');
            }
        } catch (error) {
            console.error('Error clearing cart:', error);
            showToast('An error occurred while clearing cart', 'error');
        }
    }

    updateSummary() {
        const subtotal = this.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = subtotal > 1000 ? 0 : 200; // Free shipping over NPR 1000
        const tax = subtotal * 0.13; // 13% tax
        const total = subtotal + shipping + tax;

        document.getElementById('subtotal').textContent = `NPR ${subtotal.toLocaleString()}`;
        document.getElementById('shipping').textContent = shipping === 0 ? 'Free' : `NPR ${shipping.toLocaleString()}`;
        document.getElementById('tax').textContent = `NPR ${tax.toLocaleString()}`;
        document.getElementById('total').textContent = `NPR ${total.toLocaleString()}`;
    }

    applyPromoCode() {
        const promoCode = document.getElementById('promoCode').value.trim();
        
        if (!promoCode) {
            showToast('Please enter a promo code', 'warning');
            return;
        }

        // For now, just show a placeholder message
        // In a real implementation, you would validate the promo code with the server
        showToast('Promo code functionality will be implemented soon', 'info');
        document.getElementById('promoCode').value = '';
    }

    proceedToCheckout() {
        if (this.cartItems.length === 0) {
            showToast('Your cart is empty', 'warning');
            return;
        }

        // For now, just show a placeholder message
        // In a real implementation, you would redirect to a checkout page
        showToast('Checkout functionality will be implemented soon', 'info');
    }

    showEmptyCart() {
        this.hideLoading();
        document.getElementById('emptyCartState').style.display = 'flex';
        document.getElementById('cartContent').style.display = 'none';
    }

    showLoading() {
        this.isLoading = true;
        document.getElementById('loadingState').style.display = 'flex';
        document.getElementById('cartContent').style.display = 'none';
        document.getElementById('emptyCartState').style.display = 'none';
    }

    hideLoading() {
        this.isLoading = false;
        document.getElementById('loadingState').style.display = 'none';
    }
}

// Initialize cart page when DOM is loaded
let cartPage;
document.addEventListener('DOMContentLoaded', () => {
    cartPage = new CartPage();
});

// Global function for toast notifications
function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        // Fallback toast implementation
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
} 