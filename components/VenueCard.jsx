import React from 'react';

const VenueCard = ({
  image = '/placeholder.jpg',
  category = 'Football',
  title = 'Fozi football court',
  rating = 4.8,
  reviews = 98,
  district = 'Uskudar',
  distance = '2.1 km',
  type = 'indoor',
  price = '₺1500/h',
  isFavorite = false,
  onFavoriteClick,
  onBookClick
}) => {
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1">
      {/* Image Section */}
      <div className="relative w-full h-48 overflow-hidden rounded-t-3xl">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
        
        {/* Category Badge */}
        <div className="absolute top-3 left-3 bg-black/60 text-white px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize">
          {category}
        </div>
        
        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteClick && onFavoriteClick();
          }}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 ${
            isFavorite ? 'bg-red-500' : 'bg-black/60'
          }`}
        >
          <svg
            className="w-5 h-5 text-white"
            fill={isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      {/* Content Section */}
      <div className="p-5">
        {/* Venue Name */}
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>

        {/* Rating, Location, and Type */}
        <div className="mb-4 space-y-2">
          {/* Rating and Location */}
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <span className="text-yellow-400 text-base">★</span>
            <span>
              {rating} ({reviews}) · {district} · {distance}
            </span>
          </div>

          {/* Type Badge */}
          <span className="inline-block px-3 py-1 bg-gray-300 text-gray-600 rounded-full text-xs font-medium">
            {type}
          </span>
        </div>

        {/* Price and Book Button */}
        <div className="flex flex-col items-end gap-2 mt-4">
          <span className="text-xl font-bold text-gray-900">{price}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookClick && onBookClick();
            }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors duration-200"
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
};

export default VenueCard;














