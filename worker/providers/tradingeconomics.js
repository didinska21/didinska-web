import { EconomicProvider } from "./economic.js";

// ══════════════════════════════════════════════════════════
//  TRADING ECONOMICS PROVIDER — implementasi konkret EconomicProvider.
//  Sprint ini baru fondasi: belum fetch API apa pun.
// ══════════════════════════════════════════════════════════
export class TradingEconomicsProvider extends EconomicProvider {
    async fetch(env) {
        return [];
    }
}
