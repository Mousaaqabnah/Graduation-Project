// Example usage of VenueCard component
import React, { useState } from 'react';
import VenueCard from './VenueCard';

const VenueCardExample = () => {
  const [favorites, setFavorites] = useState({});

  const handleFavoriteClick = (venueId) => {
    setFavorites((prev) => ({
      ...prev,
      [venueId]: !prev[venueId],
    }));
  };

  const handleBookClick = (venueId) => {
    console.log('Booking venue:', venueId);
    // Add your booking logic here
  };

  const venues = [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1575361204480-05e6dab6e0c0?w=400&h=300&fit=crop',
      category: 'Football',
      title: 'Fozi football court',
      rating: 4.8,
      reviews: 98,
      district: 'Uskudar',
      distance: '2.1 km',
      type: 'indoor',
      price: '₺1500/h',
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1534158914592-062992fbe900?w=400&h=300&fit=crop',
      category: 'Tennis',
      title: 'Premium Tennis Court',
      rating: 4.9,
      reviews: 127,
      district: 'Kadikoy',
      distance: '3.5 km',
      type: 'outdoor',
      price: '₺2000/h',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-gray-50">
      {venues.map((venue) => (
        <VenueCard
          key={venue.id}
          {...venue}
          isFavorite={favorites[venue.id] || false}
          onFavoriteClick={() => handleFavoriteClick(venue.id)}
          onBookClick={() => handleBookClick(venue.id)}
        />
      ))}
    </div>
  );
};

export default VenueCardExample;














