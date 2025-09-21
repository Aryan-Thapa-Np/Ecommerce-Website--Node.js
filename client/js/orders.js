// Orders Page JavaScript
class OrdersManager {
    constructor() {
        this.orders = [];
        this.filteredOrders = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filters = {
            status: '',
            dateRange: '',
            search: ''
        };
        
        this.init();
    }

    async init() {
        await this.loadHeaderFooter();
        await this.loadOrders();
        this.setupEventListeners();
        this.renderOrders();
    }

    async loadHeaderFooter() {
        try {
            // Load header
            const headerResponse = await fetch('/api/partials/header?currentPage=orders');
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

    async loadOrders() {
        try {
            const response = await fetch('/api/orders', {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-CSRF-Token': await this.getCsrfToken()
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.orders = data.data;
                    this.filteredOrders = [...this.orders];
                    this.renderOrders();
                } else {
                    this.showNoOrders();
                }
            } else {
                this.showNoOrders();
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showNoOrders();
        }
    }

    setupEventListeners() {
        // Status filter
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.applyFilters();
            });
        }

        // Date filter
        const dateFilter = document.getElementById('date-filter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.filters.dateRange = e.target.value;
                this.applyFilters();
            });
        }

        // Search
        const searchInput = document.getElementById('order-search');
        const searchBtn = document.getElementById('search-btn');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.applyFilters();
            });

            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyFilters();
                }
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.applyFilters();
            });
        }
    }

    applyFilters() {
        this.filteredOrders = this.orders.filter(order => {
            // Status filter
            if (this.filters.status && order.status !== this.filters.status) {
                return false;
            }

            // Date filter
            if (this.filters.dateRange) {
                const orderDate = new Date(order.created_at);
                const now = new Date();
                const daysDiff = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff > parseInt(this.filters.dateRange)) {
                    return false;
                }
            }

            // Search filter
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const orderId = order.id.toString();
                const itemName = order.item_name || '';
                const itemType = order.order_type || '';
                
                if (!orderId.includes(searchTerm) && 
                    !itemName.toLowerCase().includes(searchTerm) &&
                    !itemType.toLowerCase().includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        this.currentPage = 1;
        this.renderOrders();
    }

    renderOrders() {
        const ordersList = document.getElementById('orders-list');
        const noOrders = document.getElementById('no-orders');

        if (this.filteredOrders.length === 0) {
            if (this.orders.length === 0) {
                this.showNoOrders();
            } else {
                ordersList.innerHTML = `
                    <div class="no-orders">
                        <i class="fas fa-search"></i>
                        <h3>No Orders Found</h3>
                        <p>No orders match your current filters.</p>
                        <button class="btn btn-primary" onclick="ordersManager.clearFilters()">Clear Filters</button>
                    </div>
                `;
            }
            return;
        }

        // Hide no orders state
        if (noOrders) {
            noOrders.style.display = 'none';
        }

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedOrders = this.filteredOrders.slice(startIndex, endIndex);

        // Render orders
        ordersList.innerHTML = paginatedOrders.map(order => this.renderOrderCard(order)).join('');

        // Render pagination
        this.renderPagination();

        // Add click listeners to order cards
        this.addOrderCardListeners();
    }

    renderOrderCard(order) {
        const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const statusClass = order.status.toLowerCase();
        const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);

        return `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <div class="order-info">
                        <div class="order-id">Order #${order.id}</div>
                        <div class="order-date">${orderDate}</div>
                    </div>
                    <div class="order-status ${statusClass}">${statusText}</div>
                </div>
                <div class="order-body">
                    <div class="order-items">
                        <div class="order-item">
                            <img src="${order.item_image_url || '/images/placeholder.jpg'}" alt="${order.item_name}" class="item-image">
                            <div class="item-details">
                                <div class="item-name">${order.item_name}</div>
                                <div class="item-type">${this.formatItemType(order.order_type)}</div>
                            </div>
                            <div class="item-quantity">x${order.quantity}</div>
                        </div>
                    </div>
                </div>
                <div class="order-footer">
                    <div class="order-total">NPR ${order.total_amount.toLocaleString()}</div>
                    <div class="order-actions">
                        <button class="btn btn-outline" onclick="ordersManager.viewOrderDetails(${order.id})">
                            <i class="fas fa-eye"></i> View Details
                        </button>
                        ${order.status === 'completed' ? `
                            <button class="btn btn-primary" onclick="ordersManager.downloadInvoice(${order.id})">
                                <i class="fas fa-download"></i> Invoice
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    formatItemType(type) {
        const typeMap = {
            'subscription_plan': 'Subscription',
            'game_topup_variant': 'Game Top-up',
            'product': 'Product'
        };
        return typeMap[type] || type;
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredOrders.length / this.itemsPerPage);
        const pagination = document.getElementById('pagination');

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="ordersManager.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<button onclick="ordersManager.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span>...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="${i === this.currentPage ? 'active' : ''}" onclick="ordersManager.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span>...</span>`;
            }
            paginationHTML += `<button onclick="ordersManager.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // Next button
        paginationHTML += `
            <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="ordersManager.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        pagination.innerHTML = paginationHTML;
    }

    addOrderCardListeners() {
        const orderCards = document.querySelectorAll('.order-card');
        orderCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on buttons
                if (e.target.closest('.btn')) {
                    return;
                }
                
                const orderId = card.dataset.orderId;
                this.viewOrderDetails(parseInt(orderId));
            });
        });
    }

    async viewOrderDetails(orderId) {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-CSRF-Token': await this.getCsrfToken()
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.showOrderModal(data.data);
                } else {
                    this.showToast('Failed to load order details', 'error');
                }
            } else {
                this.showToast('Failed to load order details', 'error');
            }
        } catch (error) {
            console.error('Error loading order details:', error);
            this.showToast('An error occurred while loading order details', 'error');
        }
    }

    showOrderModal(order) {
        const modal = document.getElementById('order-modal');
        const orderDetails = document.getElementById('order-details');
        const downloadBtn = document.getElementById('download-invoice');

        if (orderDetails) {
            orderDetails.innerHTML = this.renderOrderDetails(order);
        }

        if (downloadBtn) {
            downloadBtn.style.display = order.status === 'completed' ? 'inline-flex' : 'none';
            downloadBtn.onclick = () => this.downloadInvoice(order.id);
        }

        if (modal) {
            modal.classList.add('active');
        }
    }

    renderOrderDetails(order) {
        const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const statusClass = order.status.toLowerCase();
        const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);

        return `
            <div class="detail-section">
                <h4>Order Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Order ID</div>
                        <div class="detail-value">#${order.id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Order Date</div>
                        <div class="detail-value">${orderDate}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">
                            <span class="order-status ${statusClass}">${statusText}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Payment Method</div>
                        <div class="detail-value">${this.formatPaymentMethod(order.payment_method)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Payment Status</div>
                        <div class="detail-value">${this.formatPaymentStatus(order.payment_status)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Total Amount</div>
                        <div class="detail-value">NPR ${order.total_amount.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Item Details</h4>
                <div class="order-item">
                    <img src="${order.item_image_url || '/images/placeholder.jpg'}" alt="${order.item_name}" class="item-image">
                    <div class="item-details">
                        <div class="item-name">${order.item_name}</div>
                        <div class="item-type">${this.formatItemType(order.order_type)}</div>
                        <div class="item-quantity">Quantity: ${order.quantity}</div>
                        <div class="item-price">Price: NPR ${order.total_amount.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            ${order.shipping ? `
                <div class="detail-section">
                    <h4>Shipping Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-label">Name</div>
                            <div class="detail-value">${order.shipping.first_name} ${order.shipping.last_name}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Phone</div>
                            <div class="detail-value">${order.shipping.phone}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Address</div>
                            <div class="detail-value">${order.shipping.address}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">City</div>
                            <div class="detail-value">${order.shipping.city}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">State</div>
                            <div class="detail-value">${order.shipping.state}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Postal Code</div>
                            <div class="detail-value">${order.shipping.postal_code}</div>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="detail-section">
                <h4>Order Timeline</h4>
                <div class="order-timeline">
                    ${this.renderOrderTimeline(order)}
                </div>
            </div>
        `;
    }

    renderOrderTimeline(order) {
        const timeline = [
            {
                title: 'Order Placed',
                date: order.created_at,
                icon: 'fa-shopping-cart',
                completed: true
            }
        ];

        if (order.payment_status === 'paid') {
            timeline.push({
                title: 'Payment Received',
                date: order.payment_date || order.created_at,
                icon: 'fa-credit-card',
                completed: true
            });
        }

        if (order.status === 'processing') {
            timeline.push({
                title: 'Order Processing',
                date: order.processing_date || order.created_at,
                icon: 'fa-cog',
                completed: true
            });
        }

        if (order.status === 'completed') {
            timeline.push({
                title: 'Order Completed',
                date: order.completed_date || order.updated_at,
                icon: 'fa-check-circle',
                completed: true
            });
        }

        return timeline.map(item => `
            <div class="timeline-item ${item.completed ? 'completed' : 'pending'}">
                <div class="timeline-icon">
                    <i class="fas ${item.icon}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">${item.title}</div>
                    <div class="timeline-date">${new Date(item.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</div>
                </div>
            </div>
        `).join('');
    }

    formatPaymentMethod(method) {
        const methodMap = {
            'esewa': 'eSewa',
            'khalti': 'Khalti',
            'bank_transfer': 'Bank Transfer'
        };
        return methodMap[method] || method;
    }

    formatPaymentStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'paid': 'Paid',
            'failed': 'Failed',
            'refunded': 'Refunded'
        };
        return statusMap[status] || status;
    }

    async downloadInvoice(orderId) {
        try {
            const response = await fetch(`/api/orders/${orderId}/invoice`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-CSRF-Token': await this.getCsrfToken()
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-${orderId}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                this.showToast('Failed to download invoice', 'error');
            }
        } catch (error) {
            console.error('Error downloading invoice:', error);
            this.showToast('An error occurred while downloading invoice', 'error');
        }
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderOrders();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    clearFilters() {
        this.filters = {
            status: '',
            dateRange: '',
            search: ''
        };

        // Reset form elements
        const statusFilter = document.getElementById('status-filter');
        const dateFilter = document.getElementById('date-filter');
        const searchInput = document.getElementById('order-search');

        if (statusFilter) statusFilter.value = '';
        if (dateFilter) dateFilter.value = '';
        if (searchInput) searchInput.value = '';

        this.applyFilters();
    }

    showNoOrders() {
        const ordersList = document.getElementById('orders-list');
        const noOrders = document.getElementById('no-orders');

        if (ordersList) {
            ordersList.innerHTML = '';
        }

        if (noOrders) {
            noOrders.style.display = 'block';
        }
    }

    getAuthToken() {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    }

    async getCsrfToken() {
        return await generateCsrfToken();
    }

    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            alert(message);
        }
    }
}

// Global functions for HTML onclick handlers
function closeOrderModal() {
    const modal = document.getElementById('order-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Initialize orders manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ordersManager = new OrdersManager();
}); 