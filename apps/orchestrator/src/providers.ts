import { SafeError } from "./errors.js";
import { demoAlternatives, demoPassenger, demoTemplate } from "./fixtures.js";
import { assertNoPii, safePrompt } from "./privacy.js";
import type {
  Alternative,
  CommunicationTemplate,
  DeliveryReceipt,
  PassengerContext,
  ProviderGateway,
  ProviderResult,
  RuntimeConfig,
  StartRunInput,
} from "./types.js";

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const stringValue = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

const requestJson = async (url: string, init: RequestInit): Promise<Record<string, unknown>> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new SafeError("PROVIDER_UNAVAILABLE", "An external provider could not be reached.", 502, true);
  }
  if (!response.ok) {
    throw new SafeError("PROVIDER_UNAVAILABLE", "An external provider could not complete this request.", 502, true);
  }
  try {
    return asRecord(await response.json());
  } catch {
    throw new SafeError("PROVIDER_UNAVAILABLE", "An external provider returned an invalid response.", 502, true);
  }
};

class DemoProviders implements ProviderGateway {
  async getAffectedPassenger(_input: StartRunInput): Promise<ProviderResult<PassengerContext>> {
    return { value: demoPassenger(), source: "demo" };
  }

  async searchRebookingOptions(_input: StartRunInput): Promise<ProviderResult<Alternative[]>> {
    return { value: demoAlternatives(), source: "demo" };
  }

  async getCommunicationTemplate(
    _input: StartRunInput,
    _passenger: PassengerContext,
  ): Promise<ProviderResult<CommunicationTemplate>> {
    return { value: demoTemplate(), source: "demo" };
  }

  async draftRecoveryMessage(input: Parameters<ProviderGateway["draftRecoveryMessage"]>[0]): Promise<ProviderResult<string>> {
    assertNoPii(input, "draftInput");
    const lounge = input.perks.find((perk) => perk.kind === "lounge_pass");
    const loungeText = lounge ? ` or upgrade to the First Class lounge for just $${lounge.price}` : "";
    return {
      value: `We're sorry for the weather delay. We've tentatively held a seat on the ${input.alternative.flightNumber} service departing at ${input.alternative.departure}. While you wait, enjoy complimentary coffee${loungeText}.`,
      source: "demo",
    };
  }

  async queueApprovedDelivery(
    input: Parameters<ProviderGateway["queueApprovedDelivery"]>[0],
  ): Promise<ProviderResult<DeliveryReceipt>> {
    assertNoPii(input, "deliveryInput");
    return { value: { channels: ["SMS", "WhatsApp", "Email"] }, source: "demo" };
  }
}

class LiveProviders implements ProviderGateway {
  private readonly demo = new DemoProviders();

  constructor(private readonly config: RuntimeConfig) {}

  private async fallback<T>(
    live: () => Promise<T>,
    demo: () => Promise<ProviderResult<T>>,
  ): Promise<ProviderResult<T>> {
    try {
      return { value: await live(), source: "live" };
    } catch {
      const fallback = await demo();
      return { value: fallback.value, source: "demo-fallback" };
    }
  }

  async getAffectedPassenger(input: StartRunInput): Promise<ProviderResult<PassengerContext>> {
    // The passenger graph is intentionally mock/tokenized even in live mode.
    return this.demo.getAffectedPassenger(input);
  }

  async searchRebookingOptions(input: StartRunInput): Promise<ProviderResult<Alternative[]>> {
    return this.fallback(
      async () => {
        const tokenResponse = await requestJson("https://test.api.amadeus.com/v1/security/oauth2/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: this.config.amadeusClientId ?? "",
            client_secret: this.config.amadeusClientSecret ?? "",
          }),
        });
        const accessToken = stringValue(tokenResponse.access_token);
        if (!accessToken) throw new SafeError("PROVIDER_UNAVAILABLE", "Amadeus authentication failed.", 502, true);

        const departure = new Date();
        departure.setUTCDate(departure.getUTCDate() + 7);
        const departureDate = departure.toISOString().slice(0, 10);
        const query = new URLSearchParams({
          originLocationCode: input.route.origin,
          destinationLocationCode: input.route.destination,
          departureDate,
          adults: "1",
          max: "3",
        });
        const result = await requestJson(`https://test.api.amadeus.com/v2/shopping/flight-offers?${query}`, {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        const offers = Array.isArray(result.data) ? result.data : [];
        const alternatives = offers.slice(0, 3).map((offer, index): Alternative => {
          const itineraries = asRecord(offer).itineraries;
          const firstItinerary = Array.isArray(itineraries) ? itineraries[0] : undefined;
          const itinerary = asRecord(firstItinerary);
          const firstSegment = asRecord((Array.isArray(itinerary.segments) ? itinerary.segments : [])[0]);
          const departure = asRecord(firstSegment.departure);
          const arrival = asRecord(firstSegment.arrival);
          const carrier = stringValue(firstSegment.carrierCode, "BA");
          const number = stringValue(firstSegment.number, String(200 + index));
          return {
            id: `amadeus_offer_${index + 1}`,
            flightNumber: `${carrier}${number}`,
            departure: stringValue(departure.at, "2026-07-18T16:00:00Z"),
            arrival: stringValue(arrival.at, "2026-07-18T19:00:00Z"),
            cabin: "Economy",
            availability: index === 0 ? "held" : "available",
          };
        });
        if (!alternatives.length) throw new SafeError("PROVIDER_UNAVAILABLE", "Amadeus returned no alternatives.", 502, true);
        return alternatives;
      },
      () => this.demo.searchRebookingOptions(input),
    );
  }

  async getCommunicationTemplate(
    input: StartRunInput,
    passenger: PassengerContext,
  ): Promise<ProviderResult<CommunicationTemplate>> {
    return this.fallback(
      async () => {
        const environment = encodeURIComponent(this.config.contentstackEnvironment ?? "");
        const result = await requestJson(
          `https://cdn.contentstack.io/v3/content_types/communication_templates/entries?environment=${environment}&locale=en-us`,
          {
            headers: {
              api_key: this.config.contentstackApiKey ?? "",
              access_token: this.config.contentstackDeliveryToken ?? "",
            },
          },
        );
        const entries = Array.isArray(result.entries) ? result.entries : [];
        const entry = asRecord(entries[0]);
        const body = stringValue(entry.body) || stringValue(entry.message);
        if (!body) throw new SafeError("PROVIDER_UNAVAILABLE", "Contentstack returned no usable template.", 502, true);
        const template = { locale: stringValue(entry.locale, "en-GB"), tone: stringValue(entry.tone, "reassuring"), body };
        assertNoPii({ input, passenger, template }, "contentstackTemplate");
        return template;
      },
      () => this.demo.getCommunicationTemplate(input, passenger),
    );
  }

  async draftRecoveryMessage(
    input: Parameters<ProviderGateway["draftRecoveryMessage"]>[0],
  ): Promise<ProviderResult<string>> {
    return this.fallback(
      async () => {
        const prompt = safePrompt(input as unknown as Record<string, unknown>);
        const base = (this.config.llmBaseUrl ?? "").replace(/\/$/, "");
        const result = await requestJson(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.config.llmApiKey ?? ""}`,
          },
          body: JSON.stringify({
            model: this.config.llmModel,
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content:
                  "Draft a concise airline recovery message. Use only the supplied tokenized context. Do not request, infer, or output names, contact details, booking references, passport, or payment data.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });
        const choices = Array.isArray(result.choices) ? result.choices : [];
        const message = asRecord(asRecord(choices[0]).message).content;
        if (typeof message !== "string" || !message.trim()) {
          throw new SafeError("PROVIDER_UNAVAILABLE", "The language model returned no message.", 502, true);
        }
        assertNoPii(message, "llmOutput");
        return message.trim();
      },
      () => this.demo.draftRecoveryMessage(input),
    );
  }

  async queueApprovedDelivery(
    input: Parameters<ProviderGateway["queueApprovedDelivery"]>[0],
  ): Promise<ProviderResult<DeliveryReceipt>> {
    return this.fallback(
      async () => {
        assertNoPii(input, "deliveryInput");
        const endpoint = (this.config.appwriteEndpoint ?? "").replace(/\/$/, "");
        await requestJson(`${endpoint}/functions/skysentinel-delivery-adapter/executions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-appwrite-project": this.config.appwriteProjectId ?? "",
            "x-appwrite-key": this.config.appwriteApiKey ?? "",
          },
          body: JSON.stringify({ body: JSON.stringify(input), async: true }),
        });
        return { channels: ["SMS", "WhatsApp", "Email"] };
      },
      () => this.demo.queueApprovedDelivery(input),
    );
  }
}

export const createProviders = (config: RuntimeConfig): ProviderGateway =>
  config.demoMode ? new DemoProviders() : new LiveProviders(config);
