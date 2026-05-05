// Venue data loaded from API
const venues = { popular: [], nearby: [] };

function mapFieldToVenue(field, favoriteIds) {
  var id = field.id;
  var images = field.images && field.images.length ? field.images : [];
  var img = images[0] || 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format';
  return {
    id: id,
    name: field.name,
    sport: field.sport || 'Sport',
    image: img,
    rating: field.rating != null ? field.rating : 0,
    reviews: field.reviewCount != null ? field.reviewCount : 0,
    location: field.location || '',
    distance: 'N/A',
    type: (field.type || 'OUTDOOR').toLowerCase(),
    price: field.pricePerHour != null ? field.pricePerHour : 0,
    isFavorite: favoriteIds.indexOf(id) !== -1
  };
}

function loadVenuesFromAPI() {
  return Promise.all([
    typeof API !== 'undefined' ? API.fields.getAll({ limit: 24 }) : Promise.resolve({ fields: [] }),
    typeof API !== 'undefined' && API.getAuthToken() ? API.favorites.getAll().catch(function() { return { favorites: [] }; }) : Promise.resolve({ favorites: [] })
  ]).then(function(results) {
    var fieldsRes = results[0];
    var favRes = results[1];
    var fields = (fieldsRes && fieldsRes.fields) ? fieldsRes.fields : [];
    var favoriteIds = (favRes && favRes.favorites) ? favRes.favorites.map(function(f) { return f.fieldId || (f.field && f.field.id); }).filter(Boolean) : [];
    var list = fields.map(function(f) { return mapFieldToVenue(f, favoriteIds); });
    venues.popular = list.slice(0, 6);
    venues.nearby = list.slice(6, 15);
    return venues;
  });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  function initUI() {
    renderVenues('popular', venues.popular);
    renderVenues('nearby', venues.nearby);
    setupEventListeners();
    initializeBookingModal();
    initializePaymentModal();
    handleInviteLink();
    var allCards = document.querySelectorAll('.venue-card');
    allCards.forEach(function(card) { card.style.display = 'block'; });
  }
  loadVenuesFromAPI()
    .then(function() {
      loadFavoritesFromStorage();
      initUI();
    })
    .catch(function(err) {
      console.error('Error loading fields:', err);
      loadFavoritesFromStorage();
      initUI();
    });
});

// Handle invite link from URL
function handleInviteLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const inviteFieldId = urlParams.get('invite');
  const organizerId = urlParams.get('organizer');
  
  if (inviteFieldId && organizerId) {
    // Find the venue by ID
    const allVenues = [...venues.popular, ...venues.nearby];
    const venue = allVenues.find(v => v.id.toString() === inviteFieldId);
    
    if (venue) {
      // Show invitation message
      setTimeout(() => {
        if (confirm(`You've been invited to book ${venue.name}. Would you like to view the booking?`)) {
          openBookingModal(venue);
        }
      }, 500);
    }
  }
}

// Handle image loading errors - defined globally so it can be called from inline onerror
window.handleImageError = function(img, sportName) {
  if (img && !img.dataset.errorHandled) {
      img.dataset.errorHandled = 'true'; // Prevent infinite loop
      const svg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext fill='%236b7280' font-family='sans-serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E${encodeURIComponent(sportName)}%3C/text%3E%3C/svg%3E`;
      img.src = svg;
  }
}

// Render venue cards
function renderVenues(containerId, venueList) {
  const containerName = containerId === 'popular' ? 'popularVenues' : 'nearbyVenues';
  const container = document.getElementById(containerName);
  
  if (!container) {
      console.error('Container not found:', containerName);
      return;
  }
  
  container.innerHTML = '';
  
  venueList.forEach(venue => {
      try {
          const card = createVenueCard(venue);
          container.appendChild(card);
      } catch (error) {
          console.error('Error creating card for venue:', venue, error);
      }
  });
}

// Create a venue card element
function createVenueCard(venue) {
  const card = document.createElement('div');
  card.className = 'venue-card';
  card.dataset.venueId = venue.id;
  card.dataset.sport = venue.sport.toLowerCase();
  
  card.innerHTML = `
      <div class="venue-image-container">
          <img src="${venue.image}" alt="${venue.name}" class="venue-image" loading="lazy" onerror="window.handleImageError(this, '${venue.sport}');">
          <div class="sport-badge">${venue.sport}</div>
          <button class="favorite-btn ${venue.isFavorite ? 'active' : ''}" data-venue-id="${venue.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
          </button>
      </div>
      <div class="venue-card-content">
          <div class="venue-header">
              <h3 class="venue-name">${venue.name}</h3>
              <span class="venue-price">₺${venue.price}/h</span>
          </div>
          <div class="venue-rating">
              <span class="star">★</span>
              <span>${venue.rating} (${venue.reviews}) . ${venue.location} . ${venue.distance}</span>
          </div>
          <div class="venue-footer-row">
              <span class="venue-type">${venue.type}</span>
              <button class="book-btn">Book</button>
          </div>
      </div>
  `;
  
  // Add event listeners to the card
  const favoriteBtn = card.querySelector('.favorite-btn');
  favoriteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(venue.id);
  });
  
  const bookBtn = card.querySelector('.book-btn');
  bookBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleBookClick(venue);
  });
  
  card.addEventListener('click', () => {
      // Navigate to venue details page
      window.location.href = `field-info.html?id=${venue.id}`;
  });
  
  return card;
}

// Toggle favorite status (API + local state)
function toggleFavorite(venueId) {
  if (typeof API === 'undefined' || !API.getAuthToken()) {
    alert('Please log in to add favorites.');
    return;
  }
  var popularVenue = venues.popular.find(function(v) { return v.id === venueId; });
  var nearbyVenue = venues.nearby.find(function(v) { return v.id === venueId; });
  var isCurrentlyFavorite = (popularVenue && popularVenue.isFavorite) || (nearbyVenue && nearbyVenue.isFavorite);
  var promise = isCurrentlyFavorite ? API.favorites.remove(venueId) : API.favorites.add(venueId);
  promise.then(function() {
    if (popularVenue) popularVenue.isFavorite = !popularVenue.isFavorite;
    if (nearbyVenue) nearbyVenue.isFavorite = !nearbyVenue.isFavorite;
    var favoriteBtn = document.querySelector('.favorite-btn[data-venue-id="' + venueId + '"]');
    if (favoriteBtn) favoriteBtn.classList.toggle('active');
    saveFavoritesToStorage();
  }).catch(function(err) {
    alert(err.message || 'Failed to update favorite.');
  });
}

// Handle book button click
function handleBookClick(venue) {
  openBookingModal(venue);
}

// Booking Modal State
let bookingState = {
  currentStep: 1,
  totalSteps: 6,
  field: null,
  selectedDate: null,
  selectedTimeSlots: [],
  organizer: null,
  players: [],
  totalCost: 0,
  paymentMethod: 'split',
  bookingId: null,
  paymentData: null,
  skipPaymentStep: false,
  mixedPaymentDistribution: {} // { playerId: amount }
};

// Open booking modal
function openBookingModal(venue) {
  // Check authentication
  const playerData = getPlayerData();
  if (!playerData) {
    alert('Please log in to book a field.');
    window.location.href = '../auth/login.html';
    return;
  }
  
  // Ensure booking modal is initialized (for field-info page)
  if (typeof initializeBookingModal === 'function') {
    const modal = document.getElementById('bookingModal');
    if (modal && !modal.dataset.initialized) {
      initializeBookingModal();
      if (typeof initializePaymentModal === 'function') {
        initializePaymentModal();
      }
      modal.dataset.initialized = 'true';
    }
  }

  // Initialize booking state
  bookingState = {
    currentStep: 1,
    totalSteps: 6,
    field: venue,
    selectedDate: null,
    selectedTimeSlots: [],
    organizer: {
      id: playerData.id,
      name: playerData.name,
      email: playerData.email
    },
    players: [],
    totalCost: venue.price || 0,
    paymentMethod: 'split',
    bookingId: null,
    paymentData: null,
    skipPaymentStep: false,
    mixedPaymentDistribution: {},
    paymentAmount: 0
  };

  // Show modal
  const modal = document.getElementById('bookingModal');
  modal.classList.add('active');

  // Populate field details
  populateFieldDetails(venue);
  
  // Set minimum date to today
  const dateInput = document.getElementById('bookingDate');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
  }

  // Generate invite link
  generateInviteLink();

  // Initialize step navigation
  updateStepDisplay();
  
  // Ensure buttons are properly displayed
  updateStepButtons();
}

// Get player data from API auth (currentUser set on login)
function getPlayerData() {
  if (typeof API === 'undefined') return null;
  var user = API.getCurrentUser && API.getCurrentUser();
  if (!user) return null;
  return {
    id: user.id,
    name: user.fullName || user.name || user.email,
    email: user.email
  };
}

// Populate field details in step 1
function populateFieldDetails(venue) {
  const container = document.getElementById('fieldDetailsPreview');
  if (!container) return;

  container.innerHTML = `
    <div class="field-preview-card">
      <img src="${venue.image}" alt="${venue.name}" class="field-preview-image">
      <div class="field-preview-info">
        <h4>${venue.name}</h4>
        <div class="field-preview-meta">
          <span><i class="fi fi-rr-marker"></i> ${venue.location}</span>
          <span><i class="fi fi-rs-star"></i> ${venue.rating} (${venue.reviews})</span>
          <span><i class="fi fi-rr-tag"></i> ${venue.sport}</span>
        </div>
        <div class="field-preview-price">
          <span>Price: <strong>₺${venue.price}/hour</strong></span>
        </div>
      </div>
    </div>
  `;
}

// Generate invite link
function generateInviteLink() {
  const inviteLink = document.getElementById('inviteLink');
  if (inviteLink && bookingState.field) {
    const link = `${window.location.origin}${window.location.pathname}?invite=${bookingState.field.id}&organizer=${bookingState.organizer.id}`;
    inviteLink.value = link;
  }
}

// Update step display
function updateStepDisplay() {
  // Hide all steps
  for (let i = 1; i <= bookingState.totalSteps; i++) {
    const step = document.getElementById(`step${i}`);
    if (step) {
      step.classList.remove('active');
    }
  }

  // Show current step
  const currentStep = document.getElementById(`step${bookingState.currentStep}`);
  if (currentStep) {
    currentStep.classList.add('active');
  }

  // Load step-specific content
  loadStepContent();
  
  // Update button visibility based on step
  updateStepButtons();
}

// Update step buttons visibility
function updateStepButtons() {
  const nextBtn = document.getElementById('nextStepBtn');
  const submitPaymentBtn = document.getElementById('submitPaymentBtn');
  const confirmBtn = document.getElementById('confirmBookingBtn');
  const prevBtn = document.getElementById('prevStepBtn');
  
  // Update previous button
  if (prevBtn) {
    prevBtn.style.display = bookingState.currentStep > 1 ? 'block' : 'none';
  }
  
  // Hide all action buttons first
  if (nextBtn) nextBtn.style.display = 'none';
  if (submitPaymentBtn) submitPaymentBtn.style.display = 'none';
  if (confirmBtn) confirmBtn.style.display = 'none';
  
  // Show appropriate button based on step
  if (bookingState.currentStep < bookingState.totalSteps) {
    if (bookingState.currentStep === 5) {
      // Payment step - show submit payment button
      if (submitPaymentBtn) {
        submitPaymentBtn.style.display = 'flex';
      } else {
        // Fallback to next button if submit button doesn't exist
        if (nextBtn) nextBtn.style.display = 'block';
      }
    } else {
      // Regular step - show next button
      if (nextBtn) {
        nextBtn.style.display = 'block';
      }
    }
  } else {
    // Last step - show confirm button
    if (confirmBtn) {
      confirmBtn.style.display = 'block';
    } else {
      // Fallback to next button if confirm button doesn't exist
      if (nextBtn) nextBtn.style.display = 'block';
    }
  }
}

// Load content for current step
function loadStepContent() {
  switch (bookingState.currentStep) {
    case 2:
      loadTimeSlots();
      break;
    case 3:
      updatePlayersList();
      break;
    case 4:
      updateCostSplit();
      break;
    case 5:
      loadPaymentStep();
      break;
    case 6:
      showBookingSummary();
      break;
  }
}

// Load payment step content
function loadPaymentStep() {
  // Calculate amount based on payment method
  let paymentAmount = 0;
  let paymentLabel = '';
  
  if (bookingState.paymentMethod === 'organizer') {
    // Organizer pays full amount
    paymentAmount = bookingState.totalCost;
    paymentLabel = 'Full Amount';
  } else if (bookingState.paymentMethod === 'split') {
    // Organizer pays their share
    const totalPlayers = bookingState.players.length + 1; // +1 for organizer
    paymentAmount = Math.round(bookingState.totalCost / totalPlayers);
    paymentLabel = 'Your Share';
  } else if (bookingState.paymentMethod === 'mixed') {
    // Organizer pays their assigned amount from mixed payment
    paymentAmount = bookingState.mixedPaymentDistribution['organizer'] || 0;
    paymentLabel = 'Your Assigned Amount';
    
    // Validate mixed payment distribution
    const totalAssigned = Object.values(bookingState.mixedPaymentDistribution).reduce((sum, amount) => sum + amount, 0);
    if (Math.abs(totalAssigned - bookingState.totalCost) > 0.01) {
      alert(`Please ensure the total payment distribution equals ₺${bookingState.totalCost}. Currently assigned: ₺${totalAssigned.toFixed(2)}`);
      return;
    }
  }
  
  // Populate payment summary
  const summary = document.getElementById('paymentInfoSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="payment-summary">
        <div class="payment-amount">
          <span class="amount-label">${paymentLabel} to Pay</span>
          <span class="amount-value">₺${paymentAmount}</span>
        </div>
        ${bookingState.paymentMethod === 'split' ? `
          <div class="payment-note">
            <i class="fi fi-rr-info"></i>
            <span>You're paying your share. Other players will pay separately when they accept the invitation.</span>
          </div>
        ` : ''}
        <div class="payment-details">
          <p><strong>${bookingState.field.name}</strong></p>
          <p>${formatDate(bookingState.selectedDate)}</p>
          <p>${bookingState.selectedTimeSlots.map(slot => {
            const hour = parseInt(slot.split(':')[0]);
            return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
          }).join(', ')}</p>
        </div>
      </div>
    `;
  }
  
  // Store payment amount for later use
  bookingState.paymentAmount = paymentAmount;
  
  // Initialize payment form formatting
  initializePaymentFormFormatting();
}

// Load available time slots
async function loadTimeSlots() {
  const container = document.getElementById('timeSlotsGrid');
  if (!container) {
    console.error('Time slots container not found');
    return;
  }
  
  if (!bookingState.field) {
    console.error('Field data not available');
    return;
  }

  // Fetch real availability from API if a date is selected
  const slots = [];
  let bookedSlots = [];
  let workingSlots = [];
  let dayLocked = false;
  
  if (bookingState.selectedDate && typeof API !== 'undefined') {
    try {
      container.innerHTML = '<p style="text-align: center; padding: 20px;">Loading availability...</p>';
      console.log('Fetching availability for field:', bookingState.field.id, 'date:', bookingState.selectedDate);
      const availability = await API.fields.getAvailability(bookingState.field.id, bookingState.selectedDate);
      console.log('Availability response:', availability);
      
      if (!availability.available && availability.lockedByOwner) {
        // Entire day is locked by owner
        dayLocked = true;
        container.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #dc3545;">
            <i class="fi fi-rr-lock" style="font-size: 24px; display: block; margin-bottom: 10px;"></i>
            <p>${availability.message || 'This field is not available on the selected date.'}</p>
          </div>
        `;
        return;
      }

      if (!availability.available && availability.closedBySchedule) {
        container.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #dc3545;">
            <i class="fi fi-rr-calendar" style="font-size: 24px; display: block; margin-bottom: 10px;"></i>
            <p>${availability.message || 'This field is closed on the selected day.'}</p>
          </div>
        `;
        return;
      }
      
      bookedSlots = availability.bookedSlots || [];
      workingSlots = Array.isArray(availability.workingSlots) ? availability.workingSlots : [];
      console.log('Booked slots:', bookedSlots);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      // Continue with all slots available if API fails
    }
  }

  const baseSlots = workingSlots.length
    ? workingSlots
    : Array.from({ length: 13 }, function (_, i) {
        const hour = 9 + i;
        return `${hour.toString().padStart(2, '0')}:00`;
      });

  baseSlots.forEach(function(startTime) {
    const hour = parseInt(startTime.split(':')[0], 10);
    slots.push({
      start: startTime,
      end: `${(hour + 1).toString().padStart(2, '0')}:00`,
      available: true
    });
  });

  // Mark booked slots as unavailable
  slots.forEach(slot => {
    if (bookedSlots.includes(slot.start)) {
      slot.available = false;
    }
  });

  container.innerHTML = slots.map(slot => `
    <button class="time-slot ${!slot.available ? 'unavailable' : ''} ${bookingState.selectedTimeSlots.includes(slot.start) ? 'selected' : ''}" 
            data-start="${slot.start}" 
            data-end="${slot.end}"
            ${!slot.available ? 'disabled' : ''}>
      ${slot.start} - ${slot.end}
    </button>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.time-slot:not(.unavailable)').forEach(btn => {
    btn.addEventListener('click', function() {
      const start = this.dataset.start;
      const end = this.dataset.end;
      
      // Toggle selection
      if (this.classList.contains('selected')) {
        this.classList.remove('selected');
        bookingState.selectedTimeSlots = bookingState.selectedTimeSlots.filter(t => t !== start);
      } else {
        this.classList.add('selected');
        bookingState.selectedTimeSlots.push(start);
      }
      
      // Update cost
      updateBookingCost();
    });
  });
}

// Update booking cost
function updateBookingCost() {
  if (!bookingState.field) return;

  const hours = bookingState.selectedTimeSlots.length;
  bookingState.totalCost = bookingState.field.price * hours;
  
  updateCostSplit();
}

// Update players list
function updatePlayersList() {
  const container = document.getElementById('playersList');
  const organizerName = document.getElementById('organizerName');
  
  if (organizerName && bookingState.organizer) {
    organizerName.textContent = `${bookingState.organizer.name} (You)`;
  }

  if (!container) return;

  if (bookingState.players.length === 0) {
    container.innerHTML = '<p class="no-players">No players added yet. Add players by username or share the invite link.</p>';
    return;
  }

  container.innerHTML = bookingState.players.map((player, index) => `
    <div class="player-item" style="display: flex; align-items: center; padding: 10px 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px;">
      <div class="player-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin-right: 12px; overflow: hidden;">
        ${player.avatar 
          ? `<img src="${player.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` 
          : `<i class="fi fi-rr-user" style="color: #666;"></i>`}
      </div>
      <div class="player-info" style="flex: 1;">
        <div style="font-weight: 500; color: #333;">${player.name}</div>
        <div style="font-size: 12px; color: #666;">${player.email || ''}</div>
      </div>
      <div class="player-payment-status" style="margin-right: 12px; padding: 4px 8px; background: #fff3cd; color: #856404; border-radius: 4px; font-size: 12px;">
        <i class="fi fi-rr-clock" style="font-size: 10px;"></i> Payment Pending
      </div>
      <button class="remove-player-btn" data-index="${index}" style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 4px;">
        <i class="fi fi-rr-cross-small"></i>
      </button>
    </div>
  `).join('');

  // Add remove handlers
  container.querySelectorAll('.remove-player-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const index = parseInt(this.dataset.index);
      bookingState.players.splice(index, 1);
      updatePlayersList();
      updateCostSplit();
    });
  });
}

// Update cost split display
function updateCostSplit() {
  const totalCostEl = document.getElementById('totalCost');
  const playerCountEl = document.getElementById('playerCount');
  const costPerPlayerEl = document.getElementById('costPerPlayer');

  const totalPlayers = bookingState.players.length + 1; // +1 for organizer
  const costPerPlayer = totalPlayers > 0 ? Math.round(bookingState.totalCost / totalPlayers) : bookingState.totalCost;

  if (totalCostEl) totalCostEl.textContent = `₺${bookingState.totalCost}`;
  if (playerCountEl) playerCountEl.textContent = totalPlayers;
  if (costPerPlayerEl) costPerPlayerEl.textContent = `₺${costPerPlayer}`;
  
  // Update mixed payment if active
  if (bookingState.paymentMethod === 'mixed') {
    updateMixedPaymentConfig();
  }
}

// Update mixed payment configuration
function updateMixedPaymentConfig() {
  const configContainer = document.getElementById('mixedPaymentConfig');
  const totalDisplay = document.getElementById('mixedPaymentTotal');
  const paymentList = document.getElementById('mixedPaymentList');
  
  if (!configContainer || !totalDisplay || !paymentList) return;
  
  // Show/hide based on payment method
  configContainer.style.display = bookingState.paymentMethod === 'mixed' ? 'block' : 'none';
  
  // Update total display
  totalDisplay.textContent = bookingState.totalCost;
  
  // Clear existing list
  paymentList.innerHTML = '';
  
  // Add organizer payment input
  const organizerItem = createMixedPaymentItem('organizer', bookingState.organizer.name, bookingState.mixedPaymentDistribution['organizer'] || 0, true);
  paymentList.appendChild(organizerItem);
  
  // Add player payment inputs
  bookingState.players.forEach(player => {
    const playerItem = createMixedPaymentItem(player.id, player.name, bookingState.mixedPaymentDistribution[player.id] || 0, false);
    paymentList.appendChild(playerItem);
  });
  
  // Update summary
  updateMixedPaymentSummary();
}

// Create mixed payment item
function createMixedPaymentItem(id, name, amount, isOrganizer) {
  const item = document.createElement('div');
  item.className = 'mixed-payment-item';
  item.dataset.paymentId = id;
  
  item.innerHTML = `
    <div class="mixed-payment-item-info">
      <div class="mixed-payment-item-name">
        ${isOrganizer ? '<i class="fi fi-rr-crown"></i>' : '<i class="fi fi-rr-user"></i>'}
        <span>${name}${isOrganizer ? ' (You)' : ''}</span>
      </div>
    </div>
    <div class="mixed-payment-item-input">
      <span class="currency-symbol">₺</span>
      <input 
        type="number" 
        class="mixed-payment-amount-input" 
        value="${amount}" 
        min="0" 
        max="${bookingState.totalCost}"
        data-payment-id="${id}"
        placeholder="0"
      >
    </div>
  `;
  
  // Add input event listener
  const input = item.querySelector('.mixed-payment-amount-input');
  if (input) {
    input.addEventListener('input', function() {
      const value = parseFloat(this.value) || 0;
      bookingState.mixedPaymentDistribution[id] = value;
      updateMixedPaymentSummary();
    });
    
    input.addEventListener('blur', function() {
      const value = parseFloat(this.value) || 0;
      if (value < 0) {
        this.value = 0;
        bookingState.mixedPaymentDistribution[id] = 0;
      } else if (value > bookingState.totalCost) {
        this.value = bookingState.totalCost;
        bookingState.mixedPaymentDistribution[id] = bookingState.totalCost;
      }
      updateMixedPaymentSummary();
    });
  }
  
  return item;
}

// Update mixed payment summary
function updateMixedPaymentSummary() {
  const assignedEl = document.getElementById('mixedPaymentAssigned');
  const remainingEl = document.getElementById('mixedPaymentRemaining');
  
  if (!assignedEl || !remainingEl) return;
  
  // Calculate total assigned
  let totalAssigned = 0;
  Object.values(bookingState.mixedPaymentDistribution).forEach(amount => {
    totalAssigned += amount;
  });
  
  const remaining = bookingState.totalCost - totalAssigned;
  
  assignedEl.textContent = `₺${totalAssigned.toFixed(2)}`;
  remainingEl.textContent = `₺${remaining.toFixed(2)}`;
  
  // Update color based on validation
  if (Math.abs(remaining) < 0.01) {
    remainingEl.style.color = '#10B981';
    remainingEl.innerHTML = `₺${remaining.toFixed(2)} <i class="fi fi-rr-check"></i>`;
  } else if (remaining < 0) {
    remainingEl.style.color = '#DC2626';
  } else {
    remainingEl.style.color = '#F59E0B';
  }
}

// Show booking summary
function showBookingSummary() {
  const container = document.getElementById('bookingSummary');
  if (!container) return;

  const totalPlayers = bookingState.players.length + 1;
  const costPerPlayer = Math.round(bookingState.totalCost / totalPlayers);
  const paymentMethodText = {
    'split': 'Each player pays their share',
    'organizer': 'Organizer pays full amount',
    'mixed': 'Mixed payment'
  };

  container.innerHTML = `
    <div class="summary-section">
      <h4>Field Information</h4>
      <div class="summary-item">
        <span>Field:</span>
        <span><strong>${bookingState.field.name}</strong></span>
      </div>
      <div class="summary-item">
        <span>Location:</span>
        <span>${bookingState.field.location}</span>
      </div>
      <div class="summary-item">
        <span>Sport:</span>
        <span>${bookingState.field.sport}</span>
      </div>
    </div>
    <div class="summary-section">
      <h4>Booking Details</h4>
      <div class="summary-item">
        <span>Date:</span>
        <span><strong>${formatDate(bookingState.selectedDate)}</strong></span>
      </div>
      <div class="summary-item">
        <span>Time:</span>
        <span><strong>${bookingState.selectedTimeSlots.map(slot => {
          const hour = parseInt(slot.split(':')[0]);
          return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
        }).join(', ')}</strong></span>
      </div>
      <div class="summary-item">
        <span>Duration:</span>
        <span>${bookingState.selectedTimeSlots.length} hour(s)</span>
      </div>
    </div>
    <div class="summary-section">
      <h4>Players</h4>
      <div class="summary-item">
        <span>Organizer:</span>
        <span><strong>${bookingState.organizer.name}</strong></span>
      </div>
      <div class="summary-item">
        <span>Total Players:</span>
        <span><strong>${totalPlayers}</strong></span>
      </div>
      ${bookingState.players.length > 0 ? `
        <div class="summary-players">
          ${bookingState.players.map(p => `<div class="player-summary-item">${p.name}</div>`).join('')}
        </div>
      ` : ''}
    </div>
    <div class="summary-section">
      <h4>Payment</h4>
      <div class="summary-item">
        <span>Total Cost:</span>
        <span><strong>₺${bookingState.totalCost}</strong></span>
      </div>
      <div class="summary-item">
        <span>Cost per Player:</span>
        <span><strong>₺${costPerPlayer}</strong></span>
      </div>
      <div class="summary-item">
        <span>Payment Method:</span>
        <span><strong>${paymentMethodText[bookingState.paymentMethod]}</strong></span>
      </div>
      ${bookingState.paymentData ? `
        <div class="summary-item">
          <span>Your Payment:</span>
          <span><strong style="color: #10B981;">✓ Paid (₺${bookingState.paymentAmount || bookingState.totalCost})</strong></span>
        </div>
      ` : bookingState.paymentMethod === 'split' ? `
        <div class="summary-item">
          <span>Your Payment:</span>
          <span><strong style="color: #F59E0B;">Pending (₺${Math.round(bookingState.totalCost / (bookingState.players.length + 1))})</strong></span>
        </div>
      ` : bookingState.paymentMethod === 'mixed' ? `
        <div class="summary-item">
          <span>Your Payment:</span>
          <span><strong style="color: ${bookingState.paymentData ? '#10B981' : '#F59E0B'};">${bookingState.paymentData ? '✓ Paid' : 'Pending'} (₺${bookingState.mixedPaymentDistribution['organizer'] || 0})</strong></span>
        </div>
        <div class="summary-section" style="margin-top: 12px; padding: 12px;">
          <h5 style="font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: #212529;">Payment Distribution:</h5>
          <div class="summary-item" style="padding: 4px 0;">
            <span>You:</span>
            <span>₺${bookingState.mixedPaymentDistribution['organizer'] || 0}</span>
          </div>
          ${bookingState.players.map(p => `
            <div class="summary-item" style="padding: 4px 0;">
              <span>${p.name}:</span>
              <span>₺${bookingState.mixedPaymentDistribution[p.id] || 0}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// Format date for display
function formatDate(dateString) {
  if (!dateString) return 'Not selected';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// Close booking modal
function closeBookingModal() {
  const modal = document.getElementById('bookingModal');
  if (modal) {
    modal.classList.remove('active');
    bookingState.currentStep = 1;
  }
}

// Initialize booking modal event listeners
function initializeBookingModal() {
  // Close button
  const closeBtn = document.getElementById('closeBookingModal');
  const cancelBtn = document.getElementById('cancelBookingBtn');
  const overlay = document.querySelector('.booking-modal-overlay');

  if (closeBtn) closeBtn.addEventListener('click', closeBookingModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeBookingModal);
  if (overlay) overlay.addEventListener('click', closeBookingModal);

  // Navigation buttons
  const prevBtn = document.getElementById('prevStepBtn');
  const nextBtn = document.getElementById('nextStepBtn');
  const confirmBtn = document.getElementById('confirmBookingBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (bookingState.currentStep > 1) {
        bookingState.currentStep--;
        updateStepDisplay();
      }
    });
  }

  if (nextBtn) {
    // Remove any existing event listeners to prevent duplicates
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    
    newNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        // Store current step before validation
        const stepBeforeValidation = bookingState.currentStep;
        console.log('Next button clicked, current step:', stepBeforeValidation);
        
        // Validate current step before moving forward
        if (validateCurrentStep()) {
          // Only increment if validation passed and we're still on the same step
          if (bookingState.currentStep === stepBeforeValidation && bookingState.currentStep < bookingState.totalSteps) {
            bookingState.currentStep++;
            console.log('Moving to step:', bookingState.currentStep);
            updateStepDisplay();
          }
        } else {
          // Validation failed - don't move to next step
          // The validateCurrentStep function already shows an alert
          console.log('Validation failed for step:', stepBeforeValidation);
          return;
        }
      } catch (error) {
        console.error('Error moving to next step:', error);
        alert('An error occurred. Please try again.');
      }
    });
  }

  // Submit payment button - handled by initializePaymentModal to avoid duplicate listeners

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      confirmBooking();
    });
  }

  // Date selection
  const dateInput = document.getElementById('bookingDate');
  if (dateInput) {
    dateInput.addEventListener('change', function() {
      bookingState.selectedDate = this.value;
      if (bookingState.selectedDate) {
        loadTimeSlots();
      }
    });
  }

  // Add player functionality
  const addPlayerBtn = document.getElementById('addPlayerBtn');
  const playerSearchInput = document.getElementById('playerSearchInput');

  if (addPlayerBtn) {
    addPlayerBtn.addEventListener('click', addPlayer);
  }

  if (playerSearchInput) {
    playerSearchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addPlayer();
      }
    });
  }
  
  // Setup real-time user search
  setupPlayerSearch();

  // Copy invite link
  const copyLinkBtn = document.getElementById('copyInviteLink');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', function() {
      const inviteLink = document.getElementById('inviteLink');
      if (inviteLink) {
        inviteLink.select();
        document.execCommand('copy');
        this.innerHTML = '<i class="fi fi-rr-check"></i> Copied!';
        setTimeout(() => {
          this.innerHTML = '<i class="fi fi-rr-copy"></i> Copy';
        }, 2000);
      }
    });
  }

  // Payment method selection
  const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  paymentRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      bookingState.paymentMethod = this.value;
      
      // Initialize mixed payment distribution if needed
      if (this.value === 'mixed') {
        initializeMixedPaymentDistribution();
      }
      
      // Update cost split display
      updateCostSplit();
    });
  });
}

// Initialize mixed payment distribution
function initializeMixedPaymentDistribution() {
  const totalPlayers = bookingState.players.length + 1;
  const equalShare = Math.round(bookingState.totalCost / totalPlayers);
  
  // Reset distribution
  bookingState.mixedPaymentDistribution = {};
  
  // Set organizer share
  bookingState.mixedPaymentDistribution['organizer'] = equalShare;
  
  // Set equal shares for players
  bookingState.players.forEach(player => {
    bookingState.mixedPaymentDistribution[player.id] = equalShare;
  });
  
  // Update UI
  updateMixedPaymentConfig();
}

// Initialize payment form formatting
function initializePaymentFormFormatting() {
  // Card number formatting
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', formatCardNumber);
    cardNumberInput.addEventListener('keypress', (e) => {
      if (!/[0-9\s]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }

  // Expiry date formatting
  const expiryInput = document.getElementById('expiryDate');
  if (expiryInput) {
    expiryInput.addEventListener('input', formatExpiryDate);
    expiryInput.addEventListener('keypress', (e) => {
      if (!/[0-9\/]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }

  // CVV validation
  const cvvInput = document.getElementById('cvv');
  if (cvvInput) {
    cvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
    cvvInput.addEventListener('keypress', (e) => {
      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }
}

// Validate current step
function validateCurrentStep() {
  const currentStep = bookingState.currentStep;
  
  // Debug logging
  console.log('Validating step:', currentStep);
  
  switch (currentStep) {
    case 1:
      // Step 1: Field Details - no validation needed, just viewing field info
      console.log('Step 1 validation: passed (no validation required)');
      return true;
    case 2:
      // Step 2: Date & Time Selection
      console.log('Step 2 validation: checking date and time slots');
      if (!bookingState.selectedDate) {
        console.log('Step 2 validation failed: no date selected');
        alert('Please select a date.');
        return false;
      }
      if (bookingState.selectedTimeSlots.length === 0) {
        alert('Please select at least one time slot.');
        return false;
      }
      updateBookingCost();
      return true;
    case 3:
      // Step 3: Add Players - players are optional, so always valid
      return true;
    case 4:
      // Step 4: Payment & Cost Split - validate payment method and mixed payment if selected
      if (bookingState.paymentMethod === 'mixed') {
        const totalAssigned = Object.values(bookingState.mixedPaymentDistribution).reduce((sum, amount) => sum + amount, 0);
        if (Math.abs(totalAssigned - bookingState.totalCost) > 0.01) {
          alert(`Please ensure the total payment distribution equals ₺${bookingState.totalCost}. Currently assigned: ₺${totalAssigned.toFixed(2)}`);
          return false;
        }
      }
      return true;
    case 5:
      // Step 5: Payment step - validate payment form
      return validatePaymentForm();
    case 6:
      // Step 6: Confirm Booking - no validation needed
      return true;
    default:
      return true;
  }
}

// Validate payment form
function validatePaymentForm() {
  const form = document.getElementById('paymentForm');
  if (!form) return true; // If form doesn't exist, skip validation
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return false;
  }
  
  // Get form data
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const expiryDate = document.getElementById('expiryDate').value;
  
  // Validate card number
  if (!validateCardNumber(cardNumber)) {
    alert('Invalid card number. Please check and try again.');
    return false;
  }
  
  // Validate expiry date
  if (!validateExpiryDate(expiryDate)) {
    alert('Invalid expiry date. Please check and try again.');
    return false;
  }
  
  return true;
}

// Search timeout for debouncing
let searchTimeout = null;
let selectedSearchUser = null;

// Search users as user types
function setupPlayerSearch() {
  const input = document.getElementById('playerSearchInput');
  const resultsContainer = document.getElementById('playerSearchResults');
  
  if (!input || !resultsContainer) return;
  
  input.addEventListener('input', function() {
    const query = this.value.trim();
    selectedSearchUser = null;
    
    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);
    
    // Hide results if query is too short
    if (query.length < 2) {
      resultsContainer.style.display = 'none';
      return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(() => searchUsers(query), 300);
  });
  
  // Hide results when clicking outside
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.style.display = 'none';
    }
  });
}

// Search users via API
async function searchUsers(query) {
  const resultsContainer = document.getElementById('playerSearchResults');
  if (!resultsContainer) return;
  
  try {
    resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">Searching...</div>';
    resultsContainer.style.display = 'block';
    
    const response = await API.users.search(query);
    const users = response.users || [];
    
    // Filter out current user and already added players
    const currentUser = API.getCurrentUser();
    const filteredUsers = users.filter(user => {
      if (currentUser && user.id === currentUser.id) return false;
      if (bookingState.players.some(p => p.id === user.id)) return false;
      return true;
    });
    
    if (filteredUsers.length === 0) {
      resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">No users found</div>';
      return;
    }
    
    resultsContainer.innerHTML = filteredUsers.map(user => `
      <div class="search-result-item" data-user='${JSON.stringify(user).replace(/'/g, "&#39;")}' 
           style="display: flex; align-items: center; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; transition: background 0.2s;"
           onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; margin-right: 10px; overflow: hidden;">
          ${user.avatar 
            ? `<img src="${user.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` 
            : `<i class="fi fi-rr-user" style="color: #666;"></i>`}
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 500; color: #333;">${user.fullName}</div>
          <div style="font-size: 12px; color: #666;">${user.email}</div>
        </div>
        <i class="fi fi-rr-plus" style="color: #007bff;"></i>
      </div>
    `).join('');
    
    // Add click handlers to results
    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', function() {
        const userData = JSON.parse(this.dataset.user);
        addPlayerFromSearch(userData);
        resultsContainer.style.display = 'none';
        document.getElementById('playerSearchInput').value = '';
      });
    });
    
  } catch (error) {
    console.error('Search error:', error);
    resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #dc3545;">Search failed. Try again.</div>';
  }
}

// Add player from search result
function addPlayerFromSearch(user) {
  // Check if player already added
  if (bookingState.players.some(p => p.id === user.id)) {
    alert('This player is already added.');
    return;
  }
  
  const player = {
    id: user.id,
    name: user.fullName,
    email: user.email,
    avatar: user.avatar
  };
  
  bookingState.players.push(player);
  updatePlayersList();
  updateCostSplit();
}

// Add player (fallback for manual entry - now shows search prompt)
function addPlayer() {
  const input = document.getElementById('playerSearchInput');
  if (!input) return;

  const searchValue = input.value.trim();
  if (!searchValue) {
    alert('Please enter a username or email to search.');
    return;
  }
  
  // If user selected from search, add them
  if (selectedSearchUser) {
    addPlayerFromSearch(selectedSearchUser);
    input.value = '';
    selectedSearchUser = null;
    return;
  }
  
  // Otherwise, trigger search
  if (searchValue.length >= 2) {
    searchUsers(searchValue);
  } else {
    alert('Please enter at least 2 characters to search.');
  }
}

// Confirm booking
function confirmBooking() {
  if (!validateCurrentStep()) {
    return;
  }

  // Determine organizer payment status
  let organizerPaymentStatus = 'not_required';
  if (bookingState.paymentMethod === 'organizer') {
    organizerPaymentStatus = bookingState.paymentData ? 'paid' : 'pending';
  } else if (bookingState.paymentMethod === 'split') {
    organizerPaymentStatus = bookingState.paymentData ? 'paid' : 'pending';
  } else if (bookingState.paymentMethod === 'mixed') {
    organizerPaymentStatus = bookingState.paymentData ? 'paid' : 'pending';
  }
  
  // Prepare player payment data
  const playersWithPayment = bookingState.players.map(p => {
    let paymentStatus = 'pending';
    let paymentAmount = 0;
    
    if (bookingState.paymentMethod === 'split') {
      paymentAmount = Math.round(bookingState.totalCost / (bookingState.players.length + 1));
    } else if (bookingState.paymentMethod === 'mixed') {
      paymentAmount = bookingState.mixedPaymentDistribution[p.id] || 0;
    }
    
    return {
      id: p.id,
      name: p.name,
      paymentStatus: paymentStatus,
      paymentAmount: paymentAmount
    };
  });

  // Create booking object
  const booking = {
    id: 'booking_' + Date.now(),
    fieldId: bookingState.field.id,
    fieldName: bookingState.field.name,
    fieldImage: bookingState.field.image,
    organizerId: bookingState.organizer.id,
    organizerName: bookingState.organizer.name,
    players: playersWithPayment,
    date: bookingState.selectedDate,
    timeSlots: bookingState.selectedTimeSlots,
    totalCost: bookingState.totalCost,
    costPerPlayer: bookingState.paymentMethod === 'mixed' ? null : Math.round(bookingState.totalCost / (bookingState.players.length + 1)),
    paymentMethod: bookingState.paymentMethod,
    status: 'pending',
    createdAt: new Date().toISOString(),
    organizerPaymentStatus: organizerPaymentStatus,
    mixedPaymentDistribution: bookingState.paymentMethod === 'mixed' ? bookingState.mixedPaymentDistribution : null
  };

  // Save booking and send invitations
  saveBookingAndSendInvitations(booking);
}

// Guard to prevent duplicate API create (double-click)
var isBookingSubmissionInProgress = false;

// Save booking via API and show confirmation
function saveBookingAndSendInvitations(booking) {
  if (typeof API === 'undefined' || !API.getAuthToken()) {
    alert('Please log in to create a booking.');
    return;
  }
  if (isBookingSubmissionInProgress) {
    return; // Prevent double submission
  }
  var slots = (bookingState.selectedTimeSlots || []).slice().sort();
  if (slots.length === 0) {
    alert('Please select at least one time slot.');
    return;
  }
  isBookingSubmissionInProgress = true;
  var confirmBtn = document.getElementById('confirmBookingBtn');
  var submitPaymentBtn = document.querySelector('#paymentForm button[type="submit"], .payment-step .btn-primary');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Creating...'; }
  if (submitPaymentBtn) { submitPaymentBtn.disabled = true; }

  // Group consecutive hours into ranges (supports non-contiguous: e.g. 13:00-14:00 and 20:00-21:00)
  var ranges = [];
  for (var i = 0; i < slots.length; i++) {
    var start = slots[i];
    var startHour = parseInt(start.split(':')[0], 10);
    var endHour = startHour + 1;
    while (i + 1 < slots.length) {
      var next = slots[i + 1];
      var nextHour = parseInt(next.split(':')[0], 10);
      if (nextHour !== endHour) break;
      endHour++;
      i++;
    }
    ranges.push({ start: start, end: endHour.toString().padStart(2, '0') + ':00' });
  }

  var timeSlotStart = ranges[0].start;
  var timeSlotEnd = ranges[0].end;
  if (ranges.length > 1) {
    timeSlotEnd = ranges[ranges.length - 1].end;
  }
  var payload = {
    fieldId: bookingState.field.id,
    date: bookingState.selectedDate,
    timeSlotStart: timeSlotStart,
    timeSlotEnd: timeSlotEnd,
    paymentMethod: (bookingState.paymentMethod || 'SPLIT').toUpperCase().replace('ORGANIZER', 'ORGANIZER').replace('SPLIT', 'SPLIT').replace('MIXED', 'MIXED'),
    teamSize: (bookingState.players.length + 1) || 1
  };
  if (ranges.length > 1) {
    payload.timeSlotRanges = ranges;
  }
  if (payload.paymentMethod === 'MIXED' && bookingState.mixedPaymentDistribution) {
    payload.mixedPaymentDistribution = bookingState.mixedPaymentDistribution;
  }
  API.bookings.create(payload)
    .then(async function(res) {
      const createdBooking = res.booking;
      console.log('Booking created:', createdBooking);
      
      // If organizer already paid during booking flow, remember it locally
      try {
        if (booking.organizerPaymentStatus === 'paid' && createdBooking && createdBooking.id) {
          var organizerPaidKey = 'organizerPaidBookings';
          var organizerPaid = JSON.parse(localStorage.getItem(organizerPaidKey) || '{}');
          organizerPaid[String(createdBooking.id)] = true;
          localStorage.setItem(organizerPaidKey, JSON.stringify(organizerPaid));

          // Also store a local copy of the booking with organizerPaymentStatus so merge can pick it up
          var allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
          var existingIdx = allBookings.findIndex(function(b) { return String(b.id) === String(createdBooking.id); });
          var mergedLocal = Object.assign({}, createdBooking, { organizerPaymentStatus: 'paid' });
          if (existingIdx !== -1) {
            allBookings[existingIdx] = mergedLocal;
          } else {
            allBookings.push(mergedLocal);
          }
          localStorage.setItem('playerBookings', JSON.stringify(allBookings));
        }
      } catch (e) {
        console.warn('Failed to persist initial organizer payment state', e);
      }
      
      // Add participants to the booking if there are any players
      if (bookingState.players.length > 0 && createdBooking && createdBooking.id) {
        try {
          // Add each player as a participant
          for (const player of bookingState.players) {
            try {
              await API.bookings.addParticipant(createdBooking.id, player.id);
              console.log('Added participant:', player.name);
            } catch (partErr) {
              console.error('Failed to add participant:', player.name, partErr);
            }
          }
          
          // Create notifications for invited players
          createPaymentNotifications(createdBooking, bookingState.players);
        } catch (err) {
          console.error('Error adding participants:', err);
        }
      }
      
      var isFullyPaid = false;
      showBookingConfirmation(booking, isFullyPaid);
      closeBookingModal();
      setTimeout(function() { window.location.href = 'bookings.html'; }, 2000);
    })
    .catch(function(err) {
      isBookingSubmissionInProgress = false;
      var confirmBtn = document.getElementById('confirmBookingBtn');
      var submitPaymentBtn = document.querySelector('#paymentForm button[type="submit"], .payment-step .btn-primary');
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Booking'; }
      if (submitPaymentBtn) { submitPaymentBtn.disabled = false; }
      alert(err.message || 'Failed to create booking.');
    });
}

// Create payment notifications for invited players
function createPaymentNotifications(booking, players) {
  const totalPlayers = players.length + 1; // +1 for organizer
  const equalShare = Math.round(booking.totalCost / totalPlayers);
  const organizerName = bookingState.organizer?.name || 'The organizer';
  const fieldName = bookingState.field?.name || booking.field?.name || 'the field';
  const isMixed = (bookingState.paymentMethod || booking.paymentMethod || '').toLowerCase() === 'mixed';
  const mixedDist = booking.mixedPaymentDistribution || bookingState.mixedPaymentDistribution || {};
  
  players.forEach(player => {
    const amount = isMixed
      ? (mixedDist[player.id] ?? mixedDist[String(player.id)] ?? equalShare)
      : equalShare;
    const notification = {
      id: 'notif_' + Date.now() + '_' + player.id,
      type: 'booking_payment_request',
      playerId: player.id,
      bookingId: booking.id,
      title: 'Payment Required',
      message: `${organizerName} invited you to a booking at ${fieldName}. Your share is ₺${amount}.`,
      date: bookingState.selectedDate,
      time: bookingState.selectedTimeSlots.join(', '),
      paymentAmount: amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Store notification in localStorage (will be replaced with real notification system later)
    const notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    notifications.push(notification);
    localStorage.setItem('playerNotifications', JSON.stringify(notifications));
    try { if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge(); } catch (_) {}

    console.log('Created payment notification for:', player.name, notification);
  });
}

// Check if full payment is received
function checkFullPayment(booking) {
  if (booking.paymentMethod === 'organizer') {
    // If organizer pays full amount, check if organizer has paid
    return booking.organizerPaymentStatus === 'paid';
  } else if (booking.paymentMethod === 'split') {
    // If split payment, check if all players (including organizer) have paid
    const allPlayersPaid = booking.players.length === 0 || booking.players.every(p => p.paymentStatus === 'paid');
    const organizerPaid = booking.organizerPaymentStatus === 'paid';
    return allPlayersPaid && organizerPaid;
  } else if (booking.paymentMethod === 'mixed') {
    // If mixed payment, check if all players (including organizer) have paid their assigned amounts
    const allPlayersPaid = booking.players.length === 0 || booking.players.every(p => p.paymentStatus === 'paid');
    const organizerPaid = booking.organizerPaymentStatus === 'paid';
    return allPlayersPaid && organizerPaid;
  }
  
  return false;
}

// Show booking confirmation message
function showBookingConfirmation(booking, isFullyPaid) {
  // Create confirmation modal
  const confirmationModal = document.createElement('div');
  confirmationModal.className = 'booking-confirmation-modal';
  confirmationModal.id = 'bookingConfirmationModal';
  
  const confirmationContent = isFullyPaid ? `
    <div class="confirmation-content">
      <div class="confirmation-icon success">
        <i class="fi fi-rr-check-circle"></i>
      </div>
      <h2 class="confirmation-title">Booking Confirmed!</h2>
      <p class="confirmation-message">
        Your booking at <strong>${booking.fieldName}</strong> has been confirmed.
      </p>
      <div class="confirmation-details">
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-calendar"></i>
          <span>${formatDate(booking.date)}</span>
        </div>
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-clock"></i>
          <span>${booking.timeSlots.map(slot => {
            const hour = parseInt(slot.split(':')[0]);
            return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
          }).join(', ')}</span>
        </div>
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-money"></i>
          <span>₺${booking.totalCost}</span>
        </div>
      </div>
      <p class="confirmation-note">
        ${booking.paymentMethod === 'organizer' 
          ? 'Full payment has been received. The booking is confirmed.' 
          : 'Your payment has been received. Other players will pay their share separately.'}
      </p>
      <button class="confirmation-btn" onclick="closeConfirmationModal()">
        View My Bookings
      </button>
    </div>
  ` : `
    <div class="confirmation-content">
      <div class="confirmation-icon pending">
        <i class="fi fi-rr-hourglass"></i>
      </div>
      <h2 class="confirmation-title">Booking Created!</h2>
      <p class="confirmation-message">
        Your booking at <strong>${booking.fieldName}</strong> has been created.
      </p>
      <div class="confirmation-details">
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-calendar"></i>
          <span>${formatDate(booking.date)}</span>
        </div>
        <div class="confirmation-detail-item">
          <i class="fi fi-rr-clock"></i>
          <span>${booking.timeSlots.map(slot => {
            const hour = parseInt(slot.split(':')[0]);
            return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
          }).join(', ')}</span>
        </div>
      </div>
      <p class="confirmation-note">
        Invitations have been sent to all players. The booking will be confirmed once all payments are received.
      </p>
      <button class="confirmation-btn" onclick="closeConfirmationModal()">
        View My Bookings
      </button>
    </div>
  `;
  
  confirmationModal.innerHTML = `
    <div class="confirmation-overlay"></div>
    <div class="confirmation-modal-content">
      ${confirmationContent}
    </div>
  `;
  
  document.body.appendChild(confirmationModal);
  
  // Show modal with animation
  setTimeout(() => {
    confirmationModal.classList.add('active');
  }, 100);
}

// Close confirmation modal
function closeConfirmationModal() {
  const modal = document.getElementById('bookingConfirmationModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

// Make function globally available
window.closeConfirmationModal = closeConfirmationModal;

// Notify field owner
function notifyOrganizerOfPayment(booking, payerData, amount) {
  const organizerId = String((booking.organizer && booking.organizer.id) || booking.organizerId || '');
  if (!organizerId) return;
  const fieldName = (booking.field && booking.field.name) || booking.fieldName || 'the field';
  const payerName = payerData && (payerData.fullName || payerData.name || payerData.email || 'A player');
  const notification = {
    id: 'notif_' + Date.now(),
    type: 'player_paid_booking',
    playerId: organizerId,
    bookingId: booking.id,
    title: 'Player Paid Their Share',
    message: payerName + ' has paid ₺' + amount + ' for your booking at ' + fieldName + '.',
    date: booking.date,
    status: 'unread',
    createdAt: new Date().toISOString()
  };
  const notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
  notifications.push(notification);
  localStorage.setItem('playerNotifications', JSON.stringify(notifications));
  try { if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge(); } catch (_) {}
}

function notifyFieldOwner(booking) {
  // In a real app, this would send a notification/email to the field owner
  // For now, we'll store it in localStorage for the owner to see
  
  // Get field owner ID (in real app, this would come from the field data)
  const fieldOwnerId = `owner_${booking.fieldId}`;
  
  const ownerNotification = {
    id: 'owner_notif_' + Date.now(),
    type: 'new_booking',
    ownerId: fieldOwnerId,
    bookingId: booking.id,
    fieldId: booking.fieldId,
    fieldName: booking.fieldName,
    organizerName: booking.organizerName,
    date: booking.date,
    timeSlots: booking.timeSlots,
    totalCost: booking.totalCost,
    status: booking.status,
    playerCount: booking.players.length + 1,
    message: `${booking.organizerName} has ${booking.status === 'confirmed' ? 'confirmed' : 'created'} a booking at ${booking.fieldName}`,
    createdAt: new Date().toISOString(),
    read: false
  };
  
  // Save owner notification
  const ownerNotifications = JSON.parse(localStorage.getItem('ownerNotifications') || '[]');
  ownerNotifications.push(ownerNotification);
  localStorage.setItem('ownerNotifications', JSON.stringify(ownerNotifications));
  
  console.log('Field owner notified:', ownerNotification);
}

// Send player invitations
function sendPlayerInvitations(booking) {
  // In a real app, this would send notifications/emails to players
  booking.players.forEach(player => {
    // Create notification for each player
    const notification = {
      id: 'notif_' + Date.now(),
      type: 'booking_invitation',
      playerId: player.id,
      bookingId: booking.id,
      message: `${booking.organizerName} invited you to a booking at ${booking.fieldName}`,
      date: booking.date,
      time: booking.timeSlots.join(', '),
      cost: booking.costPerPlayer,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Save notification (in real app, this would be sent via API)
    const notifications = JSON.parse(localStorage.getItem('playerNotifications') || '[]');
    notifications.push(notification);
    localStorage.setItem('playerNotifications', JSON.stringify(notifications));
    try { if (typeof window.matchfieldRefreshNotificationBadge === 'function') window.matchfieldRefreshNotificationBadge(); } catch (_) {}
  });

  console.log('Invitations sent to players:', booking.players.map(p => p.name));
}

// Payment Modal State
let paymentState = {
  amount: 0,
  bookingId: null,
  isOrganizer: false,
  booking: null
};

// Open payment modal
function openPaymentModal(options) {
  paymentState = {
    amount: options.amount || 0,
    bookingId: options.bookingId || null,
    isOrganizer: options.isOrganizer || false,
    booking: options.booking || null
  };

  const modal = document.getElementById('paymentModal');
  if (!modal) return;

  // Populate payment summary
  const summary = document.getElementById('paymentInfoSummary');
  if (summary) {
    summary.innerHTML = `
      <div class="payment-summary">
        <div class="payment-amount">
          <span class="amount-label">Amount to Pay</span>
          <span class="amount-value">₺${paymentState.amount}</span>
        </div>
        ${paymentState.booking ? `
          <div class="payment-details">
            <p><strong>${(paymentState.booking.field && paymentState.booking.field.name) || paymentState.booking.fieldName || 'Field'}</strong></p>
            <p>${formatDate(paymentState.booking.date)}</p>
            <p>${(paymentState.booking.timeSlots && paymentState.booking.timeSlots.length
              ? paymentState.booking.timeSlots.map(slot => {
                  const hour = parseInt(String(slot).split(':')[0], 10);
                  return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
                }).join(', ')
              : (paymentState.booking.timeSlotStart && paymentState.booking.timeSlotEnd)
                ? (paymentState.booking.timeSlotStart + ' - ' + paymentState.booking.timeSlotEnd)
                : paymentState.booking.time || 'Not specified')}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  // Reset form
  const form = document.getElementById('paymentForm');
  if (form) {
    form.reset();
  }

  // Show modal
  modal.classList.add('active');
}

// Close payment modal
function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) {
    modal.classList.remove('active');
    paymentState = {
      amount: 0,
      bookingId: null,
      isOrganizer: false,
      booking: null
    };
  }
}

// Initialize payment modal
function initializePaymentModal() {
  // Close button
  const closeBtn = document.getElementById('closePaymentModal');
  const cancelBtn = document.getElementById('cancelPaymentBtn');
  const overlay = document.querySelector('.payment-modal-overlay');

  if (closeBtn) closeBtn.addEventListener('click', closePaymentModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closePaymentModal);
  if (overlay) overlay.addEventListener('click', closePaymentModal);

  // Form submission
  const submitBtn = document.getElementById('submitPaymentBtn');
  const form = document.getElementById('paymentForm');

  if (submitBtn && form) {
    submitBtn.addEventListener('click', handlePaymentSubmission);
  }

  // Card number formatting
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', formatCardNumber);
    cardNumberInput.addEventListener('keypress', (e) => {
      if (!/[0-9\s]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }

  // Expiry date formatting
  const expiryInput = document.getElementById('expiryDate');
  if (expiryInput) {
    expiryInput.addEventListener('input', formatExpiryDate);
    expiryInput.addEventListener('keypress', (e) => {
      if (!/[0-9\/]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }

  // CVV validation
  const cvvInput = document.getElementById('cvv');
  if (cvvInput) {
    cvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
    cvvInput.addEventListener('keypress', (e) => {
      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
    });
  }
}

// Format card number with spaces
function formatCardNumber(e) {
  let value = e.target.value.replace(/\s/g, '');
  let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  if (formattedValue.length > 19) {
    formattedValue = formattedValue.substring(0, 19);
  }
  e.target.value = formattedValue;

  // Detect card type
  detectCardType(value);
}

// Detect card type
function detectCardType(cardNumber) {
  const icon = document.getElementById('cardTypeIcon');
  if (!icon) return;

  const number = cardNumber.replace(/\s/g, '');
  let cardType = 'credit-card';

  if (/^4/.test(number)) {
    cardType = 'visa';
  } else if (/^5[1-5]/.test(number)) {
    cardType = 'mastercard';
  } else if (/^3[47]/.test(number)) {
    cardType = 'amex';
  } else if (/^6/.test(number)) {
    cardType = 'discover';
  }

  // Update icon (in real app, you'd use card brand icons)
  icon.innerHTML = `<i class="fi fi-rr-${cardType === 'credit-card' ? 'credit-card' : 'credit-card'}"></i>`;
}

// Format expiry date
function formatExpiryDate(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.substring(0, 2) + '/' + value.substring(2, 4);
  }
  if (value.length > 5) {
    value = value.substring(0, 5);
  }
  e.target.value = value;
}

// Handle payment submission (booking modal step 5 OR Pay Your Share for existing booking)
function handlePaymentSubmission() {
  const form = document.getElementById('paymentForm');
  if (!form) return;

  // If account is suspended, block payment and show message
  try {
    if (window.API && typeof window.API.getCurrentUser === 'function') {
      const currentUser = window.API.getCurrentUser();
      if (currentUser && currentUser.status && String(currentUser.status).toUpperCase() !== 'ACTIVE') {
        alert('Your account is suspended. You cannot complete payments. Please contact support to resolve this.');
        return;
      }
    }
  } catch (e) {
    // If we can't read user, continue to normal validation below
  }

  // Validate form
  if (!validatePaymentForm()) {
    return;
  }

  const formData = {
    cardholderName: document.getElementById('cardholderName').value,
    cardNumber: document.getElementById('cardNumber').value.replace(/\s/g, ''),
    expiryDate: document.getElementById('expiryDate').value,
    cvv: document.getElementById('cvv').value,
    billingAddress: document.getElementById('billingAddress').value,
    billingCity: document.getElementById('billingCity').value,
    billingPostalCode: document.getElementById('billingPostalCode').value,
    billingCountry: document.getElementById('billingCountry').value,
    amount: paymentState.bookingId ? paymentState.amount : (bookingState.paymentAmount || bookingState.totalCost)
  };

  const submitBtn = document.getElementById('submitPaymentBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Processing...';
  }

  // Paying for EXISTING booking (Pay Your Share from bookings page)
  if (paymentState.bookingId) {
    setTimeout(function() {
      processPayment(formData);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Pay & Confirm Booking';
      }
    }, 1500);
    return;
  }

  // New booking flow (step 5)
  bookingState.paymentData = formData;
  setTimeout(() => {
    bookingState.currentStep = 6;
    updateStepDisplay();
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Pay & Confirm Booking';
    }
    const summary = document.getElementById('paymentInfoSummary');
    if (summary) {
      const paymentSummary = summary.querySelector('.payment-summary');
      if (paymentSummary) {
        const successMsg = document.createElement('div');
        successMsg.className = 'payment-success';
        successMsg.innerHTML = `
          <i class="fi fi-rr-check-circle"></i>
          <span>Payment successful! Proceeding to confirmation...</span>
        `;
        paymentSummary.appendChild(successMsg);
      }
    }
  }, 2000);
}

// Validate card number (accept any 12–19 digits for now; restore Luhn/real validation later)
function validateCardNumber(cardNumber) {
  const number = cardNumber.replace(/\s/g, '');
  if (number.length < 12 || number.length > 19) {
    return false;
  }
  return /^\d+$/.test(number);
}

// Validate expiry date
function validateExpiryDate(expiryDate) {
  const [month, year] = expiryDate.split('/');
  if (!month || !year) return false;

  const expMonth = parseInt(month);
  const expYear = 2000 + parseInt(year);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (expMonth < 1 || expMonth > 12) return false;
  if (expYear < currentYear) return false;
  if (expYear === currentYear && expMonth < currentMonth) return false;

  return true;
}

// Process payment
function processPayment(paymentData) {
  // In a real app, this would send payment data to a secure payment gateway
  console.log('Processing payment:', {
    amount: paymentState.amount,
    bookingId: paymentState.bookingId,
    // Never log actual card details in production
    cardLast4: paymentData.cardNumber.slice(-4),
    cardholderName: paymentData.cardholderName
  });

  let updatedBooking = null;

  // Update booking payment status (paying for an EXISTING booking - do NOT create a new one)
  if (paymentState.booking) {
    if (paymentState.isOrganizer) {
      paymentState.booking.organizerPaymentStatus = 'paid';
      var organizerPaidKey = 'organizerPaidBookings';
      var organizerPaid = JSON.parse(localStorage.getItem(organizerPaidKey) || '{}');
      organizerPaid[String(paymentState.bookingId)] = true;
      localStorage.setItem(organizerPaidKey, JSON.stringify(organizerPaid));
    } else {
      // Update player payment status
      const playerData = getPlayerData();
      const players = paymentState.booking.players || paymentState.booking.participants || [];
      const player = players.find(p => (p.id || p.userId) === playerData.id);
      if (player) {
        player.paymentStatus = 'paid';
      }
      // Notify organizer that participant paid
      notifyOrganizerOfPayment(paymentState.booking, playerData, paymentState.amount);
      // Store in dedicated key so refresh always shows paid (works with API + localStorage)
      var paidKey = 'playerPaidBookings';
      var paid = JSON.parse(localStorage.getItem(paidKey) || '{}');
      var uid = String((playerData && (playerData.id || playerData._id)) || '');
      paid[String(paymentState.bookingId) + '_' + uid] = true;
      localStorage.setItem(paidKey, JSON.stringify(paid));
    }

    // Persist to localStorage (merge into playerBookings so refresh shows updated status)
    const allBookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    const idx = allBookings.findIndex(b => String(b.id) === String(paymentState.bookingId));
    if (idx !== -1) {
      allBookings[idx] = paymentState.booking;
    } else {
      allBookings.push(paymentState.booking);
    }
    localStorage.setItem('playerBookings', JSON.stringify(allBookings));
    // Do NOT call saveBookingAndSendInvitations - that creates a NEW booking and causes duplicates
    const isFullyPaid = checkFullPayment(paymentState.booking);
    if (isFullyPaid && paymentState.booking.status !== 'confirmed') {
      paymentState.booking.status = 'confirmed';
      paymentState.booking.confirmedAt = new Date().toISOString();
      localStorage.setItem('playerBookings', JSON.stringify(allBookings));
      notifyFieldOwner(paymentState.booking);
      showBookingConfirmation(paymentState.booking, true);
    }
    updatedBooking = paymentState.booking;
  } else if (paymentState.bookingId) {
    // Update existing booking
    const bookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    const bookingIndex = bookings.findIndex(b => b.id === paymentState.bookingId);
    
    if (bookingIndex !== -1) {
      const booking = bookings[bookingIndex];
      
      if (paymentState.isOrganizer) {
        booking.organizerPaymentStatus = 'paid';
        var organizerPaidKey = 'organizerPaidBookings';
        var organizerPaid = JSON.parse(localStorage.getItem(organizerPaidKey) || '{}');
        organizerPaid[String(paymentState.bookingId)] = true;
        localStorage.setItem(organizerPaidKey, JSON.stringify(organizerPaid));
      } else {
        const playerData = getPlayerData();
        const players = booking.players || booking.participants || [];
        const player = players.find(p => (p.id || p.userId) === playerData.id);
        if (player) {
          player.paymentStatus = 'paid';
        }
        // Notify organizer that participant paid
        notifyOrganizerOfPayment(booking, playerData, paymentState.amount);
        var paidKey = 'playerPaidBookings';
        var paid = JSON.parse(localStorage.getItem(paidKey) || '{}');
        var uid = String((playerData && (playerData.id || playerData._id)) || '');
        paid[String(paymentState.bookingId) + '_' + uid] = true;
        localStorage.setItem(paidKey, JSON.stringify(paid));
      }
      
      // Check if full payment is received
      const isFullyPaid = checkFullPayment(booking);
      if (isFullyPaid && booking.status !== 'confirmed') {
        booking.status = 'confirmed';
        booking.confirmedAt = new Date().toISOString();
        
        // Notify field owner of confirmation
        notifyFieldOwner(booking);
        
        // Show confirmation message
        showBookingConfirmation(booking, true);
      }
      
      localStorage.setItem('playerBookings', JSON.stringify(bookings));
      updatedBooking = booking;
    }
  }

  // Close payment modal
  closePaymentModal();
  if (paymentState.booking) {
    closeBookingModal();
  }

  // Single success message, then refresh page to show updated state
  alert('Payment successful! Your share has been paid.');
  window.location.href = 'bookings.html';
}

// Make functions available globally for use from other pages
window.openPaymentModal = openPaymentModal;
window.openBookingModal = openBookingModal;

// Setup event listeners
function setupEventListeners() {
  // Sport filter buttons
  const filterButtons = document.querySelectorAll('.filter-btn');
  filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
          // Remove active class from all buttons
          filterButtons.forEach(b => b.classList.remove('active'));
          // Add active class to clicked button
          btn.classList.add('active');
          
          // Filter venues
          const sport = btn.dataset.sport;
          filterVenuesBySport(sport);
      });
  });
  
  // Search functionality
  const searchInput = document.querySelector('.search-input');
  const searchIcon = document.querySelector('.search-icon');
  
  // Function to perform search
  const performSearch = () => {
      const query = searchInput.value.toLowerCase().trim();
      filterVenuesBySearch(query);
  };
  
  // Search on Enter key press
  if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              performSearch();
          }
      });
  }
  
  // Search on icon click
  if (searchIcon) {
      searchIcon.addEventListener('click', () => {
          performSearch();
      });
  }
  
  // Location selector
  const locationSelector = document.querySelector('.location-selector');
  if (locationSelector) {
      locationSelector.addEventListener('click', () => {
          // Show location selection modal (to be implemented)
          console.log('Select location');
      });
  }
  
  // Only initialize notification and profile popups on the home page
  // Other pages (like bookings) have their own initialization
  const isHomePage = window.location.pathname.includes('home.html') || 
                     (window.location.pathname.endsWith('/') && !window.location.pathname.includes('bookings.html'));
  
  if (isHomePage) {
      // Notification popup is handled by shared notifications.js
      
      // Profile popup
      const profileBtn = document.getElementById('profileBtn');
      const profilePopup = document.getElementById('profilePopup');
      
      if (profileBtn && profilePopup) {
          profileBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              profilePopup.classList.toggle('active');
              // Close notification popup if open
              const notificationPopup = document.getElementById('notificationPopup');
              if (notificationPopup && notificationPopup.classList.contains('active')) {
                  notificationPopup.classList.remove('active');
              }
          });
          
          // Close popup when clicking outside
          document.addEventListener('click', (e) => {
              if (profilePopup && profilePopup.classList.contains('active')) {
                  if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                      profilePopup.classList.remove('active');
                  }
              }
          });
      }
  }
}

// Filter venues by sport
function filterVenuesBySport(sport) {
  const allCards = document.querySelectorAll('.venue-card');
  
  if (sport === 'all') {
      allCards.forEach(card => {
          card.style.display = 'block';
      });
  } else {
      allCards.forEach(card => {
          const cardSport = card.dataset.sport;
          if (cardSport === sport) {
              card.style.display = 'block';
          } else {
              card.style.display = 'none';
          }
      });
  }
}

// Filter venues by search query
function filterVenuesBySearch(query) {
  const allCards = document.querySelectorAll('.venue-card');
  
  // If query is empty, show all cards
  if (!query) {
      allCards.forEach(card => {
          card.style.display = 'block';
      });
      return;
  }
  
  allCards.forEach(card => {
      const venueName = card.querySelector('.venue-name').textContent.toLowerCase();
      const venueRating = card.querySelector('.venue-rating').textContent.toLowerCase();
      const venueSport = card.dataset.sport;
      
      if (venueName.includes(query) || venueRating.includes(query) || venueSport.includes(query)) {
          card.style.display = 'block';
      } else {
          card.style.display = 'none';
      }
  });
}

// Save favorites to localStorage
function saveFavoritesToStorage() {
  const favorites = [];
  venues.popular.forEach(v => {
      if (v.isFavorite) favorites.push(v.id);
  });
  venues.nearby.forEach(v => {
      if (v.isFavorite && !favorites.includes(v.id)) favorites.push(v.id);
  });
  localStorage.setItem('favoriteVenues', JSON.stringify(favorites));
}

// Load favorites from localStorage
function loadFavoritesFromStorage() {
  const saved = localStorage.getItem('favoriteVenues');
  if (saved) {
      const favorites = JSON.parse(saved);
      venues.popular.forEach(v => {
          v.isFavorite = favorites.includes(v.id);
      });
      venues.nearby.forEach(v => {
          v.isFavorite = favorites.includes(v.id);
      });
  }
}

// Notifications are handled by shared notifications.js (loaded on all player pages)











