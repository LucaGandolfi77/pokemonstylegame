// Simple chessboard scene: click to select a piece, move it with WASD
// This replaces the previous Pokemon battle scene.

const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

let chessAnimationId = null
let chessActive = false

const tileCount = 8
const tileSize = Math.floor(Math.min(canvas.width, canvas.height) / tileCount)
const boardWidth = tileSize * tileCount
const xOffset = Math.floor((canvas.width - boardWidth) / 2)
const yOffset = Math.floor((canvas.height - boardWidth) / 2)

// Unicode chess pieces for rendering
const pieces = {
  bR: '♜',
  bN: '♞',
  bB: '♝',
  bQ: '♛',
  bK: '♚',
  bP: '♟',
  wR: '♖',
  wN: '♘',
  wB: '♗',
  wQ: '♕',
  wK: '♔',
  wP: '♙'
}

// Board is an 8x8 array. Row 0 is top (black side), row 7 bottom (white side).
const board = Array.from({ length: tileCount }, () => Array(tileCount).fill(null))

function setupInitialPosition() {
  // Use piece codes (color + type) internally, map to unicode for drawing via `pieces`.
  board[0] = ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR']
  board[1] = Array(8).fill('bP')
  for (let r = 2; r <= 5; r++) board[r] = Array(8).fill(null)
  board[6] = Array(8).fill('wP')
  board[7] = ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
}

setupInitialPosition()

// initialize game state for a new game (call from initBattle to avoid ordering issues)
function resetGameState() {
  moveHistory.length = 0
  lastMove = null
  castlingRights.wK = castlingRights.wQ = castlingRights.bK = castlingRights.bQ = true
  sideToMove = 'w'
  statusMessage = ''
  statusTimestamp = 0
}

let selected = null // {r, c} or null
// Game state for special moves
const moveHistory = []
let lastMove = null
const castlingRights = {
  wK: true,
  wQ: true,
  bK: true,
  bQ: true
}
let sideToMove = 'w'
let statusMessage = ''
let statusTimestamp = 0
const statusTTL = 4000
let promotionPending = false
// Undo / history and AI state
const moveHistoryDetailed = []
let aiEnabled = true
let aiSide = 'b'
let aiThinking = false
const humanSide = 'w'

function hasAnyLegalMoves(color) {
  for (let r = 0; r < tileCount; r++) {
    for (let c = 0; c < tileCount; c++) {
      const code = board[r][c]
      if (!code || code[0] !== color) continue
      const moves = getLegalMoves(r, c)
      if (moves.length > 0) return true
    }
  }
  return false
}

function isCheckmate(color) {
  return isInCheck(color) && !hasAnyLegalMoves(color)
}

function boardToScreen(r, c) {
  return {
    x: xOffset + c * tileSize,
    y: yOffset + r * tileSize
  }
}

function screenToBoard(x, y) {
  const c = Math.floor((x - xOffset) / tileSize)
  const r = Math.floor((y - yOffset) / tileSize)
  if (r < 0 || r >= tileCount || c < 0 || c >= tileCount) return null
  return { r, c }
}

function drawBoard() {
  // background
  c.fillStyle = '#222'
  c.fillRect(0, 0, canvas.width, canvas.height)

  for (let r = 0; r < tileCount; r++) {
    for (let cCol = 0; cCol < tileCount; cCol++) {
      const { x, y } = boardToScreen(r, cCol)
      const isLight = (r + cCol) % 2 === 0
      c.fillStyle = isLight ? '#f0d9b5' : '#b58863'
      c.fillRect(x, y, tileSize, tileSize)
      // highlight selected
      if (selected && selected.r === r && selected.c === cCol) {
        c.fillStyle = 'rgba(0, 255, 0, 0.25)'
        c.fillRect(x, y, tileSize, tileSize)
      }
    }
  }

  // draw coordinates (optional)
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.font = `${Math.max(12, Math.floor(tileSize * 0.14))}px monospace`
  for (let i = 0; i < tileCount; i++) {
    // files (a-h) at bottom
    const file = String.fromCharCode('a'.charCodeAt(0) + i)
    const pos = boardToScreen(tileCount - 1, i)
    c.fillText(file, pos.x + 4, pos.y + tileSize - 6)
  }

  // draw pieces
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = `${Math.floor(tileSize * 0.65)}px serif`
  for (let r = 0; r < tileCount; r++) {
    for (let cCol = 0; cCol < tileCount; cCol++) {
      const code = board[r][cCol]
      if (!code) continue
      const glyph = pieces[code] || '?'
      const { x, y } = boardToScreen(r, cCol)
      const centerX = x + tileSize / 2
      const centerY = y + tileSize / 2
      // color glyph slightly differently for white vs black pieces
      if (code[0] === 'w') {
        c.fillStyle = '#fff'
        c.strokeStyle = '#000'
        c.lineWidth = Math.max(1, Math.floor(tileSize * 0.03))
        c.strokeText(glyph, centerX, centerY + 2)
        c.fillText(glyph, centerX, centerY + 2)
      } else {
        c.fillStyle = '#000'
        c.fillText(glyph, centerX, centerY + 2)
      }
    }
  }

  // highlight legal moves for selected piece
  if (selected) {
    const legal = getLegalMoves(selected.r, selected.c)
    legal.forEach((m) => {
      const { x, y } = boardToScreen(m.r, m.c)
      if (board[m.r][m.c] && board[m.r][m.c][0] !== board[selected.r][selected.c][0]) {
        // capture move
        c.fillStyle = 'rgba(255,0,0,0.35)'
      } else {
        c.fillStyle = 'rgba(0,255,0,0.25)'
      }
      c.fillRect(x, y, tileSize, tileSize)
    })
  }

  // draw status message if present
  if (statusMessage && Date.now() - statusTimestamp < statusTTL) {
    c.textAlign = 'center'
    c.fillStyle = 'rgba(0,0,0,0.7)'
    c.fillRect(canvas.width / 2 - 220, 8, 440, 28)
    c.fillStyle = 'white'
    c.font = '16px monospace'
    c.fillText(statusMessage, canvas.width / 2, 28)
  }

  // instructions
  const info = 'Click piece to select. Move selected piece with W A S D.'
  c.fillStyle = 'white'
  c.font = '14px monospace'
  c.textAlign = 'left'
  c.fillText(info, 10, 20)
}

function animateChess() {
  chessAnimationId = window.requestAnimationFrame(animateChess)
  drawBoard()
}

// Helpers for move generation
function isOnBoard(r, c) {
  return r >= 0 && r < tileCount && c >= 0 && c < tileCount
}

function getColor(code) {
  return code ? code[0] : null
}

function isEmpty(r, c) {
  return isOnBoard(r, c) && board[r][c] === null
}

function isEnemy(r, c, color) {
  return isOnBoard(r, c) && board[r][c] && board[r][c][0] !== color
}

function isFriendly(r, c, color) {
  return isOnBoard(r, c) && board[r][c] && board[r][c][0] === color
}

function getLegalMoves(r, c) {
  // generate pseudo-legal moves then filter out those that leave king in check
  const code = board[r][c]
  if (!code) return []
  const color = code[0]
  const type = code[1]
  const pseudo = []

  // pawn moves (including en-passant and double-step)
  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1
    const oneR = r + dir
    if (isOnBoard(oneR, c) && isEmpty(oneR, c)) pseudo.push({ r: oneR, c })
    const startRow = color === 'w' ? 6 : 1
    const twoR = r + 2 * dir
    if (r === startRow && isEmpty(oneR, c) && isEmpty(twoR, c)) pseudo.push({ r: twoR, c })
    // captures
    for (const dc of [-1, 1]) {
      const nc = c + dc
      if (isEnemy(oneR, nc, color)) pseudo.push({ r: oneR, c: nc })
    }
    // en-passant
    if (lastMove && lastMove.piece[1] === 'P' && lastMove.double) {
      // lastMove.to is adjacent horizontally
      if (lastMove.to.r === r && Math.abs(lastMove.to.c - c) === 1) {
        const targetR = r + dir
        const targetC = lastMove.to.c
        // ensure target square is empty (it should be)
        if (isOnBoard(targetR, targetC) && isEmpty(targetR, targetC)) {
          pseudo.push({ r: targetR, c: targetC, enPassant: true })
        }
      }
    }
  }

  if (type === 'N') {
    const offs = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1]
    ]
    for (const [dr, dc] of offs) {
      const nr = r + dr
      const nc = c + dc
      if (!isOnBoard(nr, nc)) continue
      if (!isFriendly(nr, nc, color)) pseudo.push({ r: nr, c: nc })
    }
  }

  // sliding pieces: R, B, Q
  const slide = (dirs) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr
      let nc = c + dc
      while (isOnBoard(nr, nc)) {
        if (isFriendly(nr, nc, color)) break
        pseudo.push({ r: nr, c: nc })
        if (isEnemy(nr, nc, color)) break
        nr += dr
        nc += dc
      }
    }
  }

  if (type === 'R' || type === 'Q') {
    slide([[-1, 0], [1, 0], [0, -1], [0, 1]])
  }
  if (type === 'B' || type === 'Q') {
    slide([[-1, -1], [-1, 1], [1, -1], [1, 1]])
  }

  if (type === 'K') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = r + dr
        const nc = c + dc
        if (!isOnBoard(nr, nc)) continue
        if (!isFriendly(nr, nc, color)) pseudo.push({ r: nr, c: nc })
      }
    }
    // castling: only if king and appropriate rook haven't moved and king not currently in check
    const rightsK = color === 'w' ? 'wK' : 'bK'
    const rightsQ = color === 'w' ? 'wQ' : 'bQ'
    const homeRow = color === 'w' ? 7 : 0
    if (r === homeRow && c === 4 && !isInCheck(color)) {
      // king-side
      if (castlingRights[rightsK]) {
        if (isEmpty(homeRow, 5) && isEmpty(homeRow, 6)) {
          // squares the king passes through must not be attacked
          if (!squareAttacked(homeRow, 5, color) && !squareAttacked(homeRow, 6, color)) {
            pseudo.push({ r: homeRow, c: 6, castle: 'K' })
          }
        }
      }
      // queen-side
      if (castlingRights[rightsQ]) {
        if (isEmpty(homeRow, 3) && isEmpty(homeRow, 2) && isEmpty(homeRow, 1)) {
          if (!squareAttacked(homeRow, 3, color) && !squareAttacked(homeRow, 2, color)) {
            pseudo.push({ r: homeRow, c: 2, castle: 'Q' })
          }
        }
      }
    }
  }

  // filter pseudo moves by simulating them and ensuring king is not left in check
  const legal = []
  for (const mv of pseudo) {
    if (!wouldLeaveKingInCheck({ r, c }, mv)) continue
    legal.push(mv)
  }
  return legal
}

function cloneBoard(b) {
  return b.map((row) => row.slice())
}

function findKing(b, color) {
  for (let r = 0; r < tileCount; r++) {
    for (let c = 0; c < tileCount; c++) {
      if (b[r][c] === color + 'K') return { r, c }
    }
  }
  return null
}

function squareAttacked(r, c, color) {
  // return true if square (r,c) is attacked by any enemy piece
  const enemyColor = color === 'w' ? 'b' : 'w'
  for (let i = 0; i < tileCount; i++) {
    for (let j = 0; j < tileCount; j++) {
      const code = board[i][j]
      if (!code || code[0] !== enemyColor) continue
      const type = code[1]
      // generate attack squares for this enemy piece (pseudo)
      if (type === 'P') {
        const dir = enemyColor === 'w' ? -1 : 1
        const ar = i + dir
        for (const dc of [-1, 1]) {
          const ac = j + dc
          if (ar === r && ac === c) return true
        }
      } else if (type === 'N') {
        const offs = [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1]
        ]
        for (const [dr, dc] of offs) if (i + dr === r && j + dc === c) return true
      } else if (type === 'B' || type === 'R' || type === 'Q') {
        const dirs = []
        if (type === 'B' || type === 'Q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1])
        if (type === 'R' || type === 'Q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1])
        for (const [dr, dc] of dirs) {
          let nr = i + dr
          let nc = j + dc
          while (isOnBoard(nr, nc)) {
            if (nr === r && nc === c) return true
            if (board[nr][nc]) break
            nr += dr
            nc += dc
          }
        }
      } else if (type === 'K') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) if (i + dr === r && j + dc === c) return true
      }
    }
  }
  return false
}

function isInCheck(color, b = null) {
  const boardRef = b || board
  const kingPos = findKing(boardRef, color)
  if (!kingPos) return false
  // temporarily switch to boardRef for squareAttacked (it uses global board), so call a variant that accepts board?
  // For simplicity, implement a local scan using boardRef
  const enemyColor = color === 'w' ? 'b' : 'w'
  for (let i = 0; i < tileCount; i++) {
    for (let j = 0; j < tileCount; j++) {
      const code = boardRef[i][j]
      if (!code || code[0] !== enemyColor) continue
      const type = code[1]
      if (type === 'P') {
        const dir = enemyColor === 'w' ? -1 : 1
        const ar = i + dir
        if (ar === kingPos.r && (j - 1 === kingPos.c || j + 1 === kingPos.c)) return true
      } else if (type === 'N') {
        const offs = [
          [-2, -1],
          [-2, 1],
          [-1, -2],
          [-1, 2],
          [1, -2],
          [1, 2],
          [2, -1],
          [2, 1]
        ]
        for (const [dr, dc] of offs) if (i + dr === kingPos.r && j + dc === kingPos.c) return true
      } else if (type === 'B' || type === 'R' || type === 'Q') {
        const dirs = []
        if (type === 'B' || type === 'Q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1])
        if (type === 'R' || type === 'Q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1])
        for (const [dr, dc] of dirs) {
          let nr = i + dr
          let nc = j + dc
          while (isOnBoard(nr, nc)) {
            if (nr === kingPos.r && nc === kingPos.c) return true
            if (boardRef[nr][nc]) break
            nr += dr
            nc += dc
          }
        }
      } else if (type === 'K') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) if (i + dr === kingPos.r && j + dc === kingPos.c) return true
      }
    }
  }
  return false
}

// helper to detect if a move was en-passant (simple heuristic: destination empty before move and pawn moved diagonally)
function moveMetaFlag(from, to) {
  // If moved diagonally and destination was empty just after move, it's likely en-passant.
  const dr = Math.abs(to.r - from.r)
  const dc = Math.abs(to.c - from.c)
  if (dr === 1 && dc === 1 && board[to.r][to.c] && board[to.r][to.c][1] === 'P') return false
  // Hard to detect here; return false by default. Detailed en-passant handled in performMove.
  return false
}

function wouldLeaveKingInCheck(from, mv) {
  const b = cloneBoard(board)
  const moving = b[from.r][from.c]
  // apply move on b
  // handle en-passant capture
  if (mv.enPassant) {
    // captured pawn is on same row as from, column mv.c
    const capR = from.r
    const capC = mv.c
    b[capR][capC] = null
  }
  // handle castling rook move
  if (mv.castle && moving[1] === 'K') {
    if (mv.c === 6) {
      // king side
      b[mv.r][mv.c] = moving
      b[from.r][from.c] = null
      // move rook from 7 to 5
      b[from.r][5] = b[from.r][7]
      b[from.r][7] = null
    } else if (mv.c === 2) {
      b[mv.r][mv.c] = moving
      b[from.r][from.c] = null
      b[from.r][3] = b[from.r][0]
      b[from.r][0] = null
    }
  } else {
    b[mv.r][mv.c] = moving
    b[from.r][from.c] = null
  }
  return isInCheck(moving[0], b)
}

// Public initialization called by the main game when a 'battle' starts
function initBattle() {
  // Start the chessboard scene
  chessActive = true
  resetGameState()
  setupInitialPosition()
  selected = null
  if (chessAnimationId) cancelAnimationFrame(chessAnimationId)
  animateChess()
}

function animateBattle() {
  // kept for compatibility; just call initBattle
  initBattle()
}

// Mouse selection
canvas.addEventListener('click', (e) => {
  if (!chessActive) return
  if (promotionPending) return
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const bc = screenToBoard(x, y)
  if (!bc) return
  const { r, c } = bc
  const clicked = board[r][c]
  if (selected) {
    const legal = getLegalMoves(selected.r, selected.c)
    const mv = legal.find((m) => m.r === r && m.c === c)
    if (mv) {
      performMove({ r: selected.r, c: selected.c }, { r, c }, mv)
      selected = null
      return
    }

    // clicking a friendly piece changes selection; clicking empty/different deselects
    if (clicked && clicked[0] === board[selected.r][selected.c][0]) {
      selected = { r, c }
    } else if (clicked && clicked[0] === sideToMove) {
      // switch to another friendly piece
      selected = { r, c }
    } else {
      selected = null
    }
  } else {
    // only allow selecting your side's pieces
    if (clicked && clicked[0] === sideToMove) selected = { r, c }
  }
})

// WASD movement for the selected piece
window.addEventListener('keydown', (e) => {
  if (!chessActive) return
  if (promotionPending) return
  if (!selected) return
  const key = e.key.toLowerCase()
  const delta = { r: 0, c: 0 }
  if (key === 'w') delta.r = -1
  else if (key === 's') delta.r = 1
  else if (key === 'a') delta.c = -1
  else if (key === 'd') delta.c = 1
  else return

  const nr = selected.r + delta.r
  const nc = selected.c + delta.c
  if (nr < 0 || nr >= tileCount || nc < 0 || nc >= tileCount) return
  const legal = getLegalMoves(selected.r, selected.c)
  const mv = legal.find((m) => m.r === nr && m.c === nc)
  if (!mv) return
  performMove({ r: selected.r, c: selected.c }, { r: nr, c: nc }, mv)
  selected = null
})

// Allow exiting the chess scene by pressing Escape (restores previous game flow)
window.addEventListener('keydown', (e) => {
  if (promotionPending) return
  if (e.key === 'Escape' && chessActive) {
    chessActive = false
    if (chessAnimationId) cancelAnimationFrame(chessAnimationId)
    // clear board area
    c.clearRect(0, 0, canvas.width, canvas.height)
  }
})

// performMove: applies a move, handles en-passant, castling, promotion, and updates history/rights
function performMove(from, to, moveMeta = null) {
  const moving = board[from.r][from.c]
  if (!moving) return
  const color = moving[0]

  // determine if this was an en-passant capture
  const isEnPassant = moveMeta && moveMeta.enPassant

  // handle castling
  const isCastle = moveMeta && moveMeta.castle

  // move piece
  if (isEnPassant) {
    // remove the pawn that moved two squares last turn (it sits on from.r)
    const capR = from.r
    const capC = to.c
    board[capR][capC] = null
    board[to.r][to.c] = moving
    board[from.r][from.c] = null
  } else if (isCastle && moving[1] === 'K') {
    // king-side
    if (to.c === 6) {
      board[to.r][to.c] = moving
      board[from.r][from.c] = null
      // rook from 7 to 5
      board[from.r][5] = board[from.r][7]
      board[from.r][7] = null
    } else if (to.c === 2) {
      board[to.r][to.c] = moving
      board[from.r][from.c] = null
      board[from.r][3] = board[from.r][0]
      board[from.r][0] = null
    }
  } else {
    board[to.r][to.c] = moving
    board[from.r][from.c] = null
  }
  // handle promotion: if this was a pawn reaching last rank
  const isPromotion = moving[1] === 'P' && ((color === 'w' && to.r === 0) || (color === 'b' && to.r === 7))
  if (isPromotion) {
    // If human's move, show chooser, else AI auto-promotes to queen
    if (color === humanSide) {
      promotionPending = true
      showPromotionChooser(color, to, (choice) => {
        board[to.r][to.c] = color + choice // choice is one of 'Q','R','B','N'
        promotionPending = false
        finalizeMove(from, to, moving)
      })
      return
    } else {
      // AI promotes to queen automatically
      board[to.r][to.c] = color + 'Q'
    }
  }

  // otherwise finalize immediately
  finalizeMove(from, to, moving)
}

function finalizeMove(from, to, moving) {
  // update castling rights
  if (moving === 'wK') {
    castlingRights.wK = false
    castlingRights.wQ = false
  }
  if (moving === 'bK') {
    castlingRights.bK = false
    castlingRights.bQ = false
  }
  // rook moved from original squares disables respective rights
  if (from.r === 7 && from.c === 0) castlingRights.wQ = false
  if (from.r === 7 && from.c === 7) castlingRights.wK = false
  if (from.r === 0 && from.c === 0) castlingRights.bQ = false
  if (from.r === 0 && from.c === 7) castlingRights.bK = false

  // set lastMove info
  const double = moving[1] === 'P' && Math.abs(to.r - from.r) === 2
  lastMove = { piece: moving, from: { r: from.r, c: from.c }, to: { r: to.r, c: to.c }, double }
  moveHistory.push(lastMove)
  // At this point the board already reflects the move. Build a detailed history entry for undo.
  const capturedPiece = null // placeholder; we can infer captured from lastMove context in more complex flows
  const detail = {
    piece: moving,
    from: { r: from.r, c: from.c },
    to: { r: to.r, c: to.c },
    double: lastMove ? lastMove.double : false,
    captured: capturedPiece,
    enPassant: moveMetaFlag(from, to),
    castle: null,
    promotion: null,
    prevCastlingRights: null,
    prevLastMove: lastMove
  }
  // store previous castling rights snapshot
  detail.prevCastlingRights = { ...castlingRights }
  moveHistoryDetailed.push(detail)

  // flip side to move
  const movingColor = moving[0]
  sideToMove = movingColor === 'w' ? 'b' : 'w'

  // check for check / checkmate on the side to move
  if (isInCheck(sideToMove)) {
    statusMessage = `${sideToMove === 'w' ? 'White' : 'Black'} is in check`
    statusTimestamp = Date.now()
    // checkmate?
    if (isCheckmate(sideToMove)) {
      const winner = movingColor === 'w' ? 'White' : 'Black'
      statusMessage = `Checkmate — ${winner} wins`
      statusTimestamp = Date.now()
      chessActive = false
      if (chessAnimationId) cancelAnimationFrame(chessAnimationId)
    }
  } else {
    // if not in check, clear status after short time
    statusMessage = ''
    statusTimestamp = 0
    // also detect stalemate
    if (!hasAnyLegalMoves(sideToMove)) {
      statusMessage = `Stalemate — draw`
      statusTimestamp = Date.now()
      chessActive = false
      if (chessAnimationId) cancelAnimationFrame(chessAnimationId)
    }
  }

  // update UI move history panel if present
  refreshMoveHistoryUI()

  // schedule AI move if enabled and it's AI's turn
  if (aiEnabled && sideToMove === aiSide && chessActive) {
    aiThinking = true
    setTimeout(() => {
      aiMakeMove()
      aiThinking = false
    }, 300)
  }
}

// Small helper so clicking the dialogue box behavior from original code doesn't error
document.querySelectorAll('#dialogueBox').forEach((el) => {
  el.addEventListener('click', () => {})
})

// Expose functions in global scope so `index.js` can call them like before
window.initBattle = initBattle
window.animateBattle = animateBattle

// --- UI: move history panel and controls ---
function ensureControls() {
  const wrapper = document.querySelector('canvas').parentElement
  if (document.querySelector('#chessControls')) return

  const panel = document.createElement('div')
  panel.id = 'chessControls'
  panel.style.position = 'absolute'
  panel.style.right = '8px'
  panel.style.top = '8px'
  panel.style.background = 'white'
  panel.style.border = '4px solid black'
  panel.style.padding = '8px'
  panel.style.fontFamily = "'Press Start 2P', cursive"
  panel.style.fontSize = '10px'
  panel.style.zIndex = 9998
  panel.style.maxWidth = '260px'
  panel.style.display = 'flex'
  panel.style.flexDirection = 'column'
  panel.style.gap = '6px'

  const undoBtn = document.createElement('button')
  undoBtn.textContent = 'Undo'
  undoBtn.addEventListener('click', () => undoMove())

  const undoFullBtn = document.createElement('button')
  undoFullBtn.textContent = 'Undo Full Turn'
  undoFullBtn.addEventListener('click', () => undoFullTurn())

  const toggleAI = document.createElement('button')
  toggleAI.textContent = aiEnabled ? 'AI: On' : 'AI: Off'
  toggleAI.addEventListener('click', () => {
    aiEnabled = !aiEnabled
    toggleAI.textContent = aiEnabled ? 'AI: On' : 'AI: Off'
  })

  const movesBox = document.createElement('div')
  movesBox.id = 'movesBox'
  movesBox.style.maxHeight = '220px'
  movesBox.style.overflow = 'auto'
  movesBox.style.borderTop = '2px solid #ccc'
  movesBox.style.paddingTop = '6px'

  panel.appendChild(undoBtn)
  panel.appendChild(undoFullBtn)
  panel.appendChild(toggleAI)
  panel.appendChild(movesBox)
  wrapper.appendChild(panel)
}

function refreshMoveHistoryUI() {
  ensureControls()
  const movesBox = document.querySelector('#movesBox')
  if (!movesBox) return
  movesBox.replaceChildren()
  moveHistoryDetailed.forEach((m, i) => {
    const el = document.createElement('div')
    el.textContent = `${i + 1}. ${m.piece} ${String.fromCharCode(97 + m.from.c)}${8 - m.from.r}→${String.fromCharCode(97 + m.to.c)}${8 - m.to.r}`
    movesBox.appendChild(el)
  })
}

// Undo functions
function undoMove() {
  if (moveHistoryDetailed.length === 0 || aiThinking || promotionPending) return
  const last = moveHistoryDetailed.pop()
  // revert board
  const { piece, from, to, captured, enPassant, castle, promotion, prevCastlingRights, prevLastMove } = last
  // if promotion occurred, revert promoted piece back to pawn
  if (promotion) {
    board[from.r][from.c] = piece // pawn as stored
    board[to.r][to.c] = captured || null
  } else if (enPassant) {
    // revert en-passant: moving pawn back, restore captured pawn
    board[from.r][from.c] = piece
    board[to.r][to.c] = null
    const capR = from.r
    const capC = to.c
    board[capR][capC] = captured
  } else if (castle) {
    // move king back and rook back
    board[from.r][from.c] = piece
    board[to.r][to.c] = null
    if (castle === 'K') {
      board[from.r][7] = board[from.r][5]
      board[from.r][5] = null
    } else if (castle === 'Q') {
      board[from.r][0] = board[from.r][3]
      board[from.r][3] = null
    }
  } else {
    board[from.r][from.c] = piece
    board[to.r][to.c] = captured || null
  }
  // restore castling rights & lastMove
  if (prevCastlingRights) {
    castlingRights.wK = prevCastlingRights.wK
    castlingRights.wQ = prevCastlingRights.wQ
    castlingRights.bK = prevCastlingRights.bK
    castlingRights.bQ = prevCastlingRights.bQ
  }
  lastMove = prevLastMove || null
  // flip side back
  sideToMove = piece[0]
  refreshMoveHistoryUI()
}

function undoFullTurn() {
  // undo last two ply if possible
  undoMove()
  undoMove()
}

// AI: simple move chooser (prefer captures)
function getAllLegalMovesForColor(color) {
  const moves = []
  for (let r = 0; r < tileCount; r++) {
    for (let c = 0; c < tileCount; c++) {
      const code = board[r][c]
      if (!code || code[0] !== color) continue
      const legal = getLegalMoves(r, c)
      for (const mv of legal) moves.push({ from: { r, c }, to: mv })
    }
  }
  return moves
}

function aiMakeMove() {
  if (!aiEnabled || sideToMove !== aiSide || !chessActive) return
  const moves = getAllLegalMovesForColor(aiSide)
  if (moves.length === 0) return
  // prefer captures
  const captureMoves = moves.filter((m) => {
    const dest = board[m.to.r][m.to.c]
    return dest !== null || m.to.enPassant
  })
  const pool = captureMoves.length > 0 ? captureMoves : moves
  const choice = pool[Math.floor(Math.random() * pool.length)]
  performMove(choice.from, choice.to, choice.to)
  refreshMoveHistoryUI()
}
// Promotion chooser UI (styled to match pixel font in index.html)
function showPromotionChooser(color, to, cb) {
  const wrapper = document.querySelector('canvas').parentElement
  const modal = document.createElement('div')
  modal.id = 'promotionModal'
  modal.style.position = 'absolute'
  modal.style.left = '50%'
  modal.style.top = '50%'
  modal.style.transform = 'translate(-50%, -50%)'
  modal.style.background = 'white'
  modal.style.border = '4px solid black'
  modal.style.padding = '12px'
  modal.style.display = 'flex'
  modal.style.gap = '8px'
  modal.style.zIndex = 9999
  modal.style.fontFamily = "'Press Start 2P', cursive"
  modal.style.fontSize = '12px'

  const title = document.createElement('div')
  title.textContent = 'Promote to:'
  title.style.width = '100%'
  title.style.textAlign = 'center'
  title.style.marginBottom = '8px'
  title.style.fontSize = '12px'
  title.style.alignSelf = 'flex-start'

  const options = ['Q', 'R', 'B', 'N']
  const container = document.createElement('div')
  container.style.display = 'flex'

  options.forEach((opt) => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.style.padding = '8px 12px'
    btn.style.cursor = 'pointer'
    btn.style.border = '2px solid black'
    btn.style.background = 'white'
    btn.style.fontFamily = "'Press Start 2P', cursive"
    btn.style.fontSize = '14px'
    btn.style.display = 'flex'
    btn.style.flexDirection = 'column'
    btn.style.alignItems = 'center'
    btn.style.justifyContent = 'center'
    btn.style.minWidth = '64px'

    const glyph = document.createElement('div')
    const code = color + opt
    glyph.textContent = pieces[code] || opt
    glyph.style.fontSize = '28px'
    glyph.style.lineHeight = '28px'
    glyph.style.marginBottom = '6px'

    const label = document.createElement('div')
    label.textContent = opt === 'Q' ? 'Queen' : opt === 'R' ? 'Rook' : opt === 'B' ? 'Bishop' : 'Knight'
    label.style.fontSize = '10px'

    btn.appendChild(glyph)
    btn.appendChild(label)

    btn.addEventListener('click', () => {
      modal.remove()
      cb(opt)
    })
    container.appendChild(btn)
  })

  // assemble modal
  modal.appendChild(title)
  modal.appendChild(container)
  wrapper.appendChild(modal)
}
