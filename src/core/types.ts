export type LotteryGameId =
  | 'lotto-max'
  | 'lotto-649'
  | 'daily-grand'
  | 'ontario-49'
  | 'lottario'
  | 'pick-2'
  | 'pick-3'
  | 'pick-4'
  | 'daily-keno'
  | 'poker-lotto'
  | 'encore';

export type CardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface PlayingCard {
  readonly rank: CardRank;
  readonly suit: CardSuit;
  readonly symbol: '♠' | '♥' | '♦' | '♣';
  readonly color: 'red' | 'black';
  readonly code: string;
}

export interface LotteryError {
  readonly code:
    | 'INVALID_GAME_ID'
    | 'INVALID_LINE_COUNT'
    | 'INVALID_KENO_SPOT'
    | 'INVALID_INCLUDED_NUMBERS'
    | 'INVALID_EXCLUDED_NUMBERS'
    | 'CONFLICTING_NUMBERS'
    | 'RNG_FAILURE'
    | 'VALIDATION_FAILURE';
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type Result<T, E = LotteryError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface GameTheme {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly ballBg: string;
  readonly ballText: string;
}

export interface SpecialOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface GameDefinition {
  readonly id: LotteryGameId;
  readonly name: string;
  readonly tagline: string;
  readonly category: 'national' | 'provincial' | 'daily';
  readonly drawDays: readonly string[];
  readonly drawTime: string;
  readonly ticketPrice: string;
  readonly bundleLines: number;
  readonly type: 'balls' | 'digits' | 'cards';
  readonly mainBallCount: number;
  readonly minNumber: number;
  readonly maxNumber: number;
  readonly bonusBallCount: number;
  readonly bonusFromRemaining: boolean;
  readonly supportsEncore: boolean;
  readonly kenoSpots?: readonly number[];
  readonly specialOption?: SpecialOption;
  readonly topPrize: string;
  readonly odds: string;
  readonly theme: GameTheme;
}

export interface BallLine {
  readonly kind: 'balls';
  readonly numbers: readonly number[];
  readonly bonus?: number;
  readonly grandNumber?: number;
}

export interface DigitLine {
  readonly kind: 'digits';
  readonly digits: readonly number[];
}

export interface CardLine {
  readonly kind: 'cards';
  readonly cards: readonly PlayingCard[];
}

export type GameLine = BallLine | DigitLine | CardLine;

export interface GeneratedTicket {
  readonly id: string;
  readonly gameId: LotteryGameId;
  readonly gameName: string;
  readonly timestamp: string;
  readonly lines: readonly GameLine[];
  readonly encore?: readonly number[];
  readonly goldBallNumber?: string;
  readonly kenoSpot?: number;
}

export interface GenerationOptions {
  readonly lines?: number;
  readonly includeEncore?: boolean;
  readonly kenoSpot?: number;
  readonly includeNumbers?: readonly number[];
  readonly excludeNumbers?: readonly number[];
  readonly includeGoldBall?: boolean;
}

export interface TicketStats {
  readonly lineCount: number;
  readonly oddCount: number;
  readonly evenCount: number;
  readonly sumTotal: number;
  readonly minNumber: number;
  readonly maxNumber: number;
}
