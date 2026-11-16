// The token radar's model — PLAIN variant (versi polos, for the dev-grade test
// submission): the starter's flat model, one multiple for every protocol.
//
//   implied = round(tvl * 0.25 * (1 + clamp(change_7d, -60, 120) / 100 * 0.5)
//                     * (0.6 + min(age_days, 1095) / 1095 * 0.4))
//
// Age is the time since the protocol was first listed; an unlisted age uses 365 days.
// The band is the leave-one-out residual band of the flat multiple itself: every
// comparable is priced by the flat multiple fitted without it (the median mcap/TVL
// ratio of the rest), and the band is where 80% of those misses fall. The backtest
// also reports the fitted curve's leave-one-out run on the same data, for comparison.
//
// The farm plan is the starter's six generic steps, identical for every protocol.
// The dollar economics are still netted per row on a $1,000 ticket (slice = 10% of
// the implied value times the ticket's share of TVL; gas per chain; forgone 4%
// T-bill over the hold), with the same FARM / THIN / SKIP verdict rules.
//
// This is the plain board the public dev-grade test shows. The real board — the
// comps-fitted curve — lives only in ../real/ and is never submitted before the
// final submission.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The flat model: the starter's constants, one multiple for every protocol. */
export interface FlatModel {
  kind: 'flat';
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  n_comps: number;
}

/** The starter's flat-model constants (see the starter kit's lib/model.ts). */
export const FLAT: Omit<FlatModel, 'kind' | 'n_comps'> = {
  base_multiple: 0.25,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The leave-one-out backtest: the flat multiple's own run, plus the fitted curve's run on the same data for comparison. The band comes from the flat run. */
export interface Backtest {
  n: number;
  curve_median_miss: number;
  curve_within3: number;
  curve_within10: number;
  flat_ratio: number;
  flat_median_miss: number;
  flat_within3: number;
  flat_within10: number;
  band_p10: number;
  band_p90: number;
}

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-flat-1';

/** How many live-token protocols the Token trades view carries, by market cap. */
export const LIVE_ROWS = 60;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The dollar economics of farming one row on a $1,000 ticket. */
export interface FarmEcon {
  capital_usd: number;
  slice_usd: number;
  gas_usd: number;
  tbill_usd: number;
  net_usd: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  hold_days: number;
  work_hours: number;
  net_per_hour: number;
  chain_gas_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_usd: number;
    cat_factor: number;
    growth_factor: number;
    seasoning_factor: number;
    band_lo_usd: number;
    band_hi_usd: number;
    age_days: number | null;
  };
  econ: FarmEcon;
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  band_lo_usd: number;
  band_hi_usd: number;
  base_usd: number;
  cat_factor: number;
  growth_factor: number;
  seasoning_factor: number;
  econ: FarmEcon;
  farm_steps: string[];
  watchlist: boolean;
}

/** A pre-token protocol the board set aside, with the rule that set it aside. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the set-aside list, and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: FlatModel;
  model_version: string;
  backtest: Backtest;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  set_aside_size: number;
  verdicts: { farm: number; thin: number; skip: number };
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
  scatter_comps: [number, number][];
  scatter_board: [number, number][];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const TBILL_RATE = 0.04;
const TICKET_USD = 1000;
const SLICE_SHARE = 0.1;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return 0;
  return n % 2 === 1 ? v[(n - 1) / 2]! : (v[n / 2 - 1]! + v[n / 2]!) / 2;
}

/** The q-th quantile (0..1) of a list of numbers, linearly interpolated. */
function quantile(values: number[], q: number): number {
  const v = [...values].sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const i = (v.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return v[lo]! + (v[hi]! - v[lo]!) * (i - lo);
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word that marks a wrapped or staked product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** A name that begins with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** Categories that are a wrapped, staked or bridged product of another protocol. */
const WRAPPED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool,
 *  not a wrapped, staked or bridged product of a token that already trades. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !WRAPPED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The rule that set a pre-token protocol aside, for the Set aside tab. */
export function setAsideReason(p: SnapshotProtocol): string {
  if (p.category === 'CEX') return 'CEX: the token already trades through the exchange';
  if (WRAPPED_CATEGORIES.has(p.category ?? '')) return `${p.category}: a wrapped, staked or bridged product of a token that already trades`;
  if (VERSIONED.test(p.name)) return 'Versioned pool name: a pool of another protocol, not a launch of its own';
  if (WRAPPED_WORD.test(p.name)) return 'Wrapped or staked name: a product of a token that already trades';
  if (EXCHANGE_PREFIX.test(p.name)) return 'Exchange-branded name: a product of an exchange';
  return 'Below the board cutoff: ranked past the 198 rows the board carries';
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Ordinary least squares for log10(mcap) = a + b * log10(tvl) over the given rows. */
function ols(rows: SnapshotProtocol[]): { a: number; b: number } {
  const n = rows.length;
  let mx = 0;
  let my = 0;
  for (const p of rows) {
    mx += Math.log10(p.tvl_usd);
    my += Math.log10(p.mcap_usd!);
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  for (const p of rows) {
    const dx = Math.log10(p.tvl_usd) - mx;
    sxy += dx * (Math.log10(p.mcap_usd!) - my);
    sxx += dx * dx;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

/** The shrunk median log-residual per category: median * n / (n + 5), clamped to +/-0.5 dex. */
function categoryFactors(rows: SnapshotProtocol[], fit: { a: number; b: number }): Record<string, number> {
  const byCat = new Map<string, number[]>();
  for (const p of rows) {
    const r = Math.log10(p.mcap_usd!) - (fit.a + fit.b * Math.log10(p.tvl_usd));
    const key = p.category ?? 'Other';
    const list = byCat.get(key);
    if (list) list.push(r);
    else byCat.set(key, [r]);
  }
  const out: Record<string, number> = {};
  for (const [key, rs] of byCat) {
    if (rs.length < 2) continue;
    let f = median(rs) * (rs.length / (rs.length + 5));
    f = Math.max(-0.5, Math.min(0.5, f));
    out[key] = Math.round(f * 1e4) / 1e4;
  }
  return out;
}

/** The curve's prediction for one protocol under a fitted curve (no band, no rounding). */
function predictRaw(p: SnapshotProtocol, asOf: string, fit: { a: number; b: number }, cats: Record<string, number>, med7d: number): { value: number; base: number; catF: number; growthF: number; seasonF: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const base = Math.pow(10, fit.a + fit.b * Math.log10(p.tvl_usd));
  const catLog = cats[p.category ?? 'Other'] ?? 0;
  const catF = Math.pow(10, catLog);
  const rel = finite(p.change_7d, med7d) - med7d;
  const growthF = Math.pow(10, Math.max(-40, Math.min(40, rel)) * 0.004);
  const ageForModel = age ?? 365;
  const seasonF = 1 + 0.25 * (1 - Math.exp(-ageForModel / 365));
  return { value: base * catF * growthF * seasonF, base, catF, growthF, seasonF, age };
}

/** The comparables: tokens that already trade, with a positive market cap and TVL, not a CEX. */
function comparables(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => !isPreToken(p) && (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0 && p.category !== 'CEX');
}

/** The flat model and the honest leave-one-out backtest: the flat multiple fitted
 *  without each comparable (the median mcap/TVL ratio of the rest), and the fitted
 *  curve's run on the same data for comparison. The band comes from the flat run. */
export function fitModel(snapshot: Snapshot): { model: FlatModel; backtest: Backtest } {
  const comps = comparables(snapshot);
  const med7d = median(snapshot.protocols.map((p) => p.change_7d).filter((v): v is number => v !== null));
  const fit = ols(comps);
  const cats = categoryFactors(comps, fit);
  const model: FlatModel = { kind: 'flat', ...FLAT, n_comps: comps.length };

  const looMiss: number[] = [];
  const flatMiss: number[] = [];
  const looLog: number[] = [];
  const flatLog: number[] = [];
  for (const c of comps) {
    const rest = comps.filter((p) => p !== c);
    const f2 = ols(rest);
    const c2 = categoryFactors(rest, f2);
    const pred = predictRaw(c, snapshot.as_of, f2, c2, med7d);
    looMiss.push(Math.max(pred.value / c.mcap_usd!, c.mcap_usd! / pred.value));
    looLog.push(Math.log10(c.mcap_usd! / pred.value));
    const flatRatio = median(rest.map((p) => p.mcap_usd! / p.tvl_usd));
    const fp = flatRatio * c.tvl_usd;
    flatMiss.push(Math.max(fp / c.mcap_usd!, c.mcap_usd! / fp));
    flatLog.push(Math.log10(c.mcap_usd! / fp));
  }
  const within = (arr: number[], k: number): number => arr.filter((m) => m <= k).length / arr.length;
  const backtest: Backtest = {
    n: comps.length,
    curve_median_miss: Math.round(median(looMiss) * 100) / 100,
    curve_within3: Math.round(within(looMiss, 3) * 1000) / 1000,
    curve_within10: Math.round(within(looMiss, 10) * 1000) / 1000,
    flat_ratio: Math.round(median(comps.map((p) => p.mcap_usd! / p.tvl_usd)) * 1000) / 1000,
    flat_median_miss: Math.round(median(flatMiss) * 100) / 100,
    flat_within3: Math.round(within(flatMiss, 3) * 1000) / 1000,
    flat_within10: Math.round(within(flatMiss, 10) * 1000) / 1000,
    band_p10: Math.round(quantile(flatLog, 0.1) * 1000) / 1000,
    band_p90: Math.round(quantile(flatLog, 0.9) * 1000) / 1000,
  };
  return { model, backtest };
}

/** The implied value of one protocol under the flat model, with its band and breakdown. */
export function impliedValue(p: SnapshotProtocol, asOf: string, model: FlatModel, backtest: Backtest): { implied: number; base: number; catF: number; growthF: number; seasonF: number; bandLo: number; bandHi: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const ageForModel = age ?? model.unknown_age_days;
  const base = p.tvl_usd * model.base_multiple;
  const growthF = 1 + (Math.max(model.growth_floor, Math.min(model.growth_cap, finite(p.change_7d, 0))) / 100) * model.growth_weight;
  const seasonF = model.maturity_floor + (Math.min(ageForModel, model.maturity_days) / model.maturity_days) * model.maturity_range;
  const implied = Math.max(1, Math.round(base * growthF * seasonF));
  return {
    implied,
    base: Math.round(base),
    catF: 1,
    growthF: Math.round(growthF * 1e4) / 1e4,
    seasonF: Math.round(seasonF * 1e4) / 1e4,
    bandLo: Math.max(1, Math.round(implied * Math.pow(10, backtest.band_p10))),
    bandHi: Math.max(1, Math.round(implied * Math.pow(10, backtest.band_p90))),
    age,
  };
}

/** What one transaction costs on a chain, in dollars (documented assumption, not a live quote). */
const CHAIN_GAS_USD: Record<string, number> = {
  Ethereum: 4.0,
  Base: 0.3,
  Arbitrum: 0.3,
  Optimism: 0.3,
  Solana: 0.05,
  'BNB Chain': 0.25,
  Polygon: 0.1,
  Avalanche: 0.5,
  'zkSync Era': 0.3,
  Linea: 0.3,
  Scroll: 0.3,
  Mantle: 0.2,
  Gnosis: 0.1,
  Fantom: 0.2,
};

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The dollar economics of farming one protocol on a $1,000 ticket. */
export function farmEcon(p: SnapshotProtocol, implied: number, age: number | null): FarmEcon {
  const chainGas = CHAIN_GAS_USD[chainOf(p)] ?? 1.0;
  const hold = holdDaysFor(age);
  const weeks = Math.min(12, Math.ceil(hold / 7));
  const gas = (2 + weeks) * chainGas;
  const slice = SLICE_SHARE * implied * (TICKET_USD / p.tvl_usd);
  const tbill = TICKET_USD * TBILL_RATE * (hold / 365);
  const net = slice - gas - tbill;
  const workH = 0.5 + 0.25 * weeks + 0.5;
  const verdict: 'FARM' | 'THIN' | 'SKIP' = net > 0 ? 'FARM' : slice > gas ? 'THIN' : 'SKIP';
  const r2 = (n: number): number => Math.round(n * 100) / 100;
  return {
    capital_usd: capitalFor(p),
    slice_usd: r2(slice),
    gas_usd: r2(gas),
    tbill_usd: r2(tbill),
    net_usd: r2(net),
    verdict,
    hold_days: hold,
    work_hours: Math.round(workH * 100) / 100,
    net_per_hour: r2(net / workH),
    chain_gas_usd: chainGas,
  };
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** A protocol's farm plan: the starter's six generic steps, the same for every
 *  protocol, each an action with a cost and a time, netted to the dollar. */
export function farmSteps(p: SnapshotProtocol, econ: FarmEcon, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = econ.capital_usd;
  const hold = econ.hold_days;
  return [
    { text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`, cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
    { text: actionFor(p, capital, chain), cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`, time: '15 minutes to set up' },
    { text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`, cost: 'about $2 of gas a week', time: '10 minutes a week' },
    { text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`, cost: `the $${capital} stays in the position`, time: `${hold} days` },
    { text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`, cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
    { text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`, cost: 'nothing but the log', time: '5 minutes' },
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const { model, backtest } = fitModel(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, whatever its TVL.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, backtest);
    const econ = farmEcon(p, v.implied, v.age);
    return { p, v, econ };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      base_usd: s.v.base,
      cat_factor: s.v.catF,
      growth_factor: s.v.growthF,
      seasoning_factor: s.v.seasonF,
      band_lo_usd: s.v.bandLo,
      band_hi_usd: s.v.bandHi,
      age_days: s.v.age,
    },
    econ: s.econ,
    farm_steps: farmSteps(s.p, s.econ, s.v.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The live-token protocols, by market cap, for the dashboard's Token trades view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The pre-token protocols the board set aside, with the rule that set each aside. */
export function setAsideRows(snapshot: Snapshot, board: BoardRow[]): SetAsideRow[] {
  const onBoard = new Set(board.map((r) => r.slug));
  return snapshot.protocols
    .filter((p) => isPreToken(p) && !onBoard.has(p.slug))
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, reason: setAsideReason(p) }))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    band_lo_usd: row.model.band_lo_usd,
    band_hi_usd: row.model.band_hi_usd,
    base_usd: row.model.base_usd,
    cat_factor: round4(row.model.cat_factor),
    growth_factor: round4(row.model.growth_factor),
    seasoning_factor: round4(row.model.seasoning_factor),
    econ: row.econ,
    farm_steps: row.farm_steps,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { model, backtest } = fitModel(snapshot);
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot, board);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const verdicts = { farm: 0, thin: 0, skip: 0 };
  for (const r of board) {
    if (r.econ.verdict === 'FARM') verdicts.farm++;
    else if (r.econ.verdict === 'THIN') verdicts.thin++;
    else verdicts.skip++;
  }
  const comps = comparables(snapshot);
  const scatterComps: [number, number][] = comps
    .map((p): [number, number] => [p.tvl_usd, p.mcap_usd!])
    .sort((a, b) => a[0] - b[0]);
  const scatterBoard: [number, number][] = board
    .map((r): [number, number] => [r.tvl_usd, r.implied_value_usd])
    .sort((a, b) => a[0] - b[0]);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    backtest,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    set_aside_size: setAside.length,
    verdicts,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
    set_aside: setAside,
    scatter_comps: scatterComps,
    scatter_board: scatterBoard,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
