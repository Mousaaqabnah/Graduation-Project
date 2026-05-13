// Dashboard — same data-loading pattern as player pages: API.* after auth (see player/bookings.js, player/home.js).

function ownerBookingId(b) {
    if (!b) return '';
    return String(b.id != null ? b.id : b._id || '');
}

function isSameLocalCalendarDay(d, ref) {
    const a = new Date(d);
    const b = ref || new Date();
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function ownerStatusBadgeClass(status) {
    const s = (status || '').toUpperCase();
    if (s === 'CONFIRMED' || s === 'UPCOMING' || s === 'COMPLETED') return 'badge-confirmed';
    if (s === 'PENDING') return 'badge-pending';
    if (s === 'CANCELLED') return 'badge-cancelled';
    return 'badge-pending';
}

function ownerStatusLabel(status) {
    const s = (status || '').toUpperCase();
    if (s === 'UPCOMING') return 'Upcoming';
    return s.charAt(0) + s.slice(1).toLowerCase();
}

function formatOwnerTry(amount) {
    const n = Number(amount) || 0;
    return '₺' + n.toLocaleString('tr-TR');
}

function dashboardLocationLine(field) {
    const cityDistrict = [field && field.city, field && field.district].filter(Boolean).join(', ');
    return cityDistrict || (field && field.address) || (field && field.location) || '—';
}

let ownerDashboardFieldsById = new Map();
let addFieldMapPicker = null;
let manageFieldMapPicker = null;
/** Last accepted land pin (revert sea clicks). */
let lastValidAddFieldMapPosition = { lat: 41.0082, lng: 28.9784 };
let lastValidManageFieldMapPosition = { lat: 41.0082, lng: 28.9784 };

function ownerFieldModerationUi(f) {
    const mod = String((f && f.moderationStatus) || '').toUpperCase();
    const active = !f || f.isActive !== false;
    if (mod === 'REJECTED') return { variant: 'rejected', label: 'Rejected' };
    if (mod === 'PENDING') return { variant: 'pending', label: 'Pending admin approval' };
    if (mod === 'APPROVED') return active ? { variant: 'approved', label: 'Approved & live' } : { variant: 'pending', label: 'Approved (not visible yet)' };
    return active ? { variant: 'approved', label: 'Live' } : { variant: 'pending', label: 'Pending admin approval' };
}

function setFieldStatusBadgeFromField(f) {
    const badge = document.getElementById('fieldStatusBadge');
    if (!badge) return;
    const ui = ownerFieldModerationUi(f || {});
    badge.className = 'field-status-badge' + (ui.variant === 'approved' ? '' : ' ' + ui.variant);
    const dotClass = 'status-dot' + (ui.variant === 'approved' ? '' : ' ' + ui.variant);
    badge.innerHTML = '<span class="' + dotClass + '"></span><span class="status-text">' + ui.label + '</span>';
}

function detectSportLabel(sportValue) {
    const raw = String(sportValue || '').trim().toLowerCase();
    if (!raw) return 'Football';
    if (raw === 'soccer') return 'Football';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Add-field modal: show custom sport when "Other" is selected. */
function syncFieldTypeCustomVisibility() {
    const sel = document.getElementById('fieldType');
    const group = document.getElementById('fieldSportCustomGroup');
    const input = document.getElementById('fieldSportCustom');
    if (!sel || !group || !input) return;
    const isOther = sel.value === 'other';
    group.style.display = isOther ? 'block' : 'none';
    input.required = isOther;
    if (!isOther) {
        input.value = '';
        input.style.borderColor = '';
    }
}

/** Indoor vs outdoor, artificial vs natural grass — only one of each pair at a time. */
function syncMutuallyExclusiveFieldFeaturesState() {
    const form = document.getElementById('addFieldForm');
    if (!form) return;
    function pair(aSel, bSel) {
        const a = form.querySelector(aSel);
        const b = form.querySelector(bSel);
        if (!a || !b) return;
        if (a.checked) {
            b.checked = false;
            b.disabled = true;
            a.disabled = false;
        } else if (b.checked) {
            a.checked = false;
            a.disabled = true;
            b.disabled = false;
        } else {
            a.disabled = false;
            b.disabled = false;
        }
    }
    pair('input[name="features"][value="indoor"]', 'input[name="features"][value="outdoor"]');
    pair('input[name="features"][value="artificial-grass"]', 'input[name="features"][value="natural-grass"]');
}

function initAddFieldFormEnhancements() {
    const form = document.getElementById('addFieldForm');
    if (!form || form.dataset.addFieldEnhancements === '1') return;
    form.dataset.addFieldEnhancements = '1';
    const typeSel = document.getElementById('fieldType');
    if (typeSel) {
        typeSel.addEventListener('change', function () {
            syncFieldTypeCustomVisibility();
        });
    }
    form.addEventListener('change', function (ev) {
        if (ev.target && ev.target.name === 'features') {
            syncMutuallyExclusiveFieldFeaturesState();
        }
    });
    syncFieldTypeCustomVisibility();
    syncMutuallyExclusiveFieldFeaturesState();
}

function resolveAddFieldSportForPayload() {
    const sel = document.getElementById('fieldType');
    const custom = document.getElementById('fieldSportCustom');
    if (!sel) return detectSportLabel('football');
    if (sel.value === 'other') {
        const raw = (custom && custom.value) ? String(custom.value).trim() : '';
        if (!raw) return '';
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return detectSportLabel(sel.value);
}

function syncManageSportCustomVisibility() {
    const sel = document.getElementById('manageSportCategory');
    const group = document.getElementById('manageSportCustomGroup');
    const input = document.getElementById('manageSportCustom');
    if (!sel || !group || !input) return;
    const isOther = sel.value === 'other';
    group.style.display = isOther ? 'block' : 'none';
    input.required = isOther;
    if (!isOther) {
        input.value = '';
        input.style.borderColor = '';
    }
}

function syncMutuallyExclusiveManageFeaturesState() {
    const root = document.getElementById('editFieldModal');
    if (!root) return;
    function pair(aSel, bSel) {
        const a = root.querySelector(aSel);
        const b = root.querySelector(bSel);
        if (!a || !b) return;
        if (a.checked) {
            b.checked = false;
            b.disabled = true;
            a.disabled = false;
        } else if (b.checked) {
            a.checked = false;
            a.disabled = true;
            b.disabled = false;
        } else {
            a.disabled = false;
            b.disabled = false;
        }
    }
    pair('input[name="manageFeatures"][value="indoor"]', 'input[name="manageFeatures"][value="outdoor"]');
    pair('input[name="manageFeatures"][value="artificial-grass"]', 'input[name="manageFeatures"][value="natural-grass"]');
}

function initManageFieldFormEnhancements() {
    const modal = document.getElementById('editFieldModal');
    if (!modal || modal.dataset.manageFormEnhancements === '1') return;
    modal.dataset.manageFormEnhancements = '1';
    const sportSel = document.getElementById('manageSportCategory');
    if (sportSel) {
        sportSel.addEventListener('change', function () {
            syncManageSportCustomVisibility();
        });
    }
    modal.addEventListener('change', function (ev) {
        if (ev.target && ev.target.name === 'manageFeatures') {
            syncMutuallyExclusiveManageFeaturesState();
        }
    });
    syncManageSportCustomVisibility();
    syncMutuallyExclusiveManageFeaturesState();
}

function resolveManageSportForPayload() {
    const sel = document.getElementById('manageSportCategory');
    const custom = document.getElementById('manageSportCustom');
    if (!sel) return detectSportLabel('football');
    if (sel.value === 'other') {
        const raw = custom && custom.value ? String(custom.value).trim() : '';
        if (!raw) return '';
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return detectSportLabel(sel.value);
}

function selectManageSportByName(sportName) {
    const sel = document.getElementById('manageSportCategory');
    const custom = document.getElementById('manageSportCustom');
    if (!sel) return;
    const raw = String(sportName || '').trim();
    if (!raw) {
        sel.value = 'football';
        if (custom) custom.value = '';
        syncManageSportCustomVisibility();
        return;
    }
    const norm = raw.toLowerCase().replace(/[_-]+/g, ' ');
    const aliases = {
        football: ['football', 'soccer', 'futbol', 'futsal football', 'mini football', 'hali saha'],
        basketball: ['basketball', 'basket ball'],
        tennis: ['tennis'],
        padel: ['padel', 'paddle', 'padel tennis'],
        futsal: ['futsal'],
        volleyball: ['volleyball', 'voleybol'],
        badminton: ['badminton']
    };
    let canonical = '';
    Object.keys(aliases).some(function (key) {
        const words = aliases[key];
        const matched = words.some(function (w) {
            return norm === w || norm.indexOf(w + ' ') === 0 || norm.indexOf(' ' + w) >= 0;
        });
        if (matched) canonical = key;
        return matched;
    });
    const want = canonical || norm;
    for (let i = 0; i < sel.options.length; i++) {
        const opt = sel.options[i];
        if (opt.value === 'other') continue;
        const optionText = String(opt.text || '')
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, ' ');
        const optionValue = String(opt.value || '').trim().toLowerCase();
        if (optionText === want || optionValue === want) {
            sel.selectedIndex = i;
            if (custom) custom.value = '';
            syncManageSportCustomVisibility();
            return;
        }
    }
    const otherOpt = Array.from(sel.options).find(function (o) {
        return o.value === 'other';
    });
    if (otherOpt) {
        sel.value = 'other';
        if (custom) custom.value = raw;
    }
    syncManageSportCustomVisibility();
}

function collectManageFeatureStrings() {
    const out = [];
    document.querySelectorAll('input[name="manageAmenities"]:checked').forEach(function (cb) {
        const label = cb.nextElementSibling;
        if (label && label.textContent) out.push(label.textContent.trim());
    });
    document.querySelectorAll('input[name="manageFeatures"]:checked').forEach(function (cb) {
        const label = cb.nextElementSibling;
        if (label && label.textContent) out.push(label.textContent.trim());
    });
    document.querySelectorAll('#manageHighlightsList .highlight-item span').forEach(function (span) {
        const t = span.textContent.trim();
        if (t) out.push(t);
    });
    return out;
}

function applyManageFeaturesFromField(features) {
    const arr = Array.isArray(features) ? features : [];
    const normalized = arr.map(function(v) { return String(v || '').trim().toLowerCase(); }).filter(Boolean);

    const known = new Set();
    document.querySelectorAll('input[name="manageAmenities"], input[name="manageFeatures"]').forEach(function(cb) {
        const label = (cb.nextElementSibling && cb.nextElementSibling.textContent ? cb.nextElementSibling.textContent : '').trim();
        const key = label.toLowerCase();
        if (key) known.add(key);
        cb.checked = key ? normalized.indexOf(key) !== -1 : false;
    });

    const highlightsList = document.getElementById('manageHighlightsList');
    if (!highlightsList) {
        syncMutuallyExclusiveManageFeaturesState();
        return;
    }
    highlightsList.innerHTML = '';
    arr.forEach(function(item) {
        const text = String(item || '').trim();
        if (!text || known.has(text.toLowerCase())) return;
        const node = document.createElement('div');
        node.className = 'highlight-item';
        node.innerHTML = '<span>' + text + '</span><button type="button" onclick="removeManageHighlight(this)">&times;</button>';
        highlightsList.appendChild(node);
    });
    syncMutuallyExclusiveManageFeaturesState();
}

function applyManageInfoArraysFromField(field) {
    const amenities = Array.isArray(field && field.amenities) ? field.amenities : [];
    const features = Array.isArray(field && field.features) ? field.features : [];
    const highlights = Array.isArray(field && field.highlights) ? field.highlights : [];
    const combined = amenities.concat(features, highlights);
    applyManageFeaturesFromField(combined);
}

function inferFileNameFromUrl(url, fallback) {
    const value = String(url || '').trim();
    if (!value) return fallback;
    if (value.startsWith('data:')) {
        if (value.includes('pdf')) return fallback.replace(/\.[^.]*$/, '.pdf');
        if (value.includes('png')) return fallback.replace(/\.[^.]*$/, '.png');
        if (value.includes('jpeg') || value.includes('jpg')) return fallback.replace(/\.[^.]*$/, '.jpg');
        return fallback;
    }
    try {
        const clean = value.split('?')[0].split('#')[0];
        const seg = clean.split('/').pop();
        return seg || fallback;
    } catch (_err) {
        return fallback;
    }
}

function setManageDocumentPreview(type, documentUrl) {
    const previewId = type === 'ownership' ? 'manageOwnershipPreview' : 'manageLicensePreview';
    const previewEl = document.getElementById(previewId);
    if (!previewEl) return;

    if (!documentUrl) {
        previewEl.classList.remove('active');
        previewEl.innerHTML = '';
        return;
    }

    const fileName = inferFileNameFromUrl(documentUrl, type === 'ownership' ? 'ownership_document.pdf' : 'license_document.pdf');
    previewEl.classList.add('active');
    previewEl.innerHTML =
        '<div class="file-preview-item">' +
        '<i class="fi fi-rr-file" style="margin-right: 8px;"></i>' +
        '<span>' + fileName + '</span>' +
        '<div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">' +
        '<span style="font-size: 11px; color: #10B981; font-weight: 500;">Uploaded</span>' +
        '<button type="button" onclick="removeManageFile(\'' + type + '\')" title="Remove file">&times;</button>' +
        '</div>' +
        '</div>';
}

function applyManageScheduleFromField(scheduleInput) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const schedule = scheduleInput && typeof scheduleInput === 'object' ? scheduleInput : {};
    days.forEach(function(day) {
        const row = schedule[day] || {};
        const checkbox = document.querySelector('input[name="manageWorkingDays"][value="' + day + '"]');
        const openEl = document.getElementById('manage-' + day + '-opening');
        const closeEl = document.getElementById('manage-' + day + '-closing');
        if (openEl && row.opening) openEl.value = row.opening;
        if (closeEl && row.closing) closeEl.value = row.closing;
        if (checkbox) checkbox.checked = row.enabled !== false;
        toggleManageDaySchedule(day, checkbox ? checkbox.checked : true);
    });
}

/** Load stats + today's bookings + field cards from API (owner-scoped on the server). */
async function loadOwnerDashboard() {
    if (typeof API === 'undefined') return;

    try {
        const [bookingsRes] = await Promise.all([
            API.bookings.getAll({ limit: 200 })
        ]);

        let statsRes = null;
        if (API.owner && API.owner.getStats) {
            try {
                statsRes = await API.owner.getStats();
            } catch (statsErr) {
                console.warn('loadOwnerDashboard: owner/stats failed', statsErr);
            }
        }

        let fieldsRes = { fields: [] };
        if (API.fields && API.fields.getMine) {
            try {
                fieldsRes = await API.fields.getMine();
            } catch (fieldErr) {
                console.warn('loadOwnerDashboard: fields/me failed', fieldErr);
                const grid = document.getElementById('dashboardFieldsGrid');
                if (grid) {
                    grid.innerHTML =
                        '<p style="padding:16px;color:#B45309;font-size:14px;">Could not load fields. Use the server URL <code>http://localhost:3000/...</code>, log in as <strong>OWNER</strong> (seed: <code>owner@matchfield.com</code>), and run <code>npm run db:seed</code> if the database is empty.</p>';
                }
            }
        }

        const fields = (fieldsRes && fieldsRes.fields) ? fieldsRes.fields : [];
        ownerDashboardFieldsById = new Map(fields.map(function(f) {
            return [ownerBookingId(f), f];
        }));

        if (statsRes && statsRes.stats) {
            const s = statsRes.stats;
            const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setVal('statValToday', s.todayBookings != null ? String(s.todayBookings) : '0');
            setVal('statValUpcoming', s.upcomingBookings != null ? String(s.upcomingBookings) : '0');
            // Single source of truth: match "My Fields" page (/fields/me).
            setVal('statValFields', String(fields.length));
            setVal('statValRevenue', formatOwnerTry(s.revenueThisWeek));
            const sub = document.getElementById('statSubRevenue');
            if (sub && typeof s.revenueChangePercent === 'number') {
                const sign = s.revenueChangePercent >= 0 ? '+' : '';
                sub.textContent = sign + s.revenueChangePercent + '% vs last week';
            }
        } else {
            const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setVal('statValFields', String(fields.length));
        }

        const list = (bookingsRes && bookingsRes.bookings) ? bookingsRes.bookings : [];
        const today = new Date();
        const todayBookings = list.filter(function(b) {
            if (!b.date) return false;
            if ((b.status || '').toUpperCase() === 'CANCELLED') return false;
            return isSameLocalCalendarDay(b.date, today);
        });

        bookingsData.today = todayBookings.map(function(b) {
            const field = b.field || {};
            const org = b.organizer || {};
            const start = (b.timeSlotStart || '').toString();
            const end = (b.timeSlotEnd || '').toString();
            return {
                time: start && end ? start + '-' + end : start,
                team: org.fullName || 'Organizer',
                field: field.name || 'Field',
                type: field.sport || '—',
                price: formatOwnerTry(b.totalCost),
                statusRaw: b.status || ''
            };
        });

        updateBookingsTable();

        const grid = document.getElementById('dashboardFieldsGrid');
        if (grid) {
            grid.innerHTML = fields.slice(0, 6).map(function(f) {
                const img = (f.images && f.images[0]) || 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=300&fit=crop';
                const typeTag = f.type === 'INDOOR' ? 'Indoor' : 'Outdoor';
                const rating = f.rating != null ? f.rating : '—';
                const rc = f.reviewCount != null ? f.reviewCount : 0;
                return (
                    '<div class="field-list-card" data-field-name="' + String(f.name || '').replace(/"/g, '&quot;') + '" data-field-id="' + ownerBookingId(f) + '">' +
                    '<div class="field-list-image"><img src="' + img + '" alt=""></div>' +
                    '<div class="field-list-content"><div class="field-list-info">' +
                    '<h3 class="field-list-name">' + (f.name || '') + '</h3>' +
                    '<p class="field-list-location"><i class="fi fi-rr-marker"></i> ' + dashboardLocationLine(f) + '</p>' +
                    '<div class="field-list-rating"><span class="field-star-yellow">★</span> ' +
                    '<span class="field-rating-value">' + rating + '</span> <span class="field-reviews-count">(' + rc + ')</span></div>' +
                    '<div class="field-list-tags">' +
                    '<span class="field-tag">' + typeTag + '</span>' +
                    '<span class="field-tag">' + (f.sport || '') + '</span>' +
                    '</div></div>' +
                    '<div class="field-list-actions">' +
                    '<div class="field-list-price-container">' +
                    '<span class="field-list-price-label">Price</span>' +
                    '<span class="field-list-price">' + formatOwnerTry(f.pricePerHour) + '/h</span>' +
                    '</div>' +
                    '<div class="field-list-buttons">' +
                    '<button type="button" class="manage-btn" onclick="openModal(\'' + ownerBookingId(f) + '\')">Manage</button>' +
                    '<button type="button" class="action-btn" onclick="viewFieldDetails(this)" title="View"><i class="fi fi-rr-eye"></i></button>' +
                    '</div></div></div></div>'
                );
            }).join('');
            if (fields.length === 0) {
                grid.innerHTML = '<p style="padding:16px;color:#6B7280;">No fields yet. Use <strong>Add new field</strong> to create one.</p>';
            }
        }
    } catch (e) {
        console.error('loadOwnerDashboard failed', e);
    }
}

const bookingsData = { today: [], week: [] };

// DOM Elements
const notificationPopup = document.getElementById('notificationPopup');
const profileBtn = document.getElementById('profileBtn');
const profilePopup = document.getElementById('profilePopup');
const bookingsTableBody = document.getElementById('bookingsTableBody');
const addFieldBtn = document.getElementById('addFieldBtn');
const manageBtns = document.querySelectorAll('.manage-btn');

// Notification bell: scripts/player/notifications.js (loads API list). Do not toggle here — double handlers cancel the popup.

// Profile Popup Toggle
if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePopup.classList.toggle('active');
        // Close notification popup if open
        if (notificationPopup) {
            notificationPopup.classList.remove('active');
        }
    });
}

// Close profile when clicking outside (notification panel is handled by notifications.js)
document.addEventListener('click', (e) => {
    if (profilePopup && profileBtn && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

// Update Bookings Table — today's rows from bookingsData.today (filled by loadOwnerDashboard)
function updateBookingsTable() {
    if (!bookingsTableBody) return;

    const bookings = bookingsData.today;
    bookingsTableBody.innerHTML = '';

    if (!bookings.length) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="color:#6B7280;padding:16px;">No bookings on your fields today.</td>';
        bookingsTableBody.appendChild(row);
        return;
    }

    bookings.forEach(function(booking) {
        const row = document.createElement('tr');
        const raw = booking.statusRaw || booking.status || '';
        const statusClass = ownerStatusBadgeClass(raw);
        const statusText = ownerStatusLabel(raw);

        row.innerHTML =
            '<td>' + (booking.time || '') + '</td>' +
            '<td>' + (booking.team || '') + '</td>' +
            '<td>' + (booking.field || '') + '</td>' +
            '<td>' + (booking.type || '') + '</td>' +
            '<td>' + (booking.price || '') + '</td>' +
            '<td><span class="badge ' + statusClass + '">' + statusText + '</span></td>';
        bookingsTableBody.appendChild(row);
    });
}

// Add Field Button Handler
const addFieldModal = document.getElementById('addFieldModal');
let currentStep = 1;
const totalSteps = 8;
let fieldImages = [];
let unavailableDates = [];

if (addFieldBtn && addFieldModal) {
    addFieldBtn.addEventListener('click', () => {
        openAddFieldModal();
    });
}

// Update greeting — same idea as player header: use API.getCurrentUser().fullName
function updateGreeting() {
    const greetingElement = document.getElementById('ownerGreeting');
    if (!greetingElement) return;

    const hour = new Date().getHours();
    let timeGreeting = 'Good evening';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';

    var name = 'Field owner';
    if (typeof API !== 'undefined' && API.getCurrentUser) {
        const u = API.getCurrentUser();
        if (u && u.fullName) name = u.fullName;
    }
    greetingElement.textContent = timeGreeting + ', ' + name + ' 👋';
}

document.addEventListener('DOMContentLoaded', function() {
    updateGreeting();
    if (typeof API !== 'undefined' && API.owner && API.owner.getStats) {
        loadOwnerDashboard();
    } else if (bookingsTableBody) {
        updateBookingsTable();
    }
});

// Format currency helper
function formatCurrency(amount) {
    return `₺${amount.toLocaleString('tr-TR')}`;
}

// Export functions for use in other scripts if needed
window.dashboardUtils = {
    updateBookingsTable,
    formatCurrency
};

// Modal Functions
const editFieldModal = document.getElementById('editFieldModal');
const viewFieldModal = document.getElementById('viewFieldModal');

// Open Edit Field Modal
function openModal(fieldId) {
    if (editFieldModal) {
        editFieldModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        editFieldModal.dataset.fieldId = fieldId ? String(fieldId) : '';
        
        // Show menu, hide sections
        showManageMenu();
        
        // If fieldId is provided, load field data
        if (fieldId) {
            loadFieldData(fieldId);
        }
    }
}

// Close Edit Field Modal
function closeModal() {
    if (editFieldModal) {
        editFieldModal.classList.remove('active');
        document.body.style.overflow = '';
        editFieldModal.dataset.fieldId = '';
        // Reset to menu view
        showManageMenu();
        if (manageFieldMapPicker && typeof manageFieldMapPicker.destroy === 'function') {
            manageFieldMapPicker.destroy();
            manageFieldMapPicker = null;
        }
    }
}

// Show manage menu
function showManageMenu() {
    const optionsContainer = document.querySelector('.manage-options-container');
    const sectionsContainer = document.querySelector('.manage-sections-container');
    const manageBackBtn = document.getElementById('manageBackBtn');
    const manageSubmitBtn = document.getElementById('manageSubmitBtn');
    
    if (optionsContainer) optionsContainer.style.display = 'flex';
    if (sectionsContainer) {
        sectionsContainer.classList.remove('active');
        sectionsContainer.style.display = 'none';
    }
    if (manageBackBtn) manageBackBtn.style.display = 'none';
    if (manageSubmitBtn) manageSubmitBtn.style.display = 'none';
    
    // Remove active class from all option buttons
    document.querySelectorAll('.manage-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Hide all sections
    document.querySelectorAll('.manage-section').forEach(section => {
        section.classList.remove('active');
    });
    
    currentManageSection = null;
}

// Back to menu
function backToManageMenu() {
    showManageMenu();
}

// Open manage section
let currentManageSection = null;

function openManageSection(sectionName) {
    const optionsContainer = document.querySelector('.manage-options-container');
    const sectionsContainer = document.querySelector('.manage-sections-container');
    const manageBackBtn = document.getElementById('manageBackBtn');
    const manageSubmitBtn = document.getElementById('manageSubmitBtn');
    const section = document.getElementById(`${sectionName}-section`);
    
    // Hide menu, show sections container
    if (optionsContainer) optionsContainer.style.display = 'none';
    if (sectionsContainer) {
        sectionsContainer.style.display = 'block';
        sectionsContainer.classList.add('active');
    }
    if (manageBackBtn) manageBackBtn.style.display = 'inline-block';
    if (manageSubmitBtn) manageSubmitBtn.style.display = 'inline-block';
    
    // Remove active from all options and sections
    document.querySelectorAll('.manage-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.manage-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    // Activate clicked option and section
    const clickedBtn = document.querySelector(`[onclick="openManageSection('${sectionName}')"]`);
    if (clickedBtn) clickedBtn.classList.add('active');
    if (section) {
        section.classList.add('active');
        currentManageSection = sectionName;
    }
    
    // Initialize section-specific features
    if (sectionName === 'schedule') {
        initializeManageDaySchedules();
    } else if (sectionName === 'location') {
        initializeManageMap();
        if (manageFieldMapPicker && typeof manageFieldMapPicker.invalidateSize === 'function') {
            setTimeout(function () { manageFieldMapPicker.invalidateSize(); }, 60);
        }
    } else if (sectionName === 'edit-info') {
        syncManageSportCustomVisibility();
        syncMutuallyExclusiveManageFeaturesState();
    }
}

// Load field data into modal
async function loadFieldData(fieldId) {
    let f = ownerDashboardFieldsById.get(String(fieldId));
    try {
        if (typeof API !== 'undefined' && API.fields && API.fields.getById) {
            const res = await API.fields.getById(fieldId);
            if (res && res.field) f = res.field;
        }
    } catch (err) {
        console.warn('dashboard loadFieldData getById failed, using cached field', err);
    }
    if (!f) return;

    setFieldStatusBadgeFromField(f);

    const nameEl = document.getElementById('manageFieldName');
    if (nameEl) nameEl.value = f.name || '';

    selectManageSportByName(f.sport || 'Football');

    const typeEl = document.getElementById('manageFieldType');
    if (typeEl) {
        const t = String(f.type || '').toUpperCase();
        typeEl.value = t === 'INDOOR' ? 'Indoor' : 'Outdoor';
    }

    const capacityEl = document.getElementById('manageCapacity');
    if (capacityEl) {
        capacityEl.value = f.capacity != null ? String(f.capacity) : '';
    }

    const descEl = document.getElementById('manageDescription');
    if (descEl) descEl.value = f.description || '';

    const pphEl = document.getElementById('managePricePerHour');
    if (pphEl) pphEl.value = f.pricePerHour != null ? String(f.pricePerHour) : '';

    const addressEl = document.getElementById('manageFieldAddress');
    if (addressEl) addressEl.value = f.address || f.location || '';

    const cityEl = document.getElementById('manageFieldCity');
    if (cityEl) cityEl.value = f.city || '';

    const districtEl = document.getElementById('manageFieldDistrict');
    if (districtEl) districtEl.value = f.district || '';

    const latEl = document.getElementById('manageLatitude');
    if (latEl) latEl.textContent = f.latitude != null ? String(f.latitude) : '-';

    const lngEl = document.getElementById('manageLongitude');
    if (lngEl) lngEl.textContent = f.longitude != null ? String(f.longitude) : '-';
    initializeManageMap();
    if (manageFieldMapPicker && Number.isFinite(Number(f.latitude)) && Number.isFinite(Number(f.longitude))) {
        const latN = Number(f.latitude);
        const lngN = Number(f.longitude);
        lastValidManageFieldMapPosition = { lat: latN, lng: lngN };
        manageFieldMapPicker.setPosition(latN, lngN, 'init', { silent: true });
    }

    const visibilityToggle = document.getElementById('manageVisibilityToggle');
    if (visibilityToggle) visibilityToggle.classList.toggle('active', f.isActive !== false);

    applyManageInfoArraysFromField(f);
    applyManageScheduleFromField(f.schedule || f.workingSchedule || {});

    const datesList = document.getElementById('manageUnavailableDatesList');
    if (datesList) datesList.innerHTML = '';

    const imagesContainer = document.querySelector('#edit-info-section .images-container');
    if (imagesContainer) {
        imagesContainer.querySelectorAll('.image-preview').forEach(function(node) { node.remove(); });
        const addBtn = imagesContainer.querySelector('.add-image-btn');
        const images = Array.isArray(f.images) ? f.images : [];
        images.forEach(function(src) {
            if (!src) return;
            const imagePreview = document.createElement('div');
            imagePreview.className = 'image-preview';
            imagePreview.innerHTML = '<img src="' + src + '" alt="Field"><button class="remove-image" onclick="removeImage(this)">&times;</button>';
            if (addBtn) imagesContainer.insertBefore(imagePreview, addBtn);
            else imagesContainer.appendChild(imagePreview);
        });
    }

    setManageDocumentPreview('ownership', f.ownershipDocumentUrl || '');
    setManageDocumentPreview('license', f.licensesDocumentUrl || f.licenseDocumentUrl || '');
}

// View Field Details
async function viewFieldDetails(button) {
    try {
        const fieldCard = button.closest('.field-list-card');
        const fieldId = fieldCard ? fieldCard.getAttribute('data-field-id') : '';
        if (!fieldId) return;
        if (typeof openViewFieldModalForFieldId === 'function') {
            await openViewFieldModalForFieldId(fieldId);
        }
    } catch (error) {
        console.error('Error opening view field modal:', error);
    }
}

function closeViewModal() {
    if (viewFieldModal) {
        viewFieldModal.classList.remove('active');
        document.body.style.overflow = '';
        // Reset reviews list to hidden
        const reviewsList = document.getElementById('viewReviewsList');
        const toggleBtn = document.getElementById('viewToggleReviewsBtn');
        if (reviewsList) reviewsList.style.display = 'none';
        if (toggleBtn) {
            toggleBtn.classList.remove('expanded');
            const toggleText = toggleBtn.querySelector('.view-toggle-text');
            if (toggleText) toggleText.textContent = 'View reviews';
        }
    }
}

function toggleViewReviews() {
    const reviewsList = document.getElementById('viewReviewsList');
    const toggleBtn = document.getElementById('viewToggleReviewsBtn');
    
    if (reviewsList && toggleBtn) {
        const isHidden = reviewsList.style.display === 'none' || !reviewsList.style.display;
        
        if (isHidden) {
            reviewsList.style.display = 'flex';
            toggleBtn.classList.add('expanded');
            const toggleText = toggleBtn.querySelector('.view-toggle-text');
            if (toggleText) toggleText.textContent = 'Hide reviews';
        } else {
            reviewsList.style.display = 'none';
            toggleBtn.classList.remove('expanded');
            const toggleText = toggleBtn.querySelector('.view-toggle-text');
            if (toggleText) toggleText.textContent = 'View reviews';
        }
    }
}

// Close modals when clicking outside
if (editFieldModal) {
    editFieldModal.addEventListener('click', (e) => {
        if (e.target === editFieldModal) {
            closeModal();
        }
    });
}

if (viewFieldModal) {
    viewFieldModal.addEventListener('click', (e) => {
        if (e.target === viewFieldModal) {
            closeViewModal();
        }
    });
}

// Add Field Modal Functions
function openAddFieldModal() {
    if (addFieldModal) {
        addFieldModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        currentStep = 1;
        showStep(1);
        resetAddFieldForm();
    }
}

function closeAddFieldModal() {
    if (addFieldModal) {
        addFieldModal.classList.remove('active');
        document.body.style.overflow = '';
        if (addFieldMapPicker && typeof addFieldMapPicker.destroy === 'function') {
            addFieldMapPicker.destroy();
            addFieldMapPicker = null;
        }
    }
}

// Reset form
function resetAddFieldForm() {
    fieldImages = [];
    unavailableDates = [];
    const form = document.getElementById('addFieldForm');
    if (form) form.reset();
    const imagesGrid = document.getElementById('fieldImagesGrid');
    const unavailableDatesList = document.getElementById('unavailableDatesList');
    if (imagesGrid) imagesGrid.innerHTML = '';
    if (unavailableDatesList) unavailableDatesList.innerHTML = '';
    lastValidAddFieldMapPosition = { lat: 41.0082, lng: 28.9784 };
    const latEl = document.getElementById('latitude');
    const lngEl = document.getElementById('longitude');
    if (latEl) latEl.textContent = '-';
    if (lngEl) lngEl.textContent = '-';
    if (addFieldMapPicker && typeof addFieldMapPicker.destroy === 'function') {
        addFieldMapPicker.destroy();
        addFieldMapPicker = null;
    }
    updateStepButtons();
    // Reinitialize day schedules after reset
    setTimeout(() => {
        initializeDaySchedules();
        updateRadioLabels();
        initializeAddFieldMap();
        syncFieldTypeCustomVisibility();
        syncMutuallyExclusiveFieldFeaturesState();
    }, 100);
}

// Show specific step
function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(stepEl => {
        stepEl.classList.remove('active');
    });
    
    // Show current step
    const currentStepEl = document.querySelector(`.form-step[data-step="${step}"]`);
    if (currentStepEl) {
        currentStepEl.classList.add('active');
    }
    
    // Update progress indicators
    document.querySelectorAll('.progress-step').forEach((stepEl, index) => {
        const stepNum = index + 1;
        stepEl.classList.remove('active', 'completed');
        if (stepNum === step) {
            stepEl.classList.add('active');
        } else if (stepNum < step) {
            stepEl.classList.add('completed');
        }
    });
    
    currentStep = step;
    updateStepButtons();
    if (step === 5) {
        initializeAddFieldMap();
        if (addFieldMapPicker && typeof addFieldMapPicker.invalidateSize === 'function') {
            setTimeout(function () { addFieldMapPicker.invalidateSize(); }, 60);
        }
    }
}

// Update step navigation buttons
function updateStepButtons() {
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    if (prevBtn) {
        prevBtn.style.display = currentStep > 1 ? 'inline-block' : 'none';
    }
    
    if (nextBtn && submitBtn) {
        if (currentStep === totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'inline-block';
            submitBtn.style.display = 'none';
        }
    }
}

// Next step
function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < totalSteps) {
            showStep(currentStep + 1);
        }
    }
}

// Previous step
function previousStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

// Validate current step
function validateCurrentStep() {
    const currentStepEl = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    if (!currentStepEl) return true;
    
    const requiredFields = currentStepEl.querySelectorAll('[required]');
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = '#DC2626';
            
            // Remove error style on input
            field.addEventListener('input', function() {
                this.style.borderColor = '#D1D5DB';
            }, { once: true });
        }
    });
    
    // Step-specific validation
    if (currentStep === 1) {
        const ownershipDoc = document.getElementById('ownershipDoc');
        if (ownershipDoc && !ownershipDoc.files.length) {
            alert('Please upload ownership or rental agreement document');
            isValid = false;
        }
    } else if (currentStep === 2) {
        const fieldTypeEl = document.getElementById('fieldType');
        const customSport = document.getElementById('fieldSportCustom');
        if (fieldTypeEl && fieldTypeEl.value === 'other') {
            const custom = customSport ? customSport.value.trim() : '';
            if (!custom) {
                alert('Please enter the sport name for "Other".');
                isValid = false;
                if (customSport) {
                    customSport.style.borderColor = '#DC2626';
                    customSport.addEventListener('input', function onIn() {
                        this.style.borderColor = '#D1D5DB';
                        this.removeEventListener('input', onIn);
                    });
                }
            }
        }
    } else if (currentStep === 4) {
        if (fieldImages.length === 0) {
            alert('Please upload at least one field image');
            isValid = false;
        }
    } else if (currentStep === 5) {
        const latitude = parseFloat(document.getElementById('latitude')?.textContent || '');
        const longitude = parseFloat(document.getElementById('longitude')?.textContent || '');
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            alert('Please select location on the map');
            isValid = false;
        }
    } else if (currentStep === 7) {
        // Validate that at least one day is selected
        const checkedDays = document.querySelectorAll('input[name="workingDays"]:checked');
        if (checkedDays.length === 0) {
            alert('Please select at least one working day');
            isValid = false;
        } else {
            // Validate that all checked days have valid times
            checkedDays.forEach(checkbox => {
                const day = checkbox.value;
                const opening = document.getElementById(`${day}-opening`);
                const closing = document.getElementById(`${day}-closing`);
                if (opening && closing) {
                    if (!opening.value || !closing.value) {
                        alert(`Please set opening and closing times for ${day}`);
                        isValid = false;
                    } else if (opening.value >= closing.value) {
                        alert(`Closing time must be after opening time for ${day}`);
                        isValid = false;
                    }
                }
            });
        }
    }
    
    return isValid;
}

// Add highlight
// Handle field images upload
function handleFieldImagesUpload(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
        if (file.type.startsWith('image/') && fieldImages.length < 10) {
            const reader = new FileReader();
            reader.onload = (e) => {
                fieldImages.push({
                    file: file,
                    url: e.target.result
                });
                renderFieldImages();
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Reset input
    event.target.value = '';
}

// Render field images
function renderFieldImages() {
    const container = document.getElementById('fieldImagesGrid');
    if (!container) return;
    container.innerHTML = fieldImages.map((image, index) => `
        <div class="image-preview-item">
            <img src="${image.url}" alt="Field image ${index + 1}">
            <button type="button" class="remove-image-btn" onclick="removeFieldImage(${index})">&times;</button>
        </div>
    `).join('');
}

// Remove field image
function removeFieldImage(index) {
    fieldImages.splice(index, 1);
    renderFieldImages();
}

function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
        if (!file) {
            resolve('');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            resolve((e && e.target && e.target.result) || '');
        };
        reader.onerror = function () {
            reject(new Error('Failed to read file.'));
        };
        reader.readAsDataURL(file);
    });
}

function collectAddFieldScheduleFromDom() {
    return {
        monday: {
            enabled: document.querySelector('input[name="workingDays"][value="monday"]')?.checked || false,
            opening: document.getElementById('monday-opening')?.value || null,
            closing: document.getElementById('monday-closing')?.value || null
        },
        tuesday: {
            enabled: document.querySelector('input[name="workingDays"][value="tuesday"]')?.checked || false,
            opening: document.getElementById('tuesday-opening')?.value || null,
            closing: document.getElementById('tuesday-closing')?.value || null
        },
        wednesday: {
            enabled: document.querySelector('input[name="workingDays"][value="wednesday"]')?.checked || false,
            opening: document.getElementById('wednesday-opening')?.value || null,
            closing: document.getElementById('wednesday-closing')?.value || null
        },
        thursday: {
            enabled: document.querySelector('input[name="workingDays"][value="thursday"]')?.checked || false,
            opening: document.getElementById('thursday-opening')?.value || null,
            closing: document.getElementById('thursday-closing')?.value || null
        },
        friday: {
            enabled: document.querySelector('input[name="workingDays"][value="friday"]')?.checked || false,
            opening: document.getElementById('friday-opening')?.value || null,
            closing: document.getElementById('friday-closing')?.value || null
        },
        saturday: {
            enabled: document.querySelector('input[name="workingDays"][value="saturday"]')?.checked || false,
            opening: document.getElementById('saturday-opening')?.value || null,
            closing: document.getElementById('saturday-closing')?.value || null
        },
        sunday: {
            enabled: document.querySelector('input[name="workingDays"][value="sunday"]')?.checked || false,
            opening: document.getElementById('sunday-opening')?.value || null,
            closing: document.getElementById('sunday-closing')?.value || null
        }
    };
}

// Toggle day schedule (enable/disable time inputs)
function toggleDaySchedule(day, enabled) {
    const openingInput = document.getElementById(`${day}-opening`);
    const closingInput = document.getElementById(`${day}-closing`);
    const dayRow = openingInput ? openingInput.closest('.schedule-day-row') : null;
    
    if (openingInput && closingInput) {
        if (enabled) {
            openingInput.disabled = false;
            closingInput.disabled = false;
            openingInput.required = true;
            closingInput.required = true;
            if (dayRow) dayRow.classList.remove('disabled');
        } else {
            openingInput.disabled = true;
            closingInput.disabled = true;
            openingInput.required = false;
            closingInput.required = false;
            if (dayRow) dayRow.classList.add('disabled');
        }
    }
}

// Initialize day schedules on page load
function initializeDaySchedules() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
        const checkbox = document.querySelector(`input[name="workingDays"][value="${day}"]`);
        if (checkbox) {
            toggleDaySchedule(day, checkbox.checked);
        }
    });
}

// Add unavailable date
function addUnavailableDate() {
    const input = document.getElementById('unavailableDateInput');
    const date = input ? input.value : '';
    
    if (date && !unavailableDates.includes(date)) {
        unavailableDates.push(date);
        renderUnavailableDates();
        if (input) input.value = '';
    }
}

// Remove unavailable date
function removeUnavailableDate(index) {
    unavailableDates.splice(index, 1);
    renderUnavailableDates();
}

// Render unavailable dates
function renderUnavailableDates() {
    const container = document.getElementById('unavailableDatesList');
    if (!container) return;
    container.innerHTML = unavailableDates.map((date, index) => {
        const formattedDate = new Date(date).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        return `
            <div class="date-tag">
                <span>${formattedDate}</span>
                <button type="button" onclick="removeUnavailableDate(${index})">&times;</button>
            </div>
        `;
    }).join('');
}

function applyCoordinatesToDom(lat, lng, mode) {
    const latId = mode === 'manage' ? 'manageLatitude' : 'latitude';
    const lngId = mode === 'manage' ? 'manageLongitude' : 'longitude';
    const latEl = document.getElementById(latId);
    const lngEl = document.getElementById(lngId);
    if (latEl) latEl.textContent = Number(lat).toFixed(6);
    if (lngEl) lngEl.textContent = Number(lng).toFixed(6);
}

function getAddressFieldIds(mode) {
    if (mode === 'manage') {
        return { addressId: 'manageFieldAddress', cityId: 'manageFieldCity', districtId: 'manageFieldDistrict' };
    }
    return { addressId: 'fieldAddress', cityId: 'fieldCity', districtId: 'fieldDistrict' };
}

async function applyReverseGeocodedMetadata(lat, lng, mode) {
    if (typeof GeocodingService === 'undefined' || !GeocodingService.reverseGeocode) return true;
    try {
        const meta = await GeocodingService.reverseGeocode(lat, lng);
        if (!meta) return true;
        if (meta.isUnbuildableWater) {
            const reason = meta.invalidPinReason;
            const msg =
                reason === 'drift'
                    ? 'This pin is not on land (for example open sea). Move it onto land until the address matches the pin — try near a street, district, or venue.'
                    : 'That location is on open water. Place the pin on land (e.g. a street or sports ground).';
            const title = reason === 'drift' ? 'Pin not on land' : 'Open water';
            if (typeof MatchFieldDialog !== 'undefined' && MatchFieldDialog.alert) {
                await MatchFieldDialog.alert(msg, { title: title, type: 'warning', okText: 'OK' });
            } else {
                alert(msg);
            }
            return false;
        }
        const ids = getAddressFieldIds(mode);
        const addressInput = document.getElementById(ids.addressId);
        const cityInput = document.getElementById(ids.cityId);
        const districtInput = document.getElementById(ids.districtId);
        if (addressInput && meta.address) addressInput.value = meta.address;
        if (cityInput && meta.city) cityInput.value = meta.city;
        if (districtInput && meta.district) districtInput.value = meta.district;
        return true;
    } catch (_e) {
        return true;
    }
}

async function geocodeAddressAndSetMarker(mode) {
    if (typeof GeocodingService === 'undefined' || !GeocodingService.geocodeAddress) return;
    const ids = getAddressFieldIds(mode);
    const addressInput = document.getElementById(ids.addressId);
    if (!addressInput || !addressInput.value.trim()) return;
    try {
        const result = await GeocodingService.geocodeAddress(addressInput.value.trim());
        if (!result) return;
        const picker = mode === 'manage' ? manageFieldMapPicker : addFieldMapPicker;
        if (!picker) return;
        picker.setPosition(result.lat, result.lng, 'search');
    } catch (_e) {}
}

function bindAddressSearch(mode) {
    const ids = getAddressFieldIds(mode);
    const addressInput = document.getElementById(ids.addressId);
    if (!addressInput || addressInput.dataset.geocodeBound === '1') return;
    addressInput.dataset.geocodeBound = '1';
    addressInput.addEventListener('change', function () { geocodeAddressAndSetMarker(mode); });
    addressInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            geocodeAddressAndSetMarker(mode);
        }
    });
}

function initializeAddFieldMap() {
    if (addFieldMapPicker || typeof MapPickerService === 'undefined') return;
    addFieldMapPicker = MapPickerService.create({
        containerId: 'locationMap',
        initialCenter: [41.0082, 28.9784],
        initialZoom: 12,
        draggable: true,
        onPositionChange: async function(position, source) {
            if (source === 'revert') return;
            const ok = await applyReverseGeocodedMetadata(position.lat, position.lng, 'add');
            if (!ok) {
                const prev = lastValidAddFieldMapPosition;
                if (addFieldMapPicker && prev) {
                    addFieldMapPicker.setPosition(prev.lat, prev.lng, 'revert', { silent: true });
                    applyCoordinatesToDom(prev.lat, prev.lng, 'add');
                }
                return;
            }
            lastValidAddFieldMapPosition = { lat: position.lat, lng: position.lng };
            applyCoordinatesToDom(position.lat, position.lng, 'add');
        }
    });
    bindAddressSearch('add');
}

// Toggle field visibility
function toggleFieldVisibility() {
    const toggle = document.getElementById('fieldVisibilityToggle');
    if (toggle) {
        toggle.classList.toggle('active');
    }
}

// Submit field form
async function submitFieldForm() {
    if (!validateCurrentStep()) {
        return;
    }
    if (typeof API === 'undefined' || !API.fields || !API.fields.create) {
        alert('API not available.');
        return;
    }

    const latNum = parseFloat(document.getElementById('latitude')?.textContent || '');
    const lngNum = parseFloat(document.getElementById('longitude')?.textContent || '');
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        alert('Please select a valid map location before saving.');
        return;
    }

    const city = (document.getElementById('fieldCity')?.value || '').trim();
    const district = (document.getElementById('fieldDistrict')?.value || '').trim();
    const address = (document.getElementById('fieldAddress')?.value || '').trim();
    const locationLine = [city, district].filter(Boolean).join(', ') || address || '—';
    const sport = resolveAddFieldSportForPayload();
    if (!sport) {
        alert('Please enter the sport name for "Other".');
        return;
    }
    const isIndoor = !!document.querySelector('input[name="features"][value="indoor"]:checked') &&
      !document.querySelector('input[name="features"][value="outdoor"]:checked');

    const payload = {
        name: (document.getElementById('fieldName')?.value || '').trim() || 'Field',
        sport: sport,
        description: document.getElementById('fieldDescription')?.value || '',
        capacity: parseInt(document.getElementById('capacity')?.value || '', 10) || null,
        type: isIndoor ? 'INDOOR' : 'OUTDOOR',
        location: locationLine,
        address: address || undefined,
        city: city || undefined,
        district: district || undefined,
        pricePerHour: Math.round(parseFloat(document.getElementById('pricePerHour')?.value || '0') || 0),
        amenities: Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : cb.value).filter(Boolean),
        features: Array.from(document.querySelectorAll('input[name="features"]:checked')).map(cb => cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : cb.value).filter(Boolean),
        highlights: [],
        images: fieldImages.map(function(img) { return img && img.url ? img.url : ''; }).filter(Boolean),
        schedule: collectAddFieldScheduleFromDom(),
        bookingType: document.querySelector('input[name="bookingType"]:checked')?.value || 'instant',
        visibilityRequested: !!document.getElementById('fieldVisibilityToggle')?.classList.contains('active'),
        latitude: latNum,
        longitude: lngNum
    };

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }

    try {
        const ownFile = document.getElementById('ownershipDoc')?.files?.[0];
        const licFile = document.getElementById('licensesDoc')?.files?.[0];
        const ownershipDataUrl = await fileToDataUrl(ownFile);
        const licenseDataUrl = await fileToDataUrl(licFile);
        if (ownershipDataUrl) payload.ownershipDocumentUrl = ownershipDataUrl;
        if (licenseDataUrl) payload.licensesDocumentUrl = licenseDataUrl;

        const res = await API.fields.create(payload);
        const fieldId = res && res.field && res.field.id;
        if (fieldId && Array.isArray(unavailableDates) && unavailableDates.length && API.fields.addUnavailableDate) {
            for (let i = 0; i < unavailableDates.length; i++) {
                try { await API.fields.addUnavailableDate(fieldId, unavailableDates[i]); } catch (_e) {}
            }
        }
        alert('Field submitted successfully!');
        closeAddFieldModal();
        await loadOwnerDashboard();
    } catch (err) {
        alert((err && err.message) || 'Could not create field.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit for Approval';
        }
    }
}

// Close add field modal when clicking outside
if (addFieldModal) {
    addFieldModal.addEventListener('click', (e) => {
        if (e.target === addFieldModal) {
            closeAddFieldModal();
        }
    });
}

// File upload preview handlers
document.addEventListener('DOMContentLoaded', () => {
    const ownershipDocInput = document.getElementById('ownershipDoc');
    const licensesDocInput = document.getElementById('licensesDoc');
    
    if (ownershipDocInput) {
        ownershipDocInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const preview = document.getElementById('ownershipDocPreview');
                if (preview) {
                    preview.innerHTML = `
                        <div class="file-preview-item">
                            <span>${file.name}</span>
                            <button type="button" onclick="document.getElementById('ownershipDoc').value = ''; document.getElementById('ownershipDocPreview').innerHTML = ''; document.getElementById('ownershipDocPreview').classList.remove('active');">&times;</button>
                        </div>
                    `;
                    preview.classList.add('active');
                }
            }
        });
    }
    
    if (licensesDocInput) {
        licensesDocInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const preview = document.getElementById('licensesDocPreview');
                if (preview) {
                    preview.innerHTML = `
                        <div class="file-preview-item">
                            <span>${file.name}</span>
                            <button type="button" onclick="document.getElementById('licensesDoc').value = ''; document.getElementById('licensesDocPreview').innerHTML = ''; document.getElementById('licensesDocPreview').classList.remove('active');">&times;</button>
                        </div>
                    `;
                    preview.classList.add('active');
                }
            }
        });
    }
    
    initializeAddFieldMap();
    
    // Initialize day schedules
    initializeDaySchedules();
    // Update radio labels styling
    updateRadioLabels();
    initAddFieldFormEnhancements();
    initManageFieldFormEnhancements();
});

// Update radio label styling on change
function updateRadioLabels() {
    document.querySelectorAll('.radio-label input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const label = this.closest('.radio-label');
            const allLabels = document.querySelectorAll('.radio-label');
            allLabels.forEach(l => {
                l.style.borderColor = '#E5E7EB';
                l.style.background = 'white';
                l.style.boxShadow = 'none';
            });
            if (this.checked && label) {
                label.style.borderColor = '#007BFF';
                label.style.background = '#EFF6FF';
                label.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
            }
        });
        
        // Set initial state
        if (radio.checked) {
            const label = radio.closest('.radio-label');
            if (label) {
                label.style.borderColor = '#007BFF';
                label.style.background = '#EFF6FF';
                label.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.1)';
            }
        }
    });
}

// Manage Modal Helper Functions
function toggleManageDaySchedule(day, enabled) {
    const openingInput = document.getElementById(`manage-${day}-opening`);
    const closingInput = document.getElementById(`manage-${day}-closing`);
    const row = openingInput?.closest('.schedule-day-row');
    
    if (openingInput && closingInput && row) {
        if (enabled) {
            openingInput.required = true;
            closingInput.required = true;
            row.classList.remove('disabled');
            openingInput.disabled = false;
            closingInput.disabled = false;
        } else {
            openingInput.required = false;
            closingInput.required = false;
            row.classList.add('disabled');
            openingInput.disabled = true;
            closingInput.disabled = true;
        }
    }
}

function initializeManageDaySchedules() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
        const checkbox = document.querySelector(`input[name="manageWorkingDays"][value="${day}"]`);
        if (checkbox) {
            toggleManageDaySchedule(day, checkbox.checked);
        }
    });
}

function addManageHighlight() {
    const input = document.getElementById('manageHighlightInput');
    const highlightsList = document.getElementById('manageHighlightsList');
    
    if (!input || !highlightsList) return;
    
    const highlight = input.value.trim();
    if (highlight) {
        const highlightItem = document.createElement('div');
        highlightItem.className = 'highlight-item';
        highlightItem.innerHTML = `
            <span>${highlight}</span>
            <button type="button" onclick="removeManageHighlight(this)">&times;</button>
        `;
        highlightsList.appendChild(highlightItem);
        input.value = '';
    }
}

function removeManageHighlight(button) {
    button.parentElement.remove();
}

function addManageUnavailableDate() {
    const input = document.getElementById('manageUnavailableDateInput');
    const datesList = document.getElementById('manageUnavailableDatesList');
    
    if (!input || !datesList) return;
    
    const date = input.value;
    if (date) {
        const dateItem = document.createElement('div');
        dateItem.className = 'date-item';
        dateItem.innerHTML = `
            <span>${new Date(date).toLocaleDateString()}</span>
            <button type="button" onclick="removeManageUnavailableDate(this)">&times;</button>
        `;
        datesList.appendChild(dateItem);
        input.value = '';
    }
}

function removeManageUnavailableDate(button) {
    button.parentElement.remove();
}

function handleManageImageUpload(event) {
    const files = Array.from(event.target.files);
    const container = document.querySelector('#edit-info-section .images-container');
    
    if (!container) return;
    
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imagePreview = document.createElement('div');
                imagePreview.className = 'image-preview';
                imagePreview.innerHTML = `
                    <img src="${e.target.result}" alt="Field">
                    <button class="remove-image" onclick="removeImage(this)">&times;</button>
                `;
                const addImageBtn = container.querySelector('.add-image-btn');
                if (addImageBtn) {
                    container.insertBefore(imagePreview, addImageBtn);
                } else {
                    container.appendChild(imagePreview);
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

function initializeManageMap() {
    if (manageFieldMapPicker || typeof MapPickerService === 'undefined') return;
    manageFieldMapPicker = MapPickerService.create({
        containerId: 'manageLocationMap',
        initialCenter: [41.0082, 28.9784],
        initialZoom: 12,
        draggable: true,
        onPositionChange: async function(position, source) {
            if (source === 'revert') return;
            const ok = await applyReverseGeocodedMetadata(position.lat, position.lng, 'manage');
            if (!ok) {
                const prev = lastValidManageFieldMapPosition;
                if (manageFieldMapPicker && prev) {
                    manageFieldMapPicker.setPosition(prev.lat, prev.lng, 'revert', { silent: true });
                    applyCoordinatesToDom(prev.lat, prev.lng, 'manage');
                }
                return;
            }
            lastValidManageFieldMapPosition = { lat: position.lat, lng: position.lng };
            applyCoordinatesToDom(position.lat, position.lng, 'manage');
        }
    });
    bindAddressSearch('manage');
}

function toggleManageSetting(setting) {
    const toggle = document.getElementById(`manage${setting.charAt(0).toUpperCase() + setting.slice(1)}Toggle`);
    if (toggle) {
        toggle.classList.toggle('active');
    }
}

function toggleManageFieldVisibility() {
    toggleManageSetting('Visibility');
}

function removeManageFile(type) {
    const previewId = type === 'ownership' ? 'manageOwnershipPreview' : 'manageLicensePreview';
    const filePreview = document.getElementById(previewId);
    if (filePreview) {
        filePreview.classList.remove('active');
        const fileItem = filePreview.querySelector('.file-preview-item');
        if (fileItem) {
            fileItem.remove();
        }
    }
}

function handleManageDocumentUpload(type, input) {
    const file = input.files[0];
    if (!file) return;
    
    const previewId = type === 'ownership' ? 'manageOwnershipDocPreview' : 'manageLicensesDocPreview';
    const previewContainer = document.getElementById(previewId);
    if (!previewContainer) return;
    
    // Clear previous preview
    previewContainer.innerHTML = '';
    
    const fileName = file.name;
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    
    const filePreviewItem = document.createElement('div');
    filePreviewItem.className = 'file-preview-item';
    filePreviewItem.innerHTML = `
        <i class="fi fi-rr-file-pdf" style="color: #DC2626; margin-right: 8px;"></i>
        <span>${fileName}</span>
        <div style="display: flex; align-items: center; gap: 8px; margin-left: auto;">
            <span style="font-size: 11px; color: #F59E0B; font-weight: 500;">Pending Review</span>
            <button type="button" onclick="removeManageDocumentPreview('${previewId}')" title="Remove file">&times;</button>
        </div>
        <small style="display: block; margin-top: 4px; color: #6B7280;">${fileSize} MB</small>
    `;
    
    previewContainer.appendChild(filePreviewItem);
    previewContainer.classList.add('active');
}

function removeManageDocumentPreview(previewId) {
    const previewContainer = document.getElementById(previewId);
    if (previewContainer) {
        previewContainer.innerHTML = '';
        previewContainer.classList.remove('active');
    }
    
    // Reset file input
    const inputId = previewId === 'manageOwnershipDocPreview' ? 'manageOwnershipDoc' : 'manageLicensesDoc';
    const input = document.getElementById(inputId);
    if (input) {
        input.value = '';
    }
}

function submitManageChanges() {
    if (typeof API === 'undefined' || !API.fields || !API.fields.update) {
        alert('API not available.');
        return;
    }
    const modal = document.getElementById('editFieldModal');
    const activeCard = modal ? modal.dataset.fieldId : '';
    if (!activeCard) {
        alert('No field selected.');
        return;
    }

    const typeSel = document.getElementById('manageFieldType');
    const typeEnum = String(typeSel && typeSel.value ? typeSel.value : 'Outdoor').toLowerCase().indexOf('indoor') >= 0 ? 'INDOOR' : 'OUTDOOR';
    const sport = resolveManageSportForPayload();
    if (!sport) {
        alert('Please enter the sport name for "Other".');
        return;
    }
    const capacityRaw = (document.getElementById('manageCapacity')?.value || '').trim();
    const capacityNum = capacityRaw === '' ? null : parseInt(capacityRaw, 10);

    const payload = {
        name: (document.getElementById('manageFieldName')?.value || '').trim(),
        sport: sport,
        description: document.getElementById('manageDescription')?.value || '',
        type: typeEnum,
        capacity: Number.isInteger(capacityNum) ? capacityNum : null,
        pricePerHour: Math.round(parseFloat(document.getElementById('managePricePerHour')?.value || '0') || 0),
        location: (document.getElementById('manageFieldAddress')?.value || '').trim(),
        address: (document.getElementById('manageFieldAddress')?.value || '').trim() || undefined,
        city: (document.getElementById('manageFieldCity')?.value || '').trim() || undefined,
        district: (document.getElementById('manageFieldDistrict')?.value || '').trim() || undefined,
        features: collectManageFeatureStrings()
    };

    const latNum = parseFloat(document.getElementById('manageLatitude')?.textContent || '');
    const lngNum = parseFloat(document.getElementById('manageLongitude')?.textContent || '');
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        alert('Please set a valid location on the map before saving.');
        return;
    }
    payload.latitude = latNum;
    payload.longitude = lngNum;

    API.fields.update(activeCard, payload)
        .then(function() {
            alert('Field updated successfully.');
            closeModal();
            loadOwnerDashboard();
        })
        .catch(function(err) {
            alert((err && err.message) || 'Could not update field.');
        });
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imagesContainer = document.querySelector('.images-container');
            if (imagesContainer) {
                const addImageBtn = imagesContainer.querySelector('.add-image-btn');
                
                const imagePreview = document.createElement('div');
                imagePreview.className = 'image-preview';
                imagePreview.innerHTML = `
                    <img src="${e.target.result}" alt="Field">
                    <button class="remove-image" onclick="removeImage(this)">&times;</button>
                `;
                
                if (addImageBtn) {
                    imagesContainer.insertBefore(imagePreview, addImageBtn);
                } else {
                    imagesContainer.appendChild(imagePreview);
                }
            }
        };
        reader.readAsDataURL(file);
    }
}

function removeImage(button) {
    button.closest('.image-preview').remove();
}

function saveChanges() {
    // Collect form data
    const fieldData = {
        name: document.getElementById('fieldName')?.value,
        price: document.getElementById('pricePerHour')?.value,
        location: document.getElementById('location')?.value,
        description: document.getElementById('description')?.value,
        category: document.getElementById('sportCategory')?.value,
        type: document.getElementById('fieldType')?.value,
        capacity: document.getElementById('capacity')?.value
    };
    
    console.log('Saving field data:', fieldData);
    
    // Here you would typically send data to an API
    alert('Field details saved successfully!');
    closeModal();
}

function toggleSetting(settingName) {
    const toggle = document.getElementById(`${settingName}Toggle`);
    if (toggle) {
        toggle.classList.toggle('active');
    }
}

// Calendar Functions for Edit Modal
let currentModalDate = new Date();
let selectedDate = new Date();

function renderModalCalendar() {
    const calendarDaysContainer = document.getElementById('modalCalendarDays');
    const calendarMonthElement = document.getElementById('calendarMonth');
    
    if (!calendarDaysContainer || !calendarMonthElement) return;
    
    const year = currentModalDate.getFullYear();
    const month = currentModalDate.getMonth();
    
    // Update month display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    calendarMonthElement.textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Clear previous days
    calendarDaysContainer.innerHTML = '';
    
    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day disabled';
        calendarDaysContainer.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        dayElement.addEventListener('click', () => {
            // Remove selected class from all days
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
            // Add selected class to clicked day
            dayElement.classList.add('selected');
            // Update selected date
            selectedDate = new Date(year, month, day);
            updateSelectedDateText();
            renderTimeSlots();
        });
        calendarDaysContainer.appendChild(dayElement);
    }
}

function prevModalMonth() {
    currentModalDate.setMonth(currentModalDate.getMonth() - 1);
    renderModalCalendar();
}

function nextModalMonth() {
    currentModalDate.setMonth(currentModalDate.getMonth() + 1);
    renderModalCalendar();
}

function updateSelectedDateText() {
    const selectedDateText = document.getElementById('selectedDateText');
    if (!selectedDateText) return;
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const dayName = dayNames[selectedDate.getDay()];
    const monthName = monthNames[selectedDate.getMonth()];
    const day = selectedDate.getDate();
    const year = selectedDate.getFullYear();
    
    selectedDateText.textContent = `🕐 ${dayName}, ${monthName} ${day}, ${year}`;
}

// Time Slots Functions
function renderTimeSlots() {
    const timeSlotsGrid = document.getElementById('timeSlotsGrid');
    if (!timeSlotsGrid) return;
    
    // Generate time slots from 8:00 to 23:00 (hourly)
    const slots = [];
    for (let hour = 8; hour <= 23; hour++) {
        const timeString = `${hour.toString().padStart(2, '0')}:00`;
        slots.push({
            time: timeString,
            status: Math.random() > 0.7 ? (Math.random() > 0.5 ? 'booked' : 'disabled') : 'available'
        });
    }
    
    timeSlotsGrid.innerHTML = '';
    slots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = `time-slot ${slot.status}`;
        slotElement.textContent = slot.time;
        if (slot.status === 'available') {
            slotElement.addEventListener('click', () => {
                slotElement.classList.toggle('available');
                slotElement.classList.toggle('disabled');
                updateSlotsSummary();
            });
        }
        timeSlotsGrid.appendChild(slotElement);
    });
    
    updateSlotsSummary();
}

function updateSlotsSummary() {
    const slots = document.querySelectorAll('.time-slot');
    let availableCount = 0;
    let disabledCount = 0;
    let bookedCount = 0;
    
    slots.forEach(slot => {
        if (slot.classList.contains('available')) availableCount++;
        else if (slot.classList.contains('disabled')) disabledCount++;
        else if (slot.classList.contains('booked')) bookedCount++;
    });
    
    const availableCountEl = document.getElementById('availableCount');
    const disabledCountEl = document.getElementById('disabledCount');
    const bookedCountEl = document.getElementById('bookedCount');
    
    if (availableCountEl) availableCountEl.textContent = availableCount;
    if (disabledCountEl) disabledCountEl.textContent = disabledCount;
    if (bookedCountEl) bookedCountEl.textContent = bookedCount;
}

function selectAllSlots() {
    document.querySelectorAll('.time-slot').forEach(slot => {
        if (!slot.classList.contains('booked')) {
            slot.classList.remove('disabled');
            slot.classList.add('available');
        }
    });
    updateSlotsSummary();
}

function unselectAllSlots() {
    document.querySelectorAll('.time-slot').forEach(slot => {
        if (!slot.classList.contains('booked')) {
            slot.classList.remove('available');
            slot.classList.add('disabled');
        }
    });
    updateSlotsSummary();
}

function togglePeakHours() {
    // Toggle peak hours (e.g., 18:00-22:00)
    document.querySelectorAll('.time-slot').forEach(slot => {
        const time = slot.textContent;
        const hour = parseInt(time.split(':')[0]);
        if (hour >= 18 && hour <= 22 && !slot.classList.contains('booked')) {
            slot.classList.toggle('available');
            slot.classList.toggle('disabled');
        }
    });
    updateSlotsSummary();
}

function copySchedule() {
    // Copy schedule from previous day (placeholder)
    alert('Schedule copied from previous day');
}

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize calendar if modal calendar exists
    const calendarDaysContainer = document.getElementById('modalCalendarDays');
    if (calendarDaysContainer) {
        renderModalCalendar();
        updateSelectedDateText();
    }
});

// Make functions globally available
window.openModal = openModal;
window.closeModal = closeModal;
window.viewFieldDetails = viewFieldDetails;
window.closeViewModal = closeViewModal;
window.toggleViewReviews = toggleViewReviews;
window.openAddFieldModal = openAddFieldModal;
window.closeAddFieldModal = closeAddFieldModal;
window.handleFieldImagesUpload = handleFieldImagesUpload;
window.removeFieldImage = removeFieldImage;
window.toggleDaySchedule = toggleDaySchedule;
window.addUnavailableDate = addUnavailableDate;
window.removeUnavailableDate = removeUnavailableDate;
window.toggleFieldVisibility = toggleFieldVisibility;
window.submitFieldForm = submitFieldForm;
window.nextStep = nextStep;
window.previousStep = previousStep;
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;
window.openManageSection = openManageSection;
window.backToManageMenu = backToManageMenu;
window.toggleManageDaySchedule = toggleManageDaySchedule;
window.addManageHighlight = addManageHighlight;
window.removeManageHighlight = removeManageHighlight;
window.addManageUnavailableDate = addManageUnavailableDate;
window.removeManageUnavailableDate = removeManageUnavailableDate;
window.handleManageImageUpload = handleManageImageUpload;
window.toggleManageSetting = toggleManageSetting;
window.toggleManageFieldVisibility = toggleManageFieldVisibility;
window.removeManageFile = removeManageFile;
window.handleManageDocumentUpload = handleManageDocumentUpload;
window.removeManageDocumentPreview = removeManageDocumentPreview;
window.submitManageChanges = submitManageChanges;
window.toggleSetting = toggleSetting;
window.prevModalMonth = prevModalMonth;
window.nextModalMonth = nextModalMonth;
window.selectAllSlots = selectAllSlots;
window.unselectAllSlots = unselectAllSlots;
window.togglePeakHours = togglePeakHours;
window.copySchedule = copySchedule;

