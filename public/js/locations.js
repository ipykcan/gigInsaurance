// Shared Location Data and Services
export const INDIAN_LOCATIONS = {
    "Gujarat": {
        "Vadodara": [
            { name: "Alkapuri", lat: 22.3130, lng: 73.1650 },
            { name: "Station Road", lat: 22.3117, lng: 73.1812 },
            { name: "Waghodia", lat: 22.3008, lng: 73.3639 },
            { name: "Sama Savli", lat: 22.3486, lng: 73.1932 },
            { name: "Gotri", lat: 22.3087, lng: 73.1497 }
        ],
        "Ahmedabad": [
            { name: "Navrangpura", lat: 23.0360, lng: 72.5469 },
            { name: "Satellite", lat: 23.0276, lng: 72.5054 },
            { name: "Vastrapur", lat: 23.0384, lng: 72.5290 },
            { name: "Bopal", lat: 23.0333, lng: 72.4634 }
        ],
        "Surat": [
            { name: "Adajan", lat: 21.1963, lng: 72.7937 },
            { name: "Vesu", lat: 21.1418, lng: 72.7709 },
            { name: "Varachha", lat: 21.2185, lng: 72.8465 }
        ]
    },
    "Maharashtra": {
        "Mumbai": [
            { name: "Andheri", lat: 19.1136, lng: 72.8697 },
            { name: "Bandra", lat: 19.0596, lng: 72.8295 },
            { name: "Dadar", lat: 19.0193, lng: 72.8429 }
        ],
        "Pune": [
            { name: "Kothrud", lat: 18.5074, lng: 73.8077 },
            { name: "Viman Nagar", lat: 18.5679, lng: 73.9143 },
            { name: "Hinjewadi", lat: 18.5913, lng: 73.7389 }
        ]
    },
    "Karnataka": {
        "Bengaluru": [
            { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
            { name: "Koramangala", lat: 12.9352, lng: 77.6245 },
            { name: "Whitefield", lat: 12.9698, lng: 77.7499 }
        ]
    },
    "Delhi": {
        "New Delhi": [
            { name: "Connaught Place", lat: 28.6315, lng: 77.2167 },
            { name: "Hauz Khas", lat: 28.5494, lng: 77.2001 },
            { name: "Dwarka", lat: 28.5823, lng: 77.0500 }
        ]
    }
};

export function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

export function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

export function getNearestLocation(lat, lng) {
    let nearest = null;
    let minDistance = Infinity;

    for (const state in INDIAN_LOCATIONS) {
        for (const city in INDIAN_LOCATIONS[state]) {
            for (const area of INDIAN_LOCATIONS[state][city]) {
                const dist = getDistanceFromLatLonInKm(lat, lng, area.lat, area.lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearest = {
                        name: area.name,
                        city: city,
                        state: state,
                        distance: dist
                    };
                }
            }
        }
    }
    return nearest;
}
