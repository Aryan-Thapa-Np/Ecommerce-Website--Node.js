import { csrftoken } from "./utils/generateCsrf.js";



// Lazy loading observer
const lazyImageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const img = entry.target;
      if (img.dataset.src) {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    }
  });
}, {
  rootMargin: '50px 0px', // Start loading when image is 50px from viewport
  threshold: 0.01
});

// Function to initialize lazy loading for images
function initializeLazyLoading() {
  document.querySelectorAll('img[data-src]').forEach(img => {
    lazyImageObserver.observe(img);
  });
}

// Helper to normalize image URLs
function normalizeImageUrl(url) {
  if (!url) return url;
  url = url.replace(/\\/g, '/');
  if (url.startsWith('public/')) return '/' + url.slice(7);
  if (url.startsWith('/public/')) return '/' + url.slice(8);
  return url;
}

// Function to create lazy loading image HTML
function createLazyImageHtml(src, alt, className = '') {
  src = normalizeImageUrl(src);
  // Check if the source is a video file
  if (isVideoUrl(src)) {
    // Use a fallback image or placeholder
    return `
      <div class="${className} placeholder-img">
        <i class="fas fa-image" style="font-size: 24px; color: #cbd5e1;"></i>
      </div>
    `;
  }
  
  return `
    <img 
      class="${className}" 
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'%3E%3C/svg%3E"
      data-src="${src}" 
      alt="${alt || ''}" 
      loading="lazy"
      onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 4 3\'%3E%3C/svg%3E'; this.classList.add('img-error');"
    >
  `;
}

// Helper function to check if a URL is a video
function isVideoUrl(url) {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
}

// Helper to get correct FontAwesome icon class
function getFaIconClass(icon, available) {
  // If icon is fa-check or fa-times, prepend fa-solid
  let iconName = icon && icon.startsWith('fa-') ? icon.replace(/^fa-/, '') : (available ? 'fa-check' : 'fa-times');
  return `fa-solid fa-${iconName}`;
}

// Function to update slider section
function updateSliderSection(sliderImages) {
  const sliderTrack = document.querySelector('.slider-track');
  if (!sliderTrack) return;

  let sliderHtml = '';
  if (sliderImages && sliderImages.length > 0) {
    sliderImages.forEach(image => {
      sliderHtml += `
        <div class="slider-item">
          ${image.link_url ? `<a href="${image.link_url}" class="slider-link">` : ''}
          ${createLazyImageHtml(image.image_url, image.alt_text || 'Slider Image', 'slider-img')}
          <div class="slider-content">
            <h2 class="slider-title">${image.title || ''}</h2>
            ${image.description ? `<p class="slider-description">${image.description}</p>` : ''}
            ${image.button_text && image.button_url ? 
              `<a href="${image.button_url}" class="btn btn-primary slider-cta">
                ${image.button_text}
              </a>` : ''
            }
          </div>
          ${image.link_url ? '</a>' : ''}
        </div>
      `;
    });
  } else {
    sliderHtml = `
      <div class="slider-item">
        <div class="no-data-message">
          <i class="fa-solid fa-image"></i>
          <p>No slider images available</p>
        </div>
      </div>
    `;
  }
  sliderTrack.innerHTML = sliderHtml;
  
  // Initialize lazy loading for new images
  initializeLazyLoading();
  
  // Reinitialize the slider
  const mainSlider = document.querySelector('.slider:not(.subscriptions-slider)');
  if (mainSlider) {
    new MainSlider(mainSlider);
  }
}

// Function to update marquee section
function updateMarqueeSection(promoImages) {
  const marqueeTrack = document.querySelector('.marquee-track');
  if (!marqueeTrack) return;

  let marqueeHtml = '';
  if (promoImages && promoImages.length > 0) {
    // First set
    promoImages.forEach(image => {
      marqueeHtml += `
        <div class="marquee-item">
          ${image.link_url ? `<a href="${image.link_url}" target="_blank" rel="noopener noreferrer">` : ''}
          ${createLazyImageHtml(image.image_url, image.alt_text || 'Product', 'marquee-img')}
          ${image.link_url ? '</a>' : ''}
        </div>
      `;
    });
    // Duplicate set for seamless loop
    promoImages.forEach(image => {
      marqueeHtml += `
        <div class="marquee-item">
          ${image.link_url ? `<a href="${image.link_url}" target="_blank" rel="noopener noreferrer">` : ''}
          ${createLazyImageHtml(image.image_url, image.alt_text || 'Product', 'marquee-img')}
          ${image.link_url ? '</a>' : ''}
        </div>
      `;
    });
  } else {
    marqueeHtml = `
      <div class="marquee-item">
        <div class="no-data-message">
          <i class="fa-solid fa-images"></i>
          <p>No promo images available</p>
        </div>
      </div>
    `;
  }
  marqueeTrack.innerHTML = marqueeHtml;
  
  // Initialize lazy loading for new images
  initializeLazyLoading();
}

// Function to update subscriptions section
function updateSubscriptionsSection(subscriptions) {
  const subscriptionsTrack = document.querySelector('.subscriptions-track');
  if (!subscriptionsTrack) return;

  let subscriptionsHtml = '';
  if (subscriptions && subscriptions.length > 0) {
    subscriptions.forEach(subscription => {
      if (subscription.plans && subscription.plans.length > 0) {
        const defaultPlan = subscription.plans.find(plan => plan.is_active) || subscription.plans[0];
        subscriptionsHtml += `
          <div class="subscriptions-item" data-subscription-id="${subscription.id}">
            <a href="/subscription/${subscription.id}?plan=${defaultPlan.id}" class="subscription-link">
              ${createLazyImageHtml(subscription.logo_url, subscription.name, 'subscriptions-logo')}
              <div class="subscription-title">${subscription.name}</div>
              <div class="subscription-price">
                NPR ${defaultPlan.price.toLocaleString()}/${defaultPlan.billing_cycle}
              </div>
              <ul class="subscription-features">
                ${defaultPlan.features ? 
                  JSON.parse(defaultPlan.features).map(feature => 
                    `<li><i class="${getFaIconClass(feature.icon, feature.available)}"></i> ${feature.text}</li>`
                  ).join('') : 
                  `<li><i class="fa-solid fa-check"></i> Premium features</li>
                   <li><i class="fa-solid fa-check"></i> Ad-free experience</li>
                   <li><i class="fa-solid fa-check"></i> High quality content</li>`
                }
              </ul>
            </a>
          </div>
        `;
      }
    });
  } else {
    subscriptionsHtml = `
      <div class="subscriptions-item">
        <div class="no-data-message">
          <i class="fa-solid fa-ticket"></i>
          <p>No subscriptions available</p>
        </div>
      </div>
    `;
  }
  subscriptionsTrack.innerHTML = subscriptionsHtml;
  
  // Initialize lazy loading for new images
  initializeLazyLoading();

  // Reinitialize the subscription slider
  const subscriptionSlider = document.querySelector('.subscriptions-slider');
  if (subscriptionSlider) {
    new SubscriptionSlider(subscriptionSlider);
  }
}

// Function to update games section
function updateGamesSection(games) {
  const gameGrid = document.querySelector('.game-grid');
  if (!gameGrid) return;

  let gamesHtml = '';
  if (games && games.length > 0) {
    games.forEach(game => {
      if (game.variants && game.variants.length > 0) {
        const inGameVariants = game.variants.filter(v => v.topup_type === 'in_game' && v.is_active);
        const passVariants = game.variants.filter(v => v.topup_type === 'pass' && v.is_active);

        if (inGameVariants.length > 0) {
          const minPrice = Math.min(...inGameVariants.map(v => v.price));
          const maxPrice = Math.max(...inGameVariants.map(v => v.price));
          gamesHtml += `
            <div class="game-card" data-game-id="${game.id}">
              <a href="/game/${game.id}/topup" class="game-link">
                ${createLazyImageHtml(game.game_image_url, game.game_name, 'game-img')}
                <div class="game-content">
                  <span class="game-pass-tag">In-Game</span>
                  <h3>${game.game_name}</h3>
                  <p>${inGameVariants[0].description || 'Top-up Credits'}</p>
                  <div class="price-range">NPR ${minPrice.toLocaleString()} - NPR ${maxPrice.toLocaleString()}</div>
                </div>
              </a>
            </div>
          `;
        }

        if (passVariants.length > 0) {
          const passVariant = passVariants[0];
          gamesHtml += `
            <div class="game-card" data-game-id="${game.id}">
              <a href="/game/${game.id}/pass?variant=${passVariant.id}" class="game-link">
                ${createLazyImageHtml(game.game_image_url, `${game.game_name} Pass`, 'game-img')}
                <div class="game-content">
                  <span class="game-pass-tag">${passVariant.variant_name}</span>
                  <h3>${game.game_name}</h3>
                  <p>${passVariant.description || 'Monthly Pass'}</p>
                  <div class="price-range">NPR ${passVariant.price.toLocaleString()}/${passVariant.quantity}</div>
                </div>
              </a>
            </div>
          `;
        }
      }
    });
  }
  if (!gamesHtml) {
    gamesHtml = `
      <div class="game-card">
        <div class="no-data-message">
          <i class="fa-solid fa-gamepad"></i>
          <p>No games available</p>
        </div>
      </div>
    `;
  }
  gameGrid.innerHTML = gamesHtml;
  
  // Initialize lazy loading for new images
  initializeLazyLoading();
}

// Function to view product details
function viewProductDetails(productSlug) {
  window.location.href = `/product-details/${productSlug}`;
}

// Function to update products section
function updateProductsSection(products) {
  const productsGrid = document.querySelector('.products-grid');
  if (!productsGrid) return;

  let productsHtml = '';
  if (products && products.length > 0) {
    products.forEach(product => {
      // Skip products without an image or with a video as the image
      if (!product.image_url || isVideoUrl(product.image_url)) {
        console.warn(`Product ${product.id} (${product.name}) has no valid image, using placeholder`);
        // Continue with the product but use a placeholder
      }
      // Calculate discount if applicable
      let discount = null;
      if (product.original_price && product.original_price > product.current_price) {
        discount = Math.round(100 * (product.original_price - product.current_price) / product.original_price);
      }
      productsHtml += `
        <div class="product-card" data-product-id="${product.id}" data-product-slug="${product.slug}" onclick="viewProductDetails('${product.slug}')" style="cursor: pointer; position:relative;">
          ${discount ? `<span class="discount-label">${discount}% OFF</span>` : ''}
          ${createLazyImageHtml(product.image_url, product.name, 'product-img')}
          <div class="product-content">
            <div class="product-tags">
              ${product.tags ? 
                JSON.parse(product.tags).map(tag => {
                  let tagClass = 'tag';
                  if (tag.includes('New')) tagClass += ' tag-new';
                  else if (tag.includes('-')) tagClass += ' tag-discount';
                  return `<span class="${tagClass}">${tag}</span>`;
                }).join('') : ''}
            </div>
            <h3 class="product-title">${product.name}</h3>
            <div class="product-price">
              NPR ${product.current_price.toLocaleString()}
              ${product.original_price && product.original_price > product.current_price ? 
                `<span class="price-original">NPR ${product.original_price.toLocaleString()}</span>` : ''}
            </div>
            <div class="product-meta">
              <div class="product-rating">
                <i class="fa-solid fa-star"></i> ${product.rating.toFixed(1)} (${product.review_count} reviews)
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
  } else {
    productsHtml = `
      <div class="product-card">
        <div class="no-data-message">
          <i class="fa-solid fa-box"></i>
          <p>No products available</p>
        </div>
      </div>
    `;
  }
  productsGrid.innerHTML = productsHtml;
  
  // Initialize lazy loading for new images
  initializeLazyLoading();
}

// Fetch backend data from server
async function fetchBackendData() {
  try {
    const response = await fetch('/api/products/homepage');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if(data.status === "error"){
      return;
    }



    
    if (data.success) {
      // Store data globally
      window.backendData = data.data;
  
      // Update all sections with the new data
      updateSliderSection(data.data.sliderImages);
      updateMarqueeSection(data.data.promoImages);
      updateSubscriptionsSection(data.data.subscriptions);
      updateGamesSection(data.data.games);
      updateProductsSection(data.data.products);
    
      
      return data.data;
    } else {
     
      return {
        subscriptions: [],
        games: [],
        products: [],
        sliderImages: [],
        promoImages: []
      };
    }
  } catch (error) {
   
    return {
      subscriptions: [],
      games: [],
      products: [],
      sliderImages: [],
      promoImages: []
    };
  }
}

// Initialize page with backend data
async function initializePage() {
  await fetchBackendData();
}

// Use backend data from global scope (injected by EJS)
let backendData = window.backendData || {};

// Function to subscribe to a service
function subscribeToService(subscriptionId, planId) {
  // Add to cart or redirect to subscription page
  fetch('/api/products/subscriptions/' + subscriptionId, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  })
  .then(response => response.json())
  .then(data => {
    if(data.status === "error"){
      return;
    }
    if (data.success) {
      // Redirect to subscription details page
      window.location.href = `/subscription/${subscriptionId}?plan=${planId}`;
    } else {
     console.log();
    }
  })
  .catch(error => {
    console.log();
  });
}

// Function to top up a game
function topUpGame(gameId) {
  // Redirect to game top-up page
  window.location.href = `/game/${gameId}/topup`;
}

// Function to subscribe to a game pass
function subscribeToGame(gameId, variantId) {
  // Redirect to game pass page
  window.location.href = `/game/${gameId}/pass?variant=${variantId}`;
}

// Function to check if user is logged in
function isUserLoggedIn() {
    // This should check your authentication state
    // For now, we'll assume user is not logged in
    return false;
  }

// Load additional data via AJAX if needed
function loadAdditionalData() {
    // This function can be used to load more data dynamically
    // For example, loading more products when user scrolls
    fetch('/api/products/homepage')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if(data.status === "error"){
          return;
        }
        if (data.success) {
         
          // Update global data
          backendData = { ...backendData, ...data.data };
        
        } else {
        console.log();
        }
      })
      .catch(error => {
        
      });
  }

// Newsletter subscription
document.addEventListener('DOMContentLoaded', async function() {
    window.csrfToken = await csrftoken();

    // Initialize page with backend data
    initializePage();
  });

// Loading overlay handler
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      document.body.style.overflow = '';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 300); // Wait for fade out animation
    }
  }, 1000);
});

// Make functions globally available
window.loadAdditionalData = loadAdditionalData;
window.viewProductDetails = viewProductDetails;


// Main Slider Class for Hero Section
   class MainSlider {
    constructor(element) {
      this.slider = element;
      this.track = element.querySelector('.slider-track');
      if (!this.track) return;

      this.slides = Array.from(this.track.children);
      if (this.slides.length === 0) return;

      this.dotsContainer = element.querySelector('.slider-dots');
      this.prevButton = element.querySelector('.prev');
      this.nextButton = element.querySelector('.next');

      this.currentIndex = 0;
      this.slideWidth = 0;
      this.autoplayInterval = null;
      this.touchStartX = 0;
      this.touchEndX = 0;
      this.touchStartY = 0;
      this.touchEndY = 0;
      this.isScrolling = undefined;
      this.isDragging = false;
      this.startPos = 0;
      this.currentTranslate = 0;
      this.prevTranslate = 0;

      this.init();
    }

    init() {
      this.calculateSlideWidth();
      this.createDots();
      this.updateDots();
      this.addEventListeners();
      this.startAutoplay();
      this.goToSlide(0);

      window.addEventListener('resize', () => {
        this.calculateSlideWidth();
        this.goToSlide(this.currentIndex);
      });
    }

    calculateSlideWidth() {
      this.slideWidth = this.slider.offsetWidth;
    }

    createDots() {
      if (!this.dotsContainer) return;
      this.dotsContainer.innerHTML = '';
      this.slides.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.classList.add('slider-dot');
        dot.addEventListener('click', () => this.goToSlide(index));
        this.dotsContainer.appendChild(dot);
      });
    }

    updateDots() {
      if (!this.dotsContainer) return;
      Array.from(this.dotsContainer.children).forEach((dot, index) => {
        dot.classList.toggle('active', index === this.currentIndex);
      });
    }

    addEventListeners() {
      // Touch events with better handling
      this.track.addEventListener('touchstart', (e) => {
        this.stopAutoplay();
        if (e.touches.length > 1) return; // Ignore multi-touch

        this.isDragging = true;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.startPos = this.touchStartX;
        this.isScrolling = undefined;

        // Add active class for visual feedback
        this.track.classList.add('touching');
      }, { passive: true });

      this.track.addEventListener('touchmove', (e) => {
        if (!this.isDragging) return;
        
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - this.touchStartX;
        const diffY = currentY - this.touchStartY;

        // Determine scroll direction on first move
        if (typeof this.isScrolling === 'undefined') {
          this.isScrolling = Math.abs(diffY) > Math.abs(diffX);
        }

        if (this.isScrolling) {
          this.isDragging = false;
          return;
        }

        e.preventDefault();
        this.currentTranslate = this.prevTranslate + diffX;
        this.setSliderPosition(this.currentTranslate);
      }, { passive: false });

      this.track.addEventListener('touchend', (e) => {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.track.classList.remove('touching');
        
        const movedBy = e.changedTouches[0].clientX - this.startPos;
        
        if (Math.abs(movedBy) > this.slideWidth * 0.2) {
          if (movedBy < 0) {
            this.next();
          } else {
            this.prev();
          }
        } else {
          this.goToSlide(this.currentIndex);
        }
        
        this.startAutoplay();
      }, { passive: true });

      // Navigation buttons
      if (this.prevButton) {
        this.prevButton.addEventListener('click', () => {
          this.stopAutoplay();
          this.prev();
          this.startAutoplay();
        });
      }

      if (this.nextButton) {
        this.nextButton.addEventListener('click', () => {
          this.stopAutoplay();
          this.next();
          this.startAutoplay();
        });
      }

      // Mouse enter/leave
      this.slider.addEventListener('mouseenter', () => this.stopAutoplay());
      this.slider.addEventListener('mouseleave', () => this.startAutoplay());
    }

    setSliderPosition(position) {
      this.track.style.transform = `translateX(${position}px)`;
    }

    next() {
      this.goToSlide((this.currentIndex + 1) % this.slides.length);
    }

    prev() {
      this.goToSlide((this.currentIndex - 1 + this.slides.length) % this.slides.length);
    }

    goToSlide(index) {
      this.currentIndex = index;
      this.prevTranslate = -this.currentIndex * this.slideWidth;
      this.currentTranslate = this.prevTranslate;
      this.track.style.transition = 'transform 0.5s ease';
      this.setSliderPosition(this.currentTranslate);
      this.updateDots();
    }

    startAutoplay() {
      this.stopAutoplay();
      this.autoplayInterval = setInterval(() => this.next(), 5000);
    }

    stopAutoplay() {
      if (this.autoplayInterval) {
        clearInterval(this.autoplayInterval);
        this.autoplayInterval = null;
      }
    }
  }

  // Subscription Slider Class
  class SubscriptionSlider {
    constructor(element) {
      this.slider = element;
      this.track = element.querySelector('.subscriptions-track');
      if (!this.track) return;

      this.slides = Array.from(this.track.children);
      if (this.slides.length === 0) return;

      this.prevButton = element.querySelector('.prev');
      this.nextButton = element.querySelector('.next');

      this.currentIndex = 0;
      this.cardWidth = 0;
      this.gap = 24; // 1.5rem gap
      this.touchStartX = 0;
      this.touchEndX = 0;
      this.touchStartY = 0;
      this.touchEndY = 0;
      this.autoplayInterval = null;
      this.isScrolling = false;

      // Set touch-action to manipulation for better touch handling
      this.slider.style.touchAction = 'pan-y pan-x';
      this.track.style.touchAction = 'pan-y pan-x';
      this.slides.forEach(slide => {
        slide.style.touchAction = 'pan-y pan-x';
      });

      this.init();
    }

    init() {
      this.calculateCardWidth();
      this.addEventListeners();
      this.updateNavigation();
      this.startAutoplay();

      window.addEventListener('resize', () => {
        this.calculateCardWidth();
        this.goToSlide(this.currentIndex);
      });
    }

    calculateCardWidth() {
      const firstCard = this.slides[0];
      this.cardWidth = firstCard.offsetWidth + this.gap;
      this.visibleCards = Math.floor(this.slider.offsetWidth / this.cardWidth);
      this.maxScroll = Math.max(0, this.slides.length - this.visibleCards);
    }

    addEventListeners() {
      // Touch event handling
      this.track.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) return; // Ignore multi-touch
        this.stopAutoplay();
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].pageY;
        this.isScrolling = undefined;
      }, { passive: true });

      this.track.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) return; // Ignore multi-touch
        
        const touchCurrentX = e.touches[0].clientX;
        const touchCurrentY = e.touches[0].pageY;
        const deltaX = touchCurrentX - this.touchStartX;
        const deltaY = touchCurrentY - this.touchStartY;

        // Determine scroll direction on first move
        if (typeof this.isScrolling === 'undefined') {
          this.isScrolling = Math.abs(deltaY) > Math.abs(deltaX);
        }

        // If vertical scrolling, don't prevent default behavior
        if (this.isScrolling) {
          return;
        }

        // If horizontal swiping, prevent unintended vertical scroll
        if (Math.abs(deltaX) > 10 && !this.isScrolling) {
          e.preventDefault();
        }
      }, { passive: false });

      this.track.addEventListener('touchend', (e) => {
        if (this.isScrolling) {
          this.startAutoplay();
          return;
        }

        this.touchEndX = e.changedTouches[0].clientX;
        this.touchEndY = e.changedTouches[0].pageY;
        
        const swipeDistanceX = this.touchEndX - this.touchStartX;
        
        // Only handle horizontal swipes
        if (Math.abs(swipeDistanceX) > 50) {
          if (swipeDistanceX > 0) {
            this.prev();
          } else {
            this.next();
          }
        }
        
        this.startAutoplay();
      }, { passive: true });

      // Navigation buttons
      if (this.prevButton) {
        this.prevButton.addEventListener('click', () => {
          this.stopAutoplay();
          this.prev();
          this.startAutoplay();
        });
      }

      if (this.nextButton) {
        this.nextButton.addEventListener('click', () => {
          this.stopAutoplay();
          this.next();
          this.startAutoplay();
        });
      }

      // Mouse enter/leave for autoplay control
      this.slider.addEventListener('mouseenter', () => this.stopAutoplay());
      this.slider.addEventListener('mouseleave', () => this.startAutoplay());
    }

    next() {
      if (this.currentIndex < this.maxScroll) {
        this.goToSlide(this.currentIndex + 1);
      } else {
        this.goToSlide(0);
      }
    }

    prev() {
      if (this.currentIndex > 0) {
        this.goToSlide(this.currentIndex - 1);
      }
    }

    goToSlide(index) {
      this.currentIndex = index;
      const offset = -this.currentIndex * this.cardWidth;
      this.track.style.transition = 'transform 0.5s ease';
      this.track.style.transform = `translateX(${offset}px)`;
      this.updateNavigation();
    }

    updateNavigation() {
      if (this.prevButton) {
        this.prevButton.style.display = this.currentIndex > 0 ? 'flex' : 'none';
      }
      if (this.nextButton) {
        this.nextButton.style.display = this.currentIndex < this.maxScroll ? 'flex' : 'none';
      }
    }

    

    startAutoplay() {
      this.stopAutoplay();
      this.autoplayInterval = setInterval(() => this.next(), 4000);
    }

    stopAutoplay() {
      if (this.autoplayInterval) {
        clearInterval(this.autoplayInterval);
        this.autoplayInterval = null;
      }
    }
  }



  // Mobile Navigation Scroll Behavior
  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateMobileNav() {
    const mobileNav = document.querySelector('.mobile-bottom-nav');
    if (!mobileNav) return;

    if (window.scrollY > lastScrollY) { // Scrolling down
      mobileNav.style.transform = 'translateY(0)';
    } else { // Scrolling up
      mobileNav.style.transform = 'translateY(100%)';
    }

    lastScrollY = window.scrollY;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateMobileNav();
      });
      ticking = true;
    }
  });