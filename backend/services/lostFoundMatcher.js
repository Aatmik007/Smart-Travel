/**
 * Intelligent Lost & Found Matching Engine
 * 
 * Provides:
 * 1. Multi-signal similarity scoring (Category, Location, Descriptive characteristics, Temporal proximity)
 * 2. Transparent signal explanations for all potential matches
 * 3. Privacy-preserving contact details redaction (never exposes private phone/email blindly)
 * 4. Duplicate report detection, incomplete description handling, and expiration guards
 * 5. Safe review workflow (never automatically marks an item as claimed/recovered)
 */

const dbService = require('../data/dbService');

const CATEGORY_KEYWORDS = {
  electronics: [
    'phone', 'mobile', 'charger', 'cable', 'laptop', 'tablet', 'ipad', 
    'earphones', 'headphones', 'airpods', 'powerbank', 'lenovo', 'dell', 
    'hp', 'apple', 'samsung', 'adapter', 'camera', 'smartwatch', 'watch', 
    'usb', 'pendrive', 'macbook', 'iphone', 'oneplus'
  ],
  documents: [
    'aadhar', 'aadhaar', 'pan', 'license', 'driving license', 'passport', 
    'id card', 'rc', 'debit', 'credit card', 'atm card', 'certificate', 
    'documents', 'papers', 'file', 'passbook', 'voter card', 'identity', 
    'university id', 'college id', 'folder'
  ],
  bags: [
    'bag', 'backpack', 'handbag', 'purse', 'wallet', 'luggage', 'suitcase', 
    'duffel', 'briefcase', 'pouch', 'sack', 'tote', 'clutch'
  ],
  keys: [
    'key', 'keys', 'keychain', 'bike key', 'car key', 'scooty key', 
    'house key', 'godrej'
  ],
  clothing: [
    'jacket', 'coat', 'sweater', 'hoodie', 'umbrella', 'sunglasses', 
    'glasses', 'spectacles', 'cap', 'hat', 'scarf', 'shawl', 'shoes', 
    'helmet', 'gloves', 'watch'
  ]
};

const STOP_WORDS = new Set([
  'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'a', 'an', 'is', 'it', 
  'my', 'left', 'forgotten', 'found', 'lost', 'bus', 'trip', 'seats', 'seat', 
  'transit', 'near', 'by', 'with', 'from', 'was', 'this', 'that', 'i', 'color', 
  'item', 'please', 'help', 'return', 'chowk', 'stand'
]);

/**
 * Infers category based on text keywords
 */
function inferCategory(text, explicitCategory) {
  if (explicitCategory && explicitCategory !== 'other') {
    return explicitCategory.toLowerCase().trim();
  }

  const t = (text || '').toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some(w => t.includes(w))) {
      return cat;
    }
  }
  return 'other';
}

/**
 * Tokenizes text into meaningful lowercase word tokens
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Redacts private phone numbers and emails to protect user privacy
 */
function redactContact(contactStr) {
  if (!contactStr || typeof contactStr !== 'string') return 'Contact available upon match request';

  // Mask phone numbers: +91-94191-44444 -> +91-94191-XXXXX
  let redacted = contactStr.replace(/(\+?\d{2,4}[-\s]?)?(\d{5})[-.\s]?(\d{5})/g, (match, country, first5) => {
    const c = country || '';
    return `${c}${first5}-XXXXX`;
  });

  // Mask emails: user@example.com -> u***@example.com
  redacted = redacted.replace(/([a-zA-Z0-9_\-.+]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g, (match, user, domain) => {
    const initial = user.charAt(0);
    return `${initial}***@${domain}`;
  });

  return redacted;
}

/**
 * Checks if a description is too brief or incomplete
 */
function assessDescriptionCompleteness(description) {
  const tokens = tokenize(description);
  if (tokens.length < 2 || description.trim().length < 8) {
    return {
      isComplete: false,
      warning: 'Description is brief. Providing details such as brand, color, or unique marks improves matching accuracy.'
    };
  }
  return { isComplete: true, warning: null };
}

/**
 * Checks if an item is considered expired (> 60 days old and unresolved)
 */
function isReportExpired(item) {
  if (!item.createdAt) return false;
  const createdDate = new Date(item.createdAt);
  const now = new Date();
  const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
  return diffDays > 60 && item.status !== 'claimed';
}

/**
 * Calculates matching score and signals between a target item and a candidate
 */
function calculateMatch(targetItem, candidateItem) {
  // Never match with self
  const targetId = targetItem._id ? targetItem._id.toString() : '';
  const candidateId = candidateItem._id ? candidateItem._id.toString() : '';
  if (targetId && candidateId && targetId === candidateId) {
    return null;
  }

  // Never match reports from the same user
  const targetReporter = targetItem.reporterId ? targetItem.reporterId.toString() : '';
  const candidateReporter = candidateItem.reporterId ? candidateItem.reporterId.toString() : '';
  if (targetReporter && candidateReporter && targetReporter === candidateReporter) {
    return null;
  }

  // Do not match claimed or resolved items
  if (targetItem.status === 'claimed' || candidateItem.status === 'claimed') {
    return null;
  }

  // Do not match expired items
  if (isReportExpired(candidateItem)) {
    return null;
  }

  // Determine complementary report types:
  // e.g., target is 'lost' and candidate is 'found'
  const targetType = targetItem.reportType || (targetItem.status === 'found' ? 'found' : 'lost');
  const candidateType = candidateItem.reportType || (candidateItem.status === 'found' ? 'found' : 'lost');

  // Both shouldn't be the same report type (e.g. matching lost with lost is not a recovery candidate)
  if (targetType === candidateType) {
    return null;
  }

  const signals = [];
  let score = 0;

  // Signal 1: Category Match (Weight: 25 points)
  const targetCat = inferCategory(targetItem.itemDescription, targetItem.category);
  const candidateCat = inferCategory(candidateItem.itemDescription, candidateItem.category);

  if (targetCat === candidateCat && targetCat !== 'other') {
    score += 25;
    signals.push({
      signal: 'Category Match',
      points: 25,
      detail: `Both items classified as '${targetCat}'`
    });
  }

  // Signal 2: Location / Corridor Overlap (Weight: 25 points)
  const targetLoc = (targetItem.location || targetItem.tripId || '').toLowerCase();
  const candidateLoc = (candidateItem.location || candidateItem.tripId || '').toLowerCase();
  const targetDesc = targetItem.itemDescription.toLowerCase();
  const candidateDesc = candidateItem.itemDescription.toLowerCase();

  let locationMatched = false;
  const transitHubs = [
    'route 1a', 'route 4', 'janipur', 'jewel chowk', 'gandhi nagar', 
    'railway station', 'satwari', 'airport', 'jammu university', 
    'panjtirthi', 'parade ground', 'talab tillo', 'channi himmat'
  ];

  for (const hub of transitHubs) {
    const inTarget = targetLoc.includes(hub) || targetDesc.includes(hub);
    const inCandidate = candidateLoc.includes(hub) || candidateDesc.includes(hub);
    if (inTarget && inCandidate) {
      score += 25;
      signals.push({
        signal: 'Transit Location Overlap',
        points: 25,
        detail: `Matching route corridor or landmark '${hub.toUpperCase()}'`
      });
      locationMatched = true;
      break;
    }
  }

  if (!locationMatched && targetItem.tripId && candidateItem.tripId && targetItem.tripId === candidateItem.tripId && targetItem.tripId !== 'General Transit') {
    score += 25;
    signals.push({
      signal: 'Trip Match',
      points: 25,
      detail: `Identical transit trip ID '${targetItem.tripId}'`
    });
  }

  // Signal 3: Tokenized Descriptive Characteristics Overlap (Weight: 35 points)
  const tokensA = new Set(tokenize(targetItem.itemDescription));
  const tokensB = new Set(tokenize(candidateItem.itemDescription));

  const commonTokens = [...tokensA].filter(t => tokensB.has(t));
  const unionSize = new Set([...tokensA, ...tokensB]).size;

  if (commonTokens.length > 0 && unionSize > 0) {
    const jaccard = commonTokens.length / unionSize;
    // Scale Jaccard with booster for matching salient tokens
    const textPoints = Math.min(35, Math.round(jaccard * 35 * 1.8) + (commonTokens.length >= 2 ? 10 : 0));
    score += textPoints;
    signals.push({
      signal: 'Descriptive Keyword Overlap',
      points: textPoints,
      detail: `Shared identifying descriptors: [${commonTokens.join(', ')}]`
    });
  }

  // Signal 4: Temporal Proximity (Weight: 15 points)
  if (targetItem.createdAt && candidateItem.createdAt) {
    const dateA = new Date(targetItem.createdAt);
    const dateB = new Date(candidateItem.createdAt);
    const diffDays = Math.abs((dateA - dateB) / (1000 * 60 * 60 * 24));

    let timePoints = 0;
    if (diffDays <= 2) timePoints = 15;
    else if (diffDays <= 5) timePoints = 10;
    else if (diffDays <= 12) timePoints = 5;

    if (timePoints > 0) {
      score += timePoints;
      signals.push({
        signal: 'Temporal Proximity',
        points: timePoints,
        detail: `Reported within ${Math.ceil(diffDays)} day(s) of each other`
      });
    }
  }

  // Cap score at 100
  score = Math.min(100, score);

  // Match threshold: Must achieve at least 35 points to be presented
  if (score < 35) {
    return null;
  }

  let confidenceLevel = 'Moderate';
  if (score >= 70) confidenceLevel = 'High';
  else if (score < 50) confidenceLevel = 'Low';

  return {
    candidateId: candidateItem._id ? candidateItem._id.toString() : '',
    matchScore: score,
    confidenceLevel,
    itemDescription: candidateItem.itemDescription,
    category: candidateCat,
    location: candidateItem.location || candidateItem.tripId || 'Jammu Transit',
    reportType: candidateType,
    status: candidateItem.status || 'reported',
    createdAt: candidateItem.createdAt,
    maskedContact: redactContact(candidateItem.contactDetails),
    matchSignals: signals,
    workflowGuidance: 'Review signals and verify identifying characteristics before requesting contact exchange.'
  };
}

/**
 * Finds all candidate matches for a given item across the registry
 */
async function findMatchesForItem(targetItem) {
  if (!targetItem) return [];

  const allItems = await dbService.find('lostFound');
  const matches = [];

  for (const candidate of allItems) {
    const match = calculateMatch(targetItem, candidate);
    if (match) {
      matches.push(match);
    }
  }

  // Sort by highest match score
  matches.sort((a, b) => b.matchScore - a.matchScore);
  return matches;
}

/**
 * Checks if a newly reported item is a duplicate of a recent report by the same user
 */
async function checkDuplicateReport(userId, itemDescription) {
  if (!userId || !itemDescription) return false;

  const userItems = await dbService.find('lostFound', { reporterId: userId.toString() });
  const newTokens = new Set(tokenize(itemDescription));

  for (const existing of userItems) {
    // Only check unresolved reports within last 24 hours
    if (existing.status !== 'claimed' && existing.createdAt) {
      const ageHours = (new Date() - new Date(existing.createdAt)) / (1000 * 60 * 60);
      if (ageHours < 24) {
        const existTokens = new Set(tokenize(existing.itemDescription));
        const shared = [...newTokens].filter(t => existTokens.has(t));
        const union = new Set([...newTokens, ...existTokens]).size;
        if (union > 0 && (shared.length / union) >= 0.75) {
          return true;
        }
      }
    }
  }

  return false;
}

module.exports = {
  CATEGORY_KEYWORDS,
  inferCategory,
  tokenize,
  redactContact,
  assessDescriptionCompleteness,
  isReportExpired,
  calculateMatch,
  findMatchesForItem,
  checkDuplicateReport
};
