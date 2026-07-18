import type { Alternative, CommunicationTemplate, PassengerContext, Perk } from "./types.js";

export const demoPassenger = (): PassengerContext => ({
  token: "TKN-GOLD-4471",
  tier: "Premium",
  preferences: ["Vegan"],
});

export const demoAlternatives = (): Alternative[] => [
  {
    id: "offer_1",
    flightNumber: "BA283",
    departure: "2026-07-18T16:00:00Z",
    arrival: "2026-07-18T19:00:00Z",
    cabin: "Economy",
    availability: "held",
  },
  {
    id: "offer_2",
    flightNumber: "BA295",
    departure: "2026-07-18T18:15:00Z",
    arrival: "2026-07-18T21:25:00Z",
    cabin: "Economy",
    availability: "available",
  },
  {
    id: "offer_3",
    flightNumber: "BA177",
    departure: "2026-07-18T20:30:00Z",
    arrival: "2026-07-18T23:40:00Z",
    cabin: "Premium Economy",
    availability: "available",
  },
];

export const demoTemplate = (): CommunicationTemplate => ({
  locale: "en-GB",
  tone: "reassuring and concise",
  body: "Apologise for the weather delay, present the held alternative clearly, and offer the available comfort perks.",
});

export const demoPerks = (): Perk[] => [
  { kind: "coffee", price: 0, currency: "USD" },
  { kind: "lounge_pass", price: 20, currency: "USD" },
];
