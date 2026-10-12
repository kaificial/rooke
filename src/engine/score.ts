/** Score of a position that is checkmate for the side to move, before ply adjustment. */
export const MATE = 100_000

/** Anything at or beyond this magnitude is a forced mate rather than a material score. */
export const MATE_THRESHOLD = MATE - 1_000

export const isMateScore = (score: number): boolean => Math.abs(score) >= MATE_THRESHOLD

/** Moves until mate, counted in the mating side's moves, for a mate score. */
export const mateIn = (score: number): number => Math.ceil((MATE - Math.abs(score)) / 2)
