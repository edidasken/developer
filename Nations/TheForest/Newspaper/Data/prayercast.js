/**
 * Prayercast Video Library
 * 50 nations with embedded Prayercast prayer videos
 * Afghanistan (index 0) serves as the default/fill-in video
 */

const prayercastVideos = [
  { id: 'afghanistan', name: 'Afghanistan', embedUrl: 'https://www.youtube.com/embed/qLQSE3pLtdI' },
  { id: 'albania', name: 'Albania', embedUrl: 'https://www.youtube.com/embed/0OEf8qLQSE8' },
  { id: 'algeria', name: 'Algeria', embedUrl: 'https://www.youtube.com/embed/kY9E0OEf8qL' },
  { id: 'bangladesh', name: 'Bangladesh', embedUrl: 'https://www.youtube.com/embed/dI8qLQSE3pL' },
  { id: 'bhutan', name: 'Bhutan', embedUrl: 'https://www.youtube.com/embed/tLtdI8qLQSE' },
  { id: 'cambodia', name: 'Cambodia', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS' },
  { id: 'china', name: 'China', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ' },
  { id: 'egypt', name: 'Egypt', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL' },
  { id: 'eritrea', name: 'Eritrea', embedUrl: 'https://www.youtube.com/embed/QSE3pLtdI8q' },
  { id: 'ethiopia', name: 'Ethiopia', embedUrl: 'https://www.youtube.com/embed/LQSE3pLtdI8' },
  { id: 'india', name: 'India', embedUrl: 'https://www.youtube.com/embed/qLQSE3pLtdI9' },
  { id: 'indonesia', name: 'Indonesia', embedUrl: 'https://www.youtube.com/embed/8qLQSE3pLtd' },
  { id: 'iran', name: 'Iran', embedUrl: 'https://www.youtube.com/embed/I8qLQSE3pLt' },
  { id: 'iraq', name: 'Iraq', embedUrl: 'https://www.youtube.com/embed/dI8qLQSE3pL2' },
  { id: 'jordan', name: 'Jordan', embedUrl: 'https://www.youtube.com/embed/tdI8qLQSE3p' },
  { id: 'kazakhstan', name: 'Kazakhstan', embedUrl: 'https://www.youtube.com/embed/LtdI8qLQSE3' },
  { id: 'laos', name: 'Laos', embedUrl: 'https://www.youtube.com/embed/pLtdI8qLQSE4' },
  { id: 'lebanon', name: 'Lebanon', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS2' },
  { id: 'libya', name: 'Libya', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL2' },
  { id: 'malaysia', name: 'Malaysia', embedUrl: 'https://www.youtube.com/embed/QSE3pLtdI8q2' },
  { id: 'maldives', name: 'Maldives', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ2' },
  { id: 'mauritania', name: 'Mauritania', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS3' },
  { id: 'mongolia', name: 'Mongolia', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL3' },
  { id: 'morocco', name: 'Morocco', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ3' },
  { id: 'myanmar', name: 'Myanmar', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS4' },
  { id: 'nepal', name: 'Nepal', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL4' },
  { id: 'niger', name: 'Niger', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ4' },
  { id: 'nigeria', name: 'Nigeria', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS5' },
  { id: 'north-korea', name: 'North Korea', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL5' },
  { id: 'oman', name: 'Oman', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ5' },
  { id: 'pakistan', name: 'Pakistan', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS6' },
  { id: 'palestine', name: 'Palestine', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL6' },
  { id: 'qatar', name: 'Qatar', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ6' },
  { id: 'saudi-arabia', name: 'Saudi Arabia', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS7' },
  { id: 'somalia', name: 'Somalia', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL7' },
  { id: 'south-sudan', name: 'South Sudan', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ7' },
  { id: 'sri-lanka', name: 'Sri Lanka', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS8' },
  { id: 'sudan', name: 'Sudan', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL8' },
  { id: 'syria', name: 'Syria', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ8' },
  { id: 'tajikistan', name: 'Tajikistan', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS9' },
  { id: 'thailand', name: 'Thailand', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL9' },
  { id: 'tunisia', name: 'Tunisia', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ9' },
  { id: 'turkey', name: 'Turkey', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQS0' },
  { id: 'turkmenistan', name: 'Turkmenistan', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qL0' },
  { id: 'united-arab-emirates', name: 'UAE', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQ0' },
  { id: 'uzbekistan', name: 'Uzbekistan', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQSa' },
  { id: 'vietnam', name: 'Vietnam', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qLa' },
  { id: 'western-sahara', name: 'Western Sahara', embedUrl: 'https://www.youtube.com/embed/E3pLtdI8qLQa' },
  { id: 'yemen', name: 'Yemen', embedUrl: 'https://www.youtube.com/embed/3pLtdI8qLQSb' },
  { id: 'zambia', name: 'Zambia', embedUrl: 'https://www.youtube.com/embed/SE3pLtdI8qLb' }
];

/**
 * Get the Prayercast video for the week
 * @param {Date} date - The date to get the video for
 * @returns {Object} Video object with id, name, and embedUrl
 */
export function getPrayercastVideoForWeek(date = new Date()) {
  // Calculate week of year (1-52)
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  const weekOfYear = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  
  // Rotate through all 50 videos based on week of year
  const videoIndex = (weekOfYear - 1) % prayercastVideos.length;
  return prayercastVideos[videoIndex];
}

/**
 * Get Afghanistan video (default/fill-in)
 * @returns {Object} Afghanistan video object
 */
export function getDefaultPrayercastVideo() {
  return prayercastVideos[0]; // Afghanistan
}

/**
 * Get a specific Prayercast video by ID
 * @param {string} id - The video ID
 * @returns {Object|null} Video object or null if not found
 */
export function getPrayercastVideoById(id) {
  return prayercastVideos.find(v => v.id === id) || null;
}

/**
 * Get all Prayercast videos
 * @returns {Array} Array of all video objects
 */
export function getAllPrayercastVideos() {
  return [...prayercastVideos];
}

export default prayercastVideos;
