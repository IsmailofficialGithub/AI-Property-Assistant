-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Clean up old tables to ensure fresh schema
DROP TABLE IF EXISTS property_search_cache;
DROP TABLE IF EXISTS properties;

-- 1. Create the properties table
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_type TEXT NOT NULL, -- Apartment, Villa, Studio
    price NUMERIC(15, 2),
    city TEXT,
    state TEXT,
    availability BOOLEAN DEFAULT TRUE,
    bedrooms INTEGER,
    amenities TEXT[], 
    image_url TEXT, -- New Column for Premium Visuals
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create the property_search_cache table
CREATE TABLE property_search_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    city TEXT NOT NULL UNIQUE,
    results JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Insert Mock Data with Premium Image Paths
INSERT INTO properties (property_type, price, city, state, availability, bedrooms, amenities, image_url)
VALUES 
('Apartment', 4500, 'New York', 'NY', true, 2, ARRAY['Gym', 'Concierge', 'Skyline View'], '/assets/luxury_ny_apartment.png'),
('Apartment', 3800, 'New York', 'NY', true, 3, ARRAY['Pool', 'Parking'], '/assets/luxury_ny_apartment.png'),
('Villa', 7500, 'Miami', 'FL', true, 4, ARRAY['Private Pool', 'Beach Access', 'Gym'], '/assets/miami_villa.png'),
('Villa', 6200, 'Miami', 'FL', true, 3, ARRAY['Garden', 'Smart Home'], '/assets/miami_villa.png'),
('Studio', 1800, 'New York', 'NY', true, 0, ARRAY['Central Air', 'Near Subway'], '/assets/modern_studio.png'),
('Studio', 1400, 'Miami', 'FL', true, 0, ARRAY['Parking', 'Fully Furnished'], '/assets/modern_studio.png'),
('Apartment', 2800, 'Los Angeles', 'CA', true, 2, ARRAY['Gym', 'Balcony'], '/assets/luxury_ny_apartment.png');
