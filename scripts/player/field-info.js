// Venue data (should match home-player.js)
const venuesData = {
  popular: [
      {
          id: 1,
          name: "Fozi football court",
          sport: "Football",
          image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "outdoor",
          price: 1500,
          isFavorite: false,
          description: "A premium football field located in the heart of Uskudar. Perfect for both casual matches and professional training sessions. The field features high-quality artificial turf, excellent lighting, and modern facilities.",
          features: ["Parking Available", "Changing Rooms", "Water Station", "First Aid Kit", "Referee Available", "Equipment Rental"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 2,
          name: "Fozi football court",
          sport: "Tennis",
          image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1622162879325-4c0c0c0c0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true,
          description: "Professional indoor tennis court with climate control and high-quality court surface. Suitable for all skill levels.",
          features: ["Air Conditioning", "Changing Rooms", "Pro Shop", "Coaching Available"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 3,
          name: "Fozi football court",
          sport: "Basketball",
          image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false,
          description: "Modern indoor basketball court with professional flooring and excellent lighting.",
          features: ["Air Conditioning", "Changing Rooms", "Scoreboard", "Equipment Rental"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 4,
          name: "Fozi football court",
          sport: "Padel",
          image: "https://images.unsplash.com/photo-1622163642992-6b7e3c4e3b3e?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1622163642992-6b7e3c4e3b3e?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true,
          description: "Premium padel court with glass walls and professional court surface.",
          features: ["Air Conditioning", "Changing Rooms", "Equipment Rental", "Coaching Available"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 5,
          name: "Fozi football court",
          sport: "Volleyball",
          image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false,
          description: "Indoor volleyball court with professional net system and excellent facilities.",
          features: ["Air Conditioning", "Changing Rooms", "Equipment Rental", "Referee Available"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 6,
          name: "Fozi football court",
          sport: "Ice Hockey",
          image: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true,
          description: "Professional ice hockey rink with temperature-controlled environment.",
          features: ["Ice Rink", "Equipment Rental", "Changing Rooms", "Pro Shop"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      }
  ],
  nearby: [
      {
          id: 7,
          name: "Fozi football court",
          sport: "Football",
          image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false,
          description: "A premium football field located in the heart of Uskudar.",
          features: ["Parking Available", "Changing Rooms", "Water Station"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 8,
          name: "Fozi football court",
          sport: "Tennis",
          image: "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1622162879325-4c0c0c0c0c0?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: true,
          description: "Professional indoor tennis court with climate control.",
          features: ["Air Conditioning", "Changing Rooms", "Pro Shop"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      },
      {
          id: 9,
          name: "Fozi football court",
          sport: "Basketball",
          image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop&auto=format",
          images: [
              "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&h=600&fit=crop&auto=format",
              "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop&auto=format"
          ],
          rating: 4.8,
          reviews: 98,
          location: "Uskudar",
          distance: "2.1 Km",
          type: "indoor",
          price: 1500,
          isFavorite: false,
          description: "Modern indoor basketball court with professional flooring.",
          features: ["Air Conditioning", "Changing Rooms", "Scoreboard"],
          address: "123 Main Street, Uskudar, Istanbul",
          phone: "+90 212 555 0123"
      }
  ]
};

// Get venue ID from URL parameter (string for API, or number for fallback)
function getVenueIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('id');
}

// Current field when loaded from API (so handleBooking can use it)
var currentFieldFromAPI = null;

// Find venue by ID (supports string or number for fallback data)
function findVenueById(venueId) {
  if (currentFieldFromAPI && String(currentFieldFromAPI.id) === String(venueId))
    return currentFieldFromAPI;
  const allVenues = [...venuesData.popular, ...venuesData.nearby];
  return allVenues.find(venue => String(venue.id) === String(venueId));
}

// Load field from API and map to venue format for rendering
function loadFieldFromAPI(fieldId) {
  if (typeof API === 'undefined' || !fieldId) return Promise.resolve(null);
  return API.fields.getById(fieldId).then(function(field) {
    var images = (field.images && field.images.length) ? field.images : [];
    var img = images[0] || 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop';
    return {
      id: field.id,
      name: field.name,
      sport: field.sport || 'Sport',
      image: img,
      images: images,
      rating: field.rating != null ? field.rating : 0,
      reviews: field.reviewCount != null ? field.reviewCount : 0,
      location: field.location || '',
      distance: 'N/A',
      type: (field.type || 'OUTDOOR').toLowerCase(),
      price: field.pricePerHour != null ? field.pricePerHour : 0,
      isFavorite: false,
      description: field.description || '',
      features: Array.isArray(field.features) ? field.features : [],
      address: field.address || '',
      phone: field.phone || ''
    };
  }).then(function(venue) {
    if (typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken()) {
      return API.favorites.check(venue.id).then(function(res) {
        venue.isFavorite = !!(res && (res.isFavorite || res.isFavorited));
        return venue;
      }).catch(function() { return venue; });
    }
    return venue;
  });
}

// Load favorites from localStorage
function loadFavoritesFromStorage() {
  const saved = localStorage.getItem('favoriteVenues');
  if (saved) {
      const favorites = JSON.parse(saved);
      const allVenues = [...venuesData.popular, ...venuesData.nearby];
      allVenues.forEach(v => {
          v.isFavorite = favorites.includes(v.id);
      });
  }
}

// Toggle favorite (API or local)
function toggleFavorite(venueId) {
  if (typeof API !== 'undefined' && API.getAuthToken && API.getAuthToken()) {
    var venue = findVenueById(venueId);
    if (!venue) return;
    var isFav = venue.isFavorite;
    var promise = isFav ? API.favorites.remove(venueId) : API.favorites.add(venueId);
    promise.then(function() {
      venue.isFavorite = !venue.isFavorite;
      saveFavoritesToStorage();
      updateSaveButton(venue.isFavorite);
    }).catch(function(err) { alert(err.message || 'Failed to update favorite.'); });
    return;
  }
  var venue = findVenueById(venueId);
  if (venue) {
    venue.isFavorite = !venue.isFavorite;
    saveFavoritesToStorage();
    updateSaveButton(venue.isFavorite);
  }
}

// Save favorites to localStorage
function saveFavoritesToStorage() {
  const allVenues = [...venuesData.popular, ...venuesData.nearby];
  const favorites = allVenues.filter(v => v.isFavorite).map(v => v.id);
  localStorage.setItem('favoriteVenues', JSON.stringify(favorites));
}


// Render field info
function renderFieldInfo(venue) {
  if (!venue) {
      document.getElementById('fieldInfoContent').innerHTML = `
          <div class="error-state">
              <h2>Field not found</h2>
              <p>The field you're looking for doesn't exist.</p>
              <a href="../player/home.html" class="back-btn" style="display: inline-flex; margin-top: 20px;">Back to Home</a>
          </div>
      `;
      return;
  }

  // Create field feature tags for display under image (simplified)
  const fieldFeatureTags = [
      venue.type.charAt(0).toUpperCase() + venue.type.slice(1), // Outdoor/Indoor
      venue.sport, // Football, Tennis, etc.
      'Synthetic', // Assume synthetic turf/court
      'Available today', // Availability status
      '6v6'
  ];

  const fieldFeatureTagsHTML = fieldFeatureTags.map(tag => `
      <span class="field-feature-tag">${tag}</span>
  `).join('');

  const featuresHTML = venue.features.map(feature => `
      <div class="field-feature-item">
          <div class="field-feature-icon">
              <i class="fi fi-rr-check"></i>
          </div>
          <span class="field-feature-text">${feature}</span>
      </div>
  `).join('');

  // Get images array or use single image
  const images = venue.images || [venue.image];
  const imagesHTML = images.map((img, index) => `
      <img src="${img}" alt="${venue.name} - Image ${index + 1}" class="field-main-image ${index === 0 ? 'active' : ''}" data-index="${index}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'800\\' height=\\'600\\'%3E%3Crect fill=\\'%23f3f4f6\\' width=\\'800\\' height=\\'600\\'/%3E%3Ctext fill=\\'%236b7280\\' font-family=\\'sans-serif\\' font-size=\\'24\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dominant-baseline=\\'middle\\'%3E${encodeURIComponent(venue.sport)}%3C/text%3E%3C/svg%3E'">
  `).join('');

  const html = `
      <!-- Field Title and Metadata -->
      <div class="field-header-top">
          <div class="field-title-row">
              <h1 class="field-title">${venue.name}</h1>
              <div class="field-actions-top">
                  <button class="action-btn share-btn" onclick="handleShare()">
                      <i class="fi fi-rr-share"></i>
                      <span>Share</span>
                  </button>
                  <button class="action-btn save-btn" id="saveBtn">
                      <i class="fi fi-rr-bookmark"></i>
                      <span>Save</span>
                  </button>
              </div>
          </div>
          <div class="field-meta-line">
              <i class="fi fi-rr-marker field-meta-icon"></i>
              <span>${venue.location}</span>
              <span class="field-meta-separator">•</span>
              <span>${venue.distance}</span>
              <span class="field-meta-separator">•</span>
              <span class="field-star-yellow">★</span>
              <span>${venue.rating} (${venue.reviews})</span>
              <span class="field-meta-separator">•</span>
              <span>${venue.sport}</span>
          </div>
      </div>

      <!-- Image and Booking Card Row -->
      <div class="field-main-row">
          <!-- Field Image Gallery -->
          <div class="field-gallery-wrapper">
              <div class="field-gallery" id="fieldGallery" data-current-index="0" data-total-images="${images.length}">
                  ${imagesHTML}
                  ${images.length > 1 ? `
                  <button class="gallery-nav-btn gallery-nav-left" id="galleryNavLeft">
                      <i class="fi fi-rr-angle-left"></i>
                  </button>
                  <button class="gallery-nav-btn gallery-nav-right" id="galleryNavRight">
                      <i class="fi fi-rr-angle-right"></i>
                  </button>
                  ` : ''}
              </div>
              <div class="field-feature-tags">
                  ${fieldFeatureTagsHTML}
              </div>
          </div>

          <!-- Booking Card -->
          <div class="field-booking-card">
              <div class="booking-price-section">
                  <div class="booking-price">₺${venue.price}<span class="booking-price-unit">/h</span></div>
                  <div class="booking-price-note">Per hour • Taxes included</div>
              </div>
              
              <div class="booking-location-section">
                  <h3 class="booking-section-title">Location</h3>
                  <p class="booking-location-text">Istanbul, ${venue.location} • Approx. ${venue.distance} from your current location.</p>
                  <div class="booking-map-placeholder">
                      Map placeholder (Google Maps / Leaflet later)
                  </div>
              </div>

              <button class="booking-btn" onclick="handleBooking('${String(venue.id).replace(/'/g, "\\'")}')">Book now</button>
              
              <div class="booking-cancellation">
                  Free cancellation up to 12 hours before your booking.
              </div>
          </div>
      </div>

      <!-- Field Details Grid - Content Below Main Row -->
      <div class="field-content-grid">
          <!-- Left Column - Description, Highlights, Amenities, Reviews -->
          <div class="field-content-left">
              <!-- Description -->
              <div class="field-description-section">
                  <h2 class="section-title">${venue.name}</h2>
                  <p class="field-description">${venue.description || 'A premium sports facility with excellent amenities and professional-grade equipment.'}</p>
              </div>

              <!-- Highlights -->
              <div class="field-highlights-section">
                  <h3 class="section-title">Highlights</h3>
                  <ul class="highlights-list">
                      <li>Easy access by car and public transport</li>
                      <li>High-quality lighting for night games</li>
                      <li>Clean changing rooms and showers</li>
                      <li>Snacks and drinks available on site</li>
                  </ul>
              </div>

              <!-- Amenities -->
              <div class="field-amenities-section">
                  <h3 class="section-title">Amenities</h3>
                  <div class="amenities-grid">
                      <div class="amenity-item">
                          <i class="fi fi-rr-check amenity-icon"></i>
                          <span>Flood lights</span>
                      </div>
                      <div class="amenity-item">
                          <i class="fi fi-rr-check amenity-icon"></i>
                          <span>Showers</span>
                      </div>
                      <div class="amenity-item">
                          <i class="fi fi-rr-check amenity-icon"></i>
                          <span>Team benches</span>
                      </div>
                      <div class="amenity-item">
                          <i class="fi fi-rr-check amenity-icon"></i>
                          <span>Changing rooms</span>
                      </div>
                      <div class="amenity-item">
                          <i class="fi fi-rr-check amenity-icon"></i>
                          <span>Parking</span>
                      </div>
                      <div class="amenity-item">
                          <i class="fi fi-rr-check amenity-icon"></i>
                          <span>Wi-Fi</span>
                      </div>
                  </div>
              </div>

              <!-- Reviews -->
              <div class="field-reviews-section">
                  <div class="reviews-header-section">
                      <h3 class="section-title">Reviews</h3>
                      <div class="reviews-summary-toggle">
                          <div class="reviews-summary">
                              <span class="field-star-yellow">★</span>
                              <span>${venue.rating} • ${venue.reviews} total reviews</span>
                          </div>
                          <button class="toggle-reviews-btn" id="toggleReviewsBtn" onclick="toggleReviews()">
                              <span class="toggle-text">View reviews</span>
                              <i class="fi fi-rr-angle-down toggle-icon"></i>
                          </button>
                      </div>
                  </div>
                  
                  <!-- Add Review Form -->
                  <div class="add-review-form">
                      <h4 class="add-review-title">Write a review</h4>
                      <div class="review-rating-input">
                          <label>Rating:</label>
                          <div class="star-rating" id="starRating">
                              <span class="star-input" data-rating="1">★</span>
                              <span class="star-input" data-rating="2">★</span>
                              <span class="star-input" data-rating="3">★</span>
                              <span class="star-input" data-rating="4">★</span>
                              <span class="star-input" data-rating="5">★</span>
                          </div>
                          <span class="rating-value" id="ratingValue">0</span>
                      </div>
                      <textarea 
                          class="review-textarea" 
                          id="reviewTextarea" 
                          placeholder="Share your experience..."
                          rows="4"
                      ></textarea>
                      <button class="submit-review-btn" onclick="submitReview(${venue.id})">Submit Review</button>
                  </div>

                  <div class="reviews-list" id="reviewsList" style="display: none;">
                      <div class="review-card">
                          <div class="review-header">
                              <div class="reviewer-info">
                                  <div class="reviewer-avatar-small">A</div>
                                  <div>
                                      <div class="reviewer-name">Ahmed</div>
                                      <div class="review-context">Played 5v5 last week</div>
                                  </div>
                              </div>
                              <div class="review-rating-display">
                                  <span class="star-filled">★★★★★</span>
                              </div>
                          </div>
                          <div class="review-text">"Great field quality, lights are strong and the staff were friendly. Booking was smooth."</div>
                      </div>
                      <div class="review-card">
                          <div class="review-header">
                              <div class="reviewer-info">
                                  <div class="reviewer-avatar-small">S</div>
                                  <div>
                                      <div class="reviewer-name">Sara</div>
                                      <div class="review-context">Weekend booking</div>
                                  </div>
                              </div>
                              <div class="review-rating-display">
                                  <span class="star-filled">★★★★★</span>
                              </div>
                          </div>
                          <div class="review-text">"Perfect location and easy to reach. Parking area helps a lot during busy hours."</div>
                      </div>
                  </div>
              </div>
          </div>

          <!-- Right Column - Venue Contact -->
          <div class="field-content-right">
              <div class="venue-contact-card">
                  <h3 class="venue-contact-title">Venue contact</h3>
                  <div class="venue-contact-info">
                      <div class="venue-avatar">N</div>
                      <div class="venue-details">
                          <div class="venue-name">Noor Arena Managment</div>
                          <div class="venue-response">Responds within a few hours</div>
                      </div>
                  </div>
                  <button class="venue-message-btn">Message venue</button>
              </div>
          </div>
      </div>
  `;

  document.getElementById('fieldInfoContent').innerHTML = html;

  // Add event listener to save button (same as favorite)
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
      saveBtn.dataset.venueId = venue.id;
      saveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleFavorite(venue.id);
      });
      updateSaveButton(venue.isFavorite);
  }

  // Initialize gallery sliding
  initializeGallerySliding(images.length);

  // Initialize star rating
  initializeStarRating();
  
  // Display reviews
  displayReviews(venue.id);
}

// Update save button state
function updateSaveButton(isFavorite) {
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
      if (isFavorite) {
          saveBtn.classList.add('active');
      } else {
          saveBtn.classList.remove('active');
      }
  }
}

// Handle share
function handleShare() {
  if (navigator.share) {
      navigator.share({
          title: document.querySelector('.field-title')?.textContent || 'Field Details',
          url: window.location.href
      }).catch(console.error);
  } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
          alert('Link copied to clipboard!');
      }).catch(() => {
          alert('Share feature not available. Please copy the URL manually.');
      });
  }
}

// Handle booking
function handleBooking(venueId) {
  const venue = findVenueById(venueId);
  if (venue) {
      // Use the openBookingModal function from home.js
      if (typeof openBookingModal === 'function') {
          openBookingModal(venue);
      } else {
          // Fallback if function not loaded yet
          alert('Loading booking system...');
          setTimeout(() => {
              if (typeof openBookingModal === 'function') {
                  openBookingModal(venue);
              } else {
                  alert(`Booking ${venue.name}...\n\nPlease refresh the page and try again.`);
              }
          }, 500);
      }
  }
}

// Make handleBooking available globally
window.handleBooking = handleBooking;

// Load reviews from localStorage
function loadReviews(venueId) {
  const saved = localStorage.getItem(`reviews_${venueId}`);
  if (saved) {
      return JSON.parse(saved);
  }
  return [];
}

// Save reviews to localStorage
function saveReviews(venueId, reviews) {
  localStorage.setItem(`reviews_${venueId}`, JSON.stringify(reviews));
}

// Submit review
function submitReview(venueId) {
  const textarea = document.getElementById('reviewTextarea');
  const ratingValue = document.getElementById('ratingValue');
  const reviewText = textarea.value.trim();
  const rating = parseInt(ratingValue.textContent);

  if (!reviewText) {
      alert('Please write a review before submitting.');
      return;
  }

  if (rating === 0) {
      alert('Please select a rating before submitting.');
      return;
  }

  // Get existing reviews
  const reviews = loadReviews(venueId);
  
  // Create new review
  const newReview = {
      id: Date.now(),
      reviewerName: 'You', // In a real app, this would come from user authentication
      reviewerInitial: 'Y',
      reviewText: reviewText,
      rating: rating,
      date: new Date().toLocaleDateString(),
      context: 'Recent booking'
  };

  // Add new review
  reviews.unshift(newReview); // Add to beginning
  saveReviews(venueId, reviews);

  // Clear form
  textarea.value = '';
  resetStarRating();

  // Reload reviews display
  displayReviews(venueId);

  alert('Thank you for your review!');
}

// Display reviews
function displayReviews(venueId) {
  const reviewsList = document.getElementById('reviewsList');
  const reviews = loadReviews(venueId);
  
  // Default reviews (if no user reviews exist, show these)
  const defaultReviews = [
      {
          reviewerName: 'Ahmed',
          reviewerInitial: 'A',
          reviewText: '"Great field quality, lights are strong and the staff were friendly. Booking was smooth."',
          rating: 5,
          context: 'Played 5v5 last week'
      },
      {
          reviewerName: 'Sara',
          reviewerInitial: 'S',
          reviewText: '"Perfect location and easy to reach. Parking area helps a lot during busy hours."',
          rating: 5,
          context: 'Weekend booking'
      },
      {
          reviewerName: 'Mohamed',
          reviewerInitial: 'M',
          reviewText: '"Excellent facilities and well-maintained field. The synthetic turf is in great condition. Highly recommended for regular play."',
          rating: 5,
          context: 'Regular player'
      },
      {
          reviewerName: 'Leyla',
          reviewerInitial: 'L',
          reviewText: '"Really enjoyed playing here. The booking process was easy and the field was clean. Will definitely come back!"',
          rating: 4,
          context: 'First time visitor'
      },
      {
          reviewerName: 'Yusuf',
          reviewerInitial: 'Y',
          reviewText: '"Good value for money. The field is spacious and the lighting is perfect for evening games. Only wish there were more parking spots."',
          rating: 4,
          context: 'Evening booking'
      },
      {
          reviewerName: 'Aylin',
          reviewerInitial: 'A',
          reviewText: '"Amazing experience! The facilities are top-notch and the staff is very accommodating. Great for team training sessions."',
          rating: 5,
          context: 'Team training'
      },
      {
          reviewerName: 'Can',
          reviewerInitial: 'C',
          reviewText: '"Decent field but could use some improvements in the changing rooms. Overall good value for the price."',
          rating: 4,
          context: 'Monthly booking'
      },
      {
          reviewerName: 'Elif',
          reviewerInitial: 'E',
          reviewText: '"One of the best football fields in the area. The surface is perfect and the location is very convenient. Highly recommend!"',
          rating: 5,
          context: 'Regular customer'
      }
  ];

  // Combine user reviews with default reviews, showing user reviews first
  const allReviews = reviews.length > 0 ? [...reviews, ...defaultReviews] : defaultReviews;

  reviewsList.innerHTML = allReviews.map(review => `
      <div class="review-card">
          <div class="review-header">
              <div class="reviewer-info">
                  <div class="reviewer-avatar-small">${review.reviewerInitial}</div>
                  <div>
                      <div class="reviewer-name">${review.reviewerName}</div>
                      <div class="review-context">${review.context}</div>
                  </div>
              </div>
              <div class="review-rating-display">
                  <span class="star-filled">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
              </div>
          </div>
          <div class="review-text">${review.reviewText}</div>
      </div>
  `).join('');
}

// Initialize gallery sliding
function initializeGallerySliding(totalImages) {
  if (totalImages <= 1) return;

  const gallery = document.getElementById('fieldGallery');
  const navLeft = document.getElementById('galleryNavLeft');
  const navRight = document.getElementById('galleryNavRight');
  const images = gallery.querySelectorAll('.field-main-image');
  
  let currentIndex = 0;

  function showImage(index) {
    images.forEach((img, i) => {
      if (i === index) {
        img.classList.add('active');
      } else {
        img.classList.remove('active');
      }
    });
    currentIndex = index;
    gallery.setAttribute('data-current-index', index);
  }

  function nextImage() {
    const nextIndex = (currentIndex + 1) % totalImages;
    showImage(nextIndex);
  }

  function prevImage() {
    const prevIndex = (currentIndex - 1 + totalImages) % totalImages;
    showImage(prevIndex);
  }

  if (navLeft) {
    navLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      prevImage();
    });
  }

  if (navRight) {
    navRight.addEventListener('click', (e) => {
      e.stopPropagation();
      nextImage();
    });
  }

  // Optional: Add keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (gallery && document.getElementById('fieldInfoContent').contains(gallery)) {
      if (e.key === 'ArrowLeft') {
        prevImage();
      } else if (e.key === 'ArrowRight') {
        nextImage();
      }
    }
  });
}

// Initialize star rating
function initializeStarRating() {
  const stars = document.querySelectorAll('.star-input');
  let currentRating = 0;

  stars.forEach((star, index) => {
      star.addEventListener('click', () => {
          currentRating = index + 1;
          updateStarRating(currentRating);
          document.getElementById('ratingValue').textContent = currentRating;
      });

      star.addEventListener('mouseenter', () => {
          highlightStars(index + 1);
      });
  });

  const starContainer = document.getElementById('starRating');
  if (starContainer) {
      starContainer.addEventListener('mouseleave', () => {
          highlightStars(currentRating);
      });
  }
}

// Update star rating display
function updateStarRating(rating) {
  const stars = document.querySelectorAll('.star-input');
  stars.forEach((star, index) => {
      if (index < rating) {
          star.classList.add('active');
      } else {
          star.classList.remove('active');
      }
  });
}

// Highlight stars on hover
function highlightStars(rating) {
  const stars = document.querySelectorAll('.star-input');
  stars.forEach((star, index) => {
      if (index < rating) {
          star.classList.add('highlight');
      } else {
          star.classList.remove('highlight');
      }
  });
}

// Reset star rating
function resetStarRating() {
  const stars = document.querySelectorAll('.star-input');
  stars.forEach(star => {
      star.classList.remove('active', 'highlight');
  });
  document.getElementById('ratingValue').textContent = '0';
}

// Toggle reviews visibility
function toggleReviews() {
  const reviewsList = document.getElementById('reviewsList');
  const toggleBtn = document.getElementById('toggleReviewsBtn');
  const toggleText = toggleBtn.querySelector('.toggle-text');
  const toggleIcon = toggleBtn.querySelector('.toggle-icon');
  
  if (reviewsList.style.display === 'none' || !reviewsList.style.display) {
      reviewsList.style.display = 'flex';
      toggleText.textContent = 'Hide reviews';
      toggleIcon.classList.remove('fi-rr-angle-down');
      toggleIcon.classList.add('fi-rr-angle-up');
  } else {
      reviewsList.style.display = 'none';
      toggleText.textContent = 'View reviews';
      toggleIcon.classList.remove('fi-rr-angle-up');
      toggleIcon.classList.add('fi-rr-angle-down');
  }
}

// Setup profile popup (same as home-player.js)
function setupProfilePopup() {
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
      
      document.addEventListener('click', (e) => {
          if (profilePopup && profilePopup.classList.contains('active')) {
              if (!profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
                  profilePopup.classList.remove('active');
              }
          }
      });
  }
}

// Setup notification popup (same as home-player.js)
function setupNotificationPopup() {
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
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  function showError(msg, title) {
    title = title || 'Error';
    var el = document.getElementById('fieldInfoContent');
    if (el) el.innerHTML = '<div class="error-state"><h2>' + title + '</h2><p>' + (msg || 'An error occurred.') + '</p><a href="home.html" class="back-btn" style="display: inline-flex; margin-top: 20px;">Back to Home</a></div>';
  }
  try {
    loadFavoritesFromStorage();
    setupProfilePopup();
    setupNotificationPopup();
    var venueId = getVenueIdFromURL();
    if (!venueId) {
      showError('Please select a field from the home page.', 'Invalid field ID');
      return;
    }
    loadFieldFromAPI(venueId).then(function(venue) {
      if (venue) {
        currentFieldFromAPI = venue;
        renderFieldInfo(venue);
        return;
      }
      var fallbackId = parseInt(venueId, 10) || venueId;
      var venue = findVenueById(fallbackId);
      renderFieldInfo(venue);
    }).catch(function(err) {
      console.error('Error loading field:', err);
      var venue = findVenueById(venueId);
      if (venue) renderFieldInfo(venue);
      else showError('The field could not be loaded.', 'Error loading field');
    });
  } catch (error) {
    console.error('Error loading field info:', error);
    showError('An error occurred while loading the field details.', 'Error loading field information');
  }
});








