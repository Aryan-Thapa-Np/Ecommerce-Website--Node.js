import { showToast, TOAST_TYPES } from "./utils/toast.js";
import { csrftoken } from "./utils/generateCsrf.js";

// Simple User Management JavaScript
let users = [];
let currentPage = 1;
let itemsPerPage = 10;
let csrfToken = '';

// Column visibility state
let columnVisibility = {
  email: true,
  username: true,
  role: true,
  status: true,
  emailVerified: true,
  '2fa': true,
  created: true
};

document.addEventListener('DOMContentLoaded', function () {
  initializeUserManagement();
  loadProducts();
});

async function initializeUserManagement() {
  try {

    setTimeout(() => {
      csrfToken = window.csrfToken;

    }, 2000);

  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    showMessage('Failed to initialize. Please try again.', 'error');
  }

  setupEventListeners();
  initializeColumnVisibility();
  loadUsers();
}

function setupEventListeners() {
  const searchInput = document.getElementById('userSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      currentPage = 1;
      loadUsers();
    }, 300));
  }

  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      currentPage = 1;
      loadUsers();
    });
  }

  const roleFilter = document.getElementById('roleFilter');
  if (roleFilter) {
    roleFilter.addEventListener('change', () => {
      currentPage = 1;
      loadUsers();
    });
  }

  const createUserBtn = document.getElementById('createUserBtn');
  if (createUserBtn) {
    createUserBtn.addEventListener('click', showCreateUserModal);
  }

  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadUsers();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(users.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        loadUsers();
      }
    });
  }

  // Column toggle functionality for users
  const toggleColumnsBtn = document.getElementById('toggleColumnsBtn');
  const columnToggleDropdown = document.querySelector('.column-toggle-dropdown');

  if (toggleColumnsBtn && columnToggleDropdown) {
    toggleColumnsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      columnToggleDropdown.style.display = columnToggleDropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!toggleColumnsBtn.contains(e.target) && !columnToggleDropdown.contains(e.target)) {
        columnToggleDropdown.style.display = 'none';
      }
    });

    // Handle checkbox changes
    const columnCheckboxes = columnToggleDropdown.querySelectorAll('input[type="checkbox"]');
    columnCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        toggleColumn(checkbox.dataset.column, checkbox.checked);
      });
    });
  }

  // Column toggle functionality for products
  const productsToggleColumnsBtn = document.getElementById('products-toggle-columns-btn');
  const productsColumnToggleDropdown = document.getElementById('products-column-toggles');

  if (productsToggleColumnsBtn && productsColumnToggleDropdown) {
    productsToggleColumnsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      productsColumnToggleDropdown.style.display = productsColumnToggleDropdown.style.display === 'none' ? 'block' : 'none';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!productsToggleColumnsBtn.contains(e.target) && !productsColumnToggleDropdown.contains(e.target)) {
        productsColumnToggleDropdown.style.display = 'none';
      }
    });
  }
}

// Toggle column visibility
function toggleColumn(columnName, isVisible) {
  columnVisibility[columnName] = isVisible;

  // Update table headers
  const tableHeaders = document.querySelectorAll('.users-table th');
  tableHeaders.forEach((header, index) => {
    const column = getColumnNameByIndex(index);
    if (column && column !== 'actions') {
      header.style.display = columnVisibility[column] ? '' : 'none';
    }
  });

  // Update table cells
  const tableRows = document.querySelectorAll('.users-table tbody tr');
  tableRows.forEach(row => {
    const cells = row.querySelectorAll('td');
    cells.forEach((cell, index) => {
      const column = getColumnNameByIndex(index);
      if (column && column !== 'actions') {
        cell.style.display = columnVisibility[column] ? '' : 'none';
      }
    });
  });
}

// Helper function to map column index to column name
function getColumnNameByIndex(index) {
  const columnMap = {
    0: 'email',
    1: 'username',
    2: 'role',
    3: 'status',
    4: 'emailVerified',
    5: '2fa',
    6: 'created',
    7: 'actions'
  };
  return columnMap[index];
}

// Initialize column visibility based on checkbox states
function initializeColumnVisibility() {
  const columnCheckboxes = document.querySelectorAll('.column-toggle-dropdown input[type="checkbox"]');
  columnCheckboxes.forEach(checkbox => {
    const columnName = checkbox.dataset.column;
    if (columnName) {
      columnVisibility[columnName] = checkbox.checked;
    }
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Helper function to truncate text with ellipsis
function truncateText(text, maxLength) {
  if (!text || text === 'N/A') return 'N/A';
  const trimmedText = text.toString().trim();
  if (trimmedText.length <= maxLength) return trimmedText;
  return trimmedText.substring(0, maxLength) + '...';
}

async function loadUsers() {
  try {
    const response = await fetch('/api/process/users', {
      headers: {
        'X-CSRF-Token': `bearer ${csrfToken}`,
      },
      credentials: 'include',
    });

    users = await response.json();
    if (users.status === 'error') {
      showToast(users.message, TOAST_TYPES.ERROR);
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }


    displayUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    showMessage('Failed to load users. Please try again.', 'error');
  }
}

function displayUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) {
    console.error('Users table body not found');
    return;
  }

  const searchTerm = document.getElementById('userSearchInput')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('statusFilter')?.value || '';
  const roleFilter = document.getElementById('roleFilter')?.value || '';

  let filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      (user.email && user.email.toLowerCase().includes(searchTerm)) ||
      (user.username && user.username.toLowerCase().includes(searchTerm));

    const matchesStatus = !statusFilter || user.account_status === statusFilter;
    const matchesRole = !roleFilter || user.role === roleFilter;

    return matchesSearch && matchesStatus && matchesRole;
  });

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageUsers = filteredUsers.slice(start, end);

  updatePagination(filteredUsers.length);

  tbody.innerHTML = pageUsers.map(user => `
    <tr>
      <td title="${user.email || 'N/A'}" style="display: ${columnVisibility.email ? '' : 'none'}">${truncateText(user.email, 30)}</td>
      <td title="${user.username || 'N/A'}" style="display: ${columnVisibility.username ? '' : 'none'}">${truncateText(user.username, 25)}</td>
      <td style="display: ${columnVisibility.role ? '' : 'none'}">${user.role || 'N/A'}</td>
      <td style="display: ${columnVisibility.status ? '' : 'none'}">
        <span class="status-badge ${user.account_status || 'unknown'}">
          ${user.account_status ? user.account_status.charAt(0).toUpperCase() + user.account_status.slice(1) : 'Unknown'}
        </span>
      </td>
      <td style="display: ${columnVisibility.emailVerified ? '' : 'none'}">
        <span class="status-badge ${user.email_verified ? 'active' : 'locked'}">
          ${user.email_verified ? 'Verified' : 'Unverified'}
        </span>
      </td>
      <td style="display: ${columnVisibility['2fa'] ? '' : 'none'}">
        <span class="status-badge ${user.two_factor_enabled ? 'active' : 'locked'}">
          ${user.two_factor_enabled ? (user.two_factor_method || 'Enabled') : 'Disabled'}
        </span>
      </td>
      <td style="display: ${columnVisibility.created ? '' : 'none'}">${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action" onclick="showEmailVerificationModal(${user.id}, ${!user.email_verified}, '${user.username}')" title="Toggle Email Verification">
            <i class="fas fa-envelope"></i>
          </button>
          <button class="btn-action" onclick="show2FAModal(${user.id}, ${!user.two_factor_enabled}, '${user.username}')" title="Toggle 2FA">
            <i class="fas fa-shield-alt"></i>
          </button>
          <button class="btn-action" onclick="showChangeRoleModal(${user.id})" title="Change Role">
            <i class="fas fa-user-tag"></i>
          </button>
          <button class="btn-action" onclick="showUpdateUserStatusModal(${user.id}, '${user.account_status || 'unknown'}')" title="Update Status">
            <i class="fas fa-user-cog"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updatePagination(totalUsers) {
  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  const start = totalUsers ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const end = Math.min(currentPage * itemsPerPage, totalUsers);

  const showingStart = document.getElementById('showing-start');
  const showingEnd = document.getElementById('showing-end');
  const totalEntries = document.getElementById('total-entries');
  const currentPageSpan = document.getElementById('currentPage');
  const totalPagesSpan = document.getElementById('totalPages');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (showingStart) showingStart.textContent = start;
  if (showingEnd) showingEnd.textContent = end;
  if (totalEntries) totalEntries.textContent = totalUsers;
  if (currentPageSpan) currentPageSpan.textContent = currentPage;
  if (totalPagesSpan) totalPagesSpan.textContent = totalPages;
  if (prevBtn) prevBtn.disabled = currentPage === 1;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

function createModal({ id, title, icon, body, footer }) {
  const modalHTML = `
    <div id="${id}" class="user-modal show">
      <div class="user-modal-content">
        <div class="user-modal-header">
          <h2><i class="fas ${icon}"></i> ${title}</h2>
          <button class="modal-close" onclick="closeModal('${id}')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="user-modal-body">
          ${body}
        </div>
        <div class="user-modal-footer">
          ${footer}
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showCreateUserModal() {
  const body = `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 8px; padding: 16px; margin: 12px 0; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="width: 48px; height: 48px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <i class="fas fa-user-plus" style="font-size: 18px; color: #3b82f6;"></i>
        </div>
        <h4 style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0;">Create New User</h4>
        <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">Fill in the details below</p>
      </div>
      <form id="createUserForm">
        <div class="form-group">
          <label for="newUserEmail"><i class="fas fa-envelope"></i> Email</label>
          <input type="email" id="newUserEmail" required placeholder="Enter email">
        </div>
        <div class="form-group">
          <label for="newUserName"><i class="fas fa-user"></i> Username</label>
          <input type="text" id="newUserName" required placeholder="Enter username">
        </div>
        <div class="form-group">
          <label for="newUserPassword"><i class="fas fa-lock"></i> Password</label>
          <div class="password-input-container">
            <input type="password" id="newUserPassword" required placeholder="Enter password">
            <button type="button" class="password-toggle" onclick="togglePassword()">
              <i class="fas fa-eye" id="passwordIcon"></i>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label for="newUserRole"><i class="fas fa-user-tag"></i> Role</label>
          <select id="newUserRole" required>
            <option value="">Select role</option>
            <option value="customer">Customer</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </form>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal('createUserModal')">
       Cancel
    </button>
    <button class="btn btn-primary" onclick="createUser()">
      <i class="fas fa-user-plus"></i> Create User
    </button>
  `;
  createModal({
    id: 'createUserModal',
    title: 'Create New User',
    icon: 'fa-user-plus',
    body,
    footer,
  });
}

window.showChangeRoleModal = function (userId) {
  const user = users.find(u => u.id === userId);
  if (!user) {
    showMessage('User not found', 'error');
    return;
  }
  const body = `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 8px; padding: 16px; margin: 12px 0; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="width: 48px; height: 48px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <i class="fas fa-user-tag" style="font-size: 18px; color: #3b82f6;"></i>
        </div>
        <h4 style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0;">Change Role</h4>
        <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">Select new role for <strong>${user.username}</strong></p>
      </div>
      <form id="changeRoleForm">
        <div class="form-group">
          <label for="newUserRole"><i class="fas fa-user-tag"></i> New Role</label>
          <select id="newUserRole" required>
            <option value="customer" ${user.role === 'customer' ? 'selected' : ''}>Customer</option>
            <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        <div style="background: rgba(59, 130, 246, 0.1); border-radius: 6px; padding: 8px; margin-top: 12px; border-left: 3px solid #3b82f6;">
          <p style="font-size: 12px; color: #1e40af; margin: 0; font-weight: 500;">
            <i class="fas fa-info-circle" style="margin-right: 4px;"></i>
            Affects user access permissions
          </p>
        </div>
      </form>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal('changeRoleModal')">
       Cancel
    </button>
    <button class="btn btn-primary" onclick="updateUserRole(${userId}, document.getElementById('newUserRole').value)">
      <i class="fas fa-user-tag"></i> Update Role
    </button>
  `;
  createModal({
    id: 'changeRoleModal',
    title: `Change Role - ${user.username}`,
    icon: 'fa-user-tag',
    body,
    footer,
  });
}

window.showUpdateUserStatusModal = function (userId, currentStatus) {
  const user = users.find(u => u.id === userId);
  if (!user) {
    showMessage('User not found', 'error');
    return;
  }
  const body = `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 8px; padding: 16px; margin: 12px 0; border: 1px solid #e2e8f0;">
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="width: 48px; height: 48px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          <i class="fas fa-user-cog" style="font-size: 18px; color: #3b82f6;"></i>
        </div>
        <h4 style="font-size: 16px; font-weight: 600; color: #1e293b; margin: 0;">Update Status</h4>
        <p style="font-size: 12px; color: #64748b; margin: 4px 0 0;">Change status for <strong>${user.username}</strong></p>
      </div>
      <form id="updateUserStatusForm">
        <div class="form-group">
          <label for="newUserStatus"><i class="fas fa-user-cog"></i> New Status</label>
          <select id="newUserStatus" required onchange="toggleDurationField()">
            <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>Active</option>
            <option value="suspended" ${currentStatus === 'suspended' ? 'selected' : ''}>Suspended</option>
            <option value="banned" ${currentStatus === 'banned' ? 'selected' : ''}>Banned</option>
            <option value="locked" ${currentStatus === 'locked' ? 'selected' : ''}>Locked</option>
          </select>
        </div>
        <div class="form-group">
          <label for="statusReason"><i class="fas fa-comment"></i> Reason <span style="color: #ef4444; font-size: 11px;">*</span></label>
          <textarea id="statusReason" required placeholder="Explain the reason..."></textarea>
        </div>
        <div class="form-group" id="durationField" style="display: ${['suspended', 'banned', 'locked'].includes(currentStatus) ? 'block' : 'none'}">
          <label for="statusDuration"><i class="fas fa-clock"></i> Duration (days) <span style="color: #64748b; font-size: 11px;">(Optional)</span></label>
          <input type="number" id="statusDuration" min="1" value="7" placeholder="Enter days">
        </div>
        <div style="background: rgba(239, 68, 68, 0.1); border-radius: 6px; padding: 8px; margin-top: 12px; border-left: 3px solid #ef4444;">
          <p style="font-size: 12px; color: #dc2626; margin: 0; font-weight: 500;">
            <i class="fas fa-exclamation-triangle" style="margin-right: 4px;"></i>
            Affects user system access
          </p>
        </div>
      </form>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal('updateUserStatusModal')">
     Cancel
    </button>
    <button class="btn btn-primary" id="updateStatusBtn" onclick="updateUserStatus(${userId}, document.getElementById('newUserStatus').value, document.getElementById('statusReason').value, document.getElementById('statusDuration')?.value)">
      <i class="fas fa-user-cog"></i> Update Status
    </button>
  `;
  createModal({
    id: 'updateUserStatusModal',
    title: `Update Status - ${user.username}`,
    icon: 'fa-user-cog',
    body,
    footer,
  });
}

// Email Verification Confirmation Modal
window.showEmailVerificationModal = function (userId, verified, username) {
  const action = verified ? 'enable' : 'disable';
  const actionText = action.charAt(0).toUpperCase() + action.slice(1);
  const body = `
    <div class="confirmation-content">
      <div class="confirmation-icon">
        <i class="fas fa-envelope ${verified ? 'text-success' : 'text-warning'}"></i>
      </div>
      <div class="confirmation-text">
        <h4>${actionText} Email Verification</h4>
        <p>You are about to <strong>${action}</strong> email verification for:</p>
        <p><strong style="color: #1e293b; font-size: 16px;">${username}</strong></p>
        ${verified ?
      '<p class="text-info" style="border-left-color: #3b82f6;"><i class="fas fa-info-circle"></i> This will allow the user to verify their email address and access all features.</p>' :
      '<p class="text-warning" style="border-left-color: #d97706;"><i class="fas fa-exclamation-triangle"></i> This will prevent the user from verifying their email address.</p>'
    }
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal('emailVerificationModal')">
       Cancel
    </button>
    <button class="btn btn-primary" id="confirmEmailBtn" onclick="confirmToggleEmailVerification(${userId}, ${verified})">
      <i class="fas fa-check"></i> ${actionText} Email Verification
    </button>
  `;
  createModal({
    id: 'emailVerificationModal',
    title: `Email Verification - ${actionText}`,
    icon: 'fa-envelope',
    body,
    footer,
  });
}

// 2FA Confirmation Modal
window.show2FAModal = function (userId, enabled, username) {
  const action = enabled ? 'enable' : 'disable';
  const actionText = action.charAt(0).toUpperCase() + action.slice(1);
  const body = `
    <div class="confirmation-content">
      <div class="confirmation-icon">
        <i class="fas fa-shield-alt ${enabled ? 'text-success' : 'text-warning'}"></i>
      </div>
      <div class="confirmation-text">
        <h4>${actionText} Two-Factor Authentication</h4>
        <p>You are about to <strong>${action}</strong> two-factor authentication for:</p>
        <p><strong style="color: #1e293b; font-size: 16px;">${username}</strong></p>
        ${enabled ?
      '<p class="text-info" style="border-left-color: #3b82f6;"><i class="fas fa-info-circle"></i> This will enhance the user\'s account security with an additional verification layer.</p>' :
      '<p class="text-warning" style="border-left-color: #d97706;"><i class="fas fa-exclamation-triangle"></i> This will reduce the user\'s account security by removing 2FA protection.</p>'
    }
      </div>
    </div>
  `;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal('2FAModal')">
      Cancel
    </button>
    <button class="btn btn-primary" id="confirm2FABtn" onclick="confirmToggle2FA(${userId}, ${enabled})">
      <i class="fas fa-check"></i> ${actionText} 2FA
    </button>
  `;
  createModal({
    id: '2FAModal',
    title: `Two-Factor Authentication - ${actionText}`,
    icon: 'fa-shield-alt',
    body,
    footer,
  });
}

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
};

window.togglePassword = function () {
  const passwordInput = document.getElementById('newUserPassword');
  const passwordIcon = document.getElementById('passwordIcon');

  if (passwordInput && passwordIcon) {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      passwordIcon.className = 'fas fa-eye-slash';
    } else {
      passwordInput.type = 'password';
      passwordIcon.className = 'fas fa-eye';
    }
  }
};

window.toggleDurationField = function () {
  const status = document.getElementById('newUserStatus')?.value;
  const durationField = document.getElementById('durationField');
  const durationInput = document.getElementById('statusDuration');
  const reasonInput = document.getElementById('statusReason');

  if (durationField && durationInput && reasonInput) {
    if (['suspended', 'banned', 'locked'].includes(status)) {
      durationField.style.display = 'block';
      reasonInput.setAttribute('required', 'required');
      // Duration is optional for all statuses
      durationInput.removeAttribute('required');
    } else {
      durationField.style.display = 'none';
      durationInput.removeAttribute('required');
      reasonInput.removeAttribute('required');
    }
  }
};

window.createUser = async function () {
  const email = document.getElementById('newUserEmail')?.value;
  const username = document.getElementById('newUserName')?.value;
  const password = document.getElementById('newUserPassword')?.value;
  const role = document.getElementById('newUserRole')?.value;

  if (!email || !username || !password || !role) {
    showMessage('Please fill in all fields', 'error');
    return;
  }

  // Get the create button and show loading state
  const createBtn = document.querySelector('#createUserModal .btn-primary');
  const originalBtnText = createBtn.innerHTML;
  createBtn.innerHTML = '<span class="loading-spinner"></span> Creating...';
  createBtn.disabled = true;

  try {
    const response = await fetch('/api/process/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': `bearer ${csrfToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ email, username, password, role }),
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || 'Failed to create user');
    }

    showMessage('User created successfully', 'success');
    closeModal('createUserModal');
    loadUsers();
  } catch (error) {
    console.error('Error creating user:', error);
    showMessage(error.message || 'Failed to create user', 'error');
  } finally {
    // Restore button state
    createBtn.innerHTML = originalBtnText;
    createBtn.disabled = false;
  }
};

window.confirmToggleEmailVerification = async function (userId, verified) {
  // Get the confirm button and show loading state
  const confirmBtn = document.getElementById('confirmEmailBtn');
  const originalBtnText = confirmBtn.innerHTML;
  confirmBtn.innerHTML = '<span class="loading-spinner"></span> Updating...';
  confirmBtn.disabled = true;

  try {
    const response = await fetch(`/api/process/users/${userId}/email-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': `bearer ${csrfToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ verified }),
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || 'Failed to update email verification');
    }

    showMessage(`Email verification ${verified ? 'enabled' : 'disabled'}`, 'success');
    closeModal('emailVerificationModal');
    loadUsers();
  } catch (error) {
    console.error('Error toggling email verification:', error);
    showMessage(error.message || 'Failed to update email verification', 'error');
  } finally {
    // Restore button state
    confirmBtn.innerHTML = originalBtnText;
    confirmBtn.disabled = false;
  }
};

window.confirmToggle2FA = async function (userId, enabled) {
  // Get the confirm button and show loading state
  const confirmBtn = document.getElementById('confirm2FABtn');
  const originalBtnText = confirmBtn.innerHTML;
  confirmBtn.innerHTML = '<span class="loading-spinner"></span> Updating...';
  confirmBtn.disabled = true;

  try {
    const response = await fetch(`/api/process/users/${userId}/2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': `bearer ${csrfToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ enabled }),
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || 'Failed to update 2FA status');
    }

    showMessage(`2FA ${enabled ? 'enabled' : 'disabled'}`, 'success');
    closeModal('2FAModal');
    loadUsers();
  } catch (error) {
    console.error('Error toggling 2FA:', error);
    showMessage(error.message || 'Failed to update 2FA status', 'error');
  } finally {
    // Restore button state
    confirmBtn.innerHTML = originalBtnText;
    confirmBtn.disabled = false;
  }
};

window.updateUserRole = async function (userId, newRole) {
  if (!['customer', 'staff', 'admin'].includes(newRole)) {
    showMessage('Invalid role', 'error');
    return;
  }

  // Get the update button and show loading state
  const updateBtn = document.querySelector('#changeRoleModal .btn-primary');
  const originalBtnText = updateBtn.innerHTML;
  updateBtn.innerHTML = '<span class="loading-spinner"></span> Updating...';
  updateBtn.disabled = true;

  try {
    const response = await fetch(`/api/process/users/${userId}/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': `bearer ${csrfToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ role: newRole }),
    });

    const data = await response.json();

    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || 'Failed to update user role');
    }

    showMessage('User role updated successfully', 'success');
    closeModal('changeRoleModal');
    loadUsers();
  } catch (error) {
    console.error('Error updating role:', error);
    showMessage(error.message || 'Failed to update user role', 'error');
  } finally {
    // Restore button state
    updateBtn.innerHTML = originalBtnText;
    updateBtn.disabled = false;
  }
};

window.updateUserStatus = async function (userId, status, reason, duration) {
  const validStatuses = ['active', 'suspended', 'banned', 'locked'];
  if (!validStatuses.includes(status)) {
    showMessage('Invalid status', 'error');
    return;
  }
  if (status !== 'active' && !reason) {
    showMessage('Reason is required ', 'error');
    return;
  }

  // Get the update button and show loading state
  const updateBtn = document.getElementById('updateStatusBtn');
  const originalBtnText = updateBtn.innerHTML;
  updateBtn.innerHTML = '<span class="loading-spinner"></span> Updating...';
  updateBtn.disabled = true;

  try {
    const response = await fetch(`/api/process/users/${userId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': `bearer ${csrfToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ status, reason: reason || null, duration: duration ? parseInt(duration) : null }),
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || `Failed to update user status to ${status}`);
    }

    showMessage(`User status updated to ${status} successfully`, 'success');
    closeModal('updateUserStatusModal');
    loadUsers();
  } catch (error) {
    console.error(`Error updating user status to ${status}:`, error);
    showMessage(error.message || `Failed to update user status to ${status}`, 'error');
  } finally {
    // Restore button state
    updateBtn.innerHTML = originalBtnText;
    updateBtn.disabled = false;
  }
};

function showMessage(message, type) {
  const toastType = {
    success: TOAST_TYPES.SUCCESS,
    error: TOAST_TYPES.ERROR,
    warning: TOAST_TYPES.WARNING,
  }[type] || TOAST_TYPES.INFO;
  showToast(message, toastType);
}

// ===================== PRODUCTS SECTION =====================

let products = [];
let productsMediaFiles = [];

// Global variable to track existing media IDs
let existingMediaIds = [];

// Add a global variable to store the current product's media
let currentProductMedia = [];

// DOM Elements
const productsPage = document.getElementById('productsPage');
const productsListSection = document.getElementById('products-list-section');
const productsCreateSection = document.getElementById('products-create-section');
const productsCreateBtn = document.getElementById('products-create-btn');
const productsCancelBtn = document.getElementById('products-cancel-btn');
const productsCreateForm = document.getElementById('products-create-form');
const productsTableBody = document.getElementById('products-table-body');
const productsTableHead = document.getElementById('products-table-head'); // Added for column toggles
const productsSearchInput = document.getElementById('products-search-input');
const productsCategoryFilter = document.getElementById('products-category-filter');
const productsStockFilter = document.getElementById('products-stock-filter');
const productsMediaUpload = document.getElementById('products-media-upload');
const productsMediaPreview = document.getElementById('products-media-preview');
const mainContent = document.getElementById('mainContent');

// Section navigation (add to nav-item click logic)
const productsNavItem = document.querySelector('.nav-item[data-page="products"]');
if (productsNavItem) {
  productsNavItem.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('products');
    showProductsLoadingSpinner(); // Show spinner immediately
    loadProducts();
    // Initialize column toggles when products page is shown
    renderProductColumnToggles();
  });
}

// Back button for create product form
const productsBackBtn = document.getElementById('products-back-btn');
if (productsBackBtn) {
  productsBackBtn.addEventListener('click', () => {
    productsCreateSection.style.display = 'none';
    productsListSection.style.display = 'block';
    productsCreateForm.reset();
    productsMediaFiles = [];
    renderProductsMediaPreview();
    // Reset upload label text
    const uploadText = document.getElementById('products-media-upload-text');
    if (uploadText) uploadText.textContent = 'Click or drag files here to upload';
  });
}

// Update upload label text on file select
const productsMediaUploadInput = document.getElementById('products-media-upload');
if (productsMediaUploadInput) {
  productsMediaUploadInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const uploadText = document.getElementById('products-media-upload-text');
    if (files.length === 0) {
      uploadText.textContent = 'Click or drag files here to upload';
    } else if (files.length === 1) {
      uploadText.textContent = files[0].name;
    } else {
      uploadText.textContent = `${files.length} files selected`;
    }
  });
}

// When showing create form, hide search bar, filters, and list (JS fallback)
if (productsCreateBtn) {
  productsCreateBtn.addEventListener('click', () => {
    productsListSection.style.display = 'none';
    productsCreateSection.style.display = 'block';
    productsCreateForm.reset();
    productsMediaFiles = [];
    renderProductsMediaPreview();
    // Hide controls
    document.querySelector('.products-controls')?.classList.add('hidden');
    // Reset upload label text
    const uploadText = document.getElementById('products-media-upload-text');
    if (uploadText) uploadText.textContent = 'Click or drag files here to upload';
    // Add robust class for hiding
    mainContent?.classList.add('products-create-active');
  });
}
if (productsCancelBtn) {
  productsCancelBtn.addEventListener('click', () => {
    productsCreateSection.style.display = 'none';
    productsListSection.style.display = 'block';
    productsCreateForm.reset();
    productsMediaFiles = [];
    renderProductsMediaPreview();
    // Show controls
    document.querySelector('.products-controls')?.classList.remove('hidden');
    // Reset upload label text
    const uploadText = document.getElementById('products-media-upload-text');
    if (uploadText) uploadText.textContent = 'Click or drag files here to upload';
    // Remove robust class
    mainContent?.classList.remove('products-create-active');
  });
}
if (productsBackBtn) {
  productsBackBtn.addEventListener('click', () => {
    document.querySelector('.products-controls')?.classList.remove('hidden');
    mainContent?.classList.remove('products-create-active');
  });
}

// Load products from backend
async function loadProducts() {
  try {
    showProductsLoadingSpinner();
    const res = await fetch('/api/products/products-list', { credentials: 'include' });
    const data = await res.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (data.success) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // keep the delay for UX
      products = data.data;

      renderProductsTable();

      populateProductsCategoryFilter();
      // Re-attach edit button event listeners (defensive)
      document.querySelectorAll('.btn-action[title="Edit Product"]').forEach(btn => {
        const row = btn.closest('tr.product-row');
        if (row && row.dataset.id) {
          btn.onclick = (e) => { e.stopPropagation(); window.editProduct(Number(row.dataset.id)); };
        }
      });
    }
  } catch (err) {
    showToast('Failed to load products', TOAST_TYPES.ERROR);
  }
}




// ========== SUB-CATEGORIES LOADING ==========
async function loadProductSubCategories() {
  try {
    const res = await fetch('/api/products/sub-categories');
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) throw new Error('No sub-categories');
    const subCategories = data.data;
    // Populate filter dropdown
    const filterSelect = document.getElementById('products-category-filter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">All Categories</option>' +
        subCategories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }
    // Populate create form dropdown
    const createSelect = document.getElementById('products-category');
    if (createSelect) {
      createSelect.innerHTML = '<option value="">Select Category</option>' +
        subCategories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
    }
  } catch (err) {
    // Fallback: show only default options
    const filterSelect = document.getElementById('products-category-filter');
    if (filterSelect) filterSelect.innerHTML = '<option value="">All Categories</option>';
    const createSelect = document.getElementById('products-category');
    if (createSelect) createSelect.innerHTML = '<option value="">Select Category</option>';
  }
}

// Call on page load
if (document.getElementById('productsPage')) {
  loadProductSubCategories();
}

// ========== COLUMN VISIBILITY FOR PRODUCTS TABLE ==========
const productColumns = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'current_price', label: 'Price' },
  { key: 'stock_status', label: 'Stock' },
  { key: 'is_featured', label: 'Featured' },
  { key: 'is_active', label: 'Active' },
  { key: 'created_at', label: 'Created' },
  { key: 'media', label: 'Media' },
  { key: 'actions', label: 'Actions' }
];
const PRODUCT_COLUMNS_KEY = 'products_table_columns';
function getVisibleProductColumns() {
  const stored = localStorage.getItem(PRODUCT_COLUMNS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { }
  }
  return productColumns.map(c => c.key); // All visible by default
}
function setVisibleProductColumns(cols) {
  localStorage.setItem(PRODUCT_COLUMNS_KEY, JSON.stringify(cols));
}
function renderProductColumnToggles() {
  const container = document.getElementById('products-column-toggles');
  if (!container) return;
  const visible = getVisibleProductColumns();
  container.innerHTML = productColumns.map(col => `
    <label>
      <input type="checkbox" data-column="${col.key}" value="${col.key}" ${visible.includes(col.key) ? 'checked' : ''}>
      ${col.label}
    </label>
  `).join('');

  // Handle checkbox changes
  container.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
      setVisibleProductColumns(checked);
      renderProductsTable();
    });
  });
}
// Update renderProductsTable to make rows clickable for editing
function renderProductsTable() {
  const visible = getVisibleProductColumns();
  const search = (productsSearchInput?.value || '').toLowerCase();
  const category = productsCategoryFilter?.value || '';
  const stock = productsStockFilter?.value || '';
  let filtered = products.filter(p => {
    let match = true;
    if (search) match = p.name.toLowerCase().includes(search) || p.slug.toLowerCase().includes(search);
    if (category) match = match && p.category === category;
    if (stock) match = match && p.stock_status === stock;
    return match;
  });
  let header = '<tr>';
  productColumns.forEach(col => {
    if (visible.includes(col.key)) header += `<th>${col.label}</th>`;
  });
  header += '</tr>';
  productsTableHead.innerHTML = header;
  productsTableBody.innerHTML = filtered.map(p => {
    let row = `<tr class="product-row" data-id="${p.id}">`;
    productColumns.forEach(col => {
      if (!visible.includes(col.key)) return;
      if (col.key === 'media') {
        // Check if product has media array
        if (p.media && p.media.length > 0) {
          row += `<td>${p.media.map(m => {
            // Fix URL by ensuring it points to the correct uploads path
            let mediaUrl = m.media_url;
            // Normalize backslashes to forward slashes, replace 'public/uploads' with 'uploads', and make absolute
            mediaUrl = mediaUrl.replace(/\\/g, '/').replace('public/uploads', 'uploads');
            if (!mediaUrl.startsWith('/')) mediaUrl = '/' + mediaUrl;
            return m.media_type === 'image' ?
              `<img src="${mediaUrl}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;">` :
              `<video src="${mediaUrl}" style="width:32px;height:32px;border-radius:4px;" muted></video>`;
          }).join(' ')}</td>`;
        }
        // Fallback to image_url if no media array but image_url exists
        else if (p.image_url) {
          // Fix URL by ensuring it points to the correct uploads path
          let imageUrl = p.image_url;
          // Normalize backslashes to forward slashes, replace 'public/uploads' with 'uploads', and make absolute
          imageUrl = imageUrl.replace(/\\/g, '/').replace('public/uploads', 'uploads');
          if (!imageUrl.startsWith('/')) imageUrl = '/' + imageUrl;
          row += `<td><img src="${imageUrl}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;"></td>`;
        }
        // No media available
        else {
          row += `<td><div style="width:32px;height:32px;border-radius:4px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;"><i class="fas fa-image" style="color:#94a3b8;font-size:14px;"></i></div></td>`;
        }
      } else if (col.key === 'actions') {
        row += `<td>
          <div class="action-buttons">
            <button class="btn-action" data-id="${p.id}" title="Edit Product">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action danger" onclick="deleteProduct(${p.id}); event.stopPropagation();" title="Delete Product">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </td>`;
      } else if (col.key === 'is_featured' || col.key === 'is_active') {
        row += `<td>${p[col.key] ? 'Yes' : 'No'}</td>`;
      } else if (col.key === 'created_at') {
        row += `<td>${p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</td>`;
      } else {
        row += `<td>${p[col.key] || ''}</td>`;
      }
    });
    row += '</tr>';
    return row;
  }).join('');

  // Add click event to product rows
  document.querySelectorAll('.product-row').forEach(row => {
    row.addEventListener('click', () => {
      const productId = parseInt(row.dataset.id);
      window.editProduct(productId);
    });
  });
  // Attach edit button event listeners (defensive)
  document.querySelectorAll('.btn-action[title="Edit Product"]').forEach(btn => {
    const row = btn.closest('tr.product-row');
    if (row && row.dataset.id) {
      btn.onclick = (e) => { e.stopPropagation(); window.editProduct(Number(row.dataset.id)); };
    }
  });
}
// On page load, render toggles
if (document.getElementById('products-column-toggles')) {
  renderProductColumnToggles();
}

// Populate category filter
function populateProductsCategoryFilter() {
  const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  productsCategoryFilter.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Search/filter listeners
productsSearchInput?.addEventListener('input', debounce(() => {
  showProductsLoadingSpinner();
  setTimeout(() => {
    renderProductsTable();
    hideProductsLoadingSpinner();
  }, 1000);
}, 300));

productsCategoryFilter?.addEventListener('change', () => {
  showProductsLoadingSpinner();
  setTimeout(() => {
    renderProductsTable();
    hideProductsLoadingSpinner();
  }, 1000);
});

productsStockFilter?.addEventListener('change', () => {
  showProductsLoadingSpinner();
  setTimeout(() => {
    renderProductsTable();
    hideProductsLoadingSpinner();
  }, 1000);
});

// Helper functions for showing/hiding loading spinner
function showProductsLoadingSpinner() {
  const tableBody = document.getElementById('products-table-body');
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 30px;">
          <div class="loading-spinner" style="margin: 0 auto;"></div>
          <p style="margin-top: 10px; color: #64748b;">Loading products...</p>
        </td>
      </tr>
    `;
  }
}

function hideProductsLoadingSpinner() {
  renderProductsTable();
}

// Media upload logic
productsMediaUpload?.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  const totalCount = productsMediaFiles.length + (currentProductMedia ? currentProductMedia.length : 0);

  // Check if we're exceeding the 5-image limit
  if (totalCount + files.length > 5) {
    showToast(`Maximum 5 images allowed. You can add ${5 - totalCount} more.`, TOAST_TYPES.WARNING);
  }

  // Add files up to the limit
  for (let file of files) {
    if (productsMediaFiles.length + (currentProductMedia ? currentProductMedia.length : 0) >= 5) {
      showToast('Maximum 5 images reached.', TOAST_TYPES.WARNING);
      break;
    }

    if (file.size > 100 * 1024 * 1024) {
      showToast('File too large (max 100MB)', TOAST_TYPES.ERROR);
      continue;
    }

    // Check for duplicate file names
    const isDuplicate = checkForDuplicateFile(file);
    if (isDuplicate) {
      showToast(`File "${file.name}" already exists.`, TOAST_TYPES.WARNING);
      continue;
    }

    productsMediaFiles.push(file);
  }
  renderProductsMediaPreview();
});

// Helper function to check for duplicate files
function checkForDuplicateFile(file) {
  // Check against new files
  const duplicateInNew = productsMediaFiles.some(f => f.name === file.name);
  if (duplicateInNew) return true;

  // Check against existing media
  if (currentProductMedia && currentProductMedia.length > 0) {
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    const duplicateInExisting = currentProductMedia.some(media => {
      // Extract filename from media URL
      const mediaFileName = media.media_url.split('/').pop();
      return mediaFileName && mediaFileName.includes(fileNameWithoutExt);
    });
    if (duplicateInExisting) return true;
  }

  return false;
}

function renderProductsMediaPreview() {
  productsMediaPreview.innerHTML = '';

  // Combine existing media and new files for preview
  // First render existing media
  if (currentProductMedia && currentProductMedia.length > 0) {
    currentProductMedia.forEach((media, idx) => {
      // Fix URL by ensuring it points to the correct uploads path
      let mediaUrl = media.media_url;
      // Normalize backslashes to forward slashes, replace 'public/uploads' with 'uploads', and make absolute
      mediaUrl = mediaUrl.replace(/\\/g, '/').replace('public/uploads', 'uploads');
      if (!mediaUrl.startsWith('/')) mediaUrl = '/' + mediaUrl;

      const wrapper = document.createElement('div');
      wrapper.className = 'products-media-thumb existing-media';
      wrapper.dataset.url = mediaUrl;
      wrapper.dataset.type = media.media_type || 'image';
      wrapper.dataset.id = media.id || '';
      wrapper.dataset.idx = idx;
      wrapper.dataset.source = 'existing';
      wrapper.draggable = true;

      wrapper.innerHTML = `
        ${media.media_type === 'video' ?
          `<video src="${mediaUrl}" style="width:60px;height:60px;border-radius:6px;" controls muted></video>` :
          `<img src="${mediaUrl}" alt="Media" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">`
        }
        <div class="existing-media-overlay">Existing</div>
        <button type="button" class="products-media-remove" title="Remove" data-idx="${idx}" data-source="existing">
          <i class="fas fa-times"></i>
        </button>
        <span class="products-media-drag" title="Drag to reorder"><i class="fas fa-arrows-alt"></i></span>
      `;

      productsMediaPreview.appendChild(wrapper);
    });
  }

  // Then render new files
  productsMediaFiles.forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const wrapper = document.createElement('div');
    wrapper.className = 'products-media-thumb new-media';
    wrapper.draggable = true;
    wrapper.dataset.idx = idx;
    wrapper.dataset.source = 'new';
    wrapper.innerHTML = `
      ${isImage ? `<img src="${url}" alt="Image" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">` : ''}
      ${isVideo ? `<video src="${url}" style="width:60px;height:60px;border-radius:6px;" controls muted></video>` : ''}
      <button type="button" class="products-media-remove" title="Remove" data-idx="${idx}" data-source="new"><i class="fas fa-times"></i></button>
      <span class="products-media-drag" title="Drag to reorder"><i class="fas fa-arrows-alt"></i></span>
    `;
    productsMediaPreview.appendChild(wrapper);
  });

  // Add a note about featured image if there's at least one image
  if ((currentProductMedia && currentProductMedia.length > 0) || productsMediaFiles.length > 0) {
    const note = document.createElement('div');
    note.className = 'products-media-note';
    note.innerHTML = '<small>First image will be used as the featured image. Drag to reorder.</small>';
    productsMediaPreview.appendChild(note);
  }

  // Remove handler for all media
  productsMediaPreview.querySelectorAll('.products-media-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = +btn.dataset.idx;
      const source = btn.dataset.source;

      if (source === 'existing') {
        // Remove from existing media
        const mediaId = currentProductMedia[idx].id;
        if (mediaId) {
          existingMediaIds = existingMediaIds.filter(id => id != mediaId);
        }
        currentProductMedia.splice(idx, 1);
      } else {
        // Remove from new files
        productsMediaFiles.splice(idx, 1);
      }

      renderProductsMediaPreview();
    });
  });

  // Drag & drop reorder for all media
  let dragSource = null;
  let dragIdx = null;

  productsMediaPreview.querySelectorAll('.products-media-thumb').forEach(thumb => {
    thumb.addEventListener('dragstart', (e) => {
      dragIdx = +thumb.dataset.idx;
      dragSource = thumb.dataset.source;
      e.dataTransfer.effectAllowed = 'move';
    });

    thumb.addEventListener('dragover', (e) => {
      e.preventDefault();
      thumb.classList.add('drag-over');
    });

    thumb.addEventListener('dragleave', () => thumb.classList.remove('drag-over'));

    thumb.addEventListener('drop', (e) => {
      e.preventDefault();
      thumb.classList.remove('drag-over');

      const dropIdx = +thumb.dataset.idx;
      const dropSource = thumb.dataset.source;

      if (dragIdx === null) return;

      // Handle the different drag-drop scenarios
      if (dragSource === 'existing' && dropSource === 'existing') {
        // Reordering existing media
        if (dragIdx !== dropIdx) {
          const [moved] = currentProductMedia.splice(dragIdx, 1);
          currentProductMedia.splice(dropIdx, 0, moved);
        }
      } else if (dragSource === 'new' && dropSource === 'new') {
        // Reordering new files
        if (dragIdx !== dropIdx) {
          const [moved] = productsMediaFiles.splice(dragIdx, 1);
          productsMediaFiles.splice(dropIdx, 0, moved);
        }
      } else if (dragSource === 'existing' && dropSource === 'new') {
        // Moving existing media before a new file
        // This is complex - we need to convert the existing media to a position in the combined array
        // For simplicity, we'll just re-render for now
        // A more complex implementation would track the overall order
      } else if (dragSource === 'new' && dropSource === 'existing') {
        // Moving a new file before an existing media
        // Similar complexity as above
      }

      // Reset drag state
      dragIdx = null;
      dragSource = null;

      // Re-render the preview
      renderProductsMediaPreview();
    });
  });
}

// Function to edit a product
window.editProduct = async function (id) {
  // Fetch latest product data from backend
  let product = null;
  try {
    const res = await fetch(`/api/products/products/${id}`, { credentials: 'include' });
    const data = await res.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (data && data.success && data.data) {
      product = data.data;
    } else {
      showToast('Product not found', TOAST_TYPES.ERROR);
      return;
    }
  } catch (err) {
    showToast('Failed to fetch product', TOAST_TYPES.ERROR);
    return;
  }

  // Show create form but with product data
  productsListSection.style.display = 'none';
  productsCreateSection.style.display = 'block';

  // Set form title
  const formTitle = productsCreateSection.querySelector('h2');
  if (formTitle) {
    formTitle.textContent = 'Edit Product';
  }

  // Store product ID in the form for later use
  productsCreateForm.dataset.productId = id;
  productsCreateForm.dataset.isUpdate = 'true';

  // Remove 'required' from media input when editing
  const mediaInput = document.getElementById('products-media-upload');
  if (mediaInput) {
    mediaInput.removeAttribute('required');
  }

  // Fill form fields with product data
  const form = document.getElementById('products-create-form');

  // Basic fields
  form['name'].value = product.name || '';
  form['slug'].value = product.slug || '';
  form['description'].value = product.description || '';
  form['long_description'].value = product.long_description || '';
  form['meta_description'].value = product.meta_description || '';
  form['current_price'].value = product.current_price || '';
  form['original_price'].value = product.original_price || '';
  form['currency'].value = product.currency || 'NPR';

  // Select fields
  if (form['category']) {
    // Make sure the category exists in the dropdown, if not add it
    let categoryExists = false;
    for (let i = 0; i < form['category'].options.length; i++) {
      if (form['category'].options[i].value === product.category) {
        categoryExists = true;
        break;
      }
    }

    if (!categoryExists && product.category) {
      const option = document.createElement('option');
      option.value = product.category;
      option.textContent = product.category;
      form['category'].appendChild(option);
    }

    form['category'].value = product.category || '';
  }

  // Parse JSON tags if needed
  if (product.tags) {
    if (Array.isArray(product.tags)) {
      form['tags'].value = product.tags.join(', ');
    } else if (typeof product.tags === 'string') {
      if (product.tags.trim().startsWith('[') && product.tags.trim().endsWith(']')) {
        try {
          const parsedTags = JSON.parse(product.tags);
          if (Array.isArray(parsedTags)) {
            form['tags'].value = parsedTags.join(', ');
          } else {
            form['tags'].value = product.tags;
          }
        } catch (e) {
          form['tags'].value = product.tags;
        }
      } else {
        form['tags'].value = product.tags;
      }
    } else {
      form['tags'].value = '';
    }
  } else {
    form['tags'].value = '';
  }

  form['seo_title'].value = product.seo_title || '';
  form['seo_keywords'].value = product.seo_keywords || '';
  form['stock_status'].value = product.stock_status || 'in_stock';

  // Boolean fields
  if (form['is_featured']) {
    form['is_featured'].value = product.is_featured ? '1' : '0';
  }
  if (form['is_active']) {
    form['is_active'].value = product.is_active ? '1' : '0';
  }

  // Reset media files array and existing media IDs
  productsMediaFiles = [];
  existingMediaIds = [];
  currentProductMedia = [];

  // If product has media, show it in preview
  if (product.media && product.media.length > 0) {
    existingMediaIds = product.media.filter(m => m.id).map(m => m.id);
    currentProductMedia = [...product.media];
    renderProductMediaPreviews(currentProductMedia);
  } else if (product.image_url) {
    let imageUrl = product.image_url;
    imageUrl = imageUrl.replace(/\\/g, '/').replace('public/uploads', 'uploads');
    if (!imageUrl.startsWith('/')) imageUrl = '/' + imageUrl;
    const singleMedia = {
      media_url: imageUrl,
      media_type: 'image',
      media_order: 0
    };
    currentProductMedia = [singleMedia];
    renderProductMediaPreviews(currentProductMedia);
  }

  // Update submit button text
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Product';
  }

  // Hide controls
  document.querySelector('.products-controls')?.classList.add('hidden');
  mainContent?.classList.add('products-create-active');
};

// Helper function to render product media previews for edit mode
function renderProductMediaPreviews(mediaArray) {
  const previewContainer = document.getElementById('products-media-preview');
  if (!previewContainer) return;

  previewContainer.innerHTML = '';

  mediaArray.forEach((media, idx) => {
    // Fix URL by ensuring it points to the correct uploads path
    let mediaUrl = media.media_url;
    // Normalize backslashes to forward slashes, replace 'public/uploads' with 'uploads', and make absolute
    mediaUrl = mediaUrl.replace(/\\/g, '/').replace('public/uploads', 'uploads');
    if (!mediaUrl.startsWith('/')) mediaUrl = '/' + mediaUrl;

    const wrapper = document.createElement('div');
    wrapper.className = 'products-media-thumb existing-media';
    wrapper.dataset.url = mediaUrl;
    wrapper.dataset.type = media.media_type || 'image';
    wrapper.dataset.id = media.id || '';
    wrapper.dataset.idx = idx;
    wrapper.draggable = true;

    wrapper.innerHTML = `
      ${media.media_type === 'video' ?
        `<video src="${mediaUrl}" style="width:60px;height:60px;border-radius:6px;" controls muted></video>` :
        `<img src="${mediaUrl}" alt="Media" style="width:60px;height:60px;object-fit:cover;border-radius:6px;">`
      }
      <div class="existing-media-overlay">Existing</div>
      <button type="button" class="products-media-remove" title="Remove" data-id="${media.id || ''}">
        <i class="fas fa-times"></i>
      </button>
      <span class="products-media-drag" title="Drag to reorder"><i class="fas fa-arrows-alt"></i></span>
    `;

    previewContainer.appendChild(wrapper);
  });

  // Add drag & drop reorder functionality for existing media
  let dragIdx = null;
  previewContainer.querySelectorAll('.products-media-thumb').forEach(thumb => {
    thumb.addEventListener('dragstart', (e) => {
      dragIdx = +thumb.dataset.idx;
      e.dataTransfer.effectAllowed = 'move';
    });
    thumb.addEventListener('dragover', (e) => {
      e.preventDefault();
      thumb.classList.add('drag-over');
    });
    thumb.addEventListener('dragleave', () => thumb.classList.remove('drag-over'));
    thumb.addEventListener('drop', (e) => {
      e.preventDefault();
      thumb.classList.remove('drag-over');
      const dropIdx = +thumb.dataset.idx;
      if (dragIdx !== null && dragIdx !== dropIdx) {
        // Update the order in the existingMediaIds array
        // We need to reorder the media items based on their new positions
        const mediaId = mediaArray[dragIdx].id;

        // Move the media item in the array
        const [moved] = mediaArray.splice(dragIdx, 1);
        mediaArray.splice(dropIdx, 0, moved);

        // Re-render with updated order
        renderProductMediaPreviews(mediaArray);
      }
      dragIdx = null;
    });
  });

  // Add remove handlers for existing media
  previewContainer.querySelectorAll('.products-media-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const mediaId = btn.dataset.id;
      const mediaThumb = btn.closest('.products-media-thumb');
      const idx = +mediaThumb.dataset.idx;

      // Remove from existingMediaIds array
      if (mediaId) {
        existingMediaIds = existingMediaIds.filter(id => id != mediaId);
      }

      // Remove from mediaArray
      mediaArray.splice(idx, 1);

      // Re-render without the removed item
      renderProductMediaPreviews(mediaArray);
    });
  });
}

// Utility: Sanitize input for product fields
function sanitizeProductInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>/\\|;"'~]/g, '') // Remove dangerous characters
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

// When submitting create/update product, sanitize all fields and use the selected category from the <select>
async function submitProductForm(isUpdate = false, productId = null) {
  const form = document.getElementById('products-create-form');


  // Require long_description
  if (!form['long_description'].value.trim()) {
    showToast('Long Description is required.', TOAST_TYPES.ERROR);
    form['long_description'].focus();
    return;
  }

  // Get submit button and show loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="product-btn-spinner active" id="product-btn-spinner"></span><span class="product-btn-text">Saving...</span>';

  const formData = new FormData();
  // Sanitize and append fields
  formData.append('name', sanitizeProductInput(form['name'].value));
  formData.append('slug', sanitizeProductInput(form['slug'].value));
  formData.append('description', sanitizeProductInput(form['description'].value));
  formData.append('long_description', sanitizeProductInput(form['long_description'].value));
  formData.append('meta_description', sanitizeProductInput(form['meta_description'].value));
  formData.append('current_price', form['current_price'].value);
  formData.append('original_price', form['original_price'].value);
  formData.append('category', sanitizeProductInput(form['category'].value));

  // Process tags - convert comma-separated string to array
  const tagsValue = sanitizeProductInput(form['tags'].value);
  const tagsArray = tagsValue ? tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
  formData.append('tags', JSON.stringify(tagsArray));

  formData.append('seo_title', sanitizeProductInput(form['seo_title'].value));
  formData.append('seo_keywords', sanitizeProductInput(form['seo_keywords'].value));
  formData.append('stock_status', sanitizeProductInput(form['stock_status'].value));
  formData.append('is_featured', form['is_featured'].value === '1' ? '1' : '0');
  formData.append('is_active', form['is_active'].value === '1' ? '1' : '0');
  formData.append('currency', sanitizeProductInput(form['currency'].value));

  // Check if we're exceeding the 5-image limit
  const totalMediaCount = (isUpdate ? currentProductMedia.length : 0) + productsMediaFiles.length;
  if (totalMediaCount > 5) {
    showToast('Maximum 5 images allowed. Please remove some images.', TOAST_TYPES.ERROR);
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    return;
  }

  // Media files - only append new files, existing media will be preserved
  productsMediaFiles.forEach(f => formData.append('media', f));

  // Include existing media IDs to preserve them
  if (isUpdate && existingMediaIds.length > 0) {
    formData.append('existing_media_ids', JSON.stringify(existingMediaIds));

    // Also send the media order information
    const mediaOrder = currentProductMedia
      .filter(m => m.id && existingMediaIds.includes(m.id))
      .map((m, idx) => ({ id: m.id, order: idx }));

    formData.append('media_order', JSON.stringify(mediaOrder));

    // Set the first image as the featured image
    if (currentProductMedia.length > 0) {
      const featuredImageUrl = currentProductMedia[0].media_url;
      formData.append('featured_image_url', featuredImageUrl);
    }
  }

  // POST or PUT
  const url = isUpdate ? `/api/products/admin/products/${productId}` : '/api/products/admin/products';
  const method = isUpdate ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      body: formData,
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${csrfToken}`
      }
    });

    const data = await res.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (res.status === 204 || res.status === 200) {
      showToast(`Product ${isUpdate ? 'updated' : 'created'} successfully!`, TOAST_TYPES.SUCCESS);
      await loadProducts(); // Wait for products to reload
      resetProductForm();
      productsCreateSection.style.display = 'none';
      productsListSection.style.display = 'block';
      mainContent?.classList.remove('products-create-active');
    } else {
      const data = await res.json();
      showToast(data.message || `Failed to ${isUpdate ? 'update' : 'create'} product`, TOAST_TYPES.ERROR);
    }
  } catch (err) {
    showToast(`Failed to ${isUpdate ? 'update' : 'create'} product`, TOAST_TYPES.ERROR);
  } finally {
    // Restore button state
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

// Create product submit
productsCreateForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Check if this is an update or create operation
  const isUpdate = productsCreateForm.dataset.isUpdate === 'true';
  const productId = productsCreateForm.dataset.productId;

  await submitProductForm(isUpdate, productId);
});

// When back or cancel button is clicked, reset form
const resetProductForm = () => {
  productsCreateForm.reset();
  productsMediaFiles = [];
  existingMediaIds = []; // Reset existing media IDs
  currentProductMedia = [];
  renderProductsMediaPreview();
  productsCreateForm.dataset.productId = '';
  productsCreateForm.dataset.isUpdate = 'false';

  // Add 'required' to media input when creating
  const mediaInput = document.getElementById('products-media-upload');
  if (mediaInput) {
    mediaInput.setAttribute('required', 'required');
  }

  // Reset form title
  const formTitle = productsCreateSection.querySelector('h2');
  if (formTitle) {
    formTitle.textContent = 'Create New Product';
  }

  // Reset submit button text
  const submitBtn = productsCreateForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = 'Save Product';
  }

  // Clear media preview
  const previewContainer = document.getElementById('products-media-preview');
  if (previewContainer) {
    previewContainer.innerHTML = '';
  }

  // Debug log: confirm reset
  console.log('Product form and state reset:', {
    productsMediaFiles,
    currentProductMedia,
    existingMediaIds,
    dataset: {
      productId: productsCreateForm.dataset.productId,
      isUpdate: productsCreateForm.dataset.isUpdate
    }
  });
};

productsBackBtn?.addEventListener('click', () => {
  resetProductForm();
});

productsCancelBtn?.addEventListener('click', () => {
  resetProductForm();
});

// Delete product - updated to use modal
let productToDelete = null;

window.deleteProduct = function (id) {
  // Find the product in the products array
  const product = products.find(p => p.id === id);
  if (!product) {
    showToast('Product not found', TOAST_TYPES.ERROR);
    return;
  }

  // Set the product to delete
  productToDelete = id;

  // Update the modal with product details
  const nameElement = document.getElementById('delete-product-name');
  if (nameElement) {
    nameElement.textContent = product.name;
  }

  // Show the modal
  const modal = document.getElementById('product-delete-modal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
};

window.closeProductDeleteModal = function () {
  const modal = document.getElementById('product-delete-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  productToDelete = null;
};

// Set up event listener for the confirm delete button
document.addEventListener('DOMContentLoaded', function () {
  const confirmDeleteBtn = document.getElementById('confirm-delete-product-btn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async function () {
      if (productToDelete === null) {
        closeProductDeleteModal();
        return;
      }

      // Show loading state
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.innerHTML = '<span class="loading-spinner"></span> Deleting...';

      try {
        const res = await fetch(`/api/products/admin/products/${productToDelete}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'X-CSRF-Token': `bearer ${csrfToken}`,
          }
        });

        const data = await res.json();

        if (data.status === 'error') {
          showToast(data.message, TOAST_TYPES.ERROR);
          return;
        }
        if (res.status === 204) {
          showToast('Product deleted successfully', TOAST_TYPES.SUCCESS);
          loadProducts();
        } else {

          showToast(data.message || 'Failed to delete product', TOAST_TYPES.ERROR);
        }
      } catch (err) {
        showToast('Failed to delete product', TOAST_TYPES.ERROR);
      } finally {
        // Reset button state
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Product';
        closeProductDeleteModal();
      }
    });
  }
});

// Make showPage available if defined in admin.js
if (typeof window.showPage !== 'function') {
  window.showPage = function (pageId) {
    // Only call parent if it's a different window
    if (window.parent && window.parent !== window && typeof window.parent.showPage === 'function') {
      return window.parent.showPage(pageId);
    }
    // Fallback: manually show/hide sections
    document.querySelectorAll('.page-section').forEach(section => {
      section.style.display = 'none';
    });
    const activePage = document.getElementById(pageId + 'Page');
    if (activePage) activePage.style.display = 'block';
  };
}

// ===================== SLIDER & PROMO MANAGEMENT =====================

// View Management Functions
window.showSliderList = function () {
  document.getElementById('slider-list-view').style.display = 'block';
  document.getElementById('slider-create-view').style.display = 'none';
  document.getElementById('slider-edit-view').style.display = 'none';
  loadAdminSliders();
};

window.showSliderCreate = function () {
  document.getElementById('slider-list-view').style.display = 'none';
  document.getElementById('slider-create-view').style.display = 'block';
  document.getElementById('slider-edit-view').style.display = 'none';
  setupFileUpload('slider-image-upload', 'slider-image-preview');
};

window.showSliderEdit = function (id) {
  document.getElementById('slider-list-view').style.display = 'none';
  document.getElementById('slider-create-view').style.display = 'none';
  document.getElementById('slider-edit-view').style.display = 'block';
  loadSliderForEdit(id);
};

window.showPromoList = function () {
  document.getElementById('promo-list-view').style.display = 'block';
  document.getElementById('promo-create-view').style.display = 'none';
  document.getElementById('promo-edit-view').style.display = 'none';
  loadAdminPromos();
};

window.showPromoCreate = function () {
  document.getElementById('promo-list-view').style.display = 'none';
  document.getElementById('promo-create-view').style.display = 'block';
  document.getElementById('promo-edit-view').style.display = 'none';
  setupFileUpload('promo-image-upload', 'promo-image-preview');
};

window.showPromoEdit = function (id) {
  document.getElementById('promo-list-view').style.display = 'none';
  document.getElementById('promo-create-view').style.display = 'none';
  document.getElementById('promo-edit-view').style.display = 'block';
  loadPromoForEdit(id);
};

// File Upload Handler
function setupFileUpload(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const wrapper = input.closest('.file-upload-wrapper');
  const label = wrapper.querySelector('.file-upload-label span');
  const originalText = label.textContent;

  // Handle drag and drop
  wrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    wrapper.classList.add('dragover');
  });

  wrapper.addEventListener('dragleave', () => {
    wrapper.classList.remove('dragover');
  });

  wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    wrapper.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Handle file selection
  input.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFiles(e.target.files);
    }
  });

  function handleFiles(files) {
    if (files[0]) {
      const file = files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showToast('File size should not exceed 5MB', TOAST_TYPES.ERROR);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        preview.innerHTML = `
          <img src="${e.target.result}" alt="Preview">
          <small>Selected file: ${file.name}</small>
        `;
      };
      reader.readAsDataURL(file);
      label.textContent = file.name;
    } else {
      preview.innerHTML = '';
      label.textContent = originalText;
    }
  }
}

// Load Sliders
window.loadAdminSliders = async function () {
  try {
    const response = await fetch('/api/products/admin/sliders', {
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();


    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (data.success) {
      renderSliderTable(data.data);
    } else {
      showToast('Failed to load slider images', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error loading sliders:', err);
    showToast('Failed to load slider images', TOAST_TYPES.ERROR);
  }
};

// Load Promos
window.loadAdminPromos = async function () {
  try {
    const response = await fetch('/api/products/admin/promos', {
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }


    if (data.success) {
      renderPromoTable(data.data);
    } else {
      showToast('Failed to load promo images', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error loading promos:', err);
    showToast('Failed to load promo images', TOAST_TYPES.ERROR);
  }
};

// Render Slider Table
function renderSliderTable(sliders) {
  const table = document.getElementById('slider-images-table');
  if (!table) return;

  table.innerHTML = sliders.map(slider => `
    <tr>
      <td>
        <img src="${slider.image_url}" alt="${slider.title}"
             onerror="this.src='https://via.placeholder.com/60x32?text=No+Image'">
      </td>
      <td>${slider.title || ''}</td>
      <td>${slider.description || ''}</td>
      <td>
        <span class="status-badge ${slider.is_active ? 'active' : 'locked'}">
          ${slider.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>${slider.sort_order || 0}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action" onclick="window.showSliderEdit(${slider.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-action danger" onclick="deleteSlider(${slider.id}, '${slider.title?.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="text-center">No slider images found</td></tr>';
}

// Render Promo Table
function renderPromoTable(promos) {
  const table = document.getElementById('promo-images-table');
  if (!table) return;

  table.innerHTML = promos.map(promo => `
    <tr>
      <td>
        <img src="${promo.image_url}" alt="${promo.title}"
             onerror="this.src='https://via.placeholder.com/60x32?text=No+Image'">
      </td>
      <td>${promo.title || ''}</td>
      <td>
        <span class="badge ${promo.promo_type}">
          ${promo.promo_type?.charAt(0).toUpperCase() + promo.promo_type?.slice(1) || ''}
        </span>
      </td>
      <td>
        <span class="status-badge ${promo.is_active ? 'active' : 'locked'}">
          ${promo.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>${promo.sort_order || 0}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-action" onclick="window.showPromoEdit(${promo.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-action danger" onclick="deletePromo(${promo.id}, '${promo.title?.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="text-center">No promo images found</td></tr>';
}

// Load Slider for Edit
async function loadSliderForEdit(id) {
  try {
    const response = await fetch(`/api/products/admin/sliders/${id}`, {
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (data.success) {
      const slider = data.data;
      const form = document.getElementById('slider-edit-form');
      form.dataset.sliderId = id;

      // Fill form fields
      form.querySelector('[name="title"]').value = slider.title || '';
      form.querySelector('[name="description"]').value = slider.description || '';
      form.querySelector('[name="sort_order"]').value = slider.sort_order || 0;
      form.querySelector('[name="alt_text"]').value = slider.alt_text || '';
      form.querySelector('[name="link_url"]').value = slider.link_url || '';
      form.querySelector('[name="button_text"]').value = slider.button_text || '';
      form.querySelector('[name="button_url"]').value = slider.button_url || '';
      form.querySelector('[name="is_active"]').checked = slider.is_active;

      // Show current image
      const preview = document.getElementById('slider-edit-image-preview');
      if (slider.image_url) {
        preview.innerHTML = `
          <img src="${slider.image_url}" alt="Current">
          <small>Current image will be kept unless you upload a new one</small>
        `;
      }

      setupFileUpload('slider-edit-image-upload', 'slider-edit-image-preview');
    } else {
      showToast('Failed to load slider data', TOAST_TYPES.ERROR);
      showSliderList();
    }
  } catch (err) {
    console.error('Error loading slider:', err);
    showToast('Failed to load slider data', TOAST_TYPES.ERROR);
    showSliderList();
  }
}

// Load Promo for Edit
async function loadPromoForEdit(id) {
  try {
    const response = await fetch(`/api/products/admin/promos/${id}`, {
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (data.success) {
      const promo = data.data;
      const form = document.getElementById('promo-edit-form');
      form.dataset.promoId = id;

      // Fill form fields
      form.querySelector('[name="title"]').value = promo.title || '';
      form.querySelector('[name="sort_order"]').value = promo.sort_order || 0;
      form.querySelector('[name="promo_type"]').value = promo.promo_type || '';
      form.querySelector('[name="alt_text"]').value = promo.alt_text || '';
      form.querySelector('[name="link_url"]').value = promo.link_url || '';
      form.querySelector('[name="is_active"]').checked = promo.is_active;

      // Show current image
      const preview = document.getElementById('promo-edit-image-preview');
      if (promo.image_url) {
        preview.innerHTML = `
          <img src="${promo.image_url}" alt="Current">
          <small>Current image will be kept unless you upload a new one</small>
        `;
      }

      setupFileUpload('promo-edit-image-upload', 'promo-edit-image-preview');
    } else {
      showToast('Failed to load promo data', TOAST_TYPES.ERROR);
      showPromoList();
    }
  } catch (err) {
    console.error('Error loading promo:', err);
    showToast('Failed to load promo data', TOAST_TYPES.ERROR);
    showPromoList();
  }
}

// Form Submission Handlers
document.getElementById('slider-create-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  // Explicitly set is_active based on checkbox
  formData.set('is_active', form.querySelector('[name="is_active"]').checked);

  try {
    const response = await fetch('/api/products/admin/sliders', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }


    if (data.success) {
      showToast('Slider created successfully', TOAST_TYPES.SUCCESS);
      form.reset();
      showSliderList();
    } else {
      showToast(data.message || 'Failed to create slider', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error creating slider:', err);
    showToast('Failed to create slider', TOAST_TYPES.ERROR);
  }
});

document.getElementById('slider-edit-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const sliderId = form.dataset.sliderId;

  // Explicitly set is_active based on checkbox
  formData.set('is_active', form.querySelector('[name="is_active"]').checked);

  try {
    const response = await fetch(`/api/products/admin/sliders/${sliderId}`, {
      method: 'PUT',
      body: formData,
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (data.success) {
      showToast('Slider updated successfully', TOAST_TYPES.SUCCESS);
      showSliderList();
    } else {
      showToast(data.message || 'Failed to update slider', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error updating slider:', err);
    showToast('Failed to update slider', TOAST_TYPES.ERROR);
  }
});

document.getElementById('promo-create-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  // Explicitly set is_active based on checkbox
  formData.set('is_active', form.querySelector('[name="is_active"]').checked);

  try {
    const response = await fetch('/api/products/admin/promos', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }


    if (data.success) {
      showToast('Promo created successfully', TOAST_TYPES.SUCCESS);
      form.reset();
      showPromoList();
    } else {
      showToast(data.message || 'Failed to create promo', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error creating promo:', err);
    showToast('Failed to create promo', TOAST_TYPES.ERROR);
  }
});

document.getElementById('promo-edit-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const promoId = form.dataset.promoId;

  // Explicitly set is_active based on checkbox
  formData.set('is_active', form.querySelector('[name="is_active"]').checked);

  try {
    const response = await fetch(`/api/products/admin/promos/${promoId}`, {
      method: 'PUT',
      body: formData,
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }

    if (data.success) {
      showToast('Promo updated successfully', TOAST_TYPES.SUCCESS);
      showPromoList();
    } else {
      showToast(data.message || 'Failed to update promo', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error updating promo:', err);
    showToast('Failed to update promo', TOAST_TYPES.ERROR);
  }
});

// Delete Functions
let sliderToDelete = null;
let promoToDelete = null;

window.deleteSlider = function (id, title) {
  sliderToDelete = id;
  const nameElement = document.getElementById('delete-slider-name');
  if (nameElement) {
    nameElement.textContent = title || 'Untitled Slider';
  }
  const modal = document.getElementById('slider-delete-modal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
};

window.closeSliderDeleteModal = function () {
  const modal = document.getElementById('slider-delete-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  sliderToDelete = null;
};

window.deletePromo = function (id, title) {
  promoToDelete = id;
  const nameElement = document.getElementById('delete-promo-name');
  if (nameElement) {
    nameElement.textContent = title || 'Untitled Promo';
  }
  const modal = document.getElementById('promo-delete-modal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
};

window.closePromoDeleteModal = function () {
  const modal = document.getElementById('promo-delete-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  promoToDelete = null;
};

// Set up event listeners for delete confirmations
document.addEventListener('DOMContentLoaded', function () {
  // Slider delete confirmation
  const confirmDeleteSliderBtn = document.getElementById('confirm-delete-slider-btn');
  if (confirmDeleteSliderBtn) {
    confirmDeleteSliderBtn.addEventListener('click', async function () {
      if (sliderToDelete === null) {
        closeSliderDeleteModal();
        return;
      }

      // Show loading state
      confirmDeleteSliderBtn.disabled = true;
      confirmDeleteSliderBtn.innerHTML = '<span class="loading-spinner"></span> Deleting...';

      try {
        const response = await fetch(`/api/products/admin/sliders/${sliderToDelete}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'X-CSRF-Token': `bearer ${window.csrfToken}`
          }
        });

        const data = await response.json();

        if (data.status === 'error') {
          showToast(data.message, TOAST_TYPES.ERROR);
          return;
        }

        if (data.success) {
          showToast('Slider deleted successfully', TOAST_TYPES.SUCCESS);
          loadAdminSliders();
        } else {
          showToast(data.message || 'Failed to delete slider', TOAST_TYPES.ERROR);
        }
      } catch (err) {
        console.error('Error deleting slider:', err);
        showToast('Failed to delete slider', TOAST_TYPES.ERROR);
      } finally {
        // Reset button state
        confirmDeleteSliderBtn.disabled = false;
        confirmDeleteSliderBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Slider';
        closeSliderDeleteModal();
      }
    });
  }

  // Promo delete confirmation
  const confirmDeletePromoBtn = document.getElementById('confirm-delete-promo-btn');
  if (confirmDeletePromoBtn) {
    confirmDeletePromoBtn.addEventListener('click', async function () {
      if (promoToDelete === null) {
        closePromoDeleteModal();
        return;
      }

      // Show loading state
      confirmDeletePromoBtn.disabled = true;
      confirmDeletePromoBtn.innerHTML = '<span class="loading-spinner"></span> Deleting...';

      try {
        const response = await fetch(`/api/products/admin/promos/${promoToDelete}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'X-CSRF-Token': `bearer ${window.csrfToken}`
          }
        });

        const data = await response.json();

        if (data.status === 'error') {
          showToast(data.message, TOAST_TYPES.ERROR);
          return;
        }
        if (data.success) {
          showToast('Promo deleted successfully', TOAST_TYPES.SUCCESS);
          loadAdminPromos();
        } else {
          showToast(data.message || 'Failed to delete promo', TOAST_TYPES.ERROR);
        }
      } catch (err) {
        console.error('Error deleting promo:', err);
        showToast('Failed to delete promo', TOAST_TYPES.ERROR);
      } finally {
        // Reset button state
        confirmDeletePromoBtn.disabled = false;
        confirmDeletePromoBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Promo';
        closePromoDeleteModal();
      }
    });
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
  // Get nav items
  const sliderNavItem = document.querySelector('.nav-item[data-page="slider"]');
  const promoNavItem = document.querySelector('.nav-item[data-page="promo"]');

  // Add click handlers
  if (sliderNavItem) {
    sliderNavItem.addEventListener('click', function (e) {
      e.preventDefault();
      window.showPage('slider');
      window.showSliderList();
    });
  }

  if (promoNavItem) {
    promoNavItem.addEventListener('click', function (e) {
      e.preventDefault();
      window.showPage('promo');
      window.showPromoList();
    });
  }

  // Check if we should load slider/promo data on page load
  const currentPage = sessionStorage.getItem('admin_active_page');
  if (currentPage === 'slider') {
    window.showSliderList();
  } else if (currentPage === 'promo') {
    window.showPromoList();
  }
});

// ===================== GAMES MANAGEMENT =====================

let games = [];
let currentGameId = null;
let gamesSearchTerm = '';

// Add search input event listener for games
const gamesSearchInput = document.getElementById('games-search-input');
if (gamesSearchInput) {
  gamesSearchInput.addEventListener('input', debounce(() => {
    gamesSearchTerm = gamesSearchInput.value.trim().toLowerCase();
    showTableLoadingSpinner('games-table-body', 5);
    setTimeout(() => {
      renderGamesTable();
    }, 1000);
  }, 300));
}

// View Management Functions
window.showGamesList = function () {
  document.getElementById('games-list-view').style.display = 'block';
  document.getElementById('games-create-view').style.display = 'none';
  document.getElementById('games-edit-view').style.display = 'none';
  loadGames();
};

window.showGameCreate = function () {
  document.getElementById('games-list-view').style.display = 'none';
  document.getElementById('games-create-view').style.display = 'block';
  document.getElementById('games-edit-view').style.display = 'none';
  setupFileUpload('game-image-upload', 'game-image-preview');
  // Clear variants container
  document.getElementById('variants-container').innerHTML = '';
  // Add first variant by default
  addVariant();
};

window.showGameEdit = function (id) {
  document.getElementById('games-list-view').style.display = 'none';
  document.getElementById('games-create-view').style.display = 'none';
  document.getElementById('games-edit-view').style.display = 'block';
  loadGameForEdit(id);
};

// Load Games
async function loadGames() {
  try {
    showTableLoadingSpinner('games-table-body', 5);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const response = await fetch('/api/products/admin/games', {
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });
    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }
    if (data.success) {
      games = data.data;
      renderGamesTable();
    } else {
      showToast('Failed to load games', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error loading games:', err);
    showToast('Failed to load games', TOAST_TYPES.ERROR);
  }
}

// Render Games Table
function renderGamesTable() {
  const table = document.getElementById('games-table-body');
  if (!table) return;

  // Filter games by search term
  let filteredGames = games;
  if (gamesSearchTerm) {
    filteredGames = games.filter(game =>
      (game.game_name && game.game_name.toLowerCase().includes(gamesSearchTerm)) ||
      (game.description && game.description.toLowerCase().includes(gamesSearchTerm))
    );
  }

  table.innerHTML = filteredGames.map(game => `
    <tr>
      <td>
        <img src="${game.game_image_url}" alt="${game.game_name}"
             onerror="this.src='/noice/placeholder.webp'">
      </td>
      <td>${game.game_name || ''}</td>
      <td>
        ${game.variants.map(variant => `
          <span class="badge ${variant.topup_type}">
            ${variant.variant_name} (${variant.quantity})
          </span>
        `).join(' ')}
      </td>
      <td>
        <span class="status-badge ${game.is_active ? 'active' : 'locked'}">
          ${game.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn-action" onclick="showGameEdit(${game.id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-action danger" onclick="deleteGame(${game.id}, '${game.game_name?.replace(/'/g, "\\'")}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="text-center">No games found</td></tr>';
}

// Variant Management
function createVariantHTML(index, variant = null) {
  return `
    <div class="variant-item" data-index="${index}">
      <div class="variant-header">
        <h4>Variant #${index + 1}</h4>
        <button type="button" class="btn-action danger" onclick="removeVariant(${index})">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="variant-form">
        <div class="form-group">
          <label>Type <span class="required">*</span></label>
          <select name="variants[${index}][topup_type]" required>
            <option value="in_game" ${variant?.topup_type === 'in_game' ? 'selected' : ''}>In-Game Currency</option>
            <option value="pass" ${variant?.topup_type === 'pass' ? 'selected' : ''}>Game Pass</option>
            <option value="wallet" ${variant?.topup_type === 'wallet' ? 'selected' : ''}>Wallet</option>
          </select>
        </div>
        <div class="form-group">
          <label>Name <span class="required">*</span></label>
          <input type="text" name="variants[${index}][variant_name]" 
                 value="${variant?.variant_name || ''}" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="variants[${index}][description]" rows="2">${variant?.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Price <span class="required">*</span></label>
            <input type="number" name="variants[${index}][price]" 
                   value="${variant?.price || ''}" required min="0" step="0.01">
          </div>
          <div class="form-group">
            <label>Currency</label>
            <input type="text" name="variants[${index}][currency]" 
                   value="${variant?.currency || 'NPR'}" readonly>
          </div>
          <div class="form-group">
            <label>Quantity <span class="required">*</span></label>
            <input type="text" name="variants[${index}][quantity]" 
                   value="${variant?.quantity || ''}" required
                   placeholder="e.g., 500 Gems, 1 Month">
          </div>
        </div>
        <div class="form-group">
          <label>Status</label>
          <div class="switch-group">
            <label class="switch">
              <input type="checkbox" name="variants[${index}][is_active]" 
                     ${variant?.is_active ? 'checked' : ''}>
              <span class="switch-slider"></span>
            </label>
            <span class="switch-label">Active</span>
          </div>
        </div>
        <input type="hidden" name="variants[${index}][id]" value="${variant?.id || ''}">
        <input type="hidden" name="variants[${index}][sort_order]" value="${variant?.sort_order || index}">
      </div>
    </div>
  `;
}

window.addVariant = function () {
  const container = document.getElementById('variants-container');
  const index = container.children.length;
  container.insertAdjacentHTML('beforeend', createVariantHTML(index));
};

window.addEditVariant = function () {
  const container = document.getElementById('edit-variants-container');
  const index = container.children.length;
  container.insertAdjacentHTML('beforeend', createVariantHTML(index));
};

window.removeVariant = function (index) {
  const isEdit = document.getElementById('games-edit-view').style.display === 'block';
  const container = document.getElementById(isEdit ? 'edit-variants-container' : 'variants-container');
  const variant = container.children[index];

  if (variant) {
    // If this is an existing variant (has ID), mark it for deletion
    const variantId = variant.querySelector('input[name$="[id]"]')?.value;
    if (variantId) {
      // Create deleted variants container if it doesn't exist
      let deletedContainer = document.getElementById('deleted-variants-container');
      if (!deletedContainer) {
        deletedContainer = document.createElement('div');
        deletedContainer.id = 'deleted-variants-container';
        deletedContainer.style.display = 'none';
        container.parentNode.appendChild(deletedContainer);
      }

      const deletedInput = document.createElement('input');
      deletedInput.type = 'hidden';
      deletedInput.name = 'deleted_variants[]';
      deletedInput.value = variantId;
      deletedContainer.appendChild(deletedInput);
    }

    variant.remove();

    // Reindex remaining variants
    Array.from(container.children).forEach((item, idx) => {
      if (item.classList.contains('variant-item')) {
        item.dataset.index = idx;
        item.querySelector('h4').textContent = `Variant #${idx + 1}`;

        // Update all form field names
        item.querySelectorAll('[name*="variants["]').forEach(field => {
          field.name = field.name.replace(/variants\[\d+\]/, `variants[${idx}]`);
        });
      }
    });
  }
};

// Load Game for Edit
async function loadGameForEdit(id) {
  try {
    const game = games.find(g => g.id === id);
    if (!game) {
      showToast('Game not found', TOAST_TYPES.ERROR);
      return;
    }

    // Set form fields
    const form = document.getElementById('games-edit-form');
    form.dataset.gameId = id;
    currentGameId = id;

    document.getElementById('edit-game-id').value = game.id;
    document.getElementById('edit-game-name').value = game.game_name;
    document.getElementById('edit-game-description').value = game.description || '';
    document.getElementById('edit-game-status').checked = game.is_active;

    // Show current image
    const preview = document.getElementById('edit-game-image-preview');
    if (game.game_image_url) {
      preview.innerHTML = `
        <img src="${game.game_image_url}" alt="Current">
        <small>Current image will be kept unless you upload a new one</small>
      `;
    }

    // Load variants
    const variantsContainer = document.getElementById('edit-variants-container');
    variantsContainer.innerHTML = '';
    if (game.variants && game.variants.length > 0) {
      game.variants.forEach((variant, index) => {
        variantsContainer.insertAdjacentHTML('beforeend', createVariantHTML(index, variant));
      });
    } else {
      addEditVariant(); // Add one empty variant by default
    }

    setupFileUpload('edit-game-image-upload', 'edit-game-image-preview');
  } catch (err) {
    console.error('Error loading game:', err);
    showToast('Failed to load game data', TOAST_TYPES.ERROR);
    showGamesList();
  }
}

// Form Submission Handlers
document.getElementById('games-create-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);

  // Fix is_active status for game
  formData.set('is_active', form.querySelector('[name="is_active"]').checked ? '1' : '0');

  // Add variants data
  const variants = [];
  const variantItems = document.querySelectorAll('#variants-container .variant-item');

  variantItems.forEach((item, index) => {
    const variant = {
      topup_type: item.querySelector('select[name$="[topup_type]"]').value,
      variant_name: item.querySelector('input[name$="[variant_name]"]').value,
      description: item.querySelector('textarea[name$="[description]"]').value || '',
      price: parseFloat(item.querySelector('input[name$="[price]"]').value) || 0,
      currency: item.querySelector('input[name$="[currency]"]').value || 'NPR',
      quantity: item.querySelector('input[name$="[quantity]"]').value,
      is_active: item.querySelector('input[name$="[is_active]"]').checked ? 1 : 0,
      sort_order: index
    };

    // Only add valid variants
    if (variant.variant_name && variant.quantity) {
      variants.push(variant);
    }
  });

  // Remove any existing variants data from formData
  for (const key of Array.from(formData.keys())) {
    if (key.startsWith('variants[') || key === 'variants') {
      formData.delete(key);
    }
  }

  // Convert variants to string and set in formData
  const variantsString = JSON.stringify(variants);
  formData.set('variants', variantsString);

  console.log('Submitting variants:', variants);
  console.log('Variants string:', variantsString);

  try {
    const response = await fetch('/api/products/admin/games', {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }
    if (data.success) {
      showToast('Game created successfully', TOAST_TYPES.SUCCESS);
      form.reset();
      showGamesList();
    } else {
      showToast(data.message || 'Failed to create game', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error creating game:', err);
    showToast('Failed to create game', TOAST_TYPES.ERROR);
  }
});

document.getElementById('games-edit-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const gameId = currentGameId;

  // Fix is_active status for game
  formData.set('is_active', form.querySelector('[name="is_active"]').checked ? '1' : '0');

  // Add variants data
  const variants = [];
  const deletedVariants = [];

  document.querySelectorAll('#edit-variants-container .variant-item').forEach((item, index) => {
    const variantId = item.querySelector('input[name$="[id]"]')?.value;
    const variant = {
      id: variantId || null,
      topup_type: item.querySelector('select[name$="[topup_type]"]').value,
      variant_name: item.querySelector('input[name$="[variant_name]"]').value,
      description: item.querySelector('textarea[name$="[description]"]').value || '',
      price: parseFloat(item.querySelector('input[name$="[price]"]').value) || 0,
      currency: item.querySelector('input[name$="[currency]"]').value || 'NPR',
      quantity: item.querySelector('input[name$="[quantity]"]').value,
      is_active: item.querySelector('input[name$="[is_active]"]').checked ? 1 : 0,
      sort_order: index
    };

    // Only add valid variants
    if (variant.variant_name && variant.quantity) {
      variants.push(variant);
    }
  });

  // Get deleted variant IDs from the dedicated container
  document.querySelectorAll('#deleted-variants-container input[name="deleted_variants[]"]').forEach(input => {
    if (input.value) {
      deletedVariants.push(parseInt(input.value));
    }
  });

  // Remove any existing variants data from formData
  for (const key of Array.from(formData.keys())) {
    if (key.startsWith('variants[') || key === 'variants' || key === 'deleted_variants[]') {
      formData.delete(key);
    }
  }

  // Set the variants and deleted_variants data
  formData.set('variants', JSON.stringify(variants));
  formData.set('deleted_variants', JSON.stringify(deletedVariants));

  console.log('Submitting variants:', variants);
  console.log('Deleted variants:', deletedVariants);

  try {
    const response = await fetch(`/api/products/admin/games/${gameId}`, {
      method: 'PUT',
      body: formData,
      credentials: 'include',
      headers: {
        'X-CSRF-Token': `bearer ${window.csrfToken}`
      }
    });

    const data = await response.json();
    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      return;
    }


    if (data.success) {
      showToast('Game updated successfully', TOAST_TYPES.SUCCESS);
      showGamesList();
    } else {
      showToast(data.message || 'Failed to update game', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    console.error('Error updating game:', err);
    showToast('Failed to update game', TOAST_TYPES.ERROR);
  }
});

// Delete Game
let gameToDelete = null;

window.deleteGame = function (id, name) {
  gameToDelete = id;
  const nameElement = document.getElementById('delete-game-name');
  if (nameElement) {
    nameElement.textContent = name || 'Untitled Game';
  }
  const modal = document.getElementById('game-delete-modal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
};

window.closeGameDeleteModal = function () {
  const modal = document.getElementById('game-delete-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  gameToDelete = null;
};

// Set up event listener for delete confirmation
document.addEventListener('DOMContentLoaded', function () {
  renderGamesTable();

  setTimeout(() => {
    loadGames();
    loadSubscriptions();
  }, 2000);


  const confirmDeleteGameBtn = document.getElementById('confirm-delete-game-btn');
  if (confirmDeleteGameBtn) {
    confirmDeleteGameBtn.addEventListener('click', async function () {
      if (gameToDelete === null) {
        closeGameDeleteModal();
        return;
      }

      // Show loading state
      confirmDeleteGameBtn.disabled = true;
      confirmDeleteGameBtn.innerHTML = '<span class="loading-spinner"></span> Deleting...';

      try {
        const response = await fetch(`/api/products/admin/games/${gameToDelete}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'X-CSRF-Token': `bearer ${window.csrfToken}`
          }
        });

        const data = await response.json();
        if (data.status === 'error') {
          showToast(data.message, TOAST_TYPES.ERROR);
          return;
        }
        if (data.success) {
          showToast('Game deleted successfully', TOAST_TYPES.SUCCESS);
          loadGames();
        } else {
          showToast(data.message || 'Failed to delete game', TOAST_TYPES.ERROR);
        }
      } catch (err) {
        console.error('Error deleting game:', err);
        showToast('Failed to delete game', TOAST_TYPES.ERROR);
      } finally {
        // Reset button state
        confirmDeleteGameBtn.disabled = false;
        confirmDeleteGameBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Game';
        closeGameDeleteModal();
      }
    });
  }

  // Add games nav item click handler
  const gamesNavItem = document.querySelector('.nav-item[data-page="games"]');
  if (gamesNavItem) {
    gamesNavItem.addEventListener('click', function (e) {
      e.preventDefault();
      window.showPage('games');
      window.showGamesList();
    });
  }
});

// ===================== SUBSCRIPTIONS MANAGEMENT =====================

let subscriptions = [];
let currentSubscriptionId = null;
let subscriptionsSearchTerm = '';

// Sidebar navigation for subscriptions
const subscriptionsNavItem = document.querySelector('.nav-item[data-page="subscriptions"]');
if (subscriptionsNavItem) {
  subscriptionsNavItem.addEventListener('click', (e) => {
    e.preventDefault();
    showPage('subscriptions');
    showSubscriptionsList();
  });
}

// Show subscriptions list
window.showSubscriptionsList = function () {
  document.getElementById('subscriptionsPage').style.display = 'block';
  document.getElementById('subscriptions-list-view').style.display = 'block';
  document.getElementById('subscriptions-create-view').style.display = 'none';
  document.getElementById('subscriptions-edit-view').style.display = 'none';
  loadSubscriptions();
};

// Show create subscription form
const subscriptionsCreateBtn = document.getElementById('subscriptions-create-btn');
if (subscriptionsCreateBtn) {
  subscriptionsCreateBtn.addEventListener('click', () => {
    document.getElementById('subscriptions-list-view').style.display = 'none';
    document.getElementById('subscriptions-create-view').style.display = 'block';
    document.getElementById('subscriptions-edit-view').style.display = 'none';
    document.getElementById('subscriptions-create-form').reset();
    document.getElementById('plans-container').innerHTML = '';
    // Add first plan by default
    addPlan();
    // Reset logo preview
    document.getElementById('subscription-logo-preview').innerHTML = '';
  });
}

// Show edit subscription form
window.showSubscriptionEdit = function (id) {
  document.getElementById('subscriptions-list-view').style.display = 'none';
  document.getElementById('subscriptions-create-view').style.display = 'none';
  document.getElementById('subscriptions-edit-view').style.display = 'block';
  loadSubscriptionForEdit(id);
};

// Load subscriptions from backend
async function loadSubscriptions() {
  try {
    showTableLoadingSpinner('subscriptions-table-body', 5);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const res = await fetch('/api/products/admin/subscriptions', { credentials: 'include' });
    const data = await res.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      showSubscriptionsList();
      return;
    }
    if (data.success) {
      subscriptions = data.data;
      renderSubscriptionsTable();
    } else {
      showToast('Failed to load subscriptions', TOAST_TYPES.ERROR);
    }
  } catch (err) {
    showToast('Failed to load subscriptions', TOAST_TYPES.ERROR);
  }
}

// Search input for subscriptions
const subscriptionsSearchInput = document.getElementById('subscriptions-search-input');
if (subscriptionsSearchInput) {
  subscriptionsSearchInput.addEventListener('input', debounce(() => {
    subscriptionsSearchTerm = subscriptionsSearchInput.value.trim().toLowerCase();
    showTableLoadingSpinner('subscriptions-table-body', 5);
    setTimeout(() => {
      renderSubscriptionsTable();
    }, 1000);
  }, 300));
}

// Render subscriptions table
function renderSubscriptionsTable() {
  const tbody = document.getElementById('subscriptions-table-body');
  if (!tbody) return;
  let filtered = subscriptions;
  if (subscriptionsSearchTerm) {
    filtered = subscriptions.filter(sub =>
      (sub.name && sub.name.toLowerCase().includes(subscriptionsSearchTerm)) ||
      (sub.description && sub.description.toLowerCase().includes(subscriptionsSearchTerm))
    );
  }
  tbody.innerHTML = filtered.map(sub => `
    <tr>
      <td><img src="${sub.logo_url || '/noice/placeholder.webp'}" alt="${sub.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"></td>
      <td>${sub.name || ''}</td>
      <td>${Array.isArray(sub.plans) ? sub.plans.length : 0}</td>
      <td><span class="status-badge ${sub.is_active ? 'active' : 'locked'}">${sub.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn-action" onclick="showSubscriptionEdit(${sub.id})" title="Edit Subscription"><i class="fas fa-edit"></i></button>
          <button class="btn-action danger" onclick="deleteSubscription(${sub.id}, '${sub.name?.replace(/'/g, "\\'")}')" title="Delete Subscription"><i class="fas fa-trash-alt"></i></button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="text-center">No subscriptions found</td></tr>';
}

// Add plan (for create)
window.addPlan = function () {
  const container = document.getElementById('plans-container');
  const index = container.children.length;
  container.insertAdjacentHTML('beforeend', createPlanHTML(index));
};

// Add plan (for edit)
window.addEditPlan = function () {
  const container = document.getElementById('edit-plans-container');
  const index = container.children.length;
  container.insertAdjacentHTML('beforeend', createPlanHTML(index, null, true));
};

// Remove plan
window.removePlan = function (index, isEdit = false) {
  const container = document.getElementById(isEdit ? 'edit-plans-container' : 'plans-container');
  const plan = container.children[index];
  if (plan) {
    plan.remove();
    // Reindex remaining plans
    Array.from(container.children).forEach((item, idx) => {
      if (item.classList.contains('plan-variant-item')) {
        item.dataset.index = idx;
        item.querySelector('h4').textContent = `Plan #${idx + 1}`;
        // Update all form field names
        item.querySelectorAll('[name*="plans["]').forEach(field => {
          field.name = field.name.replace(/plans\[\d+\]/, `plans[${idx}]`);
        });
      }
    });
  }
};

// Create plan HTML
function createPlanHTML(index, plan = null, isEdit = false) {
  const planIdField = isEdit && plan && plan.id ? `<input type="hidden" name="plans[${index}][id]" value="${plan.id}">` : '';
  return `
    <div class="plan-variant-item" data-index="${index}">
      <div class="plan-variant-header">
        <h4>Plan #${index + 1}</h4>
        <button type="button" class="btn-action danger" onclick="removePlan(${index}, ${isEdit})"><i class="fas fa-times"></i></button>
      </div>
      <div class="plan-variant-form">
        <div class="form-row">
          <div class="form-group">
            <label>Plan Name <span class="required">*</span></label>
            <input type="text" name="plans[${index}][plan_name]" value="${plan?.plan_name || ''}" required>
          </div>
          <div class="form-group">
            <label>Price <span class="required">*</span></label>
            <input type="number" name="plans[${index}][price]" value="${plan?.price || ''}" required min="0" step="0.01">
          </div>
          <div class="form-group">
            <label>Currency</label>
            <input type="text" name="plans[${index}][currency]" value="${plan?.currency || 'NPR'}" required>
          </div>
          <div class="form-group">
            <label>Billing Cycle</label>
            <select name="plans[${index}][billing_cycle]">
              <option value="monthly" ${plan?.billing_cycle === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="yearly" ${plan?.billing_cycle === 'yearly' ? 'selected' : ''}>Yearly</option>
              <option value="quarterly" ${plan?.billing_cycle === 'quarterly' ? 'selected' : ''}>Quarterly</option>
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <div class="switch-group">
              <label class="switch">
                <input type="checkbox" name="plans[${index}][is_active]" ${plan?.is_active ? 'checked' : ''}>
                <span class="switch-slider"></span>
              </label>
              <span class="switch-label">Active</span>
            </div>
          </div>
        </div>
        ${planIdField}
        <div class="form-group full-width">
          <label>Features</label>
          <div class="features-list" id="features-list-${isEdit ? 'edit-' : ''}${index}">
            <!-- Features will be rendered here -->
          </div>
          <button type="button" class="btn-add-feature" onclick="addFeature(${index}, ${isEdit})"><i class="fas fa-plus"></i> Add Feature</button>
        </div>
      </div>
    </div>
  `;
}

// Add feature to a plan
window.addFeature = function (planIndex, isEdit = false, feature = null) {
  const featuresList = document.getElementById(`features-list-${isEdit ? 'edit-' : ''}${planIndex}`);
  if (!featuresList) return;
  const featureIndex = featuresList.children.length;
  const featureHTML = `
    <div class="feature-item" data-index="${featureIndex}">
      <input type="text" name="plans[${planIndex}][features][${featureIndex}][text]" placeholder="Feature text" value="${feature?.text || ''}" required>
      <input type="text" class="icon-input" name="plans[${planIndex}][features][${featureIndex}][icon]" placeholder="Icon (fa-check)" value="${feature?.icon || ''}" required>
      <label>Available <input type="checkbox" name="plans[${planIndex}][features][${featureIndex}][available]" ${feature?.available ? 'checked' : ''}></label>
      <button type="button" class="btn-remove-feature" onclick="removeFeature(${planIndex}, ${featureIndex}, ${isEdit})"><i class="fas fa-times"></i></button>
    </div>
  `;
  featuresList.insertAdjacentHTML('beforeend', featureHTML);
};

// Remove feature from a plan
window.removeFeature = function (planIndex, featureIndex, isEdit = false) {
  const featuresList = document.getElementById(`features-list-${isEdit ? 'edit-' : ''}${planIndex}`);
  if (!featuresList) return;
  const feature = featuresList.children[featureIndex];
  if (feature) {
    feature.remove();
    // Reindex remaining features
    Array.from(featuresList.children).forEach((item, idx) => {
      item.dataset.index = idx;
      item.querySelectorAll('[name]').forEach(field => {
        field.name = field.name.replace(/features\[\d+\]/, `features[${idx}]`);
      });
    });
  }
};

// Render features for a plan (used in edit)
function renderFeatures(planIndex, features, isEdit = false) {
  const featuresList = document.getElementById(`features-list-${isEdit ? 'edit-' : ''}${planIndex}`);
  if (!featuresList) return;
  featuresList.innerHTML = '';
  (features || []).forEach((feature, idx) => {
    window.addFeature(planIndex, isEdit, feature);
  });
}

// Load subscription for edit
async function loadSubscriptionForEdit(id) {
  try {
    const res = await fetch(`/api/products/admin/subscriptions/${id}`, { credentials: 'include' });
    const data = await res.json();

    if (data.status === 'error') {
      showToast(data.message, TOAST_TYPES.ERROR);
      showSubscriptionsList();
      return;
    }
    if (!data.success) {
      showToast('Failed to load subscription', TOAST_TYPES.ERROR);
      showSubscriptionsList();
      return;
    }
    const sub = data.data;
    currentSubscriptionId = sub.id;
    // Fill form fields
    document.getElementById('edit-subscription-id').value = sub.id;
    document.getElementById('edit-subscription-name').value = sub.name || '';
    document.getElementById('edit-subscription-description').value = sub.description || '';
    document.getElementById('edit-subscription-status').checked = !!sub.is_active;
    // Logo preview
    const preview = document.getElementById('edit-subscription-logo-preview');
    if (preview) {
      preview.innerHTML = sub.logo_url ? `<img src="${sub.logo_url}" alt="Current" style="max-width:100px;max-height:60px;">` : '';
    }
    // Render plans
    const plansContainer = document.getElementById('edit-plans-container');
    plansContainer.innerHTML = '';
    (sub.plans || []).forEach((plan, idx) => {
      plansContainer.insertAdjacentHTML('beforeend', createPlanHTML(idx, plan, true));
    });
    // Render features for each plan
    (sub.plans || []).forEach((plan, idx) => {
      renderFeatures(idx, plan.features, true);
    });
  } catch (err) {
    showToast('Failed to load subscription', TOAST_TYPES.ERROR);
    showSubscriptionsList();
  }
}

// Delete subscription
let subscriptionToDelete = null;
window.deleteSubscription = function (id, name) {
  subscriptionToDelete = id;
  const nameElement = document.getElementById('delete-subscription-name');
  if (nameElement) {
    nameElement.textContent = name || 'Untitled Subscription';
  }
  const modal = document.getElementById('subscription-delete-modal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
};
window.closeSubscriptionDeleteModal = function () {
  const modal = document.getElementById('subscription-delete-modal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
  subscriptionToDelete = null;
};
// Confirm delete
const confirmDeleteSubscriptionBtn = document.getElementById('confirm-delete-subscription-btn');
if (confirmDeleteSubscriptionBtn) {
  confirmDeleteSubscriptionBtn.addEventListener('click', async function () {
    if (subscriptionToDelete === null) {
      window.closeSubscriptionDeleteModal();
      return;
    }
    confirmDeleteSubscriptionBtn.disabled = true;
    confirmDeleteSubscriptionBtn.innerHTML = '<span class="loading-spinner"></span> Deleting...';
    try {
      const res = await fetch(`/api/products/admin/subscriptions/${subscriptionToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': `bearer ${window.csrfToken}` }
      });
      const data = await res.json();
      if (data.status === 'error') {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }
      if (data.success) {
        showToast('Subscription deleted successfully', TOAST_TYPES.SUCCESS);
        loadSubscriptions();
      } else {
        showToast(data.message || 'Failed to delete subscription', TOAST_TYPES.ERROR);
      }
    } catch (err) {
      showToast('Failed to delete subscription', TOAST_TYPES.ERROR);
    } finally {
      confirmDeleteSubscriptionBtn.disabled = false;
      confirmDeleteSubscriptionBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Subscription';
      window.closeSubscriptionDeleteModal();
    }
  });
}

// File upload preview for create/edit
function setupSubscriptionLogoUpload(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;
  input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.innerHTML = `<img src="${ev.target.result}" alt="Preview" style="max-width:100px;max-height:60px;">`;
      };
      reader.readAsDataURL(e.target.files[0]);
    } else {
      preview.innerHTML = '';
    }
  });
}
setupSubscriptionLogoUpload('subscription-logo-upload', 'subscription-logo-preview');
setupSubscriptionLogoUpload('edit-subscription-logo-upload', 'edit-subscription-logo-preview');

// Create subscription submit
const subscriptionsCreateForm = document.getElementById('subscriptions-create-form');
if (subscriptionsCreateForm) {
  subscriptionsCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    // Fix is_active
    formData.set('is_active', form.querySelector('[name="is_active"]').checked ? '1' : '0');
    // Collect plans
    const plans = [];
    const planItems = document.querySelectorAll('#plans-container .plan-variant-item');
    planItems.forEach((item, index) => {
      const plan = {
        plan_name: item.querySelector('input[name$="[plan_name]"]').value,
        price: parseFloat(item.querySelector('input[name$="[price]"]').value) || 0,
        currency: item.querySelector('input[name$="[currency]"]').value || 'NPR',
        billing_cycle: item.querySelector('select[name$="[billing_cycle]"]').value,
        is_active: item.querySelector('input[name$="[is_active]"]').checked ? 1 : 0,
        sort_order: index,
        features: []
      };
      // Collect features
      const featuresList = item.querySelector('.features-list');
      if (featuresList) {
        Array.from(featuresList.children).forEach(featureItem => {
          plan.features.push({
            text: featureItem.querySelector('input[name$="[text]"]').value,
            icon: featureItem.querySelector('input[name$="[icon]"]').value,
            available: featureItem.querySelector('input[name$="[available]"]').checked
          });
        });
      }
      plans.push(plan);
    });
    // Remove any existing plans data from formData
    for (const key of Array.from(formData.keys())) {
      if (key.startsWith('plans[') || key === 'plans') {
        formData.delete(key);
      }
    }
    formData.set('plans', JSON.stringify(plans));
    try {
      const res = await fetch('/api/products/admin/subscriptions', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: { 'X-CSRF-Token': `bearer ${window.csrfToken}` }
      });
      const data = await res.json();
      if (data.status === 'error') {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }
      if (data.success) {
        showToast('Subscription created successfully', TOAST_TYPES.SUCCESS);
        form.reset();
        showSubscriptionsList();
      } else {
        showToast(data.message || 'Failed to create subscription', TOAST_TYPES.ERROR);
      }
    } catch (err) {
      showToast('Failed to create subscription', TOAST_TYPES.ERROR);
    }
  });
}

// Edit subscription submit
const subscriptionsEditForm = document.getElementById('subscriptions-edit-form');
if (subscriptionsEditForm) {
  subscriptionsEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const subscriptionId = currentSubscriptionId;
    // Fix is_active
    formData.set('is_active', form.querySelector('[name="is_active"]').checked ? '1' : '0');
    // Collect plans
    const plans = [];
    const planItems = document.querySelectorAll('#edit-plans-container .plan-variant-item');
    planItems.forEach((item, index) => {
      const planId = item.querySelector('input[name$="[id]"]')?.value;
      const plan = {
        id: planId || null,
        plan_name: item.querySelector('input[name$="[plan_name]"]').value,
        price: parseFloat(item.querySelector('input[name$="[price]"]').value) || 0,
        currency: item.querySelector('input[name$="[currency]"]').value || 'NPR',
        billing_cycle: item.querySelector('select[name$="[billing_cycle]"]').value,
        is_active: item.querySelector('input[name$="[is_active]"]').checked ? 1 : 0,
        sort_order: index,
        features: []
      };
      // Collect features
      const featuresList = item.querySelector('.features-list');
      if (featuresList) {
        Array.from(featuresList.children).forEach(featureItem => {
          plan.features.push({
            text: featureItem.querySelector('input[name$="[text]"]').value,
            icon: featureItem.querySelector('input[name$="[icon]"]').value,
            available: featureItem.querySelector('input[name$="[available]"]').checked
          });
        });
      }
      plans.push(plan);
    });
    // Remove any existing plans data from formData
    for (const key of Array.from(formData.keys())) {
      if (key.startsWith('plans[') || key === 'plans') {
        formData.delete(key);
      }
    }
    formData.set('plans', JSON.stringify(plans));
    try {
      const res = await fetch(`/api/products/admin/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        body: formData,
        credentials: 'include',
        headers: { 'X-CSRF-Token': `bearer ${window.csrfToken}` }
      });
      const data = await res.json();
      if (data.status === 'error') {
        showToast(data.message, TOAST_TYPES.ERROR);
        return;
      }

      if (data.success) {
        showToast('Subscription updated successfully', TOAST_TYPES.SUCCESS);
        showSubscriptionsList();
      } else {
        showToast(data.message || 'Failed to update subscription', TOAST_TYPES.ERROR);
      }
    } catch (err) {
      showToast('Failed to update subscription', TOAST_TYPES.ERROR);
    }
  });
}

// Helper: Show/hide loading spinner for tables
function showTableLoadingSpinner(tableBodyId, colspan) {
  const tbody = document.getElementById(tableBodyId);
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;padding:30px;">
      <div class="loading-spinner" style="margin:0 auto;"></div>
      <p style="margin-top:10px;color:#64748b;">Loading...</p>
    </td></tr>`;
  }
}