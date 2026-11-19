/**
 * Official Ontario Lottery & Gaming Corporation (OLG) Game Definitions
 *
 * Sourced from official OLG game rules & regulations:
 * - OLG Official Portal: https://www.olg.ca
 * - PlaySmart Ontario (Odds & Prize Payouts): https://www.playsmart.ca
 *
 * Key Ontario Lottery Specifications & Math Notes:
 * 1. Lottario:
 *    - Ticket price: $1.00 per play.
 *    - Each $1.00 play officially includes TWO sets (lines) of 6 numbers from 1 to 45.
 *    - Single-line jackpot odds: C(45, 6) = 1 in 8,145,060.
 *    - Overall jackpot odds per $1.00 ticket (2 lines): 8,145,060 / 2 = 1 in 4,072,530.
 *    - Early Bird Draw: Official OLG feature for tickets purchased before 11:59:59 PM ET Friday.
 *      4 additional numbers drawn for a $50,000 prize pool (odds: approx 1 in 4,967).
 *    - Draw Day: Every Saturday night at 10:30 PM ET.
 * 2. Daily Keno:
 *    - Player selects spot size from 2 to 10 out of 70 numbers.
 *    - Draws held twice daily (Midday at 2:00 PM ET, Evening at 10:30 PM ET).
 *    - Supports the official $1.00 ENCORE add-on with twice-daily draws.
 * 3. Pick-2, Pick-3, Pick-4:
 *    - Twice daily draws (Midday 2:00 PM ET, Evening 10:30 PM ET).
 *    - Pick-2 straight match pays fixed $99 (1 in 100 odds).
 *    - Pick-3 top prize is pari-mutuel based on a 50% prize pool (approx $500 on $1 straight play).
 *    - Pick-4 $1 straight match pays fixed $5,000 (1 in 10,000 odds).
 *    - All three Pick games support the official $1.00 ENCORE add-on.
 * 4. Lotto Max:
 *    - 7/50 balls. $5.00 play includes 3 lines of 7 numbers. Maxmillions at $50M+ jackpots.
 * 5. Lotto 6/49:
 *    - 6/49 balls. Classic $5M draw + Guaranteed Gold Ball Draw (progressive up to $68M).
 * 6. Daily Grand:
 *    - 5/49 balls + Grand Number from 1 to 7. Top prize: $1,000 a day for life.
 * 7. Ontario 49:
 *    - 6/49 balls, $1.00 play, fixed $2M jackpot.
 * 8. Poker Lotto:
 *    - 5 cards from 52-card deck. Instant terminal win up to $10,000 + nightly draw up to $100,000.
 * 9. Encore:
 *    - 7-digit lottery (0000000 to 9999999). 22 ways to win, top prize $1,000,000.
 *
 * NOTE: Jackpots, odds, and draw times are subject to change by OLG.
 * Always verify official winning numbers, current jackpots, and prize conditions at olg.ca.
 */

import { createErr, createOk } from './result.js';
import type { GameDefinition, LotteryError, Result } from './types.js';

export const ONTARIO_GAMES: readonly GameDefinition[] = [
  {
    id: 'lotto-max',
    name: 'Lotto Max',
    tagline: 'Dream to the Max — Jackpots up to $80 Million',
    category: 'national',
    drawDays: ['Tuesday', 'Friday'],
    drawTime: '10:30 PM ET',
    ticketPrice: '$5.00 (3 lines of 7 numbers)',
    bundleLines: 3,
    type: 'balls',
    mainBallCount: 7,
    minNumber: 1,
    maxNumber: 50,
    supportsEncore: true,
    specialOption: {
      id: 'maxmillions',
      name: 'Maxmillions',
      description: 'Additional $1 Million prizes when main jackpot reaches $50M+',
    },
    topPrize: '$80,000,000',
    odds: '1 in 33,294,800',
    source: 'https://www.olg.ca/en/lottery/play-lotto-max-encore.html',
    theme: {
      primary: '#008744',
      secondary: '#005a2e',
      accent: '#f4c20d',
      ballBg: '#0f7b3b',
      ballText: '#ffffff',
    },
  },
  {
    id: 'lotto-649',
    name: 'Lotto 6/49',
    tagline: 'Classic $5M Jackpot & Guaranteed Gold Ball Jackpot',
    category: 'national',
    drawDays: ['Wednesday', 'Saturday'],
    drawTime: '10:30 PM ET',
    ticketPrice: '$3.00',
    bundleLines: 1,
    type: 'balls',
    mainBallCount: 6,
    minNumber: 1,
    maxNumber: 49,
    supportsEncore: true,
    specialOption: {
      id: 'gold-ball',
      name: 'Gold Ball Draw',
      description: 'Guaranteed $1M prize or progressive Gold Ball jackpot up to $68M',
    },
    topPrize: '$68,000,000 (Gold Ball)',
    odds: '1 in 13,983,816',
    source: 'https://www.olg.ca/en/lottery/play-lotto-649-encore.html',
    theme: {
      primary: '#00529b',
      secondary: '#003366',
      accent: '#ffd700',
      ballBg: '#00529b',
      ballText: '#ffffff',
    },
  },
  {
    id: 'daily-grand',
    name: 'Daily Grand',
    tagline: '$1,000 a Day for Life',
    category: 'national',
    drawDays: ['Monday', 'Thursday'],
    drawTime: '10:30 PM ET',
    ticketPrice: '$3.00',
    bundleLines: 1,
    type: 'balls',
    mainBallCount: 5,
    minNumber: 1,
    maxNumber: 49,
    supportsEncore: true,
    topPrize: '$1,000 A Day for Life',
    odds: '1 in 13,348,188',
    source: 'https://www.olg.ca/en/lottery/play-daily-grand-encore.html',
    theme: {
      primary: '#007a87',
      secondary: '#00545d',
      accent: '#ffb400',
      ballBg: '#007a87',
      ballText: '#ffffff',
    },
  },
  {
    id: 'ontario-49',
    name: 'Ontario 49',
    tagline: 'Ontario’s Own Million Dollar Classic',
    category: 'provincial',
    drawDays: ['Wednesday', 'Saturday'],
    drawTime: '10:30 PM ET',
    ticketPrice: '$1.00',
    bundleLines: 1,
    type: 'balls',
    mainBallCount: 6,
    minNumber: 1,
    maxNumber: 49,
    supportsEncore: true,
    topPrize: '$2,000,000 Fixed',
    odds: '1 in 13,983,816',
    source: 'https://www.olg.ca/en/lottery/play-ontario-49-encore.html',
    theme: {
      primary: '#b31b1b',
      secondary: '#701010',
      accent: '#ffcc00',
      ballBg: '#b31b1b',
      ballText: '#ffffff',
    },
  },
  {
    id: 'lottario',
    name: 'Lottario',
    tagline: 'Ontario’s Longest Running Lottery with Early Bird Prizes',
    category: 'provincial',
    drawDays: ['Saturday'],
    drawTime: '10:30 PM ET',
    ticketPrice: '$1.00 (2 lines of 6 numbers)',
    bundleLines: 2,
    type: 'balls',
    mainBallCount: 6,
    minNumber: 1,
    maxNumber: 45,
    supportsEncore: true,
    specialOption: {
      id: 'early-bird',
      name: 'Early Bird',
      description: '4 bonus numbers for tickets bought before Friday 11:59:59 PM ET ($50,000 pool)',
    },
    topPrize: '$250,000+ Progressive',
    odds: '1 in 4,072,530 per $1 play (2 lines included; 1 in 8,145,060 per line)',
    source: 'https://www.olg.ca/en/lottery/play-lottario-encore.html',
    theme: {
      primary: '#4a154b',
      secondary: '#2e0d2f',
      accent: '#00c7b7',
      ballBg: '#4a154b',
      ballText: '#ffffff',
    },
  },
  {
    id: 'pick-2',
    name: 'Pick-2',
    tagline: 'Daily 2-digit lottery with midday and evening draws',
    category: 'daily',
    drawDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    drawTime: '2:00 PM & 10:30 PM ET',
    ticketPrice: '$2.00',
    bundleLines: 1,
    type: 'digits',
    mainBallCount: 2,
    minNumber: 0,
    maxNumber: 9,
    supportsEncore: true,
    topPrize: '$99.00',
    odds: '1 in 100',
    source: 'https://www.olg.ca/en/lottery/play-pick-2.html',
    theme: {
      primary: '#e65100',
      secondary: '#bf360c',
      accent: '#ffd54f',
      ballBg: '#e65100',
      ballText: '#ffffff',
    },
  },
  {
    id: 'pick-3',
    name: 'Pick-3',
    tagline: 'Ontario favorite 3-digit game with twice daily draws',
    category: 'daily',
    drawDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    drawTime: '2:00 PM & 10:30 PM ET',
    ticketPrice: '$1.00 / $2.00',
    bundleLines: 1,
    type: 'digits',
    mainBallCount: 3,
    minNumber: 0,
    maxNumber: 9,
    supportsEncore: true,
    topPrize: 'Pari-Mutuel (~$500.00 on $1 Straight)',
    odds: '1 in 1,000',
    source: 'https://www.olg.ca/en/lottery/play-pick-3.html',
    theme: {
      primary: '#0277bd',
      secondary: '#01579b',
      accent: '#80d8ff',
      ballBg: '#0277bd',
      ballText: '#ffffff',
    },
  },
  {
    id: 'pick-4',
    name: 'Pick-4',
    tagline: '4 digits to win up to $5,000 twice daily',
    category: 'daily',
    drawDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    drawTime: '2:00 PM & 10:30 PM ET',
    ticketPrice: '$1.00',
    bundleLines: 1,
    type: 'digits',
    mainBallCount: 4,
    minNumber: 0,
    maxNumber: 9,
    supportsEncore: true,
    topPrize: '$5,000.00',
    odds: '1 in 10,000',
    source: 'https://www.olg.ca/en/lottery/play-pick-4.html',
    theme: {
      primary: '#558b2f',
      secondary: '#33691e',
      accent: '#b2ff59',
      ballBg: '#558b2f',
      ballText: '#ffffff',
    },
  },
  {
    id: 'daily-keno',
    name: 'Daily Keno',
    tagline: 'Choose 2 to 10 numbers from 1 to 70 for personalized odds',
    category: 'daily',
    drawDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    drawTime: '2:00 PM & 10:30 PM ET',
    ticketPrice: '$1, $2, $5, or $10',
    bundleLines: 1,
    type: 'balls',
    mainBallCount: 10,
    minNumber: 1,
    maxNumber: 70,
    supportsEncore: true,
    kenoSpots: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    topPrize: '$2,500,000 (10 Spot $10 play)',
    odds: '1 in 2,147,181 (10 of 10)',
    source: 'https://www.olg.ca/en/lottery/play-daily-keno.html',
    theme: {
      primary: '#ad1457',
      secondary: '#6a1b9a',
      accent: '#ff4081',
      ballBg: '#ad1457',
      ballText: '#ffffff',
    },
  },
  {
    id: 'poker-lotto',
    name: 'Poker Lotto',
    tagline: '5 playing cards with instant terminal wins & nightly top prize',
    category: 'daily',
    drawDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    drawTime: '10:30 PM ET',
    ticketPrice: '$2.00',
    bundleLines: 1,
    type: 'cards',
    mainBallCount: 5,
    minNumber: 1,
    maxNumber: 52,
    supportsEncore: false,
    specialOption: {
      id: 'all-in',
      name: 'All In',
      description: 'Extra $1 for enhanced instant prizes and progressive jackpot',
    },
    topPrize: '$100,000 Nightly',
    odds: '1 in 2,598,960 (Royal Flush)',
    source: 'https://www.olg.ca/en/lottery/play-poker-lotto.html',
    theme: {
      primary: '#1b5e20',
      secondary: '#0b3d11',
      accent: '#d4af37',
      ballBg: '#1b5e20',
      ballText: '#ffffff',
    },
  },
  {
    id: 'encore',
    name: 'Encore',
    tagline: '7-digit nightly lottery with 22 ways to win $1 Million',
    category: 'daily',
    drawDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    drawTime: '10:30 PM ET',
    ticketPrice: '$1.00',
    bundleLines: 1,
    type: 'digits',
    mainBallCount: 7,
    minNumber: 0,
    maxNumber: 9,
    supportsEncore: false,
    topPrize: '$1,000,000',
    odds: '1 in 10,000,000',
    source: 'https://www.olg.ca/en/lottery/play-encore.html',
    theme: {
      primary: '#6a1b9a',
      secondary: '#4a148c',
      accent: '#ea80fc',
      ballBg: '#6a1b9a',
      ballText: '#ffffff',
    },
  },
];

export function getGameDefinition(id: string): Result<GameDefinition, LotteryError> {
  const game = ONTARIO_GAMES.find((g) => g.id === id);
  if (!game) {
    return createErr({
      code: 'INVALID_GAME_ID',
      message: `Unknown lottery game ID: '${id}'.`,
      details: { requestedId: id, availableGames: ONTARIO_GAMES.map((g) => g.id) },
    });
  }
  return createOk(game);
}

export function getAllGames(): Result<readonly GameDefinition[], LotteryError> {
  return createOk(ONTARIO_GAMES);
}
