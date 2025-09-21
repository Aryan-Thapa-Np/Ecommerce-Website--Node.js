import { showToast } from './utils/toast.js';
import { csrftoken } from './utils/generateCsrf.js';

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const steps = document.querySelectorAll('.step');
    const checkoutSteps = document.querySelectorAll('.checkout-step');
    const backToCartBtn = document.getElementById('back-to-cart');
    const nextToPaymentBtn = document.getElementById('next-to-payment');
    const backToShippingBtn = document.getElementById('back-to-shipping');
    const proceedToPaymentBtn = document.getElementById('proceed-to-payment');
    const paymentMethods = document.querySelectorAll('.payment-method');
    const paymentModalOverlays = document.querySelectorAll('.payment-modal-overlay');
    const modalCloseBtns = document.querySelectorAll('.payment-modal-close, .modal-close-btn');
    const fileUploadInputs = document.querySelectorAll('.file-upload-input');
    const submitBtns = document.querySelectorAll('#esewa-submit, #khalti-submit, #bank-submit, #cash-submit');
    const orderItems = document.querySelector('.order-items');
    
    let selectedPaymentMethod = null;
    let shippingData = {};
    let paymentProofFile = null;
    
    // Function to fix image paths by removing /public/ or \public\ from URLs
    function fixImagePath(path) {
        if (!path) return path;
        return path.replace('/public/', '/').replace('\\public\\', '/');
    }
    
    // Fix any image paths in the DOM on page load
    document.querySelectorAll('img').forEach(img => {
        if (img.src && (img.src.includes('/public/') || img.src.includes('\\public\\'))) {
            img.src = fixImagePath(img.src);
        }
    });
    
    // Initialize file preview containers
    document.querySelectorAll('.file-preview').forEach(preview => {
     
        // Make sure the container exists and is properly styled
        preview.style.minHeight = '50px';
    });
    
    // Check if cart is empty
    const isCartEmpty = orderItems && (orderItems.querySelector('p')?.textContent === 'Your cart is empty.' || 
                        orderItems.children.length === 0);
    
    // Disable buttons if cart is empty
    if (isCartEmpty) {
        if (nextToPaymentBtn) nextToPaymentBtn.disabled = true;
        if (proceedToPaymentBtn) proceedToPaymentBtn.disabled = true;
        submitBtns.forEach(btn => btn.disabled = true);
        
        showToast('Your cart is empty. Please add items before checkout.', 'warning');
    }
    
    // Initialize CSRF token
    let csrfToken = '';
    (async function() {
        csrfToken = await csrftoken();
        window.csrfToken = csrfToken;
    })();
    
    // Step navigation
    function goToStep(stepNumber) {
        // Update step indicators
        steps.forEach(step => {
            const dataStep = parseInt(step.dataset.step);
            step.classList.remove('active', 'completed');
            
            if (dataStep < stepNumber) {
                step.classList.add('completed');
            } else if (dataStep === stepNumber) {
                step.classList.add('active');
            }
        });
        
        // Show/hide step content
        checkoutSteps.forEach((step, index) => {
            step.style.display = index + 1 === stepNumber ? 'block' : 'none';
        });
    }
    
    // Back to cart
    if (backToCartBtn) {
        backToCartBtn.addEventListener('click', function() {
            window.location.href = '/';
        });
    }
    
    // Next to payment step
    if (nextToPaymentBtn) {
        nextToPaymentBtn.addEventListener('click', function() {
            if (isCartEmpty) {
                showToast('Your cart is empty. Please add items before checkout.', 'warning');
                return;
            }
            
            const shippingForm = document.getElementById('shipping-form');
            
            // Basic form validation
            const requiredFields = ['first_name', 'last_name', 'phone'];
            
            // Add shipping fields if physical products exist
            if (document.getElementById('address')) {
                requiredFields.push('address', 'city', 'state', 'postal_code', 'country');
            }
            
            // Check each required field
            let isValid = true;
            requiredFields.forEach(field => {
                const input = document.getElementById(field);
                if (input && !input.value.trim()) {
                    input.reportValidity();
                    isValid = false;
                }
            });
            
            if (!isValid) return;
            
            // Show loading state
            nextToPaymentBtn.disabled = true;
            const originalText = nextToPaymentBtn.textContent;
            nextToPaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            // Collect shipping data
            const formData = new FormData(shippingForm);
            shippingData = {
                first_name: formData.get('first_name'),
                last_name: formData.get('last_name'),
                phone: formData.get('phone'),
                address: formData.get('address') || '',
                city: formData.get('city') || '',
                state: formData.get('state') || '',
                postal_code: formData.get('postal_code') || '',
                country: formData.get('country') || 'Nepal'
            };
            
            // Simulate loading for 2 seconds
            setTimeout(() => {
                // Go to payment step
                goToStep(2);
                
                // Reset button state
                nextToPaymentBtn.disabled = false;
                nextToPaymentBtn.textContent = originalText;
            }, 2000);
        });
    }
    
    // Back to shipping step
    if (backToShippingBtn) {
        backToShippingBtn.addEventListener('click', function() {
            goToStep(1);
        });
    }
    
    // Payment method selection
    paymentMethods.forEach(method => {
        method.addEventListener('click', function() {
            if (isCartEmpty) {
                showToast('Your cart is empty. Please add items before checkout.', 'warning');
                return;
            }
            
            // Remove selected class from all methods
            paymentMethods.forEach(m => m.classList.remove('selected'));
            
            // Add selected class to clicked method
            this.classList.add('selected');
            
            // Store selected payment method
            selectedPaymentMethod = this.dataset.method;
            
            // Enable proceed button
            proceedToPaymentBtn.disabled = false;
        });
    });
    
    // Proceed to payment
    if (proceedToPaymentBtn) {
        proceedToPaymentBtn.addEventListener('click', function() {
            if (isCartEmpty) {
                showToast('Your cart is empty. Please add items before checkout.', 'warning');
                return;
            }
            
            if (!selectedPaymentMethod) {
                showToast('Please select a payment method', 'error');
                return;
            }
            
            // Show loading state
            proceedToPaymentBtn.disabled = true;
            const originalText = proceedToPaymentBtn.textContent;
            proceedToPaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            // Simulate loading for 2 seconds
            setTimeout(() => {
                // Show payment modal based on selected method
                let modalId;
                if (selectedPaymentMethod === 'cash') {
                    modalId = 'cod-modal';
                } else {
                    modalId = `${selectedPaymentMethod}-modal`;
                }
                const modal = document.getElementById(modalId);

                if (modal) {
                    modal.classList.add('active');
                    // Ensure file preview container is properly initialized when modal opens
                    let previewId;
                    if (selectedPaymentMethod === 'cash') {
                        previewId = 'cash-file-preview';
                    } else {
                        previewId = `${selectedPaymentMethod}-file-preview`;
                    }
                    const previewEl = document.getElementById(previewId);
                    if (previewEl) {
                        previewEl.style.display = 'block';
                        previewEl.style.minHeight = '50px';
                        previewEl.style.border = '1px dashed #e5e7eb';
                        previewEl.innerHTML = '';
                    } else {
                        console.error('Preview container not found in modal:', previewId);
                    }
                }
                
                // Reset button state
                proceedToPaymentBtn.disabled = false;
                proceedToPaymentBtn.textContent = originalText;
            }, 2000);
        });
    }
    
    // Close payment modals
    modalCloseBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = btn.closest('.payment-modal-overlay');
            modal.classList.remove('active');
        });
    });
    
    // File upload preview
    fileUploadInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
           
            // Validate file type
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
            if (!validTypes.includes(file.type)) {
                showToast('Please upload a valid image file (JPEG, PNG, GIF)', 'error');
                input.value = '';
                return;
            }
            
            // Validate file size (max 200MB)
            const maxSize = 200 * 1024 * 1024; // 200MB
            if (file.size > maxSize) {
                showToast('File size should be less than 200MB', 'error');
                input.value = '';
                return;
            }
            
            // Store file for later use
            paymentProofFile = file;
       
            // Get the payment method from the input ID
            let paymentMethod = input.id.split('-')[0]; // e.g., "esewa" from "esewa-payment-proof"
            if (paymentMethod === 'cash') paymentMethod = 'cash'; // handle cash

            // Show preview - use the correct ID format
            let previewId;
            if (paymentMethod === 'cash') {
                previewId = 'cash-file-preview';
            } else {
                previewId = `${paymentMethod}-file-preview`;
            }
            const previewEl = document.getElementById(previewId);
           
            
            if (previewEl) {
                // Clear previous preview
                previewEl.innerHTML = '';
                
                // Create preview container
                const previewContainer = document.createElement('div');
                previewContainer.className = 'preview-container';
                
                // Create preview image
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.onload = function() {
                   
                    URL.revokeObjectURL(this.src);
                };
                img.onerror = function() {
                    console.error('Error loading image preview');
                };
                
                // Create file info
                const fileInfo = document.createElement('div');
                fileInfo.className = 'file-info';
                fileInfo.innerHTML = `
                    <p class="file-name">${file.name}</p>
                    <p class="file-size">${(file.size / 1024).toFixed(1)} KB</p>
                `;
                
                // Create remove button
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-file';
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                removeBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    input.value = '';
                    paymentProofFile = null;
                    previewEl.innerHTML = '';
                    previewEl.classList.remove('active');
                    
                   
                });
                
                // Append elements to preview container
                previewContainer.appendChild(img);
                previewContainer.appendChild(fileInfo);
                previewContainer.appendChild(removeBtn);
                
                // Append preview container to preview element
                previewEl.appendChild(previewContainer);
                previewEl.classList.add('active');
                
               
                
                
            } else {
                console.error('Preview element not found:', previewId);
                showToast('Error displaying preview. Check console for details.', 'error');
                
                // Try to find any preview elements for debugging
                const allPreviews = document.querySelectorAll('.file-preview');
                
              
            }
        });
    });
    
    // Submit order
    submitBtns.forEach(btn => {
        btn.addEventListener('click', async function() {
            if (isCartEmpty) {
                showToast('Your cart is empty. Please add items before checkout.', 'warning');
                return;
            }
            let paymentMethod = btn.id.replace('-submit', '');
            if (paymentMethod === 'cash') paymentMethod = 'cash'; // handle cash

            // Validate payment proof
            if (!paymentProofFile) {
                showToast('Please upload payment proof', 'error');
                return;
            }
            
            // Disable button and show loading state
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            // Simulate initial loading for 2 seconds
            setTimeout(async () => {
                try {
                    // Create order
                    const orderData = {
                        shipping: shippingData,
                        payment_method: paymentMethod
                    };
                    
                    // Submit order
                    const orderResponse = await fetch('/api/orders', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            "X-CSRF-Token": `bearer ${csrfToken}`,
                        },
                        body: JSON.stringify(orderData)
                    });
                    
                    const orderResult = await orderResponse.json();

                    if(orderResult.status === 'error'){
                        showToast(orderResult.message || 'Failed to create order', 'error');
                        return;
                    }

                    if (!orderResponse.ok) {
                        throw new Error('Failed to create order');
                    }
                    
                    
                    const orderId = orderResult.order_id;
                    
                    // Update button text to show progress
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading proof...';
                    
                    // Upload payment proof
                    const formData = new FormData();
                    formData.append('payment_proof', paymentProofFile);
                    formData.append('order_id', orderId);
                    formData.append('_csrf', csrfToken);
                    
                    const uploadResponse = await fetch('/api/orders/payment-proof', {
                        method: 'POST',
                        headers: {
                            "X-CSRF-Token": `bearer ${csrfToken}`,
                        },
                        credentials: 'include',
                        body: formData
                    });
                    const uploadResult = await uploadResponse.json();
                    
                    if(uploadResult.status === 'error'){
                        showToast(uploadResult.message || 'Failed to upload payment proof', 'error');
                        return;
                    }
                    
                    
                    if (!uploadResponse.ok) {
                        throw new Error('Failed to upload payment proof');
                    }
                    
                    // Update button text to show progress
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing...';
                    
                    // Simulate final processing for 1 second
                    setTimeout(async () => {
                        // Close modal
                        const modal = btn.closest('.payment-modal-overlay');
                        modal.classList.remove('active');
                        
                        // Show success step
                        goToStep(3);
                        
                        // Update order details
                        document.getElementById('order-id').textContent = orderId;
                        document.getElementById('order-date').textContent = new Date().toLocaleDateString();
                        document.getElementById('order-payment-method').textContent = 
                            paymentMethod === 'esewa' ? 'eSewa' : 
                            paymentMethod === 'khalti' ? 'Khalti' : 
                            paymentMethod === 'bank' ? 'Bank Transfer' : 
                            paymentMethod === 'COD' ? 'Cash on Delivery' : '';
                        
                        // Clear cart (optional)
                        await fetch('/api/orders/clear-cart', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                "X-CSRF-Token": `bearer ${csrfToken}`,
                            },
                            credentials: 'include',
                        });
                        

                        showToast('Order created successfully', 'success');
                    }, 1000);
                    
                } catch (error) {
                    console.error('Order submission error:', error);
                    showToast('Failed to process order. Please try again.', 'error');
                    
                    // Reset button
                    btn.disabled = false;
                    btn.textContent = 'Complete Order';
                }
            }, 2000);
        });
    });
    
    // Generate a random order ID for demo purposes (remove in production)
    function generateDemoOrderId() {
        return 'ORD-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    
    // Handle demo mode for testing without backend
    const isDemoMode = false; // Set to false in production

    if (isDemoMode) {
        submitBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                
                if (isCartEmpty) {
                    showToast('Your cart is empty. Please add items before checkout.', 'warning');
                    return;
                }
                
                let paymentMethod = btn.id.replace('-submit', '');
                if (paymentMethod === 'cash') paymentMethod = 'cash'; // handle cash

                // Validate payment proof
                if (!paymentProofFile) {
                    showToast('Please upload payment proof', 'error');
                    return;
                }
                
                // Disable button and show loading state
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                
                // Simulate order creation (2 seconds)
                setTimeout(() => {
                    // Update button text to show progress
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading proof...';
                    
                    // Simulate file upload (2 seconds)
                    setTimeout(() => {
                        // Update button text to show progress
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finalizing...';
                        
                        // Simulate finalization (1 second)
                        setTimeout(() => {
                            // Close modal
                            const modal = btn.closest('.payment-modal-overlay');
                            modal.classList.remove('active');
                            
                            // Show success step
                            goToStep(3);
                            
                            // Update order details
                            document.getElementById('order-id').textContent = generateDemoOrderId();
                            document.getElementById('order-date').textContent = new Date().toLocaleDateString();
                            document.getElementById('order-payment-method').textContent = 
                                paymentMethod === 'esewa' ? 'eSewa' : 
                                paymentMethod === 'khalti' ? 'Khalti' : 
                                paymentMethod === 'bank' ? 'Bank Transfer' : 
                                paymentMethod === 'cash' ? 'Cash on Delivery' : '';
                        }, 1000);
                    }, 2000);
                }, 2000);
            });
        });
    }

const viewOrdersDashboardBtn = document.getElementById('view-orders-dashboard');
if (viewOrdersDashboardBtn) {
    viewOrdersDashboardBtn.addEventListener('click', function() {
        sessionStorage.removeItem('customer_active_page');
        sessionStorage.setItem('customer_active_page', 'orders');
        window.location.href = '/user/dashboard';
    });
}
});
