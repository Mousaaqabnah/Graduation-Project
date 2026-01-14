# React + Tailwind CSS Setup Instructions

## Prerequisites
- Node.js (v14 or higher)
- npm or yarn

## Installation Steps

### 1. Initialize React Project (if starting fresh)
```bash
npx create-react-app matchfield-app
cd matchfield-app
```

### 2. Install Tailwind CSS
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 3. Configure Tailwind CSS

Update `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 4. Add Tailwind to CSS

In `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 5. Use the VenueCard Component

1. Copy `VenueCard.jsx` to your `src/components` folder
2. Import and use it in your components:

```jsx
import VenueCard from './components/VenueCard';

function App() {
  return (
    <div className="p-6">
      <VenueCard
        image="https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=400&h=300&fit=crop"
        category="Football"
        title="Fozi football court"
        rating={4.8}
        reviews={98}
        district="Uskudar"
        distance="2.1 km"
        type="indoor"
        price="₺1500/h"
        isFavorite={false}
        onFavoriteClick={() => console.log('Favorite clicked')}
        onBookClick={() => console.log('Book clicked')}
      />
    </div>
  );
}
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| image | string | '/placeholder.jpg' | Image URL for the venue |
| category | string | 'Football' | Sport category badge |
| title | string | 'Fozi football court' | Venue name |
| rating | number | 4.8 | Rating score |
| reviews | number | 98 | Number of reviews |
| district | string | 'Uskudar' | District/location name |
| distance | string | '2.1 km' | Distance from user |
| type | string | 'indoor' | Venue type (indoor/outdoor) |
| price | string | '₺1500/h' | Price per hour |
| isFavorite | boolean | false | Favorite status |
| onFavoriteClick | function | undefined | Callback when favorite clicked |
| onBookClick | function | undefined | Callback when book clicked |

## Features

- ✅ Fully responsive design
- ✅ Hover effects and transitions
- ✅ Favorite toggle functionality
- ✅ Clean, modern UI
- ✅ Accessible (proper button semantics)
- ✅ Customizable via props































