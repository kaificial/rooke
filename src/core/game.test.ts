import { describe, expect, it } from 'vitest'
import { Game } from './game'
import { Position, START_FEN } from './position'
import { parseSquare } from './squares'
import type { PromotionType } from './types'

function play(game: Game, ...moves: string[]) {
  for (const text of moves) {
    const promotion = text.length === 5 ? (text[4] as PromotionType) : undefined
    game.play({ from: parseSquare(text.slice(0, 2)), to: parseSquare(text.slice(2, 4)), promotion })
  }
}

describe('Position', () => {
  it('round-trips FEN', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'
    expect(Position.fromFen(fen).toFen()).toBe(fen)
    expect(Position.start().toFen()).toBe(START_FEN)
  })

  it('rejects malformed FEN', () => {
    expect(() => Position.fromFen('not a fen')).toThrow()
    expect(() => Position.fromFen('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow(/king/)
  })

  it('sets the en passant square after a double push', () => {
    const game = new Game()
    play(game, 'e2e4')
    expect(game.position.toFen()).toContain(' b KQkq e3 ')
  })
})

describe('Game rules', () => {
  it('detects fool\'s mate', () => {
    const game = new Game()
    play(game, 'f2f3', 'e7e5', 'g2g4', 'd8h4')
    expect(game.outcome).toEqual({ kind: 'checkmate', winner: 'b' })
  })

  it('detects stalemate', () => {
    const game = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(game.outcome).toEqual({ kind: 'draw', reason: 'stalemate' })
  })

  it('rejects illegal moves', () => {
    const game = new Game()
    expect(() => play(game, 'e2e5')).toThrow(/Illegal/)
    expect(() => play(game, 'e7e5')).toThrow(/Illegal/) // not black's turn
  })

  it('does not allow castling through check', () => {
    // The black rook on f8 attacks f1, so white may not castle kingside.
    const game = new Game('5r1k/8/8/8/8/8/8/4K2R w K - 0 1')
    expect(game.findLegal(parseSquare('e1'), parseSquare('g1'))).toBeUndefined()
  })

  it('lets a king castle when the path is clear', () => {
    const game = new Game('7k/8/8/8/8/8/8/4K2R w K - 0 1')
    const castle = game.findLegal(parseSquare('e1'), parseSquare('g1'))
    expect(castle?.castle).toBe('k')
    play(game, 'e1g1')
    expect(game.position.toFen()).toBe('7k/8/8/8/8/8/8/5RK1 b - - 1 1')
  })

  it('handles en passant', () => {
    const game = new Game()
    play(game, 'e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6')
    expect(game.position.pieceAt(parseSquare('d5'))).toBeNull()
    expect(game.position.pieceAt(parseSquare('d6'))?.type).toBe('p')
  })

  it('handles promotion with a choice of piece', () => {
    const game = new Game('7k/P7/8/8/8/8/8/K7 w - - 0 1')
    expect(game.legalMovesFrom(parseSquare('a7'))).toHaveLength(4)
    play(game, 'a7a8n')
    expect(game.position.pieceAt(parseSquare('a8'))).toMatchObject({ type: 'n', color: 'w' })
  })

  it('declares a draw by insufficient material', () => {
    const game = new Game('7k/8/8/8/8/8/8/K6B w - - 0 1')
    expect(game.outcome).toEqual({ kind: 'draw', reason: 'insufficient-material' })
  })

  it('declares a draw by threefold repetition', () => {
    const game = new Game()
    play(game, 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8')
    expect(game.outcome).toEqual({ kind: 'draw', reason: 'repetition' })
  })

  it('declares a draw by the fifty-move rule', () => {
    const game = new Game('7k/8/8/8/8/8/8/K1R5 w - - 99 80')
    play(game, 'c1c2')
    expect(game.outcome).toEqual({ kind: 'draw', reason: 'fifty-move' })
  })

  it('ends the game on timeout', () => {
    const game = new Game()
    expect(game.flag('w')).toEqual({ kind: 'timeout', winner: 'b' })
    expect(() => play(game, 'e2e4')).toThrow(/over/)
  })
})

describe('algebraic notation', () => {
  it('writes captures, checks and castling', () => {
    const game = new Game()
    play(game, 'e2e4', 'd7d5', 'e4d5', 'g8f6', 'f1b5', 'c7c6', 'g1f3', 'c6b5', 'e1g1')
    expect(game.history.map((m) => m.san)).toEqual([
      'e4', 'd5', 'exd5', 'Nf6', 'Bb5+', 'c6', 'Nf3', 'cxb5', 'O-O',
    ])
  })

  it('disambiguates identical pieces by file, then rank', () => {
    const byFile = new Game('4k3/8/8/8/8/8/4K3/R6R w - - 0 1')
    play(byFile, 'a1d1')
    expect(byFile.history[0].san).toBe('Rad1')

    const byRank = new Game('4k3/R7/8/8/8/8/R7/4K3 w - - 0 1')
    play(byRank, 'a2a4')
    expect(byRank.history[0].san).toBe('R2a4')
  })

  it('marks promotion and mate', () => {
    const game = new Game('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1')
    play(game, 'a1a8')
    expect(game.history[0].san).toBe('Ra8#')
    expect(game.outcome).toEqual({ kind: 'checkmate', winner: 'w' })

    const promo = new Game('7k/P7/8/8/8/8/8/K7 w - - 0 1')
    play(promo, 'a7a8q')
    expect(promo.history[0].san).toBe('a8=Q+')
  })
})
