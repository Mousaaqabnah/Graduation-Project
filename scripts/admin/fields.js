// Fields Management functionality

// DOM Elements (notification bell: ../../scripts/player/notifications.js)
const profileBtn = document.getElementById('profileBtn');
const profilePopup = document.getElementById('profilePopup');
const fieldSearch = document.getElementById('fieldSearch');
const fieldFilter = document.getElementById('fieldFilter');
const statusFilter = document.getElementById('statusFilter');
const dateFilter = document.getElementById('dateFilter');
const fieldsTableBody = document.getElementById('fieldsTableBody');
const fieldInfoModal = document.getElementById('fieldInfoModal');
const closeFieldInfoModal = document.getElementById('closeFieldInfoModal');
const fieldInfoContent = document.getElementById('fieldInfoContent');

let allFields = [];
let isLoading = false;

// Profile Popup Toggle
if (profileBtn && profilePopup) {
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profilePopup.classList.toggle('active');
        const notificationPopup = document.getElementById('notificationPopup');
        if (notificationPopup) {
            notificationPopup.classList.remove('active');
        }
    });
}

document.addEventListener('click', (e) => {
    if (profilePopup && !profilePopup.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopup.classList.remove('active');
    }
});

function escapeHtml(text) {
    if (text == null) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatSport(sport) {
    const s = String(sport || '').toLowerCase();
    const sportMap = {
        'football': 'Football',
        'basketball': 'Basketball',
        'tennis': 'Tennis',
        'volleyball': 'Volleyball'
    };
    return sportMap[s] || (sport ? String(sport) : '—');
}

function displayStatus(field) {
    const ms = field.moderationStatus ? String(field.moderationStatus).toUpperCase() : '';
    if (ms === 'PENDING') return 'pending';
    if (ms === 'APPROVED') return 'approved';
    if (ms === 'REJECTED') return 'rejected';
    // Back-compat: old fields w/out moderationStatus
    return field.isActive ? 'approved' : 'pending';
}

function formatStatus(status) {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    try {
        return d.toLocaleString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (_) {
        return d.toISOString();
    }
}

function formatScheduleForAdmin(schedule) {
    if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) return '';
    const days = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday'
    ];
    const labels = {
        monday: 'Mon',
        tuesday: 'Tue',
        wednesday: 'Wed',
        thursday: 'Thu',
        friday: 'Fri',
        saturday: 'Sat',
        sunday: 'Sun'
    };
    const rows = days
        .map((day) => {
            const d = schedule[day];
            if (!d || typeof d !== 'object') return '';
            const enabled = !!d.enabled;
            if (!enabled) return labels[day] + ': closed';
            const open = d.opening ? String(d.opening) : '—';
            const close = d.closing ? String(d.closing) : '—';
            return labels[day] + ': ' + open + ' - ' + close;
        })
        .filter(Boolean);
    return rows.join('\n');
}

/** Same unit as owner forms: whole TRY per hour (not kuruş). */
function formatPriceTry(pricePerHour) {
    const n = Number(pricePerHour || 0);
    return '\u20BA' + n.toLocaleString('tr-TR') + '/h';
}

function escapeAttr(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function isDataUrl(url) {
    return typeof url === 'string' && url.trim().toLowerCase().startsWith('data:');
}

function normalizeDataUrl(url) {
    if (!isDataUrl(url)) return url;
    // Remove accidental whitespace/newlines in base64 payload.
    return String(url).replace(/\s+/g, '');
}

function getDataUrlExtension(url) {
    const m = String(url).match(/^data:([^;,]+)[;,]/i);
    const mime = (m && m[1] ? m[1].toLowerCase() : '').trim();
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('png')) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('msword')) return 'doc';
    if (mime.includes('wordprocessingml')) return 'docx';
    return 'bin';
}

function mergeAdminFieldRowWithDetail(row, detail) {
    if (!detail) return Object.assign({}, row);
    const images =
        Array.isArray(detail.images) && detail.images.length ? detail.images : row.images || [];
    const pph = detail.pricePerHour != null ? detail.pricePerHour : row.pricePerHour;
    const unavailableDates =
        Array.isArray(detail.unavailableDates) && detail.unavailableDates.length
            ? detail.unavailableDates
            : Array.isArray(row.unavailableDates)
            ? row.unavailableDates
            : [];
    return Object.assign({}, row, {
        images,
        description: detail.description != null ? detail.description : row.description,
        capacity: detail.capacity != null ? detail.capacity : row.capacity,
        city: detail.city != null ? detail.city : row.city,
        district: detail.district != null ? detail.district : row.district,
        amenities: Array.isArray(detail.amenities) ? detail.amenities : row.amenities,
        features: Array.isArray(detail.features) ? detail.features : row.features,
        highlights: Array.isArray(detail.highlights) ? detail.highlights : row.highlights,
        schedule: detail.schedule != null ? detail.schedule : row.schedule,
        bookingType: detail.bookingType != null ? detail.bookingType : row.bookingType,
        advanceBooking: detail.advanceBooking != null ? detail.advanceBooking : row.advanceBooking,
        cancellationPolicy:
            detail.cancellationPolicy != null ? detail.cancellationPolicy : row.cancellationPolicy,
        visibilityRequested:
            detail.visibilityRequested !== undefined && detail.visibilityRequested !== null
                ? !!detail.visibilityRequested
                : row.visibilityRequested,
        address: detail.address != null ? detail.address : row.address,
        phone: detail.phone != null ? detail.phone : row.phone,
        type: detail.type || row.type,
        latitude: detail.latitude,
        longitude: detail.longitude,
        pricePerHour: pph,
        price: formatPriceTry(pph),
        ownershipDocumentUrl:
            detail.ownershipDocumentUrl ||
            (detail.pendingChanges && detail.pendingChanges.ownershipDocumentUrl) ||
            row.ownershipDocumentUrl ||
            (row.pendingChanges && row.pendingChanges.ownershipDocumentUrl) ||
            '',
        licensesDocumentUrl:
            detail.licensesDocumentUrl ||
            (detail.pendingChanges && detail.pendingChanges.licensesDocumentUrl) ||
            row.licensesDocumentUrl ||
            (row.pendingChanges && row.pendingChanges.licensesDocumentUrl) ||
            '',
        pendingChanges:
            detail.pendingChanges && typeof detail.pendingChanges === 'object'
                ? detail.pendingChanges
                : row.pendingChanges || null,
        moderationReason: detail.moderationReason || row.moderationReason || '',
        createdAt: detail.createdAt || row.createdAt || null,
        unavailableDates
    });
}

function resolveAdminFieldDocumentUrl(field, key) {
    if (!field || !key) return '';
    var direct = field[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    var pending = field.pendingChanges && field.pendingChanges[key];
    if (pending != null && String(pending).trim()) return String(pending).trim();
    return '';
}

function buildAdminFieldDocumentsSection(field) {
    const ownRaw = resolveAdminFieldDocumentUrl(field, 'ownershipDocumentUrl');
    const licRaw = resolveAdminFieldDocumentUrl(field, 'licensesDocumentUrl');
    const own = normalizeDataUrl(ownRaw);
    const lic = normalizeDataUrl(licRaw);
    if (!own && !lic) {
        return (
            '<div class="field-info-item">' +
            '<div class="field-info-label">Ownership &amp; license documents</div>' +
            '<div class="field-info-muted">No document URLs on file for this field. ' +
            '(Owners can attach links when the upload flow saves them.)</div>' +
            '</div>'
        );
    }
    let inner = '';
    if (own) {
        const ownIsData = isDataUrl(own);
        const ownExt = getDataUrlExtension(own);
        inner +=
            '<div class="admin-doc-row">' +
            '<span class="admin-doc-name">Ownership / rental</span>' +
            '<a class="admin-doc-link" href="' +
            (ownIsData ? '#' : escapeAttr(own)) +
            '" ' +
            (ownIsData
                ? 'data-doc-url="' +
                  escapeAttr(own) +
                  '" data-doc-filename="ownership-document.' +
                  ownExt +
                  '"'
                : 'target="_blank" rel="noopener noreferrer"') +
            '>' +
            (ownIsData ? 'Download file' : 'Open file') +
            '</a>' +
            '</div>';
    }
    if (lic) {
        const licIsData = isDataUrl(lic);
        const licExt = getDataUrlExtension(lic);
        inner +=
            '<div class="admin-doc-row">' +
            '<span class="admin-doc-name">Licenses / permits</span>' +
            '<a class="admin-doc-link" href="' +
            (licIsData ? '#' : escapeAttr(lic)) +
            '" ' +
            (licIsData
                ? 'data-doc-url="' +
                  escapeAttr(lic) +
                  '" data-doc-filename="license-document.' +
                  licExt +
                  '"'
                : 'target="_blank" rel="noopener noreferrer"') +
            '>' +
            (licIsData ? 'Download file' : 'Open file') +
            '</a>' +
            '</div>';
    }
    return (
        '<div class="field-info-item">' +
        '<div class="field-info-label">Ownership &amp; license documents</div>' +
        '<div class="admin-field-docs">' +
        inner +
        '</div></div>'
    );
}

function buildAdminFieldPicturesSection(field) {
    const imgs = Array.isArray(field.images) ? field.images : [];
    const fid = escapeHtml(field.id);
    if (!imgs.length) {
        return (
            '<div class="field-info-item field-images-section">' +
            '<div class="field-info-label">Field photos</div>' +
            '<div class="field-info-muted">No images uploaded for this field.</div>' +
            '</div>'
        );
    }
    const first = escapeAttr(imgs[0]);
    const carouselArrows =
        imgs.length <= 1
            ? 'style="display: none;"'
            : '';
    const dots =
        imgs.length > 1
            ? '<div class="carousel-indicators">' +
              imgs
                  .map(
                      (_, index) =>
                          '<span class="carousel-dot ' +
                          (index === 0 ? 'active' : '') +
                          '" onclick="goToImage(\'' +
                          fid +
                          "', " +
                          index +
                          ')"></span>'
                  )
                  .join('') +
              '</div>'
            : '';
    const thumbs = imgs
        .map(
            (url, i) =>
                '<button type="button" class="admin-field-photo-thumb' +
                (i === 0 ? ' active' : '') +
                '" onclick="goToImage(\'' +
                fid +
                "', " +
                i +
                ')" title="Photo ' +
                (i + 1) +
                '">' +
                '<img src="' +
                escapeAttr(url) +
                '" alt="">' +
                '</button>'
        )
        .join('');
    return (
        '<div class="field-info-item field-images-section">' +
        '<div class="field-info-label">Field photos</div>' +
        '<div class="field-image-carousel" data-field-id="' +
        fid +
        '">' +
        '<button class="carousel-arrow carousel-arrow-left" onclick="navigateImage(\'' +
        fid +
        "', -1)\" " +
        carouselArrows +
        '>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
        '<polyline points="15 18 9 12 15 6"></polyline></svg></button>' +
        '<div class="carousel-image-container">' +
        '<img src="' +
        first +
        '" alt="Field photo 1" class="carousel-image" onclick="openImageModal(' +
        JSON.stringify(imgs[0]) +
        ')">' +
        dots +
        '</div>' +
        '<button class="carousel-arrow carousel-arrow-right" onclick="navigateImage(\'' +
        fid +
        "', 1)\" " +
        carouselArrows +
        '>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
        '<polyline points="9 18 15 12 9 6"></polyline></svg></button>' +
        '</div>' +
        '<input type="hidden" id="currentImageIndex_' +
        fid +
        '" value="0">' +
        '<div class="admin-field-photo-grid">' +
        thumbs +
        '</div>' +
        '</div>'
    );
}

function buildAdminUnavailableDatesSection(field) {
    const dates = Array.isArray(field.unavailableDates) ? field.unavailableDates : [];
    if (!dates.length) {
        return (
            '<div class="field-info-item">' +
            '<div class="field-info-label">Unavailable dates</div>' +
            '<div class="field-info-muted">No blocked dates submitted by the owner.</div>' +
            '</div>'
        );
    }
    const formatted = dates
        .map((row) => {
            const raw = row && row.date != null ? row.date : row;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
        })
        .filter(Boolean)
        .join(', ');
    return (
        '<div class="field-info-item">' +
        '<div class="field-info-label">Unavailable dates</div>' +
        '<div class="field-info-value">' +
        (formatted || '—') +
        '</div></div>'
    );
}

function formatPendingFieldLabel(key) {
    const labels = {
        name: 'Field name',
        sport: 'Sport',
        type: 'Court type',
        location: 'Location',
        address: 'Address',
        city: 'City',
        district: 'District',
        latitude: 'Latitude',
        longitude: 'Longitude',
        ownershipDocumentUrl: 'Ownership document',
        licensesDocumentUrl: 'Licenses document'
    };
    return labels[key] || key;
}

function buildAdminPendingChangesSection(field) {
    const pending = field && field.pendingChanges && typeof field.pendingChanges === 'object'
        ? field.pendingChanges
        : null;
    const keys = pending ? Object.keys(pending) : [];
    if (!keys.length) return '';
    const rows = keys.map(function(key) {
        let value = pending[key];
        if (value === null || value === undefined || value === '') {
            value = 'Removed';
        } else if (typeof value === 'object') {
            value = JSON.stringify(value);
        } else {
            value = String(value);
        }
        if (key === 'ownershipDocumentUrl' || key === 'licensesDocumentUrl') {
            value = value === 'Removed' ? 'Removed' : 'Updated file submitted';
        }
        return (
            '<div class="field-info-item"><div class="field-info-label">Pending change: ' +
            escapeHtml(formatPendingFieldLabel(key)) +
            '</div><div class="field-info-value">' +
            escapeHtml(value) +
            '</div></div>'
        );
    }).join('');
    return (
        '<div class="field-info-item"><div class="field-info-label">Owner requested changes</div><div class="field-info-value">These edits are waiting for admin approval.</div></div>' +
        rows
    );
}

function buildAdminFieldInfoMarkup(field) {
    const scheduleText = escapeHtml(formatScheduleForAdmin(field.schedule));
    return (
        buildAdminFieldPicturesSection(field) +
        buildAdminFieldDocumentsSection(field) +
        buildAdminUnavailableDatesSection(field) +
        buildAdminPendingChangesSection(field) +
        '<div class="field-info-item">' +
        '<div class="field-info-label">Field name</div>' +
        '<div class="field-info-value">' +
        escapeHtml(field.fieldName) +
        '</div></div>' +
        '<div class="field-info-item">' +
        '<div class="field-info-label">Location</div>' +
        '<div class="field-info-value">' +
        escapeHtml(field.location) +
        '</div></div>' +
        (field.address
            ? '<div class="field-info-item"><div class="field-info-label">Address</div><div class="field-info-value">' +
              escapeHtml(field.address) +
              '</div></div>'
            : '') +
        '<div class="field-info-item">' +
        '<div class="field-info-label">Owner</div>' +
        '<div class="field-info-value">' +
        escapeHtml(field.owner) +
        '</div></div>' +
        (field.ownerEmail
            ? '<div class="field-info-item"><div class="field-info-label">Owner email</div><div class="field-info-value">' +
              escapeHtml(field.ownerEmail) +
              '</div></div>'
            : '') +
        (field.phone
            ? '<div class="field-info-item"><div class="field-info-label">Field phone</div><div class="field-info-value">' +
              escapeHtml(field.phone) +
              '</div></div>'
            : '') +
        '<div class="field-info-item">' +
        '<div class="field-info-label">Sport</div>' +
        '<div class="field-info-value"><span class="sport-badge ' +
        escapeHtml(field.sport) +
        '">' +
        formatSport(field.sport) +
        '</span></div></div>' +
        (field.type
            ? '<div class="field-info-item"><div class="field-info-label">Court type</div><div class="field-info-value">' +
              escapeHtml(String(field.type)) +
              '</div></div>'
            : '') +
        (field.capacity != null
            ? '<div class="field-info-item"><div class="field-info-label">Capacity</div><div class="field-info-value">' +
              escapeHtml(String(field.capacity)) +
              ' players</div></div>'
            : '') +
        (field.city || field.district
            ? '<div class="field-info-item"><div class="field-info-label">City / District</div><div class="field-info-value">' +
              escapeHtml([field.city, field.district].filter(Boolean).join(' / ') || '—') +
              '</div></div>'
            : '') +
        '<div class="field-info-item">' +
        '<div class="field-info-label">Price per hour</div>' +
        '<div class="field-info-value">' +
        escapeHtml(field.price) +
        '</div></div>' +
        '<div class="field-info-item">' +
        '<div class="field-info-label">Coordinates</div>' +
        '<div class="field-info-value">' +
        (field.latitude != null && field.longitude != null
            ? escapeHtml(String(field.latitude) + ', ' + String(field.longitude))
            : '—') +
        '</div></div>' +
        '<div class="field-info-item">' +
        '<div class="field-info-label">Submitted at</div>' +
        '<div class="field-info-value">' +
        escapeHtml(formatDateTime(field.createdAt)) +
        '</div></div>' +
        '<div class="field-info-item">' +
        '<div class="field-info-label">Status</div>' +
        '<div class="field-info-value"><span class="status-badge ' +
        field.status +
        '">' +
        formatStatus(field.status) +
        '</span></div></div>' +
        (field.moderationReason
            ? '<div class="field-info-item"><div class="field-info-label">Moderation note</div><div class="field-info-value">' +
              escapeHtml(field.moderationReason) +
              '</div></div>'
            : '') +
        (field.description
            ? '<div class="field-info-item"><div class="field-info-label">Description</div><div class="field-info-value">' +
              escapeHtml(field.description) +
              '</div></div>'
            : '') +
        (field.amenities && field.amenities.length
            ? '<div class="field-info-item"><div class="field-info-label">Amenities</div><div class="field-info-value">' +
              field.amenities.map((a) => escapeHtml(a)).join(', ') +
              '</div></div>'
            : '') +
        (field.features && field.features.length
            ? '<div class="field-info-item"><div class="field-info-label">Field features</div><div class="field-info-value">' +
              field.features.map((a) => escapeHtml(a)).join(', ') +
              '</div></div>'
            : '') +
        (field.highlights && field.highlights.length
            ? '<div class="field-info-item"><div class="field-info-label">Highlights</div><div class="field-info-value">' +
              field.highlights.map((h) => escapeHtml(h)).join(', ') +
              '</div></div>'
            : '') +
        (field.bookingType
            ? '<div class="field-info-item"><div class="field-info-label">Booking type</div><div class="field-info-value">' +
              escapeHtml(String(field.bookingType)) +
              '</div></div>'
            : '') +
        (field.advanceBooking
            ? '<div class="field-info-item"><div class="field-info-label">Advance booking</div><div class="field-info-value">' +
              escapeHtml(String(field.advanceBooking)) +
              '</div></div>'
            : '') +
        (field.cancellationPolicy
            ? '<div class="field-info-item"><div class="field-info-label">Cancellation policy</div><div class="field-info-value">' +
              escapeHtml(String(field.cancellationPolicy)) +
              '</div></div>'
            : '') +
        (field.visibilityRequested != null
            ? '<div class="field-info-item"><div class="field-info-label">Owner visibility request</div><div class="field-info-value">' +
              (field.visibilityRequested ? 'Visible in search' : 'Hidden from search') +
              '</div></div>'
            : '') +
        (scheduleText
            ? '<div class="field-info-item"><div class="field-info-label">Submitted schedule</div><div class="field-info-value"><code>' +
              scheduleText +
              '</code></div></div>'
            : '') +
        '<div class="field-info-actions">' +
        (field.status === 'pending'
            ? '<button type="button" class="btn-approve" onclick="approveFieldFromModal(\'' +
              escapeHtml(field.id) +
              '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>Approve field</button>' +
              '<button type="button" class="btn-reject" onclick="rejectFieldFromModal(\'' +
              escapeHtml(field.id) +
              '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Reject field</button>'
            : field.status === 'approved'
            ? '<button type="button" class="btn-reject" onclick="rejectFieldFromModal(\'' +
              escapeHtml(field.id) +
              '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Reject field</button>'
            : field.status === 'rejected'
            ? '<button type="button" class="btn-approve" onclick="approveFieldFromModal(\'' +
              escapeHtml(field.id) +
              '\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>Approve field</button>'
            : '') +
        '</div>'
    );
}

function downloadDataUrlFile(dataUrl, filename) {
    const normalized = normalizeDataUrl(dataUrl);
    if (!isDataUrl(normalized)) return;
    fetch(normalized)
        .then((res) => res.blob())
        .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename || 'document.bin';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
        })
        .catch(() => {
            // Fallback if fetch/blob conversion fails for any reason.
            const a = document.createElement('a');
            a.href = normalized;
            a.download = filename || 'document.bin';
            document.body.appendChild(a);
            a.click();
            a.remove();
        });
}

function mapField(f) {
    return {
        id: f.id,
        fieldName: f.name || 'Field',
        location: f.location || '—',
        owner: (f.owner && (f.owner.fullName || f.owner.email)) ? (f.owner.fullName || f.owner.email) : '—',
        ownerEmail: (f.owner && f.owner.email) ? f.owner.email : '',
        sport: String(f.sport || '').toLowerCase(),
        pricePerHour: f.pricePerHour || 0,
        price: formatPriceTry(f.pricePerHour),
        status: displayStatus(f),
        isActive: !!f.isActive,
        moderationStatus: f.moderationStatus || null,
        moderationReason: f.moderationReason || '',
        description: f.description || '',
        capacity: f.capacity != null ? f.capacity : null,
        city: f.city || '',
        district: f.district || '',
        features: Array.isArray(f.features) ? f.features : [],
        amenities: Array.isArray(f.amenities) ? f.amenities : [],
        highlights: Array.isArray(f.highlights) ? f.highlights : [],
        images: Array.isArray(f.images) ? f.images : [],
        schedule: f.schedule || null,
        bookingType: f.bookingType || '',
        advanceBooking: f.advanceBooking || '',
        cancellationPolicy: f.cancellationPolicy || '',
        visibilityRequested:
            f.visibilityRequested === undefined || f.visibilityRequested === null
                ? null
                : !!f.visibilityRequested,
        address: f.address || '',
        phone: f.phone || '',
        type: f.type || '',
        createdAt: f.createdAt || null,
        ownershipDocumentUrl: f.ownershipDocumentUrl || '',
        licensesDocumentUrl: f.licensesDocumentUrl || '',
        pendingChanges:
            f.pendingChanges && typeof f.pendingChanges === 'object' ? f.pendingChanges : null
    };
}

async function loadFieldsFromAPI() {
    if (isLoading) return;
    isLoading = true;
    if (fieldsTableBody) {
        fieldsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#6B7280">Loading fields...</td></tr>';
    }
    try {
        if (!window.API || !API.admin || !API.admin.getFields) {
            throw new Error('API not available.');
        }
        const params = { limit: 200, page: 1 };
        const sport = fieldFilter && fieldFilter.value && fieldFilter.value !== 'all' ? fieldFilter.value : '';
        const status = statusFilter && statusFilter.value && statusFilter.value !== 'all' ? statusFilter.value : '';
        const search = fieldSearch && fieldSearch.value ? fieldSearch.value.trim() : '';
        if (sport) params.sport = sport;
        if (status) params.status = status;
        if (search) params.search = search;
        const res = await API.admin.getFields(params);
        allFields = (res.fields || []).map(mapField);
        renderFields(allFields);
    } catch (e) {
        console.warn('Load fields failed:', e);
        allFields = [];
        if (fieldsTableBody) {
            fieldsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:#DC2626">${escapeHtml(e && e.message ? e.message : 'Failed to load fields')}</td></tr>`;
        }
    } finally {
        isLoading = false;
    }
}

// Render fields table
function renderFields(fields = allFields) {
    if (!fieldsTableBody) return;
    
    if (fields.length === 0) {
        fieldsTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #6B7280;">
                    ${isLoading ? 'Loading fields...' : 'No fields found matching your criteria.'}
                </td>
            </tr>
        `;
        return;
    }
    
    fieldsTableBody.innerHTML = fields.map(field => `
        <tr>
            <td>
                <span class="field-name">${escapeHtml(field.fieldName)}</span>
            </td>
            <td>
                <span class="location">${escapeHtml(field.location)}</span>
            </td>
            <td>
                <span class="owner">${escapeHtml(field.owner)}</span>
            </td>
            <td>
                <span class="sport-badge ${field.sport}">${formatSport(field.sport)}</span>
            </td>
            <td>
                <span class="price">${escapeHtml(field.price)}</span>
            </td>
            <td>
                <span class="status-badge ${field.status}">${formatStatus(field.status)}</span>
            </td>
            <td>
                <div class="actions-cell">
                    <div class="action-buttons">
                        <button type="button" class="action-icon-btn info" onclick="showFieldInfo('${escapeHtml(field.id)}')" title="View field info">
                            <i class="fi fi-rr-info"></i>
                        </button>
                        ${field.status === 'pending' 
                            ? `<button type="button" class="action-icon-btn approve" onclick="approveField('${escapeHtml(field.id)}')" title="Approve field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </button>
                            <button type="button" class="action-icon-btn reject" onclick="rejectField('${escapeHtml(field.id)}')" title="Reject field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>`
                            : field.status === 'approved'
                            ? `<button type="button" class="action-icon-btn reject" onclick="rejectField('${escapeHtml(field.id)}')" title="Reject field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>`
                            : field.status === 'rejected'
                            ? `<button type="button" class="action-icon-btn approve" onclick="approveField('${escapeHtml(field.id)}')" title="Approve field">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </button>`
                            : ''
                        }
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
}

// Search functionality
if (fieldSearch) {
    fieldSearch.addEventListener('input', () => {
        clearTimeout(fieldSearch._t);
        fieldSearch._t = setTimeout(loadFieldsFromAPI, 300);
    });
}

// Filter functionality
if (fieldFilter) {
    fieldFilter.addEventListener('change', loadFieldsFromAPI);
}

if (statusFilter) {
    statusFilter.addEventListener('change', loadFieldsFromAPI);
}

if (dateFilter) {
    dateFilter.addEventListener('change', loadFieldsFromAPI);
}

async function moderateFieldAction(fieldId, status, closeModalOnSuccess) {
    const field = allFields.find(f => String(f.id) === String(fieldId));
    if (!field) return;

    if (!window.API || !API.admin || !API.admin.moderateField) {
        alert('Admin moderation API is not available.');
        return;
    }

    const statusUpper = String(status || '').toUpperCase();
    const actionWord = statusUpper === 'APPROVED' ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${actionWord} "${field.fieldName}"?`)) return;

    let reason = '';
    if (statusUpper === 'REJECTED') {
        reason = prompt('Reason for rejection (optional):') || '';
    }

    try {
        await API.admin.moderateField(String(fieldId), statusUpper, reason);
        await loadFieldsFromAPI();
        if (closeModalOnSuccess) closeFieldInfoModalOnly();
    } catch (e) {
        alert(e && e.message ? e.message : `Failed to ${actionWord} field.`);
    }
}

// Approve field
async function approveField(fieldId) {
    return moderateFieldAction(fieldId, 'APPROVED', false);
}

// Reject field
async function rejectField(fieldId) {
    return moderateFieldAction(fieldId, 'REJECTED', false);
}

// Approve field from modal
async function approveFieldFromModal(fieldId) {
    return moderateFieldAction(fieldId, 'APPROVED', true);
}

// Reject field from modal
async function rejectFieldFromModal(fieldId) {
    return moderateFieldAction(fieldId, 'REJECTED', true);
}

// Show field info modal — loads full detail from GET /fields/:id (images, doc URLs, exact price).
async function showFieldInfo(fieldId) {
    const row = allFields.find((f) => String(f.id) === String(fieldId));
    if (!row || !fieldInfoContent) return;

    fieldInfoContent.innerHTML =
        '<div class="field-info-item"><div class="field-info-value field-info-loading">Loading field details\u2026</div></div>';
    if (fieldInfoModal) {
        fieldInfoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    let merged = row;
    try {
        if (window.API && API.fields && API.fields.getById) {
            const res = await API.fields.getById(String(fieldId));
            const detail = res && res.field;
            merged = mergeAdminFieldRowWithDetail(row, detail);
        }
        if (window.API && API.fields && API.fields.listUnavailableDates) {
            const unavailableRes = await API.fields.listUnavailableDates(String(fieldId));
            const unavailableDates =
                unavailableRes && Array.isArray(unavailableRes.unavailableDates)
                    ? unavailableRes.unavailableDates
                    : [];
            merged = Object.assign({}, merged, { unavailableDates });
        }
    } catch (e) {
        console.warn('Admin field modal: getById failed, using list row only.', e);
    }

    window.__adminFieldInfoView = merged;
    fieldInfoContent.innerHTML = buildAdminFieldInfoMarkup(merged);
}

// Close field info modal
function closeFieldInfoModalOnly() {
    if (fieldInfoModal) {
        fieldInfoModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    try {
        delete window.__adminFieldInfoView;
    } catch (_) {
        window.__adminFieldInfoView = null;
    }
}

if (closeFieldInfoModal && fieldInfoModal) {
    closeFieldInfoModal.addEventListener('click', () => {
        closeFieldInfoModalOnly();
    });

    fieldInfoModal.addEventListener('click', (e) => {
        if (e.target === fieldInfoModal) {
            closeFieldInfoModalOnly();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fieldInfoModal.classList.contains('active')) {
            closeFieldInfoModalOnly();
        }
    });
}

if (fieldInfoContent) {
    fieldInfoContent.addEventListener('click', (e) => {
        const link = e.target && e.target.closest ? e.target.closest('.admin-doc-link[data-doc-url]') : null;
        if (!link) return;
        e.preventDefault();
        const dataUrl = link.getAttribute('data-doc-url') || '';
        const filename = link.getAttribute('data-doc-filename') || 'document.bin';
        downloadDataUrlFile(dataUrl, filename);
    });
}

// Navigate images in carousel
function navigateImage(fieldId, direction) {
    const field =
        window.__adminFieldInfoView && String(window.__adminFieldInfoView.id) === String(fieldId)
            ? window.__adminFieldInfoView
            : allFields.find((f) => String(f.id) === String(fieldId));
    if (!field || !field.images || field.images.length === 0) return;
    
    const carousel = document.querySelector(`.field-image-carousel[data-field-id="${fieldId}"]`);
    if (!carousel) return;
    
    const currentIndexInput = document.getElementById(`currentImageIndex_${fieldId}`);
    if (!currentIndexInput) return;
    
    let currentIndex = parseInt(currentIndexInput.value) || 0;
    const totalImages = field.images.length;
    
    // Calculate new index
    currentIndex += direction;
    if (currentIndex < 0) {
        currentIndex = totalImages - 1;
    } else if (currentIndex >= totalImages) {
        currentIndex = 0;
    }
    
    // Update image
    const image = carousel.querySelector('.carousel-image');
    if (image) {
        image.src = field.images[currentIndex];
        image.alt = `Field image ${currentIndex + 1}`;
        image.setAttribute('onclick', 'openImageModal(' + JSON.stringify(field.images[currentIndex]) + ')');
    }

    const thumbs = carousel.parentElement && carousel.parentElement.querySelectorAll('.admin-field-photo-thumb');
    thumbs.forEach((btn, index) => {
        if (index === currentIndex) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    
    // Update indicators
    const dots = carousel.querySelectorAll('.carousel-dot');
    dots.forEach((dot, index) => {
        if (index === currentIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
    
    // Update hidden input
    currentIndexInput.value = currentIndex;
}

// Go to specific image
function goToImage(fieldId, index) {
    const field =
        window.__adminFieldInfoView && String(window.__adminFieldInfoView.id) === String(fieldId)
            ? window.__adminFieldInfoView
            : allFields.find((f) => String(f.id) === String(fieldId));
    if (!field || !field.images || index < 0 || index >= field.images.length) return;
    
    const carousel = document.querySelector(`.field-image-carousel[data-field-id="${fieldId}"]`);
    if (!carousel) return;
    
    const currentIndexInput = document.getElementById(`currentImageIndex_${fieldId}`);
    if (!currentIndexInput) return;
    
    // Update image
    const image = carousel.querySelector('.carousel-image');
    if (image) {
        image.src = field.images[index];
        image.alt = `Field image ${index + 1}`;
        image.setAttribute('onclick', 'openImageModal(' + JSON.stringify(field.images[index]) + ')');
    }

    const thumbs = carousel.parentElement && carousel.parentElement.querySelectorAll('.admin-field-photo-thumb');
    thumbs.forEach((btn, dotIndex) => {
        if (dotIndex === index) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    
    // Update indicators
    const dots = carousel.querySelectorAll('.carousel-dot');
    dots.forEach((dot, dotIndex) => {
        if (dotIndex === index) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
    
    // Update hidden input
    currentIndexInput.value = index;
}

// Open image in full size modal
function openImageModal(imageUrl) {
    // Create modal overlay if it doesn't exist
    let imageModal = document.getElementById('imageModal');
    if (!imageModal) {
        imageModal = document.createElement('div');
        imageModal.id = 'imageModal';
        imageModal.className = 'modal-overlay image-modal-overlay';
        imageModal.innerHTML = `
            <div class="image-modal-content">
                <button class="image-modal-close" onclick="closeImageModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <img src="${imageUrl}" alt="Field image" class="full-size-image">
            </div>
        `;
        document.body.appendChild(imageModal);
        
        // Close on overlay click
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && imageModal.classList.contains('active')) {
                closeImageModal();
            }
        });
    } else {
        const img = imageModal.querySelector('.full-size-image');
        if (img) {
            img.src = imageUrl;
        }
    }
    
    imageModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close image modal
function closeImageModal() {
    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Make functions globally available for onclick handlers
window.approveField = approveField;
window.rejectField = rejectField;
window.approveFieldFromModal = approveFieldFromModal;
window.rejectFieldFromModal = rejectFieldFromModal;
window.showFieldInfo = showFieldInfo;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.navigateImage = navigateImage;
window.goToImage = goToImage;

// Initialize: Render fields on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFieldsFromAPI();
});

