# MatchField Project Structure

This document describes the organized file structure of the MatchField project.

## Directory Structure

```
Graduation Project/
├── index.html                 # Root entry point (redirects to login)
├── pages/                     # All HTML pages organized by feature
│   ├── auth/                  # Authentication pages
│   │   ├── login.html
│   │   └── signup.html
│   ├── player/                # Player-specific pages
│   │   ├── home.html
│   │   ├── bookings.html
│   │   ├── map.html
│   │   └── field-info.html
│   ├── owner/                 # Field owner-specific pages
│   │   └── dashboard.html
│   ├── admin/                 # Admin pages (includes support Messages inbox)
│   │   └── messages.html
│   └── shared/                # Shared pages (accessible by all user types)
│       ├── about-us.html
│       └── contact-us.html
├── styles/                    # All CSS files organized by feature
│   ├── auth/
│   │   └── signup.css
│   ├── player/
│   │   ├── home.css
│   │   ├── bookings.css
│   │   ├── map.css
│   │   └── field-info.css
│   ├── owner/
│   │   └── dashboard.css
│   ├── admin/
│   │   └── messages.css       # Admin support inbox styles (not user chat)
│   └── shared/
│       ├── base.css           # Base styles (formerly styles.css)
│       ├── about-us.css
│       └── contact-us.css
├── scripts/                   # All JavaScript files organized by feature
│   ├── auth/
│   │   ├── login.js           # (formerly script.js)
│   │   └── signup.js
│   ├── player/
│   │   ├── home.js
│   │   ├── bookings.js
│   │   ├── map.js
│   │   └── field-info.js
│   ├── owner/
│   │   └── dashboard.js
│   ├── admin/
│   │   └── messages.js        # Admin support inbox
│   └── shared/
│       ├── about-us.js
│       └── contact-us.js
├── assets/                    # Static assets
│   └── images/
│       └── logo/
│           └── A modern logo for a .png
├── components/                # React components
│   ├── VenueCard.jsx
│   └── VenueCard.example.jsx
├── app/                       # Future React app structure
│   └── (dashboard)/
├── lib/                       # Library files
└── components/ui/             # UI components

```

> Note: Internal player/owner user↔user Chat pages and Socket.IO messaging were removed in product Phase 3. Admin `messages.html` is the support-ticket inbox.
## Path References

### From pages/auth/ (login.html, signup.html)
- CSS: `../../styles/auth/` or `../../styles/shared/`
- JS: `../../scripts/auth/`
- Images: `../../assets/images/`

### From pages/player/ (home.html, bookings.html, etc.)
- CSS: `../../styles/player/`
- JS: `../../scripts/player/`
- Images: `../../assets/images/`
- Other pages: `../player/` or `../shared/` or `../auth/`

### From pages/owner/ (dashboard.html)
- CSS: `../../styles/owner/`
- JS: `../../scripts/owner/`
- Images: `../../assets/images/`
- Other pages: `../owner/` or `../player/` or `../shared/` or `../auth/`

### From pages/shared/ (about-us.html, contact-us.html)
- CSS: `../../styles/shared/`
- JS: `../../scripts/shared/`
- Images: `../../assets/images/`
- Other pages: `../player/` or `../owner/` or `../shared/` or `../auth/`

## File Naming Conventions

- **HTML files**: Use kebab-case (e.g., `field-info.html`)
- **CSS files**: Match HTML file names (e.g., `field-info.css`)
- **JS files**: Match HTML file names (e.g., `field-info.js`)
- **Old names → New names**:
  - `index.html` → `pages/auth/login.html`
  - `home-player.html` → `pages/player/home.html`
  - `my-booking-player.html` → `pages/player/bookings.html`
  - `chat-player.html` → removed (internal user chat discontinued)
  - `styles.css` → `styles/shared/base.css`
  - `script.js` → `scripts/auth/login.js`

## Adding New Features

When adding new user types or features:

1. Create appropriate directories in `pages/`, `styles/`, and `scripts/`
2. Follow the existing naming conventions
3. Update navigation links in sidebar components
4. Use relative paths from the page location

## Owner Dashboard Features

The owner dashboard (`pages/owner/dashboard.html`) includes:
- Overview cards showing key metrics (Today's bookings, Upcoming bookings, Total Fields, Revenue)
- Upcoming bookings table with time filters (Today/This week)
- My Fields section with field cards and quick actions
- Navigation sidebar with owner-specific menu items
- Profile and notification popups

## Next Steps

- Create additional owner pages (bookings.html, fields.html)
- Add field management functionality
- Organize shared components if needed
- Set up build tools if transitioning to React


