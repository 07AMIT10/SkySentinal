# 📄 Product Requirements Document: SkySentinel 
**The Proactive, Privacy-First & Cost-Efficient Disruption Agent**

## 1. Executive Summary
Flight disruptions cost the travel industry billions in support overhead, SLA penalties, and customer churn. Current AI solutions are often too expensive to deploy at scale (costing dollars per passenger via premium LLMs) and pose massive PII compliance risks.

**SkySentinel** is an autonomous, proactive disruption management agent built for massive scale. When a flight is delayed, it uses ultra-fast, open-source inference (via Groq/OpenRouter) to act as a hyper-personalized concierge. It finds alternative flights, packages them with contextual perks, drafts a brand-compliant message, and queues it for Human-in-the-Loop (HITL) approval. It turns a net-negative experience into a loyalty-building moment, utilizing a strict zero-PII architecture at a fraction of standard AI inference costs.

## 2. Alignment with Judging Criteria
*   **Scalable AI Integration (New Focus):** By utilizing open-source models (e.g., Llama 3/Mistral) via Groq/OpenRouter, the solution demonstrates how to handle massive concurrency (e.g., a weather event delaying 50 flights) without exorbitant premium API costs.
*   **Innovation:** Shifts disruption from a "cost center" to a "revenue retention/upsell" opportunity.
*   **Technical Feasibility:** 80% orchestration glue. Easily completable in 2 hours using OpenAI-compatible SDKs pointed at Groq/OpenRouter.
*   **Customer & Business Impact:** Eliminates the "black box" of travel delays; prevents call center surges while maintaining a 99% cheaper inference overhead.
*   **Quality & Demo:** Features a dramatic, real-time "Agent Trace Dashboard" showing lightning-fast tool orchestration, concluding with a high-stakes HITL approval screen.

## 3. Core Value Proposition (Business & Revenue Impact)
*   **Frictionless Scalability:** Disruption is spiky (weather events). Groq’s LPU technology and OpenRouter's free-tier open models allow the airline to spin up 10,000 concurrent agent threads for pennies.
*   **Revenue Generation (Micro-upsells):** The agent offers contextual upsells at a discount (e.g., *"Since you have a 3h delay, we've secured a window seat on the next flight and offer a discounted $15 Lounge Pass"*).
*   **Enterprise Governance:** Solves the #1 blocker for enterprise AI adoption—fear of autonomous action—by using a strict Human-In-The-Loop (HITL) gate and Zero-PII context windows.

---

## 4. Sponsor Technology Integration (The Tech Stack)

| Tech / Sponsor | Role in SkySentinel MVP | Real vs. Hardcoded |
| :--- | :--- | :--- |
| **Groq / OpenRouter** | **The Orchestration & Reasoning Engine.** Uses blazing-fast free-tier models (e.g., Llama-3-70B via Groq or Mistral via OpenRouter) to parse data, select flights, and draft hyper-personalized messages. *(Note: If Claude is a strict sponsor requirement, OpenRouter can also route to Claude's free/cheap tiers, but the pitch focuses on OS scalability).* | **REAL** |
| **Amadeus** | `Flight Offers Search API`. Queries real alternative flights for the disrupted route and date. | **REAL** |
| **Contentstack** | Headless CMS storing localized communication templates, brand guidelines, and compliance disclaimers injected into the LLM's prompt. | **REAL** |
| **SurrealDB** | Graph DB mocking the relational context: `[Passenger_Token] -> (prefers) -> [Aisle Seat] -> (located_at) -> [Terminal B]`. | *Hardcoded/Mock* |
| **Appwrite** | Backend-as-a-Service hosting the HITL Agent Dashboard, secure Auth for the human agents, and De-tokenization logic. | **REAL** |

---

## 5. Security & Privacy: The "Zero-PII" Architecture
Enterprise airlines will not let AI touch raw customer data, especially on open-source public endpoints. SkySentinel is built on a **Tokenized Context Protocol**:
1.  **Event Trigger:** System detects delay.
2.  **Anonymization:** Data is stripped. The Groq/OpenRouter LLM only receives: `Passenger: TKN-GOLD-4471`, `Tier: Premium`, `Prefers: Vegan`. *No names, emails, or passports.*
3.  **Agent Logic:** The open-source model generates the itinerary and message for `TKN-GOLD-4471`.
4.  **HITL Gate:** Human agent reviews the action.
5.  **De-tokenization:** Only upon human "Approve," a privileged, non-AI edge function (Appwrite) replaces the token with the real name and dispatches the email/SMS. 

---

## 6. The MVP Demo Flow (The "Golden Path")
This is exactly what the judges will see on screen:

*   **Step 1: The Trigger (UI):** A clean dashboard with a big red button: `[Simulate: WX Delay LHR->JFK (Flight BA117)]`.
*   **Step 2: The Agent Trace (UI - Lightning Fast):** A terminal-like timeline renders live. Because you are using Groq/Open-Source, highlight the *speed* in the trace:
    *   *`[12ms] Fetched affected passenger manifest (Tokenized via Appwrite)`*
    *   *`[412ms] Amadeus API: Fetched 3 alternative LHR->JFK flights.`*
    *   *`[85ms] Contentstack: Retrieved "Premium Tier Weather Delay" localized template.`*
    *   *`[310ms] Groq (Llama-3-70b): Reasoning recovery package & drafting message.`* *(Point out this blazing speed during the demo!)*
*   **Step 3: The HITL Gate (UI):** Screen pauses. Shows the proposed action for Passenger `TKN-GOLD-4471`. 
    *   *Proposed Message:* "We're sorry for the delay. We've tentatively held a seat on the 4:00 PM flight. While you wait, enjoy complimentary coffee at Terminal 5, or upgrade to the First Class lounge for just $20."
*   **Step 4: Approval (Action):** The judge clicks **[Approve & De-Tokenize]**.
*   **Step 5: The "Wow" Finish (Smoke & Mirrors):** Multi-channel icons (SMS/WhatsApp/Email) light up green. A "Metrics Dashboard" updates live: 
    *   `Cost Saved: $450 (Call Center Deflection)`
    *   `Upsell Captured: $20`
    *   `Inference Cost: $0.0001 (Powered by Open-Source AI)`
