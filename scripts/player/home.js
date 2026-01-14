// Sample venue data
const venues = {
  popular: [
      {
          id: 1,
          name: "Fozi football court",
          sport: "Football",
          image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "outdoor",
          price: 1500,
          isFavorite: false
      },
      {
          id: 2,
          name: "Fozi football court",
          sport: "Tennis",
          image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true
      },
      {
          id: 3,
          name: "Fozi football court",
          sport: "Basketball",
          image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false
      },
      {
          id: 4,
          name: "Fozi football court",
          sport: "Padel",
          image: "https://images.unsplash.com/photo-1622163642992-6b7e3c4e3b3e?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true
      },
      {
          id: 5,
          name: "Fozi football court",
          sport: "Volleyball",
          image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false
      },
      {
          id: 6,
          name: "Fozi football court",
          sport: "Ice Hockey",
          image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true
      }
  ],
  nearby: [
      {
          id: 7,
          name: "Fozi football court",
          sport: "Football",
          image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false
      },
      {
          id: 8,
          name: "Fozi football court",
          sport: "Tennis",
          image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true
      },
      {
          id: 9,
          name: "Fozi football court",
          sport: "Basketball",
          image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=300&fit=crop&auto=format",
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false
      }
  ]
};

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
  try {
      loadFavoritesFromStorage();
      renderVenues('popular', venues.popular);
      renderVenues('nearby', venues.nearby);
      setupEventListeners();
      initializeBookingModal();
      initializePaymentModal();
      
      // Check for invite link in URL
      handleInviteLink();
      
      // Ensure all cards are visible on initial load
      const allCards = document.querySelectorAll('.venue-card');
      allCards.forEach(card => {
          card.style.display = 'block';
      });
  } catch (error) {
      console.error('Error initializing page:', error);
      alert('An error occurred while loading the page. Please check the console for details.');
  }
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

// Toggle favorite status
function toggleFavorite(venueId) {
  // Update in popular venues
  const popularVenue = venues.popular.find(v => v.id === venueId);
  if (popularVenue) {
      popularVenue.isFavorite = !popularVenue.isFavorite;
  }
  
  // Update in nearby venues
  const nearbyVenue = venues.nearby.find(v => v.id === venueId);
  if (nearbyVenue) {
      nearbyVenue.isFavorite = !nearbyVenue.isFavorite;
  }
  
  // Update UI
  const favoriteBtn = document.querySelector(`.favorite-btn[data-venue-id="${venueId}"]`);
  if (favoriteBtn) {
      favoriteBtn.classList.toggle('active');
  }
  
  // Save to localStorage (optional)
  saveFavoritesToStorage();
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

// Get player data from localStorage (simulated)
function getPlayerData() {
  // In a real app, this would come from authentication
  const stored = localStorage.getItem('playerData');
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Default player data for demo
  const defaultPlayer = {
    id: 'player_' + Date.now(),
    name: 'John Doe',
    email: 'john.doe@example.com'
  };
  localStorage.setItem('playerData', JSON.stringify(defaultPlayer));
  return defaultPlayer;
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
function loadTimeSlots() {
  const container = document.getElementById('timeSlotsGrid');
  if (!container) {
    console.error('Time slots container not found');
    return;
  }
  
  if (!bookingState.field) {
    console.error('Field data not available');
    return;
  }

  // Generate time slots (9 AM to 10 PM, hourly)
  const slots = [];
  for (let hour = 9; hour < 22; hour++) {
    const startTime = `${hour.toString().padStart(2, '0')}:00`;
    const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
    slots.push({
      start: startTime,
      end: endTime,
      available: Math.random() > 0.3 // 70% availability for demo
    });
  }

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
    <div class="player-item">
      <div class="player-info">
        <i class="fi fi-rr-user"></i>
        <span>${player.name}</span>
        <span class="player-id">ID: ${player.id}</span>
      </div>
      <button class="remove-player-btn" data-index="${index}">
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

  // Submit payment button
  const submitPaymentBtn = document.getElementById('submitPaymentBtn');
  if (submitPaymentBtn) {
    submitPaymentBtn.addEventListener('click', () => {
      handlePaymentSubmission();
    });
  }

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

// Add player
function addPlayer() {
  const input = document.getElementById('playerSearchInput');
  if (!input) return;

  const searchValue = input.value.trim();
  if (!searchValue) {
    alert('Please enter a username or Player ID.');
    return;
  }

  // Simulate player lookup (in real app, this would be an API call)
  const player = {
    id: 'player_' + Date.now(),
    name: searchValue,
    email: searchValue.toLowerCase().replace(/\s+/g, '.') + '@example.com'
  };

  // Check if player already added
  if (bookingState.players.some(p => p.id === player.id || p.name.toLowerCase() === player.name.toLowerCase())) {
    alert('This player is already added.');
    return;
  }

  bookingState.players.push(player);
  input.value = '';
  updatePlayersList();
  updateCostSplit();
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

// Save booking and send invitations
function saveBookingAndSendInvitations(booking) {
  // Check if full payment is received
  const isFullyPaid = checkFullPayment(booking);
  
  // Update booking status based on payment
  if (isFullyPaid) {
    booking.status = 'confirmed';
    booking.confirmedAt = new Date().toISOString();
  } else {
    booking.status = 'pending';
  }

  // Save booking to localStorage (in real app, this would be an API call)
  const bookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
  bookings.push(booking);
  localStorage.setItem('playerBookings', JSON.stringify(bookings));

  // Send invitations to players
  sendPlayerInvitations(booking);

  // Notify field owner
  notifyFieldOwner(booking);

  // Show confirmation message
  if (isFullyPaid) {
    showBookingConfirmation(booking, true);
  } else {
    showBookingConfirmation(booking, false);
  }

  // Close modal
  closeBookingModal();

  // Redirect to bookings page
  setTimeout(() => {
    window.location.href = 'bookings.html';
  }, 2000);
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
            <p><strong>${paymentState.booking.fieldName}</strong></p>
            <p>${formatDate(paymentState.booking.date)}</p>
            <p>${paymentState.booking.timeSlots.map(slot => {
              const hour = parseInt(slot.split(':')[0]);
              return `${slot} - ${(hour + 1).toString().padStart(2, '0')}:00`;
            }).join(', ')}</p>
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

// Handle payment submission (from booking modal step)
function handlePaymentSubmission() {
  const form = document.getElementById('paymentForm');
  if (!form) return;

  // Validate form
  if (!validatePaymentForm()) {
    return;
  }

  // Get form data
  const formData = {
    cardholderName: document.getElementById('cardholderName').value,
    cardNumber: document.getElementById('cardNumber').value.replace(/\s/g, ''),
    expiryDate: document.getElementById('expiryDate').value,
    cvv: document.getElementById('cvv').value,
    billingAddress: document.getElementById('billingAddress').value,
    billingCity: document.getElementById('billingCity').value,
    billingPostalCode: document.getElementById('billingPostalCode').value,
    billingCountry: document.getElementById('billingCountry').value,
    amount: bookingState.paymentAmount || bookingState.totalCost
  };

  // Store payment data
  bookingState.paymentData = formData;

  // Show processing state
  const submitBtn = document.getElementById('submitPaymentBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fi fi-rr-spinner"></i> Processing...';
  }

  // Simulate payment processing (in real app, this would be an API call)
  setTimeout(() => {
    // Payment successful, move to confirmation step
    bookingState.currentStep = 6;
    updateStepDisplay();
    
    // Reset button
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Pay & Confirm Booking';
    }
    
    // Show success message
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

// Validate card number (Luhn algorithm)
function validateCardNumber(cardNumber) {
  const number = cardNumber.replace(/\s/g, '');
  if (number.length < 13 || number.length > 19) {
    return false;
  }

  let sum = 0;
  let isEven = false;

  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number.charAt(i));

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
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

  // Update booking payment status
  if (paymentState.booking) {
    if (paymentState.isOrganizer) {
      paymentState.booking.organizerPaymentStatus = 'paid';
    } else {
      // Update player payment status
      const playerData = getPlayerData();
      const player = paymentState.booking.players.find(p => p.id === playerData.id);
      if (player) {
        player.paymentStatus = 'paid';
      }
    }

    // Save booking
    saveBookingAndSendInvitations(paymentState.booking);
    updatedBooking = paymentState.booking;
  } else if (paymentState.bookingId) {
    // Update existing booking
    const bookings = JSON.parse(localStorage.getItem('playerBookings') || '[]');
    const bookingIndex = bookings.findIndex(b => b.id === paymentState.bookingId);
    
    if (bookingIndex !== -1) {
      const booking = bookings[bookingIndex];
      
      if (paymentState.isOrganizer) {
        booking.organizerPaymentStatus = 'paid';
      } else {
        const playerData = getPlayerData();
        const player = booking.players.find(p => p.id === playerData.id);
        if (player) {
          player.paymentStatus = 'paid';
        }
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

  // Show success message
  if (updatedBooking && updatedBooking.status === 'confirmed') {
    // Confirmation message will be shown by showBookingConfirmation
  } else {
    alert('Payment successful!');
  }

  // Close modals
  closePaymentModal();
  if (paymentState.booking) {
    closeBookingModal();
  }

  // Redirect to bookings page
  setTimeout(() => {
    window.location.href = 'bookings.html';
  }, updatedBooking && updatedBooking.status === 'confirmed' ? 3000 : 1000);
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
      // Notification popup
      const notificationBtn = document.querySelector('.notification-btn');
      const notificationPopup = document.getElementById('notificationPopup');
      const closeNotificationBtn = document.getElementById('closeNotificationBtn');
      
      if (notificationBtn && notificationPopup) {
          notificationBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              notificationPopup.classList.toggle('active');
              // Close profile popup if open
              const profilePopup = document.getElementById('profilePopup');
              if (profilePopup && profilePopup.classList.contains('active')) {
                  profilePopup.classList.remove('active');
              }
          });
          
          // Close notification button
          if (closeNotificationBtn) {
              closeNotificationBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  notificationPopup.classList.remove('active');
              });
          }
          
          // Close popup when clicking outside
          document.addEventListener('click', (e) => {
              if (notificationPopup && notificationPopup.classList.contains('active')) {
                  if (!notificationPopup.contains(e.target) && !notificationBtn.contains(e.target)) {
                      notificationPopup.classList.remove('active');
                  }
              }
          });
      }
      
      // Profile popup
      const profileBtn = document.getElementById('profileBtn');
      const profilePopup = document.getElementById('profilePopup');
      
      if (profileBtn && profilePopup) {
          profileBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              profilePopup.classList.toggle('active');
              // Close notification popup if open
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











