const dbService = require('../data/dbService');
const {
  CANONICAL_HUBS,
  findMultimodalRoutes,
  extractTransitIntent,
  formatDeterministicReply
} = require('../services/routeEngine');

const aiController = {
  /**
   * Dedicated Multimodal Routing Engine endpoint
   * POST /api/routes/multimodal
   */
  async getMultimodalRoute(req, res, next) {
    try {
      const { origin, destination, preference } = req.body;
      const result = await findMultimodalRoutes(origin, destination, preference);

      if (!result.success) {
        return res.status(result.code === 'SAME_LOCATION' ? 400 : 404).json(result);
      }

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * Conversational Assistant with Multimodal Routing Integration
   * POST /api/ai/chat
   */
  async chatbot(req, res, next) {
    try {
      const { message } = req.body;
      const msgLower = (message || '').toLowerCase().trim();

      // 1. Check greetings
      if (/^(hi|hello|hey|greetings|namaste)\b/i.test(msgLower)) {
        return res.status(200).json({
          reply: `Hello! I am your **JammuMove Route Assistant**.
I provide verified multimodal route recommendations across Jammu (combining Smart Electric Buses, E-Rickshaws, Walking, and Carpools).

**Try asking**:
• *"How do I go from Janipur to Gandhi Nagar?"*
• *"Cheapest route from Panjtirthi to Railway Station"*
• *"Fastest way from University to Satwari Airport"*

You can also use our **Multimodal Journey Planner** and **Fare Estimator** below!`
        });
      }

      // 2. Check general fare schedule inquiries
      if (
        (msgLower.includes('fare') || msgLower.includes('rate') || msgLower.includes('cost') || msgLower.includes('price')) &&
        !msgLower.includes('from') && !msgLower.includes(' to ') && !msgLower.includes('between')
      ) {
        return res.status(200).json({
          reply: `**Jammu Standard Transit Fares (Verified Municipal Rates)**:
• **Smart Electric Buses (Route 1A & Route 4)**: ₹10 - ₹25 depending on stages.
• **Local Shared E-Rickshaws**: ₹15 - ₹25 for short-to-medium connecting corridors.
• **City Matadors / Minibuses**: ₹15 - ₹25 for standard city stages.
• **Community Carpools**: ₹40 - ₹100 for verified driver listings.

To calculate an exact journey, specify your start and destination (e.g., *"Janipur to Railway Station"*), or use the **AI Fare Estimator** on this page!`
        });
      }

      // 3. Extract transit intent (Origin, Destination, Preference)
      const transitIntent = extractTransitIntent(message);

      if (transitIntent && transitIntent.hasRouteIntent) {
        const { origin, destination, preference } = transitIntent;

        // Execute verified route engine
        const routeResult = await findMultimodalRoutes(origin.name, destination.name, preference);

        if (routeResult.success) {
          let replyText = null;

          // Attempt AI explanation via Gemini if configured
          if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
            try {
              replyText = await callGeminiToExplainRoute(message, routeResult, 5000);
            } catch (apiErr) {
              console.warn('[AI Service Warning] External AI error/timeout, using deterministic formatter:', apiErr.message);
            }
          }

          // Use deterministic explanation if Gemini is unavailable or failed
          if (!replyText || replyText.trim().length === 0) {
            replyText = formatDeterministicReply(routeResult);
          }

          return res.status(200).json({
            reply: replyText,
            routeData: routeResult
          });
        }

        if (routeResult.code === 'SAME_LOCATION') {
          return res.status(200).json({
            reply: `Origin and destination cannot both be **${origin.name}**. Please choose two distinct locations to plan a journey.`
          });
        }

        if (routeResult.code === 'NO_ROUTE_FOUND') {
          return res.status(200).json({
            reply: `No verified public transit or carpool route currently links **${origin.name}** and **${destination.name}** in our active schedule.
Try checking the **Find Rides** tab on the Passenger Dashboard to see if any community member has posted a custom carpool on this route.`
          });
        }
      }

      // If user mentioned only 1 recognized hub (without asking for a route from/to an unknown destination)
      if (transitIntent && !transitIntent.hasRouteIntent && transitIntent.singleHub && !msgLower.includes('from') && !msgLower.includes(' to ')) {
        return res.status(200).json({
          reply: `I recognized **${transitIntent.singleHub.name}**. Where would you like to travel to or from? 
For example: *"How do I go from ${transitIntent.singleHub.name} to Jammu Tawi Railway Station?"*`
        });
      }

      // If user supplied GEMINI_API_KEY, attempt dynamic AI completion with timeout for general questions
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
        try {
          const aiResponse = await callGeminiWithTimeout(message, 5000);
          if (aiResponse && aiResponse.trim().length > 0) {
            return res.status(200).json({ reply: aiResponse });
          }
        } catch (apiErr) {
          console.warn('[AI Service Warning] External AI error/timeout, falling back to local Jammu transit engine:', apiErr.message);
        }
      }

      // Unrecognized or unserved location limitation response
      return res.status(200).json({
        reply: `I could not determine a verified direct public transit route for that query in our current Jammu transit schedule.

**Covered Hubs**: Janipur, Jewel Chowk, Gandhi Nagar, Jammu University, Jammu Tawi Railway Station, Channi Himmat, Satwari (Airport), Talab Tillo, Parade Ground, and Panjtirthi.

**Recommended Actions**:
1. Specify two recognized landmarks (e.g., *"Janipur to Satwari"* or *"University to Railway Station"*).
2. Use the **Multimodal Journey Planner** on this page to select locations from our verified network.
3. Check the **Find Rides** tab on the Passenger Dashboard to find or offer custom carpools.`
      });

    } catch (err) {
      next(err);
    }
  },

  async predictFare(req, res, next) {
    try {
      const { distance } = req.body;
      const dist = parseFloat(distance);

      // Jammu standard fare schedule
      const fares = {
        car: Math.max(50, Math.round(20 + dist * 12)),  // Base 20 + 12 per km
        auto: Math.max(30, Math.round(15 + dist * 8)),  // Base 15 + 8 per km
        bike: Math.max(20, Math.round(10 + dist * 5))   // Base 10 + 5 per km
      };

      res.status(200).json({ fares });
    } catch (err) {
      next(err);
    }
  },

  async predictDemand(req, res, next) {
    try {
      const { routeName } = req.body;
      const hour = new Date().getHours();
      
      let level = 'Medium';
      let factor = 1.0;
      let reason = 'Moderate traffic flow during standard midday hours.';

      if (hour >= 8 && hour <= 11) {
        level = 'High';
        factor = 1.35;
        reason = 'Morning rush hour: Heavy office, secretariat, and university commuter movement.';
      } else if (hour >= 17 && hour <= 20) {
        level = 'High';
        factor = 1.4;
        reason = 'Evening peak hour: Congestion around Jewel Chowk and Tawi Bridges as commuters return home.';
      } else if (hour >= 21 || hour <= 6) {
        level = 'Low';
        factor = 0.85;
        reason = 'Night hours: Free flow across transit corridors with reduced bus and shared auto frequency.';
      }

      res.status(200).json({
        routeName: routeName || 'General Jammu Corridor',
        level,
        factor,
        reason
      });
    } catch (err) {
      next(err);
    }
  },

  async checkSpam(req, res, next) {
    try {
      const { price, startName, endName, availableSeats } = req.body;

      const p = parseFloat(price);
      const seats = parseInt(availableSeats, 10);

      const reasons = [];
      let isSpam = false;

      if (p <= 0) {
        isSpam = true;
        reasons.push('Price must be greater than zero.');
      } else if (p > 500) {
        isSpam = true;
        reasons.push('Carpool price exceeds reasonable city bounds (max ₹500 for local Jammu routes).');
      }

      if (seats < 1 || seats > 6) {
        isSpam = true;
        reasons.push('Invalid seat capacity for a standard carpool listing (must be 1-6).');
      }

      if (startName && endName && startName.trim().toLowerCase() === endName.trim().toLowerCase()) {
        isSpam = true;
        reasons.push('Pickup and drop-off locations cannot be identical.');
      }

      res.status(200).json({
        isSpam,
        reasons
      });
    } catch (err) {
      next(err);
    }
  }
};

/**
 * Calls Google Gemini to generate a clear, courteous explanation of verified route engine results
 */
async function callGeminiToExplainRoute(userPrompt, verifiedRoute, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const promptText = `You are JammuMove's verified Transit Assistant for Jammu, J&K.
The user asked: "${userPrompt}"

Our municipal route engine has calculated the following VERIFIED multimodal journey:
- Origin: ${verifiedRoute.origin.name}
- Destination: ${verifiedRoute.destination.name}
- Mode Summary: ${verifiedRoute.routes[0].summary}
- Total Fare: ₹${verifiedRoute.routes[0].totalFare}
- Estimated Duration: ~${verifiedRoute.routes[0].totalDurationMins} minutes
- Transfers: ${verifiedRoute.routes[0].transfers}
- Journey Legs:
${verifiedRoute.routes[0].legs.map(l => `  * Leg ${l.legIndex}: [${l.mode.toUpperCase()}] ${l.instruction} (Duration: ${l.durationMins}m, Fare: ₹${l.fare})`).join('\n')}

INSTRUCTIONS:
1. Explain this exact journey clearly, courteously, and concisely to the commuter.
2. DO NOT invent, hallucinate, or alter any stops, transfers, transport modes, fares, or durations.
3. Use the exact total fare of ₹${verifiedRoute.routes[0].totalFare} and duration of ~${verifiedRoute.routes[0].totalDurationMins} minutes.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ]
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (explanation && explanation.length > 20) {
      return explanation;
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * General Gemini helper for non-routing inquiries
 */
async function callGeminiWithTimeout(userPrompt, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `You are the JammuMove AI Route Assistant for Jammu, Jammu & Kashmir, India.
Provide helpful, concise transit guidance across Jammu city corridors (Janipur, Jewel Chowk, Gandhi Nagar, Jammu University, Railway Station, Channi Himmat, Satwari Airport, Talab Tillo, Panjtirthi, Parade Ground).
Include realistic route suggestions, public bus options (e.g. Route 1A, Route 4), and shared auto estimates.
Never fabricate non-existent bus routes or fake fares. If you cannot determine a reliable route, state the limitation clearly.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }]
          }
        ]
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = aiController;
