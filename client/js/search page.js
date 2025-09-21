// Search Page JavaScript

import { showToast, TOAST_TYPES } from "./utils/toast.js";

// State variables
let currentPage = 1;
let itemsPerPage = 20;
let totalPages = 1;
let currentCategory = '';
let currentQuery = '';
let currentMinPrice = '';
let currentMaxPrice = '';
let currentSort = 'name-asc';
let isLoading = false;
let categories = [];

// DOM Elements
const productsGrid = document.querySelector('.search-results-grid');
const categoryList = document.querySelector('.category-list');
const paginationContainer = document.querySelector('.pagination');
const totalResultsSpan = document.querySelector('.total-results');
const itemsPerPageSelect = document.getElementById('itemsPerPage');
const sortBySelect = document.getElementById('sortBy');
const minPriceInput = document.getElementById('minPrice');
const maxPriceInput = document.getElementById('maxPrice');
const applyPriceBtn = document.getElementById('applyPrice');

// Add sanitizeQuery function
function sanitizeQuery(query) {
    return query.replace(/[<>;"'`]/g, '').trim().slice(0, 100);
}

// Add normalizeImageUrl function
function normalizeImageUrl(url) {
    if (!url) return url;
    url = url.replace(/\\/g, '/');
    if (url.startsWith('public/')) return '/' + url.slice(7);
    if (url.startsWith('/public/')) return '/' + url.slice(8);
    return url;
}

// Helper to normalize tags to array
function getTagsArray(tags) {
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
        try {
            const parsed = JSON.parse(tags);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [tags];
        }
    }
    return [];
}

// Initialize page
async function init() {
    // Get query parameters
    const urlParams = new URLSearchParams(window.location.search);
    currentQuery = sanitizeQuery(urlParams.get('q') || '');
    currentCategory = urlParams.get('category') || '';
    currentMinPrice = urlParams.get('minPrice') || '';
    currentMaxPrice = urlParams.get('maxPrice') || '';
    currentSort = urlParams.get('sort') || 'name-asc';
    currentPage = parseInt(urlParams.get('page')) || 1;
    itemsPerPage = parseInt(urlParams.get('limit')) || 20;

    // Set initial values
    minPriceInput.value = currentMinPrice;
    maxPriceInput.value = currentMaxPrice;
    sortBySelect.value = currentSort;
    itemsPerPageSelect.value = itemsPerPage;

    // Load categories and products
    await Promise.all([
        loadCategories(),
        loadProducts()
    ]);

    // Setup event listeners
    setupEventListeners();
}

// Load categories
async function loadCategories() {
    try {
        const response = await fetch('/api/products/categories');
        const data = await response.json();

        if(data.status === "error"){
            
            return;
        }

        if (data.success) {
            categories = data.data;
            updateCategoryList();
        }
    } catch (error) {
       
        showToast('Failed to load categories', TOAST_TYPES.ERROR);
    }
}

// Update category list UI
function updateCategoryList() {
    if (!categoryList) return;

    let html = '';
    categories.forEach(mainCat => {
        if (!mainCat || !mainCat.sub_categories) return;

        html += `
            <div class="category-group">
                <div class="category-item ${currentCategory === mainCat.name ? 'active' : ''}" 
                     data-category="${mainCat.name}">
                    <span>${mainCat.name}</span>
                    <span class="category-count">${mainCat.sub_categories.length}</span>
                </div>
                ${mainCat.sub_categories.map(subCat => `
                    <div class="category-item sub-category ${currentCategory === subCat.name ? 'active' : ''}" 
                         data-category="${subCat.name}">
                        <span>${subCat.name}</span>
                        <span class="category-count">${subCat.count || 0}</span>
                    </div>
                `).join('')}
            </div>
        `;
    });

    categoryList.innerHTML = html;

    // Add event listeners to category items
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', () => {
            const category = item.dataset.category;
            // Build new URL with q=category (for subcategories)
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.delete('category');
            urlParams.set('q', category);
            window.location.href = `/search?${urlParams.toString()}`;
        });
    });
}

// Load products with current filters
async function loadProducts() {
    if (isLoading) return;
    isLoading = true;
    try {
        if (productsGrid) {
            productsGrid.classList.add('loading');
            productsGrid.innerHTML = `<div class="no-results"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading...</p></div>`;
        }
        // Build query parameters
        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage
        });
        if (currentQuery) params.append('q', currentQuery);
        if (currentCategory) params.append('category', currentCategory);
        if (currentMinPrice) params.append('minPrice', currentMinPrice);
        if (currentMaxPrice) params.append('maxPrice', currentMaxPrice);
        const [sortField, sortOrder] = currentSort.split('-');
        // Map sortBy=price to current_price for backend
        let sortFieldMapped = sortField;
        if (sortField === 'price') sortFieldMapped = 'current_price';
        params.append('sortBy', sortFieldMapped);
        params.append('order', sortOrder.toUpperCase());
        // Fetch products
        const fetchPromise = fetch(`/api/products/search?${params.toString()}`)
            .then(response => response.json());
        // Wait at least 1s
        const delayPromise = new Promise(resolve => setTimeout(resolve, 1000));
        const [data] = await Promise.all([fetchPromise, delayPromise]);
        console.log(data);

        if(data.status === "error"){
        
            return;
        }

        if (data.success) {
            try {
                const { products, subscriptions, games, pagination } = data.data;
                totalPages = pagination.totalPages;
                updateProductsGrid({ products, subscriptions, games });
                updatePagination();
                updateTotalResults(pagination.total);
            } catch (err) {
                console.error('Error inside data.success block:', err);
                throw err; // rethrow so the outer catch still works
            }
        } else {
            if (productsGrid) {
                productsGrid.innerHTML = `<div class="no-results"><i class="fa-solid fa-box-open"></i><p>No results found</p></div>`;
            }
        }
    } catch (error) {
       
        showToast('Failed to load products', TOAST_TYPES.ERROR);
        if (productsGrid) {
            productsGrid.innerHTML = `<div class="no-results"><i class="fa-solid fa-box-open"></i><p>Failed to load results</p></div>`;
        }
    } finally {
        isLoading = false;
        if (productsGrid) {
            productsGrid.classList.remove('loading');
        }
    }
}

// Update products grid
function updateProductsGrid(data) {
    const productsGrid = document.querySelector('.search-results-grid');
    if (!productsGrid) return;
    const { products = [], subscriptions = [], games = [] } = data;
    let html = '';
    let hasResults = false;

    // Subscriptions
    if (subscriptions.length > 0) {
        hasResults = true;
        html += `<div class="search-section"><h3>Subscriptions</h3><div class="search-products-grid">`;
        subscriptions.forEach(sub => {
            html += `
                <div class="search-product-card" onclick="window.location.href='/subscription/${sub.id}?plan=${sub.plans && sub.plans[0] ? sub.plans[0].id : ''}'">
                    <img class="product-img" src="${normalizeImageUrl(sub.logo_url)}" alt="${sub.name}" loading="lazy">
                    <div class="product-content">
                        <h3 class="product-title">${sub.name}</h3>
                        <div class="product-price">
                            ${sub.plans && sub.plans.length > 0 ? `NPR ${sub.plans[0].price.toLocaleString()} / ${sub.plans[0].billing_cycle}` : ''}
                        </div>
                        <div class="product-meta">
                            <span>${sub.description || ''}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    // Games
    if (games.length > 0) {
        hasResults = true;
        html += `<div class="search-section"><h3>Game Top-up</h3><div class="search-products-grid">`;
        games.forEach(game => {
            // In-game (topup) variants
            const inGameVariants = game.variants ? game.variants.filter(v => v.topup_type === 'in_game' && v.is_active) : [];
            if (inGameVariants.length > 0) {
                const minPrice = Math.min(...inGameVariants.map(v => v.price));
                const maxPrice = Math.max(...inGameVariants.map(v => v.price));
                html += `
                    <div class="search-product-card" onclick="window.location.href='/game/${game.id}/topup'">
                        <img class="product-img" src="${normalizeImageUrl(game.game_image_url)}" alt="${game.game_name}" loading="lazy">
                        <div class="product-content">
                            <div class="product-tags">
                                ${getTagsArray(game.tags).map(tag => `
                                    <span class="tag ${tag.includes('New') ? 'tag-new' : tag.includes('-') ? 'tag-discount' : ''}">${tag}</span>
                                `).join('')}
                            </div>
                            <h3 class="product-title">${game.game_name}</h3>
                            <div class="product-price">
                                NPR ${minPrice.toLocaleString()}${minPrice !== maxPrice ? ` - NPR ${maxPrice.toLocaleString()}` : ''}
                            </div>
                            <div class="product-meta">
                                <span>${inGameVariants[0].description || game.description || ''}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            // Pass variants
            const passVariants = game.variants ? game.variants.filter(v => v.topup_type === 'pass' && v.is_active) : [];
            passVariants.forEach(passVariant => {
                html += `
                    <div class="search-product-card" onclick="window.location.href='/game/${game.id}/pass?variant=${passVariant.id}'">
                        <img class="product-img" src="${normalizeImageUrl(game.game_image_url)}" alt="${game.game_name} Pass" loading="lazy">
                        <div class="product-content">
                            <div class="product-tags">
                                ${getTagsArray(game.tags).map(tag => `
                                    <span class="tag ${tag.includes('New') ? 'tag-new' : tag.includes('-') ? 'tag-discount' : ''}">${tag}</span>
                                `).join('')}
                            </div>
                            <h3 class="product-title">${game.game_name}</h3>
                            <div class="product-price">
                                NPR ${passVariant.price.toLocaleString()}${passVariant.quantity ? ` / ${passVariant.quantity}` : ''}
                            </div>
                            <div class="product-meta">
                                <span>${passVariant.description || game.description || ''}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
        });
        html += `</div></div>`;
    }
    // Products
    if (products.length > 0) {
        hasResults = true;
        html += `<div class="search-section"><h3>Products</h3><div class="search-products-grid">`;
        products.forEach(product => {
            html += `
                <div class="search-product-card" onclick="window.location.href='/product-details/${product.slug}'">
                    <img class="product-img" src="${normalizeImageUrl(product.image_url)}" alt="${product.name}" loading="lazy">
                    <div class="product-content">
                        <div class="product-tags">
                            ${getTagsArray(product.tags).map(tag => `
                                <span class="tag ${tag.includes('New') ? 'tag-new' : tag.includes('-') ? 'tag-discount' : ''}">${tag}</span>
                            `).join('')}
                        </div>
                        <h3 class="product-title">${product.name}</h3>
                        <div class="product-price">
                            NPR ${product.current_price.toLocaleString()}
                            ${product.original_price && product.original_price > product.current_price ? 
                                `<span class="price-original">NPR ${product.original_price.toLocaleString()}</span>` : ''}
                        </div>
                        <div class="product-meta">
                            <div class="product-rating">
                                <i class="fa-solid fa-star"></i>
                                ${product.rating} (${product.review_count} reviews)
                            </div>
                            <div class="${product.stock_status === 'in_stock' ? 'text-success' : 'text-danger'}">
                                <i class="fa-solid fa-${product.stock_status === 'in_stock' ? 'check' : 'times'}-circle"></i>
                                ${product.stock_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    if (!hasResults) {
        html = `
            <div class="no-results">
                <i class="fa-solid fa-box-open"></i>
                <p>No results found</p>
            </div>
        `;
    }
    productsGrid.innerHTML = html;
}

// Update pagination
function updatePagination() {
    if (!paginationContainer) return;

    let html = '';

    // Previous button
    html += `
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" 
                ${currentPage === 1 ? 'disabled' : ''} 
                data-page="${currentPage - 1}">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 || // First page
            i === totalPages || // Last page
            (i >= currentPage - 2 && i <= currentPage + 2) // Pages around current page
        ) {
            html += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                        data-page="${i}">
                    ${i}
                </button>
            `;
        } else if (
            (i === currentPage - 3 && currentPage > 4) ||
            (i === currentPage + 3 && currentPage < totalPages - 3)
        ) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }

    // Next button
    html += `
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                ${currentPage === totalPages ? 'disabled' : ''} 
                data-page="${currentPage + 1}">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    paginationContainer.innerHTML = html;

    // Add event listeners to pagination buttons
    document.querySelectorAll('.pagination-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.dataset.page);
            updateURL();
            loadProducts();
            window.scrollTo(0, 0);
        });
    });
}

// Update total results count
function updateTotalResults(total) {
    if (totalResultsSpan) {
        totalResultsSpan.textContent = `${total} results found`;
    }
}

// Setup event listeners
function setupEventListeners() {
    // Items per page change
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', () => {
            itemsPerPage = parseInt(itemsPerPageSelect.value);
            currentPage = 1;
            updateURL();
            loadProducts();
        });
    }

    // Sort change
    if (sortBySelect) {
        sortBySelect.addEventListener('change', () => {
            currentSort = sortBySelect.value;
            currentPage = 1;
            updateURL();
            loadProducts();
        });
    }

    // Price filter
    if (applyPriceBtn) {
        applyPriceBtn.addEventListener('click', () => {
            currentMinPrice = minPriceInput.value;
            currentMaxPrice = maxPriceInput.value;
            currentPage = 1;
            updateURL();
            loadProducts();
        });
    }

    // Mobile filter toggle
    const filterToggle = document.querySelector('.filter-toggle');
    const searchFilters = document.querySelector('.search-filters');
    
    if (filterToggle && searchFilters) {
        filterToggle.addEventListener('click', () => {
            searchFilters.classList.toggle('active');
        });

        // Close filters when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchFilters.contains(e.target) && !filterToggle.contains(e.target)) {
                searchFilters.classList.remove('active');
            }
        });
    }
}

// Update URL with current filters
function updateURL() {
    const params = new URLSearchParams();
    
    if (currentQuery) params.set('q', currentQuery);
    if (currentCategory) params.set('category', currentCategory);
    if (currentMinPrice) params.set('minPrice', currentMinPrice);
    if (currentMaxPrice) params.set('maxPrice', currentMaxPrice);
    if (currentSort !== 'name-asc') params.set('sort', currentSort);
    if (currentPage > 1) params.set('page', currentPage);
    if (itemsPerPage !== 20) params.set('limit', itemsPerPage);

    const newURL = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.pushState({}, '', newURL);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);


